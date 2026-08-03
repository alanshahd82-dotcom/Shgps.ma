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

// ─── Health check ──────────────────────────────────────────────────────────

export async function checkServer() {
  try {
    const res = await fetch(`${BASE}/api/server`, {
      headers: { Authorization: `Basic ${AUTH}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { available: false, reason: `HTTP ${res.status}` }
    const data = await res.json()
    return { available: true, version: data.version || null }
  } catch (err) {
    return { available: false, reason: err.message }
  }
}

// ─── Session ───────────────────────────────────────────────────────────────

export async function createSession(baseUrl, email, password) {
  const formBody = `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
  const res = await fetch(baseUrl + '/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody,
  })
  if (!res.ok) throw new Error(`Session POST failed: HTTP ${res.status}`)
  const setCookie = res.headers.get('set-cookie') || ''
  const sessionCookie = setCookie.split(';')[0]
  const user = await res.json()
  const userToken = user.token || ''
  return { sessionCookie, userToken }
}

// ─── Admin bootstrap ───────────────────────────────────────────────────────

export async function ensureAdminUser(baseUrl, email, password) {
  try {
    const res = await fetch(baseUrl + '/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Admin', email, password, administrator: true }),
    })
    if (res.ok) return { created: true }
    if (res.status === 400 || res.status === 409) return { created: false, reason: 'already_exists' }
    return { created: false, reason: `HTTP ${res.status}` }
  } catch (err) {
    return { created: false, reason: err.message }
  }
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

export async function deleteDevice(traccarId) {
  return req(`/api/devices/${traccarId}`, { method: 'DELETE' })
}

// ─── Users ─────────────────────────────────────────────────────────────────

export async function createUser(name, email, password) {
  return req('/api/users', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
}

export async function deleteUser(traccarId) {
  return req(`/api/users/${traccarId}`, { method: 'DELETE' })
}

export async function linkDevice(traccarUserId, traccarDeviceId) {
  return req('/api/permissions', {
    method: 'POST',
    body: JSON.stringify({ userId: traccarUserId, deviceId: traccarDeviceId }),
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
    body: JSON.stringify({ deviceId: traccarId, type, attributes: {} }),
  })
}

// ─── Geofences ─────────────────────────────────────────────────────────────

export async function createGeofence(name, lat, lng, radius = 500) {
  const area = `CIRCLE (${lat} ${lng}, ${radius})`
  return req('/api/geofences', {
    method: 'POST',
    body: JSON.stringify({ name, area }),
  })
}

export async function getGeofencesByDevice(traccarDeviceId) {
  if (!traccarDeviceId) return req('/api/geofences')
  return req(`/api/geofences?deviceId=${traccarDeviceId}`)
}

export async function deleteGeofence(geofenceId) {
  return req(`/api/geofences/${geofenceId}`, { method: 'DELETE' })
}
