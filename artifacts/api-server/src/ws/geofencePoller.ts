/**
 * geofencePoller.ts
 *
 * Polls the Traccar REST API for geofence enter/exit events and broadcasts
 * them to all connected WebSocket clients via `broadcastGeofenceAlert`.
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
import { broadcastGeofenceAlert, type GeofenceAlertPayload } from "./broadcast.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const TRACCAR_URL = process.env["TRACCAR_URL"]?.replace(/\/$/, "");
const TRACCAR_EMAIL = process.env["TRACCAR_EMAIL"];
const TRACCAR_PASSWORD = process.env["TRACCAR_PASSWORD"];

/** How often to poll Traccar for new events (ms). */
const POLL_INTERVAL_MS = 15_000;

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

    logger.info(
      { deviceId, deviceName, eventType, geofenceName, ts },
      "geofenceAlert broadcast"
    );
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
    poll().catch((err) => logger.warn({ err }, "Geofence poller: poll failed"));
  }, POLL_INTERVAL_MS);

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS, traccarUrl: TRACCAR_URL }, "Geofence poller started");

  return () => clearInterval(intervalId);
}
