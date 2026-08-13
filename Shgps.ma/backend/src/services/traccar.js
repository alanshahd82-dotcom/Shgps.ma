import { config } from '../config.js'

const base = () => config.traccar.url

// ── Session-based auth (Traccar 5.x+ dropped Basic Auth for REST) ──
let _sessionCookie = null
let _sessionExpiresAt = 0

async function ensureSession() {
  if (_sessionCookie && Date.now() < _sessionExpiresAt) return _sessionCookie
  const url = `${base()}/api/session`
  const body = new URLSearchParams({ email: config.traccar.email, password: config.traccar.password }).toString()
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw Object.assign(new Error(`Traccar session ${res.status}`), { code: 'TRACCAR_AUTH_FAILED', status: res.status })
  const setCookie = res.headers.get('set-cookie') || ''
  const m = setCookie.match(/JSESSIONID=[^;]+/)
  if (!m) throw Object.assign(new Error('Traccar: no JSESSIONID in response'), { code: 'TRACCAR_AUTH_FAILED', status: 401 })
  _sessionCookie = m[0]
  _sessionExpiresAt = Date.now() + 25 * 60 * 1000 // refresh before ~30 min expiry
  console.log('[Traccar] REST session established')
  return _sessionCookie
}
const MAX_POSITION_SPEED_KMH = 220

function haversineKm(a, b) {
  const radius = 6371
  const lat1 = Number(a.latitude) * Math.PI / 180
  const lat2 = Number(b.latitude) * Math.PI / 180
  const dLat = (Number(b.latitude) - Number(a.latitude)) * Math.PI / 180
  const dLng = (Number(b.longitude) - Number(a.longitude)) * Math.PI / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const value = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)))
}

export function cleanPositions(list) {
  const candidates = (Array.isArray(list) ? list : [])
    .filter((position) => {
      const latitude = Number(position?.latitude)
      const longitude = Number(position?.longitude)
      const fixTime = new Date(position?.fixTime)
      return position?.fixTime
        && !Number.isNaN(fixTime.getTime())
        && Number.isFinite(latitude)
        && Number.isFinite(longitude)
        && latitude >= -90
        && latitude <= 90
        && longitude >= -180
        && longitude <= 180
        && !(Math.abs(latitude) < 0.01 && Math.abs(longitude) < 0.01)
    })
    .sort((a, b) => new Date(a.fixTime) - new Date(b.fixTime))

  const cleaned = []
  for (const position of candidates) {
    const previous = cleaned.at(-1)
    if (previous) {
      const elapsedHours = (new Date(position.fixTime) - new Date(previous.fixTime)) / 3600000
      const speedKmh = elapsedHours > 0
        ? haversineKm(previous, position) / elapsedHours
        : 0
      // Equal-timestamp fixes are valid Traccar samples. Do not discard them
      // as impossible-speed points; only apply the speed guard when time has
      // actually advanced.
      if (elapsedHours > 0 && speedKmh > MAX_POSITION_SPEED_KMH) continue
    }
    cleaned.push(position)
  }
  return cleaned
}

async function call(path, opts = {}, _retried = false) {
  let cookie
  try { cookie = await ensureSession() } catch (e) {
    if (!_retried && (e.code === 'TRACCAR_AUTH_FAILED')) { _sessionCookie = null; _sessionExpiresAt = 0; return call(path, opts, true) }
    throw e
  }
  const res = await fetch(`${base()}${path}`, {
    ...opts,
    headers: { Cookie: cookie, 'Content-Type': 'application/json', ...opts.headers },
  })
  // If session expired mid-flight, retry once with a fresh session
  if ((res.status === 401 || res.status === 403) && !_retried) {
    _sessionCookie = null; _sessionExpiresAt = 0
    return call(path, opts, true)
  }
  if (!res.ok) {
    const error = new Error(`Traccar ${res.status}: ${await res.text()}`)
    error.code = res.status === 401 || res.status === 403
      ? 'TRACCAR_AUTH_FAILED'
      : 'TRACCAR_REQUEST_FAILED'
    error.status = res.status
    throw error
  }
  if (res.status === 204) return null
  return res.json()
}

export const getAllPositions  = ()            => call('/api/positions')
export const getAllDevices    = ()            => call('/api/devices')
export const getDevice        = (id)          => call(`/api/devices/${id}`)
export const getDevicesByUser = (uid)        => call(`/api/devices?userId=${uid}`)
export const createDevice     = (name, imei) => call('/api/devices', { method:'POST', body: JSON.stringify({ name, uniqueId: imei }) })
export const deleteDevice     = (id)         => call(`/api/devices/${id}`, { method:'DELETE' })
export const createUser = (name, email, pw) =>
  call('/api/users', { method:'POST', body: JSON.stringify({ name, email, password: pw, deviceLimit:100, administrator:false }) })
