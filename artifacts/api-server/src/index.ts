import { createServer } from "http";
import { WebSocketServer } from "ws";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { startStalenessScanner, recordPosition } from "./ws/deviceStaleness.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Wrap Express in an HTTP server so we can attach WebSocket on the same port.
const httpServer = createServer(app);

// ─── WebSocket bridge ────────────────────────────────────────────────────────
//
// Clients connect to ws://<host>/ws.
// Supported inbound messages:
//   { type: "position", deviceId: string, lat: number, lng: number }
//
// Outbound messages:
//   { type: "position", deviceId, lat, lng, ts }
//   { type: "deviceStale", deviceId, lastSeenAt, staleForMs }
//
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  logger.info({ ip }, "WebSocket client connected");

  ws.on("message", (raw) => {
    let msg: unknown;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    if (
      typeof msg === "object" &&
      msg !== null &&
      "type" in msg &&
      (msg as { type: unknown }).type === "position"
    ) {
      const { deviceId, lat, lng } = msg as {
        type: string;
        deviceId: string;
        lat: number;
        lng: number;
      };

      if (!deviceId) {
        ws.send(JSON.stringify({ type: "error", message: "deviceId is required" }));
        return;
      }

      // Record the arrival time for staleness tracking
      recordPosition(deviceId);

      // Broadcast the position to all connected clients
      const outbound = JSON.stringify({ type: "position", deviceId, lat, lng, ts: Date.now() });
      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(outbound);
        }
      });
    }
  });

  ws.on("close", () => {
    logger.info({ ip }, "WebSocket client disconnected");
  });

  ws.on("error", (err) => {
    logger.error({ err, ip }, "WebSocket error");
  });

  // Acknowledge connection
  ws.send(JSON.stringify({ type: "connected", ts: Date.now() }));
});

// Start staleness scanner — broadcasts `deviceStale` events when a device
// has not reported a position within STALE_THRESHOLD_MS.
const stopScanner = startStalenessScanner(wss);

// ─── Start server ────────────────────────────────────────────────────────────

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening (HTTP + WebSocket)");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  stopScanner();
  httpServer.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});
