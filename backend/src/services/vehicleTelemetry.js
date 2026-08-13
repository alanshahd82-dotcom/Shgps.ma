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

// The backend and frontend use the same silence window for a confirmed
// power-disconnect episode. A missing voltage field by itself never starts it.
export const POWER_SILENCE_WINDOW_MS = 5 * 60 * 1000

function isFalseLike(raw) {
  if (raw === false || raw === 0) return true
  if (typeof raw !== 'string') return false
  return /^(?:false|0|no|off|lost|cut|disconnected?)$/i.test(raw.trim())
}

const POWER_LOSS_ALARM_PATTERN = /^(?:power[_ -]?(?:cut|lost|off|disconnect(?:ed)?|failure)|external[_ -]?power(?:[_ -]?(?:cut|lost|off|disconnect(?:ed)?))?|charge[_ -]?(?:off|lost|disconnect(?:ed)?))$/i

/**
 * Return an explicit tracker signal that external power was lost.
 *
 * Missing voltage is intentionally not considered a signal: GT06 devices
 * commonly omit that field while still sending valid positions.
 */
export function detectExternalPowerLoss(position) {
  const attributes = position?.attributes || {}
  const directKeys = [
    'externalPower',
    'externalPowerLost',
    'external_power_lost',
    'powerLost',
    'power_lost',
    'powerCut',
    'power_cut',
    'chargeOff',
    'charge_off',
  ]

  for (const key of directKeys) {
    if (isFalseLike(attributes[key])) return { source: key }
    if (/lost|cut|off/i.test(key) && attributes[key] === true) return { source: key }
  }

  if (isFalseLike(attributes.charge)) return { source: 'charge:false' }

  const alarm = String(attributes.alarm ?? '').trim()
  if (alarm && POWER_LOSS_ALARM_PATTERN.test(alarm)) {
    return { source: `alarm:${alarm}` }
  }

  return null
}

/**
 * Return an affirmative tracker signal that external power is back.
 *
 * Absence of a loss field is deliberately not enough. GT06 packets can omit
 * `charge` intermittently while the vehicle is still on internal battery.
 */
export function detectExternalPowerRestored(position) {
  const attributes = position?.attributes || {}
  const isTrueLike = value => value === true || value === 1
    || (typeof value === 'string' && /^(?:true|1|yes|on|connected|restored|normal|ok)$/i.test(value.trim()))

  if (isTrueLike(attributes.charge)) return { source: 'charge:true' }
  if (isTrueLike(attributes.externalPower)) return { source: 'externalPower:true' }

  const lossKeys = [
    'externalPowerLost',
    'external_power_lost',
    'powerLost',
    'power_lost',
    'powerCut',
    'power_cut',
    'chargeOff',
    'charge_off',
  ]
  for (const key of lossKeys) {
    if (isFalseLike(attributes[key])) return { source: `${key}:false` }
  }

  const alarm = String(attributes.alarm ?? '').trim()
  if (/^(?:power[_ -]?(?:restored|on|normal)|external[_ -]?power[_ -]?(?:restored|on|normal)|charge[_ -]?(?:on|restored|normal))$/i.test(alarm)) {
    return { source: `alarm:${alarm}` }
  }

  return null
}

function toFinitePositiveNumber(raw) {
  if (raw == null || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

// Keep the last real reading while Traccar continues delivering positions.
// A missing position for longer than this is treated as a real disconnect.
export const VOLTAGE_DISCONNECT_GRACE_MS = 10 * 60 * 1000
const lastKnownVoltage = new Map()
const disconnectedVehicles = new Set()

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

  if (!connected) return null

  const cached = expireVoltage(deviceId, now)
  if (!cached) return null
  cached.lastSeenAt = now
  return cached.voltage
}

export function clearVehicleVoltage(deviceId) {
  const key = cacheKey(deviceId)
  if (key) lastKnownVoltage.delete(key)
}

export function hasKnownVehicleVoltage(deviceId, now = Date.now()) {
  return Boolean(expireVoltage(deviceId, now))
}

export function markVehicleConnected(deviceId) {
  const key = cacheKey(deviceId)
  if (key) disconnectedVehicles.delete(key)
}

export function markVehicleDisconnected(deviceId) {
  const key = cacheKey(deviceId)
  if (!key) return
  disconnectedVehicles.add(key)
  lastKnownVoltage.delete(key)
}

export function isVehicleDisconnected(deviceId) {
  const key = cacheKey(deviceId)
  return Boolean(key && disconnectedVehicles.has(key))
}

export function positionIsFresh(position, maxAgeMs = POWER_SILENCE_WINDOW_MS, now = Date.now()) {
  const raw = position?.fixTime ?? position?.lastUpdate ?? position?.last_update
  const timestamp = raw ? new Date(raw).getTime() : NaN
  if (!Number.isFinite(timestamp)) return false
  const age = now - timestamp
  return age >= 0 && age < maxAgeMs
}

export function positionIsSilent(position, maxAgeMs = POWER_SILENCE_WINDOW_MS, now = Date.now()) {
  const raw = position?.fixTime ?? position?.lastUpdate ?? position?.last_update
  const timestamp = raw ? new Date(raw).getTime() : NaN
  return Number.isFinite(timestamp) && now - timestamp >= maxAgeMs
}
