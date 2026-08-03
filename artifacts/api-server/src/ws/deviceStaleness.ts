/**
 * deviceStaleness.ts
 *
 * Tracks the last-seen timestamp of each device and broadcasts a
 * `deviceStale` WebSocket event when a device hasn't reported in
 * STALE_THRESHOLD_MS milliseconds.
 *
 * Also sends Expo push notifications to all registered devices (#38).
 *
 * This module is intentionally decoupled from the Traccar transport:
 * call `recordPosition(deviceId)` whenever a position update arrives.
 */

import { WebSocket, WebSocketServer } from "ws";
import { logger } from "../lib/logger.js";
import { sendPushNotifications } from "../lib/pushNotifications.js";
import { getRegisteredTokens } from "../routes/alerts.js";

/** How long with no position update before a device is considered stale (ms). */
export const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/** How often to scan for newly-stale devices (ms). */
const SCAN_INTERVAL_MS = 30 * 1000; // 30 seconds

// ─── Internal state ──────────────────────────────────────────────────────────

/** epoch-ms of the last received position for each device id */
const lastSeenMap = new Map<string, number>();

/** device ids that have already been flagged stale (avoid repeat broadcasts) */
const staleSet = new Set<string>();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Call this every time a position update arrives for a device.
 * Clears any prior `stale` flag so that the device recovers gracefully.
 */
export function recordPosition(deviceId: string): void {
  lastSeenMap.set(deviceId, Date.now());
  if (staleSet.has(deviceId)) {
    staleSet.delete(deviceId);
    logger.info({ deviceId }, "Device recovered from stale state");
  }
}

/**
 * Returns the last-seen timestamp for a device, or `null` if unknown.
 */
export function getLastSeen(deviceId: string): number | null {
  return lastSeenMap.get(deviceId) ?? null;
}

/**
 * Starts the periodic staleness scan.
 * Broadcasts `deviceStale` events to all connected WS clients.
 * Returns a cleanup function that stops the interval.
 */
export function startStalenessScanner(wss: WebSocketServer): () => void {
  const intervalId = setInterval(() => scan(wss), SCAN_INTERVAL_MS);
  logger.info(
    { thresholdMs: STALE_THRESHOLD_MS, scanIntervalMs: SCAN_INTERVAL_MS },
    "Device staleness scanner started",
  );
  return () => clearInterval(intervalId);
}

// ─── Internal ────────────────────────────────────────────────────────────────

function scan(wss: WebSocketServer): void {
  const now = Date.now();
  for (const [deviceId, lastSeen] of lastSeenMap.entries()) {
    const age = now - lastSeen;
    if (age >= STALE_THRESHOLD_MS && !staleSet.has(deviceId)) {
      staleSet.add(deviceId);
      broadcastDeviceStale(wss, deviceId, lastSeen);
    }
  }
}

interface DeviceStalePayload {
  type: "deviceStale";
  deviceId: string;
  lastSeenAt: number; // epoch ms
  staleForMs: number;
}

function broadcastDeviceStale(
  wss: WebSocketServer,
  deviceId: string,
  lastSeenAt: number,
): void {
  const payload: DeviceStalePayload = {
    type: "deviceStale",
    deviceId,
    lastSeenAt,
    staleForMs: Date.now() - lastSeenAt,
  };
  const message = JSON.stringify(payload);

  let sent = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sent++;
    }
  });

  logger.warn(
    { deviceId, lastSeenAt, staleForMs: payload.staleForMs, clientsNotified: sent },
    "deviceStale broadcast",
  );

  // ── Push notifications for stale alerts (#38) ─────────────────────────────
  const tokens = getRegisteredTokens();
  if (tokens.length > 0) {
    sendPushNotifications(
      tokens.map((t) => ({
        to: t.token,
        title: "⚠ Vehicle Signal Lost",
        body: `${deviceId} has not reported GPS in over 5 minutes.`,
        data: { type: "stale", deviceId },
        sound: "default" as const,
      }))
    );
  }
}
