import { config } from '../config.js'

const BASE = config.traccar.url
const AUTH = Buffer.from(`${config.traccar.email}:${config.traccar.password}`).toString('base64')

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${AUTH}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Traccar ${path} → HTTP ${res.status}`)
  if (res.status === 204) return null
  return res.json()
}

// ─── Devices ───────────────────────────────────────────────────────────────

export async function getAllDevices() {
  return req('/api/devices')
}

export async function createDevice({ name, imei, protocol = 'GT06' }) {
  return req('/api/devices', {
    method: 'POST',
    body: JSON.stringify({ name, uniqueId: imei }),
  })
}

// ─── Positions ─────────────────────────────────────────────────────────────

export async function getAllPositions() {
  return req('/api/positions')
}

export async function getHistory(traccarId, from, to) {
  if (!traccarId) return []
  const f = from || new Date(Date.now() - 24 * 3600000).toISOString()
  const t = to   || new Date().toISOString()
  return req(`/api/positions?deviceId=${traccarId}&from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`)
}

// ─── Trips ─────────────────────────────────────────────────────────────────

export async function getTrips(traccarId, from, to) {
  if (!traccarId) return []
  const f = from || new Date(Date.now() - 30 * 24 * 3600000).toISOString()
  const t = to   || new Date().toISOString()
  try {
    return await req(`/api/reports/trips?deviceId=${traccarId}&from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`)
  } catch { return [] }
}

// ─── Commands ──────────────────────────────────────────────────────────────

export async function sendCommand(traccarId, type) {
  if (!traccarId) throw new Error('No Traccar device ID')
  return req('/api/commands/send', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: traccarId,
      type,
      attributes: {},
    }),
  })
}

// ─── Geofences ─────────────────────────────────────────────────────────────

export async function createGeofence(traccarId, { lat, lng, radius = 500, name = 'Geofence' }) {
  if (!traccarId) throw new Error('No Traccar device ID')
  const area = `CIRCLE (${lat} ${lng}, ${radius})`
  const gf = await req('/api/geofences', {
    method: 'POST',
    body: JSON.stringify({ name, area }),
  })
  // Link geofence to device
  await req('/api/permissions', {
    method: 'POST',
    body: JSON.stringify({ deviceId: traccarId, geofenceId: gf.id }),
  })
  return gf
}
