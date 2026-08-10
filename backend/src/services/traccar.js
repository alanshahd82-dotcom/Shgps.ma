import { config } from '../config.js'

const base = () => config.traccar.url
const auth = () => 'Basic ' + Buffer.from(`${config.traccar.email}:${config.traccar.password}`).toString('base64')

async function call(path, opts = {}) {
  const res = await fetch(`${base()}${path}`, {
    ...opts,
    headers: { Authorization: auth(), 'Content-Type': 'application/json', ...opts.headers },
  })
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

  const responses = await Promise.all(chunks)
  const unique = new Map()
  for (const positions of responses) {
    for (const position of positions) {
      const key = position.id
        ?? `${position.fixTime || ''}|${position.latitude || ''}|${position.longitude || ''}`
      unique.set(String(key), position)
    }
  }

  return [...unique.values()].sort((a, b) => new Date(a.fixTime) - new Date(b.fixTime))
}

// ─── المرحلة 1: إصلاح إرسال الأمر (إضافة attributes) ──────────
export const sendCommand = (deviceId, type) =>
  call('/api/commands/send', { method:'POST', body: JSON.stringify({ deviceId, type, attributes: {} }) })

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
