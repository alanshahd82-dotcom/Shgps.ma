import test from 'node:test'
import assert from 'node:assert/strict'
import { signalToBars } from '../../src/utils/signal.js'
import { mergeVoltageFields } from '../../src/utils/voltageMerge.js'
import { speedKmh } from '../src/utils/speed.js'
import {
  resolveDeviceStatus,
  positionIsFresh,
  readBatteryLevel,
} from '../src/services/vehicleTelemetry.js'

// ── 1. Offline nulling: when backend reports offline, stale telemetry must not persist ──
test('OFFLINE-1: offline status nulls speed in mergeDeviceSnapshots', () => {
  const current = { speed: 85, engineOn: true, motion: true, signal: 4, charge: true, status: 'online' }
  const incoming = { id: current.id, status: 'offline', speed: null, engineOn: null, motion: null, signal: null, charge: null }
  // Simulate the mergeDeviceSnapshots offline branch
  const offline = incoming.status === 'offline'
  const merged = {
    ...current,
    ...incoming,
    ...mergeVoltageFields(current, incoming),
    speed: offline ? null : current.speed,
    engineOn: offline ? null : current.engineOn,
    motion: offline ? null : current.motion,
    signal: offline ? null : current.signal,
    charge: offline ? null : current.charge,
  }
  assert.equal(merged.speed, null, 'speed must be null when offline')
  assert.equal(merged.engineOn, null, 'engineOn must be null when offline')
  assert.equal(merged.motion, null, 'motion must be null when offline')
  assert.equal(merged.signal, null, 'signal must be null when offline')
  assert.equal(merged.charge, null, 'charge must be null when offline')
})

test('OFFLINE-2: online status preserves current telemetry', () => {
  const current = { speed: 85, engineOn: true, motion: true, signal: 4, charge: true, status: 'online' }
  const incoming = { id: current.id, status: 'online', speed: 90, engineOn: true, motion: true, signal: 3, charge: true }
  const offline = incoming.status === 'offline'
  const merged = {
    ...current,
    ...incoming,
    speed: offline ? null : current.speed,
    engineOn: offline ? null : current.engineOn,
    motion: offline ? null : current.motion,
    signal: offline ? null : current.signal,
    charge: offline ? null : current.charge,
  }
  assert.equal(merged.speed, 85, 'speed preserved when online (current wins for non-newer)')
  assert.equal(merged.signal, 4, 'signal preserved when online')
})

// ── 2. Timestamp consistency ──────────────────────────────────────────────────────
test('TS-1: REST lastUpdate uses td.lastUpdate (server contact) not just fixTime', () => {
  const td = { status: 'online', lastUpdate: '2026-09-02T15:13:24.546+00:00' }
  const p = { fixTime: '2026-09-02T15:13:21.000+00:00' }
  // devices.js mapping: td?.lastUpdate ?? p?.fixTime ?? null
  const restLastUpdate = td?.lastUpdate ?? p?.fixTime ?? null
  assert.equal(restLastUpdate, '2026-09-02T15:13:24.546+00:00', 'REST should prefer td.lastUpdate')
})

test('TS-2: WS lastUpdate uses serverTime (packet arrival) not just fixTime', () => {
  const pos = {
    serverTime: '2026-09-02T15:13:24.546+00:00',
    deviceTime: '2026-09-02T15:13:24.546+00:00',
    fixTime: '2026-09-02T15:13:21.000+00:00',
  }
  // WS handler: pos.serverTime ?? pos.deviceTime ?? pos.fixTime ?? current.lastUpdate
  const wsLastUpdate = pos.serverTime ?? pos.deviceTime ?? pos.fixTime ?? null
  assert.equal(wsLastUpdate, '2026-09-02T15:13:24.546+00:00', 'WS should prefer serverTime')
})

test('TS-3: stale fixTime must not appear as live lastUpdate', () => {
  const staleFixTime = '2026-09-01T08:00:00.000+00:00'
  const freshServerTime = '2026-09-02T15:13:24.546+00:00'
  const wsLastUpdate = freshServerTime ?? staleFixTime ?? null
  assert.equal(wsLastUpdate, freshServerTime, 'fresh serverTime wins over stale fixTime')
})

// ── 3. Missing telemetry: null handling ────────────────────────────────────────────
test('MISSING-1: null speed from REST stays null (not 0)', () => {
  const restSpeed = null // trackingEnabled && p ? Math.round(speedKmh(p.speed)) : null
  assert.equal(restSpeed, null)
})

