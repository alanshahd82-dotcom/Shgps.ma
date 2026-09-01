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
// Relay commands can make some trackers echo an external-power-low attribute
// even though the vehicle battery is still connected. Suppress only the
// resulting power alert briefly; normal telemetry and device state continue.
export const ENGINE_COMMAND_POWER_SUPPRESSION_MS = 60 * 1000
// Number of consecutive new packets with no power-loss attribute that prove
// the external supply is back when the tracker never sends an explicit
// restore flag. Kept small so the UI recovers within a couple of minutes.
export const CLEAN_TELEMETRY_RESTORE_COUNT = 3
// Timestamp of the last successful engine command, keyed by Traccar device ID.
// This is intentionally in-memory: it protects only the short-lived relay echo
// window and must not become a persisted battery-disconnect state.
export const engineCommandCooldowns = new Map()
const powerAlertSuppressionDurations = new Map()
const engineCommandDeviceAliases = new Map()
const loggedCooldownLookups = new Set()

function isFalseLike(raw) {
  if (raw === false || raw === 0) return true
  if (typeof raw !== 'string') return false
  return /^(?:false|0|no|off|lost|cut|disconnected?)$/i.test(raw.trim())
}

function isExplicitFalse(raw) {
  if (raw === false || raw === 0) return true
  return typeof raw === 'string' && /^(?:false|0|no)$/i.test(raw.trim())
}

function isLossLike(raw) {
  if (raw === true || raw === 1) return true
  if (typeof raw !== 'string') return false
  return /^(?:true|1|yes|lost|cut|off|disconnected?)$/i.test(raw.trim())
}

function cacheKey(deviceId) {
  return deviceId == null ? null : String(deviceId)
}

export function suppressPowerAlerts(deviceId, durationMs = ENGINE_COMMAND_POWER_SUPPRESSION_MS, now = Date.now()) {
  const key = cacheKey(deviceId)
  if (!key) return
  const duration = Number(durationMs)
  if (!Number.isFinite(duration) || duration <= 0) return
  engineCommandCooldowns.set(key, now)
  powerAlertSuppressionDurations.set(key, duration)
}

export function registerEngineCommandCooldown(traccarId, localDeviceId, now = Date.now()) {
  const traccarKey = cacheKey(traccarId)
  if (!traccarKey) return
  engineCommandCooldowns.set(traccarKey, now)
  powerAlertSuppressionDurations.set(traccarKey, ENGINE_COMMAND_POWER_SUPPRESSION_MS)

  const localKey = cacheKey(localDeviceId)
  if (localKey) engineCommandDeviceAliases.set(localKey, traccarKey)

  console.log('[engine-cooldown] set', JSON.stringify({
    cooldownKey: traccarKey,
    localDeviceId: localKey,
    traccarId: traccarKey,
  }))
}

export function isPowerAlertSuppressed(deviceId, now = Date.now()) {
  const positionKey = cacheKey(deviceId)
  if (!positionKey) return false
  const key = engineCommandDeviceAliases.get(positionKey) || positionKey
  const lastCommandTime = engineCommandCooldowns.get(key)
  if (!Number.isFinite(lastCommandTime)) return false
  const duration = powerAlertSuppressionDurations.get(key) ?? ENGINE_COMMAND_POWER_SUPPRESSION_MS
  if (now - lastCommandTime >= duration) {
    engineCommandCooldowns.delete(key)
    powerAlertSuppressionDurations.delete(key)
    loggedCooldownLookups.delete(positionKey)
    return false
  }
  if (!loggedCooldownLookups.has(positionKey)) {
    console.log('[power-cooldown] lookup', JSON.stringify({
      positionDeviceId: positionKey,
      cooldownKey: key,
      matched: true,
    }))
    loggedCooldownLookups.add(positionKey)
  }
  return true
}

/**
 * Return an explicit tracker signal that external power was lost.
 *
 * Missing voltage is intentionally not considered a signal: GT06 devices
 * commonly omit that field while still sending valid positions.
 */
