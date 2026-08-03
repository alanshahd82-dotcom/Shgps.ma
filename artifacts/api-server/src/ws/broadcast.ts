/**
 * broadcast.ts
 *
 * Shared singleton that lets any module (HTTP routes, WS handler, scanners)
 * broadcast a WebSocket event to all connected clients.
 *
 * Call `setWss(wss)` once after the WebSocketServer is created in index.ts.
 */

import { WebSocket, WebSocketServer } from "ws";

let _wss: WebSocketServer | null = null;

export function setWss(wss: WebSocketServer): void {
  _wss = wss;
}

export function broadcastPosition(
  deviceId: string,
  lat: number,
  lng: number,
  speed: number,
  heading: number,
  ts: number
): void {
  if (!_wss) return;
  const msg = JSON.stringify({ type: "position", deviceId, lat, lng, speed, heading, ts });
  _wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

export interface GeofenceAlertPayload {
  type: "geofenceAlert";
  eventType: "enter" | "exit";
  deviceId: string;
  deviceName: string;
  geofenceId: number;
  geofenceName: string;
  ts: number;
}

/**
 * Broadcast a geofence enter/exit event to all connected WebSocket clients.
 */
export function broadcastGeofenceAlert(payload: GeofenceAlertPayload): void {
  if (!_wss) return;
  const msg = JSON.stringify(payload);
  _wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// ── Traccar health status ─────────────────────────────────────────────────────

export interface TraccarStatusPayload {
  type: "traccarStatus";
  connected: boolean;
  reason?: string;
  ts: number;
}

/**
 * Broadcast the Traccar connection health to all connected WS clients.
 * Call this when the backend detects Traccar has gone away or recovered.
 */
export function broadcastTraccarStatus(
  connected: boolean,
  reason?: string | null
): void {
  if (!_wss) return;
  const payload: TraccarStatusPayload = {
    type: "traccarStatus",
    connected,
    ts: Date.now(),
    ...(reason != null ? { reason } : {}),
  };
  const msg = JSON.stringify(payload);
  _wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

/**
 * Send the current Traccar status to a single newly-connected client.
 * Call on `wss.on("connection")` so the client learns the state immediately.
 */
export function sendTraccarStatusToClient(
  ws: WebSocket,
  connected: boolean
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const payload: TraccarStatusPayload = {
    type: "traccarStatus",
    connected,
    ts: Date.now(),
  };
  ws.send(JSON.stringify(payload));
}