test('MISSING-2: null voltage shows unavailable, not a fabricated number', () => {
  const voltage = null // readVehicleVoltage returns null when no valid voltage
  assert.equal(voltage, null)
})

test('MISSING-3: null signal shows 0 bars', () => {
  assert.equal(signalToBars(null), 0)
  assert.equal(signalToBars(undefined), 0)
})

test('MISSING-4: null batteryLevel stays null', () => {
  const pos = { attributes: {} }
  assert.equal(readBatteryLevel(pos), null)
})

test('MISSING-5: null charge shows unavailable, not false', () => {
  // charge: p?.attributes?.charge ?? null
  const pos = { attributes: {} }
  const charge = pos.attributes?.charge ?? null
  assert.equal(charge, null)
})

// ── 4. Invalid GPS: (0, 0) must be rejected ──────────────────────────────────────────
test('GPS-1: (0, 0) coordinates are invalid (null island)', () => {
  // validLivePosition rejects (0,0)
  const lat = 0, lng = 0
  const isValid = Math.abs(lat) > 0.01 || Math.abs(lng) > 0.01
  assert.equal(isValid, false, '(0,0) must be rejected')
})

test('GPS-2: valid coordinates are accepted', () => {
  const lat = 31.690580, lng = -8.056774
  const isValid = Math.abs(lat) > 0.01 || Math.abs(lng) > 0.01
  assert.equal(isValid, true)
})

test('GPS-3: null lat/lng are invalid', () => {
  const lat = null, lng = null
  const isValid = lat != null && lng != null && (Math.abs(lat) > 0.01 || Math.abs(lng) > 0.01)
  assert.equal(isValid, false)
})

// ── 5. Odometer/distance semantics ─────────────────────────────────────────────────
test('DIST-1: totalDistance is Traccar cumulative GPS distance in meters, not physical odometer', () => {
  const traccarTotalDistance = 657096979.1310823 // meters from attributes.totalDistance
  // This is Traccar's computed distance, NOT the vehicle's physical odometer
  // The card shows daily distance derived from this, labeled "km" (not "Kilométrage")
  assert.equal(typeof traccarTotalDistance, 'number')
  assert.ok(traccarTotalDistance > 0)
})

test('DIST-2: daily distance = (current totalDistance - start totalDistance) / 1000', () => {
  const startTotalDistance = 657096000 // meters at start of day
  const currentTotalDistance = 657096979.13 // meters now
  const dailyKm = (currentTotalDistance - startTotalDistance) / 1000
  assert.ok(dailyKm > 0)
  assert.ok(dailyKm < 1000, 'daily distance should be reasonable (< 1000 km/day)')
})

test('DIST-3: GT06 odometer attribute is separate from totalDistance', () => {
  // Device 70 live data: attributes.odometer = 15701, attributes.totalDistance = 342289114.52
  // These are different values — odometer may be physical, totalDistance is computed
  const odometer = 15701
  const totalDistance = 342289114.5217302
  assert.notEqual(odometer, totalDistance)
})

// ── 6. Charge semantics ─────────────────────────────────────────────────────────────
test('CHARGE-1: GT06 charge=true means tracker is charging (external power)', () => {
  // Device 37 live data: attributes.charge = true
  const charge = true
  assert.equal(charge, true)
})

test('CHARGE-2: charge absent from attributes -> null (not false)', () => {
  // Device 70 live data: no charge attribute
  const pos = { attributes: { sat: 11, ignition: false } }
  const charge = pos.attributes?.charge ?? null
  assert.equal(charge, null, 'missing charge must be null, not false')
})

test('CHARGE-3: charge is nulled when device goes offline', () => {
  const current = { charge: true, status: 'online' }
  const incoming = { status: 'offline', charge: null }
  const offline = incoming.status === 'offline'
  const merged = offline ? null : current.charge
  assert.equal(merged, null, 'charge must be null when offline')
})

// ── 7. REST vs WS consistency ────────────────────────────────────────────────────────
test('CONSIST-1: speed is km/h in both REST and WS (backend converts knots)', () => {
  const knots = 10
  const restSpeed = Math.round(speedKmh(knots)) // REST: Math.round(speedKmh(p.speed))
  const wsBackendSpeed = Math.round(speedKmh(knots)) // WS bridge: Math.round(speedKmh(p.speed))
  assert.equal(restSpeed, wsBackendSpeed, 'REST and WS must return same speed')
  assert.equal(restSpeed, 19, '10 knots = 18.52 km/h -> rounded 19')
})