export function detectExternalPowerLoss(position, { everSeenBatteryVoltage = true } = {}) {
  // Suppress a relay echo if an engine command was sent to this device
  // recently; this protects every caller, including the WebSocket bridge.
  if (position?.deviceId != null && isPowerAlertSuppressed(position.deviceId)) {
    return null
  }

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
    if (key === 'externalPower' && isFalseLike(attributes[key])) return { source: key }
    if (key !== 'externalPower' && isLossLike(attributes[key])) return { source: key }
  }

  // GT06 (the protocol used by this fleet) never sends externalPower/powerCut.
  // It reports the external supply through `charge`. An explicit charge:false
  // is electrical feedback, BUT on GT06 charge:false only means "the alternator
  // is not charging right now" (engine off). Parked vehicles emit it on every
  // packet, which produced a disconnect/restore alert storm on perfectly
  // healthy vehicles. So it counts as a loss signal only when the SAME packet
  // reports no vehicle-battery voltage: a packet carrying 12.7 V proves the
  // vehicle battery is still wired to the tracker.
  if (attributes.charge !== undefined && attributes.charge !== null
    && isFalseLike(attributes.charge)) {
    const chargeVoltage = extractReportedVoltage(position)
    // A packet carrying a battery-range voltage proves the vehicle battery
    // is still wired to the tracker, so charge:false just means "not charging".
    if (chargeVoltage !== null && isBatteryVoltage(chargeVoltage)) return null
    // FIX 1: charge:false can only mean the vehicle battery was disconnected
    // for a device that has previously reported a vehicle-battery voltage. A
    // standalone tracker (no vehicle) never does, so it must never fire a
    // disconnect from charge:false alone. everSeenBatteryVoltage defaults to
    // true so callers without per-device state (the WS UI normalisation in
    // index.js) keep the legacy behaviour; the alert engine passes the tracked
    // per-device flag.
    if (!everSeenBatteryVoltage) return null
    return { source: 'charge:false' }
  }

  // Generic Traccar alarm names are not electrical feedback. Production
  // devices have emitted alarm:powerCut while the tracker remained online,
  // so an alarm alone must never create a battery-disconnect alert.
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
    if (isExplicitFalse(attributes[key])) return { source: `${key}:false` }
  }

  const alarm = String(attributes.alarm ?? '').trim()
  if (/^(?:power[_ -]?(?:restored|on|normal)|external[_ -]?power[_ -]?(?:restored|on|normal)|charge[_ -]?(?:on|restored|normal))$/i.test(alarm)) {
    return { source: `alarm:${alarm}` }
  }

  // FIX 2: a bare voltage reading is NOT an affirmative restoration signal.
  // GT06 reports the supply voltage on every connected packet; treating
  // "voltage appeared" as "power restored" fired a restore on every
  // voltage-bearing packet and flapped against charge:false disconnects.
  // Restoration now requires an explicit affirmative signal above
  // (charge:true, externalPower:true, an explicit powerCut/lossKey:false, or
  // a powerRestored alarm). The clean-telemetry probation in the reducer still
  // recovers episodes where the tracker never sends charge:true.
  return null
}

/**
 * Apply one position to the power episode state.
 *
 * A missing/undefined `charge` field is intentionally ignored: it can
 * disappear on sleeping GT06 devices. Only explicit loss attributes
 * (including an explicit charge:false) may create a disconnect episode;
 * silence alone never does.
 */
export function reducePowerTelemetryState(current, {
  signature,
  observedAt,
  now,
  powerLossSignal,
  powerRestoredSignal,
}) {
  const next = { ...current }
  const isNewTelemetry = next.lastPositionKey !== signature

  if (isNewTelemetry) {
    next.lastPositionKey = signature
    next.lastPositionAt = next.lastPositionAt === null
      ? observedAt
      : Math.max(next.lastPositionAt, observedAt)
  }

  // Clean-telemetry probation: a GT06 that really lost the vehicle supply keeps
  // repeating its loss attribute on every packet. So a device that is in a
  // disconnect episode and then sends several consecutive NEW packets with no
  // loss signal at all is electrically back, even when the tracker never sends
  // an affirmative `charge:true`. This can never be triggered by silence
  // (it requires new packets) and it is what stops an episode from getting
  // stuck forever after the supply is reconnected.
  if (next.disconnected && isNewTelemetry && !powerLossSignal) {
    next.cleanTelemetryCount = (next.cleanTelemetryCount || 0) + 1
  } else if (powerLossSignal) {
    next.cleanTelemetryCount = 0
  }

  const confirmedRestore = next.disconnected
    && isNewTelemetry
    && !powerLossSignal
    && (
      Boolean(powerRestoredSignal)
      || next.disconnectTrigger === 'silence'
      || (next.cleanTelemetryCount || 0) >= CLEAN_TELEMETRY_RESTORE_COUNT
    )

  if (confirmedRestore) {
    next.disconnected = false
    next.disconnectTrigger = null
    next.powerLossSignal = null
    next.missingSince = null
    next.alerting = false
    next.cleanTelemetryCount = 0
  }

  if (powerLossSignal) {
    next.powerLossSignal = powerLossSignal
    next.missingSince = now
    next.invalidPositionCount = 0
    return {
      state: next,
      isNewTelemetry,
      restored: confirmedRestore,
      shouldAlertImmediately: isNewTelemetry && !next.disconnected && !next.alerting,
      shouldScheduleSilence: false,
    }
  }

  if (!next.powerLossSignal) next.missingSince = null
  next.invalidPositionCount = 0
  return {
    state: next,
    isNewTelemetry,
    restored: confirmedRestore,
    shouldAlertImmediately: false,
    shouldScheduleSilence: isNewTelemetry && !next.disconnected && !next.powerLossSignal,
  }
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

// Accept both 12V systems (cars, bikes) and 24V systems (trucks, buses).
export const VOLTAGE_RANGE_12V = { min: 9, max: 15 }
export const VOLTAGE_RANGE_24V = { min: 18, max: 30 }

export function isBatteryVoltage(value) {
  return (
    (value >= VOLTAGE_RANGE_12V.min && value <= VOLTAGE_RANGE_12V.max)
    || (value >= VOLTAGE_RANGE_24V.min && value <= VOLTAGE_RANGE_24V.max)
  )
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
    // Phase 2H-2: only a valid vehicle-battery voltage is surfaced; a generic
    // adc1 reading (e.g. 6.4 V) is rejected at the read boundary.
    return isBatteryVoltage(reported) ? reported : null
  }

  if (!connected) return null

  // A confirmed external-power disconnect must not keep serving the last
  // known vehicle voltage: that reading belongs to the supply that is now
  // cut. Only a freshly reported value (handled above) may appear again.
  if (isVehicleDisconnected(deviceId)) return null

  const cached = expireVoltage(deviceId, now)
  if (!cached) return null
  cached.lastSeenAt = now
  return isBatteryVoltage(cached.voltage) ? cached.voltage : null
}