export const deleteUser  = (id) => call(`/api/users/${id}`,  { method:'DELETE' })
export const linkDevice   = (userId, deviceId) => call('/api/permissions', { method:'POST',   body: JSON.stringify({ userId, deviceId }) })
export const unlinkDevice = (userId, deviceId) => call('/api/permissions', { method:'DELETE', body: JSON.stringify({ userId, deviceId }) })
const HISTORY_CHUNK_MS = 24 * 60 * 60 * 1000

async function getHistoryChunk(deviceId, from, to) {
  const p = new URLSearchParams({
    deviceId: String(deviceId),
    from,
    to,
  })
  // Traccar's standard history endpoint is /api/positions.
  // /api/reports/route is not a Traccar endpoint and returns 404/502.
  const positions = await call(`/api/positions?${p}`)
  return Array.isArray(positions) ? positions : []
}

export async function getHistory(deviceId, from, to) {
  const start = new Date(from || Date.now() - HISTORY_CHUNK_MS)
  const end = new Date(to || Date.now())

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return []
  }

  // Traccar normally accepts a large range, but installations and proxies can
  // cap the number of returned positions. Fetching daily windows keeps the
  // response bounded while retaining every point in longer replay ranges.
  const chunks = []
  let cursor = start.getTime()
  while (cursor < end.getTime()) {
    const next = Math.min(cursor + HISTORY_CHUNK_MS, end.getTime())
    chunks.push(getHistoryChunk(deviceId, new Date(cursor).toISOString(), new Date(next).toISOString()))
    cursor = next
  }

  const unique = new Map()
  // Keep a small number of history requests in flight. Large report ranges
  // can otherwise open one Traccar request per day at once and stall the
  // browser when the device screen is already doing other work.
  const HISTORY_CONCURRENCY = 3
  for (let index = 0; index < chunks.length; index += HISTORY_CONCURRENCY) {
    const responses = await Promise.all(chunks.slice(index, index + HISTORY_CONCURRENCY))
    for (const positions of responses) {
      for (const position of positions) {
        const key = position.id
          ?? `${position.fixTime || ''}|${position.latitude || ''}|${position.longitude || ''}`
        unique.set(String(key), position)
      }
    }
  }

  return [...unique.values()].sort((a, b) => new Date(a.fixTime) - new Date(b.fixTime))
}

// ─── المرحلة 1: إصلاح إرسال الأمر (إضافة attributes) ──────────
export const sendCommand = (deviceId, type, attributes = {}) =>
  call('/api/commands/send', { method:'POST', body: JSON.stringify({ deviceId, type, attributes }) })

// ─── المرحلة 2 (Draft): دوال السياج الجغرافي ──────────────────
//
// Traccar يستخدم صيغة WKT لتعريف المنطقة:
//   CIRCLE (longitude latitude, radius)
//   ملاحظة: الترتيب هو longitude أولاً ثم latitude
//
// createGeofence: ينشئ سياجاً جغرافياً في Traccar ويعيد الكائن مع ID
export const createGeofence = (name, lat, lng, radius) =>
  call('/api/geofences', {
    method: 'POST',
    body: JSON.stringify({
      name,
      area: `CIRCLE (${lng} ${lat}, ${radius})`,  // WKT: lng أولاً ثم lat
      attributes: {},
    }),
  })

// getGeofencesByDevice: يجلب السياجات المرتبطة بجهاز معين
export const getGeofencesByDevice = (deviceId) =>
  call(`/api/geofences?deviceId=${deviceId}`)

// deleteGeofence: يحذف سياجاً جغرافياً بالـ ID
export const deleteGeofence = (geofenceId) =>
  call(`/api/geofences/${geofenceId}`, { method: 'DELETE' })

// linkGeofenceToDevice: يربط السياج بالجهاز عبر جدول الصلاحيات
export const linkGeofenceToDevice = (deviceId, geofenceId) =>
  call('/api/permissions', {
    method: 'POST',
    body: JSON.stringify({ deviceId, geofenceId }),
  })

// unlinkGeofenceFromDevice: يفك ربط السياج عن الجهاز
export const unlinkGeofenceFromDevice = (deviceId, geofenceId) =>
  call('/api/permissions', {
    method: 'DELETE',
    body: JSON.stringify({ deviceId, geofenceId }),
  })
