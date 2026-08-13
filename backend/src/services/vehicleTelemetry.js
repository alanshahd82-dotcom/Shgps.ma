const VOLTAGE_ATTRIBUTE_KEYS = [
  'voltage',
  'power',
  'externalPower',
  'adc1',
  'adc',
  'analog1',
  'vbat',
  'supply',
]

function toFinitePositiveNumber(raw) {
  if (raw == null || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

// Keep the last real reading while Traccar continues delivering positions.
// A missing position for longer than this is treated as a real disconnect.
export const VOLTAGE_DISCONNECT_GRACE_MS = 10 * 60 * 1000
const lastKnownVoltage = new Map()

function isBatteryVoltage(value) {
  return value >= 9 && value <= 15
}

/**
 * Return only a voltage explicitly reported by the tracker.
 *
 * `batteryLevel` is deliberately excluded because Traccar exposes it as a
 * percentage. Some GT06 firmware uses `battery` for either a percentage or
 * a voltage, so that field is accepted only when it looks like car voltage.
 */
export function extractReportedVoltage(position) {
  const attributes = position?.attributes || {}

  for (const key of VOLTAGE_ATTRIBUTE_KEYS) {
    const value = toFinitePositiveNumber(attributes[key])
    if (value !== null) return value
  }

  const batteryValue = toFinitePositiveNumber(attributes.battery)
  return batteryValue !== null && isBatteryVoltage(batteryValue) ? batteryValue : null
}

export function readBatteryLevel(position) {
  const attributes = position?.attributes || {}
  const raw = attributes.batteryLevel ?? (
    isBatteryVoltage(Number(attributes.battery)) ? undefined : attributes.battery
  )
  const value = raw == null || raw === '' ? NaN : Number(raw)
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null
}

function cacheKey(deviceId) {
  return deviceId == null ? null : String(deviceId)
}

function rememberVoltage(deviceId, voltage, now = Date.now()) {
  const key = cacheKey(deviceId)
  if (!key || voltage === null) return
  lastKnownVoltage.set(key, { voltage, lastSeenAt: now })
}

function expireVoltage(deviceId, now = Date.now()) {
  const key = cacheKey(deviceId)
  if (!key) return null
  const cached = lastKnownVoltage.get(key)
  if (!cached) return null
  if (now - cached.lastSeenAt >= VOLTAGE_DISCONNECT_GRACE_MS) {
    lastKnownVoltage.delete(key)
    return null
  }
  return cached
}

/**
 * Observe a Traccar position and update the in-memory last-known cache.
 * A position without voltage still proves the tracker is connected, so it
 * refreshes the grace window without changing the stored voltage.
 */
export function observeVehicleVoltage(position) {
  const deviceId = position?.deviceId
  const reported = extractReportedVoltage(position)
  const now = Date.now()

  if (reported !== null) {
    rememberVoltage(deviceId, reported, now)
    return reported
  }

  const cached = expireVoltage(deviceId, now)
  if (cached && position) cached.lastSeenAt = now
  return null
}

/**
 * Read the current voltage, falling back to the last reported value while the
 * caller still considers the device connected.
 */
export function readVehicleVoltage(position, deviceId = position?.deviceId, { connected = true } = {}) {
  const reported = extractReportedVoltage(position)
  const now = Date.now()
  if (reported !== null) {
    rememberVoltage(deviceId, reported, now)
    return reported
  }

  if (!connected) {
    clearVehicleVoltage(deviceId)
    return null
  }

  const cached = expireVoltage(deviceId, now)
  if (!cached) return null
  cached.lastSeenAt = now
  return cached.voltage
}

export function clearVehicleVoltage(deviceId) {
  const key = cacheKey(deviceId)
  if (key) lastKnownVoltage.delete(key)
}