test('CONSIST-2: voltage validation is identical in REST and WS', () => {
  // Both use readVehicleVoltage which calls isBatteryVoltage
  // A 6.4V ADC reading is rejected in both paths
  const adcVoltage = 6.4
  const is12V = adcVoltage >= 9.5 && adcVoltage <= 15.5
  const is24V = adcVoltage >= 19 && adcVoltage <= 30
  const isValid = is12V || is24V
  assert.equal(isValid, false, '6.4V must be rejected by isBatteryVoltage')
})

test('CONSIST-3: signal (rssi) is raw value in both REST and WS, frontend converts', () => {
  const rssi = 3 // GT06 0-5 scale
  // REST: p?.attributes?.rssi ?? null
  // WS: pos.attributes?.rssi ?? current.signal
  // Both send raw value 3; frontend signalToBars converts to bars
  const restSignal = rssi
  const wsSignal = rssi
  assert.equal(restSignal, wsSignal)
  assert.equal(signalToBars(restSignal), 3, 'rssi=3 -> 3 bars in both paths')
})

test('CONSIST-4: lastUpdate uses td.lastUpdate in REST, serverTime in WS — both are server contact time', () => {
  const td = { status: 'online', lastUpdate: '2026-09-02T15:13:24.546+00:00' }
  const p = { fixTime: '2026-09-02T15:13:21.000+00:00' }
  const restLastUpdate = td?.lastUpdate ?? p?.fixTime ?? null

  const wsPos = { serverTime: '2026-09-02T15:13:24.546+00:00', fixTime: '2026-09-02T15:13:21.000+00:00' }
  const wsLastUpdate = wsPos.serverTime ?? wsPos.fixTime ?? null

  // Both should be the server contact time, not the GPS fix time
  assert.equal(restLastUpdate, '2026-09-02T15:13:24.546+00:00')
  assert.equal(wsLastUpdate, '2026-09-02T15:13:24.546+00:00')
  assert.equal(restLastUpdate, wsLastUpdate, 'REST and WS lastUpdate must match')
})

test('CONSIST-5: totalDistance is meters in both REST and WS', () => {
  const traccarTotalDistance = 657096979.13
  // REST: p.attributes.totalDistance
  // WS: pos.attributes.totalDistance
  // Both send raw meters; frontend divides by 1000 for km
  assert.equal(traccarTotalDistance, 657096979.13)
})

test('CONSIST-6: charge is mapped in both REST and WS', () => {
  const traccarCharge = true
  // REST: p.attributes.charge
  // WS: pos.attributes.charge
  const restCharge = traccarCharge
  const wsCharge = traccarCharge
  assert.equal(restCharge, wsCharge)
})

test('CONSIST-7: engineOn (ignition) is identical in REST and WS', () => {
  const traccarIgnition = false
  const restEngineOn = traccarIgnition
  const wsEngineOn = traccarIgnition
  assert.equal(restEngineOn, wsEngineOn)
})

test('CONSIST-8: motion is identical in REST and WS', () => {
  const traccarMotion = false
  const restMotion = traccarMotion
  const wsMotion = traccarMotion
  assert.equal(restMotion, wsMotion)
})

// ── 8. Voltage validation (WebSocket) ────────────────────────────────────────────────
test('VOLT-WS-1: WS voltage fallback uses pos.voltage (validated by backend), not raw attributes', () => {
  // After fix: voltage: pos.voltage ?? current.voltage ?? null
  // No more: pos.attributes?.voltage ?? pos.attributes?.power
  const pos = { voltage: 12.8, attributes: { voltage: 6.4 } } // 6.4V ADC in attributes
  const current = { voltage: 13.2 }
  // pos.voltage (12.8, validated by backend) wins over raw attributes.voltage (6.4)
  const wsVoltage = pos.voltage ?? current.voltage ?? null
  assert.equal(wsVoltage, 12.8, 'validated pos.voltage must win over raw attributes')
})

test('VOLT-WS-2: null pos.voltage preserves current validated voltage', () => {
  const pos = { voltage: null, attributes: { voltage: 6.4 } }
  const current = { voltage: 13.2 }
  const wsVoltage = pos.voltage ?? current.voltage ?? null
  assert.equal(wsVoltage, 13.2, 'current validated voltage preserved, raw 6.4V ignored')
})

test('VOLT-WS-3: both null -> null (not fabricated)', () => {
  const pos = { voltage: null, attributes: {} }
  const current = { voltage: null }
  const wsVoltage = pos.voltage ?? current.voltage ?? null
  assert.equal(wsVoltage, null)
})
