/**
 * geofencePoller.ts
 *
 * Polls the Traccar REST API for geofence enter/exit events and broadcasts
 * them to all connected WebSocket clients via `broadcastGeofenceAlert`.
 *
 * Also:
 *   - Tracks Traccar connection health and broadcasts `traccarStatus` events
 *     when the backend loses / recovers the Traccar connection (#20).
 *   - Exports `getDeviceNames()` so REST routes can serve friendly device
 *     names to the mobile app (#19).
 *   - Sends Expo push notifications for geofence alerts (#38).
 *
 * Required environment variables (set via Replit Secrets):
 *   TRACCAR_URL      — base URL of the Traccar server, e.g. https://demo.traccar.org
 *   TRACCAR_EMAIL    — Traccar account email
 *   TRACCAR_PASSWORD — Traccar account password
 *
 * When any of these are absent the poller starts in no-op mode (logs a
 * warning and returns immediately).  This lets the rest of the server run
 * fine during development without a live Traccar instance.
 */

import { logger } from "../lib/logger.js";
import { broadcastGeofenceAlert, broadcastTraccarStatus, type GeofenceAlertPayload } from "./broadcast.js";
import { sendPushNotifications } from "../lib/pushNotifications.js";
import { getRegisteredTokens } from "../routes/alerts.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const TRACCAR_URL = process.env["TRACCAR_URL"]?.replace(/\/$/, "");
const TRACCAR_EMAIL = process.env["TRACCAR_EMAIL"];
const TRACCAR_PASSWORD = process.env["TRACCAR_PASSWORD"];

/** How often to poll Traccar for new events (ms). */
const POLL_INTERVAL_MS = 15_000;

/** How many consecutive poll failures before declaring Traccar disconnected. */
const FAILURE_THRESHOLD = 3;

// ─── Health tracking (#20) ───────────────────────────────────────────────────

let consecutiveFailures = 0;
let traccarIsConnected = true; // optimistic until first failure

/** Returns the last-known Traccar connection state (for new WS clients). */
export function isTraccarConnected(): boolean {
  return traccarIsConnected;
}

// ─── In-memory event de-duplication ──────────────────────────────────────────

/** Set of Traccar event IDs we have already processed this session. */
const seenEventIds = new Set<number>();

// ─── Traccar response shapes (subset) ────────────────────────────────────────

interface TraccarEvent {
  id: number;
  deviceId: number;
  type: string;         // "geofenceEnter" | "geofenceExit" | …
  eventTime: string;    // ISO-8601
  geofenceId?: number;
}

interface TraccarDevice {
  id: number;
  uniqueId: string;     // the string identifier sent by the GPS unit
  name: string;
}

interface TraccarGeofence {
  id: number;
  name: string;
}

// ─── Cached name lookup tables ────────────────────────────────────────────────

/** Traccar numeric deviceId → { uniqueId, name } */
const deviceCache = new Map<number, TraccarDevice>();
/** Traccar numeric geofenceId → name */
const geofenceCache = new Map<number, string>();

// ─── Public: device name export (#19) ────────────────────────────────────────

/**
 * Returns a map of Traccar uniqueId → human-readable name.
 * Used by the /api/devices/names REST endpoint so the mobile app can label
 * unknown devices with their Traccar names.
 */
export function getDeviceNames(): Record<string, string> {
  const names: Record<string, string> = {};
  for (const device of deviceCache.values()) {
    names[device.uniqueId] = device.name;
  }
  return names;
}

// ─── Timestamp tracking ──────────────────────────────────────────────────────

/** Epoch-ms of the last successful poll; used as the `from` parameter. */
let lastPollAt: number = Date.now() - POLL_INTERVAL_MS;

// ─── Auth header ─────────────────────────────────────────────────────────────