/**
 * Peek the last-known vehicle-battery voltage without refreshing the grace
 * window. Used to serve a stale reading when telemetry is silent but the
 * device is not confirmed disconnected. Returns null unless the cached value
 * passes isBatteryVoltage, so a generic adc1 reading (e.g. 6.4 V) is never
 * surfaced as a vehicle-battery voltage.
 */
export function readLastKnownVehicleVoltage(deviceId, now = Date.now()) {
  const cached = expireVoltage(deviceId, now)
  if (!cached) return null
  if (!isBatteryVoltage(cached.voltage)) return null
  return { voltage: cached.voltage, lastSeenAt: cached.lastSeenAt }
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

/**
 * Return true when the device has reported recently (within maxAgeMs).
 *
 * Traccar exposes three timestamps per position:
 *   fixTime   — when the GPS lock was obtained (stale on idle/no-GPS devices)
 *   deviceTime — when the device itself generated the packet
 *   serverTime — when Traccar received the packet (always fresh if reporting)
 *
 * A device like "bekane" (motion-only, no ignition/charge fields) keeps its
 * GPS fix time unchanged while idle but still sends regular keep-alive packets,
 * so serverTime will be fresh even when fixTime is hours old.  Using only
 * fixTime would mark such a device as offline while it is perfectly connected.
 * We therefore accept ANY recent timestamp as proof of connectivity.
 */
export function positionIsFresh(position, maxAgeMs = POWER_SILENCE_WINDOW_MS, now = Date.now()) {
  // Ordered: serverTime (most reliable for recency), deviceTime, then fixTime.
  const candidates = [
    position?.serverTime,
    position?.deviceTime,
    position?.fixTime ?? position?.lastUpdate ?? position?.last_update,
  ]
  for (const raw of candidates) {
    if (!raw) continue
    const ts = new Date(raw).getTime()
    if (!Number.isFinite(ts)) continue
    const age = now - ts
    if (age >= 0 && age < maxAgeMs) return true
  }
  return false
}

/**
 * Return true only when ALL known timestamps are beyond the silence window.
 *
 * A device is truly silent only when the server has not received any packet
 * recently.  A fresh serverTime means the device IS reporting, even if its
 * GPS fix is stale.  We take the most recent of the available timestamps so
 * that an idle device with an old fixTime but a fresh serverTime is NOT
 * considered silent.
 */
export function positionIsSilent(position, maxAgeMs = POWER_SILENCE_WINDOW_MS, now = Date.now()) {
  const candidates = [
    position?.serverTime,
    position?.deviceTime,
    position?.fixTime ?? position?.lastUpdate ?? position?.last_update,
  ]
  let latestTs = NaN
  for (const raw of candidates) {
    if (!raw) continue
    const ts = new Date(raw).getTime()
    if (Number.isFinite(ts) && (isNaN(latestTs) || ts > latestTs)) latestTs = ts
  }
  return Number.isFinite(latestTs) && now - latestTs >= maxAgeMs
}
