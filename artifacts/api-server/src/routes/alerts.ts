/**
 * Alerts routes
 *
 * POST /alerts/register — register a device's Expo push token
 * GET  /alerts/tokens   — list registered push tokens (internal use)
 */

import { Router } from "express";
import { logger } from "../lib/logger.js";

const router = Router();

interface PushRegistration {
  token: string;
  deviceId: string;
  registeredAt: number;
}

/** In-memory push token registry (replace with DB for production). */
const pushRegistry = new Map<string, PushRegistration>();

router.post("/alerts/register", (req, res) => {
  const { token, deviceId } = req.body as { token?: string; deviceId?: string };

  if (!token || !deviceId) {
    res.status(400).json({ error: "token and deviceId are required" });
    return;
  }

  pushRegistry.set(deviceId, { token, deviceId, registeredAt: Date.now() });
  logger.info({ deviceId }, "Push token registered");
  res.json({ ok: true });
});

router.get("/alerts/tokens", (_req, res) => {
  res.json({ tokens: Array.from(pushRegistry.values()) });
});

/** Returns all registered push tokens — used by the staleness scanner to send alerts. */
export function getRegisteredTokens(): PushRegistration[] {
  return Array.from(pushRegistry.values());
}

export default router;