function basicAuthHeader(): string {
  const cred = `${TRACCAR_EMAIL}:${TRACCAR_PASSWORD}`;
  return "Basic " + Buffer.from(cred).toString("base64");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${TRACCAR_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: basicAuthHeader(),
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Traccar ${path} responded ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Refresh device list into cache. */
async function refreshDevices(): Promise<void> {
  const devices = await fetchJson<TraccarDevice[]>("/api/devices");
  for (const d of devices) {
    deviceCache.set(d.id, d);
  }
}

/** Refresh geofence list into cache. */
async function refreshGeofences(): Promise<void> {
  const geofences = await fetchJson<TraccarGeofence[]>("/api/geofences");
  for (const g of geofences) {
    geofenceCache.set(g.id, g.name);
  }
}

// ─── Main poll cycle ──────────────────────────────────────────────────────────

async function poll(): Promise<void> {
  const from = new Date(lastPollAt).toISOString();
  const to = new Date().toISOString();
  lastPollAt = Date.now();

  const events = await fetchJson<TraccarEvent[]>(
    `/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&type=geofenceEnter&type=geofenceExit`
  );

  // ── Health recovery (#20) ─────────────────────────────────────────────────
  consecutiveFailures = 0;
  if (!traccarIsConnected) {
    traccarIsConnected = true;
    broadcastTraccarStatus(true);
    logger.info("Traccar connection recovered");
  }

  if (events.length === 0) return;

  // Refresh lookup caches lazily when we encounter unknown IDs.
  let devicesDirty = false;
  let geofencesDirty = false;
  for (const ev of events) {
    if (!deviceCache.has(ev.deviceId)) devicesDirty = true;
    if (ev.geofenceId != null && !geofenceCache.has(ev.geofenceId)) geofencesDirty = true;
  }
  if (devicesDirty) await refreshDevices();
  if (geofencesDirty) await refreshGeofences();

  for (const ev of events) {
    if (seenEventIds.has(ev.id)) continue;
    seenEventIds.add(ev.id);

    if (ev.type !== "geofenceEnter" && ev.type !== "geofenceExit") continue;
    if (ev.geofenceId == null) continue;

    const device = deviceCache.get(ev.deviceId);
    const geofenceName = geofenceCache.get(ev.geofenceId) ?? `Zone #${ev.geofenceId}`;
    const deviceId = device?.uniqueId ?? String(ev.deviceId);
    const deviceName = device?.name ?? deviceId;
    const eventType: "enter" | "exit" = ev.type === "geofenceEnter" ? "enter" : "exit";
    const ts = new Date(ev.eventTime).getTime();

    const payload: GeofenceAlertPayload = {
      type: "geofenceAlert",
      eventType,
      deviceId,
      deviceName,
      geofenceId: ev.geofenceId,
      geofenceName,
      ts,
    };

    broadcastGeofenceAlert(payload);

    // ── Push notifications for geofence alerts (#38) ───────────────────────
    const tokens = getRegisteredTokens();
    if (tokens.length > 0) {
      const verb = eventType === "enter" ? "entered" : "exited";
      sendPushNotifications(
        tokens.map((t) => ({
          to: t.token,
          title: `📍 Geofence Alert`,
          body: `${deviceName} ${verb} ${geofenceName}`,
          data: { type: "geofence", deviceId, eventType, geofenceName },
          sound: "default" as const,
        }))
      );
    }

    logger.info(
      { deviceId, deviceName, eventType, geofenceName, ts },
      "geofenceAlert broadcast"
    );
  }
}

// ─── Health failure handler (#20) ─────────────────────────────────────────────

function handlePollFailure(err: unknown): void {
  consecutiveFailures++;
  logger.warn({ err, consecutiveFailures }, "Geofence poller: poll failed");

  if (consecutiveFailures >= FAILURE_THRESHOLD && traccarIsConnected) {
    traccarIsConnected = false;
    const reason = err instanceof Error ? err.message : String(err);
    broadcastTraccarStatus(false, reason);
    logger.warn({ reason }, "Traccar marked as disconnected");
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Starts the geofence event poller.
 * Returns a cleanup function that stops the interval.
 */
export function startGeofencePoller(): () => void {
  if (!TRACCAR_URL || !TRACCAR_EMAIL || !TRACCAR_PASSWORD) {
    logger.warn(
      "TRACCAR_URL / TRACCAR_EMAIL / TRACCAR_PASSWORD not set — geofence poller disabled"
    );
    return () => {};
  }

  // Warm up caches on first run, then start polling.
  Promise.all([refreshDevices(), refreshGeofences()]).catch((err) =>
    logger.warn({ err }, "Geofence poller: initial cache warm-up failed")
  );

  const intervalId = setInterval(() => {
    poll().catch(handlePollFailure);
  }, POLL_INTERVAL_MS);

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS, traccarUrl: TRACCAR_URL }, "Geofence poller started");

  return () => clearInterval(intervalId);
}
