/**
 * Device routes
 *
 * GET  /devices          — list all known device positions
 * GET  /devices/names    — map of Traccar uniqueId → human name (#19)
 * POST /devices/position — accept a position update (used by mobile background task)
 */

import { Router } from "express";
import { storePosition, getAllPositions } from "../ws/positionStore.js";
import { recordPosition } from "../ws/deviceStaleness.js";
import { broadcastPosition } from "../ws/broadcast.js";
import { getDeviceNames } from "../ws/geofencePoller.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.get("/devices", (_req, res) => {
  res.json({ devices: getAllPositions() });
});

/**
 * Returns friendly device names from the Traccar cache so the mobile app
 * can display human-readable labels instead of raw device IDs. (#19)
 *
 * Response: { names: { [traccarUniqueId]: "Human Name", … } }
 */
router.get("/devices/names", (_req, res) => {
  res.json({ names: getDeviceNames() });
});

router.post("/devices/position", (req, res) => {
  const { deviceId, lat, lng, speed = 0, heading = 0, ts } = req.body as {
    deviceId?: string;
    lat?: number;
    lng?: number;
    speed?: number;
    heading?: number;
    ts?: number;
  };

  if (!deviceId || lat == null || lng == null) {
    res.status(400).json({ error: "deviceId, lat, and lng are required" });
    return;
  }

  const timestamp = ts ?? Date.now();

  storePosition({ deviceId, lat, lng, speed, heading, ts: timestamp });
  recordPosition(deviceId);

  // Re-broadcast the position to all WS clients so the live map updates
  broadcastPosition(deviceId, lat, lng, speed, heading, timestamp);

  logger.info({ deviceId, lat, lng }, "Position update received (HTTP) — broadcast to WS clients");
  res.json({ ok: true, ts: timestamp });
});

export default router;
