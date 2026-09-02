// Phase 2G-FIX-1 — standalone GT06 power-alert safety.
//
// Locks down the detection-level fixes that stop a standalone tracker (no
// vehicle battery) from producing false power_disconnected / power_restored
// alerts during a connectivity-only outage/reconnect.
//
// FIX 1: charge:false is NOT a power loss unless the device previously reported
//        a vehicle-battery voltage (per-device everSeenBatteryVoltage).
// FIX 2: a bare voltage reading is NOT a power restoration.
// FIX 3: a reconnect/snapshot replay of the same telemetry does not re-fire a
//        disconnect (shouldAlertImmediately requires new telemetry).
import test from 'node:test'
import assert from 'node:assert/strict'

import { createPowerAlertEngine } from '../src/services/powerAlerts.js'
import {
  detectExternalPowerLoss,
  detectExternalPowerRestored,
  isBatteryVoltage,
  isVehicleDisconnected,
  markVehicleConnected,
  clearVehicleVoltage,
  engineCommandCooldowns,
  ENGINE_COMMAND_POWER_SUPPRESSION_MS,
} from '../src/services/vehicleTelemetry.js'

const TRACCAR_ID = 70
const DEVICE_ROW = { id: 16, traccar_id: TRACCAR_ID, user_id: 3, name: 'DACIA' }

function makeHarness(opts = {}) {
  const alerts = []
  const powerStates = new Map()
  const legacyRow = opts.legacyDisconnect
    ? { traccar_id: TRACCAR_ID, disconnect_trigger: opts.legacyTrigger || 'telemetry' }
    : null
  if (legacyRow) powerStates.set(String(TRACCAR_ID), legacyRow.disconnect_trigger)
  const db = {
    query: async (sql, params = []) => {
      if (/FROM devices WHERE traccar_id/.test(sql)) return { rows: [DEVICE_ROW] }
      if (/FROM device_power_states WHERE disconnected/.test(sql)) {
        return { rows: legacyRow ? [legacyRow] : [] }
      }
      if (/INSERT INTO alerts/.test(sql)) {
        const type = /power_restored/.test(sql) ? 'power_restored' : 'power_disconnected'
        alerts.push(type)
        return { rows: [{ id: alerts.length, type, message: '', data: JSON.parse(params[3] || '{}'), created_at: new Date().toISOString() }] }
      }
      if (/INSERT INTO device_power_states/.test(sql)) { powerStates.set(String(params[0]), params[1]); return { rows: [] } }
      if (/DELETE FROM device_power_states/.test(sql)) { powerStates.delete(String(params[0])); return { rows: [] } }
      return { rows: [] }
    },
  }
  const wsEvents = []
  let clock = Date.UTC(2026, 7, 31, 12, 0, 0)
  const timers = new Map()
  let seq = 0
  const setTimeoutFn = (fn, delay) => { const id = ++seq; timers.set(id, { fn, fire: clock + (delay || 0) }); return id }
  const clearTimeoutFn = (id) => { timers.delete(id) }
  const engine = createPowerAlertEngine({
    db,
    getAllPositions: async () => [],
    sendPowerDisconnectEvent: () => wsEvents.push('device:power-disconnected'),
    sendPowerRestoredEvent: () => wsEvents.push('device:power-restored'),
    now: () => clock,
    setTimeoutFn,
    clearTimeoutFn,
  })
  markVehicleConnected(TRACCAR_ID)
  clearVehicleVoltage(TRACCAR_ID)
  engineCommandCooldowns.delete(String(TRACCAR_ID))

  let positionId = 5000
  async function send(attributes) {
    clock += 60_000
    positionId += 1
    const iso = new Date(clock).toISOString()
    const position = {
      id: positionId,
      deviceId: TRACCAR_ID,
      latitude: 33.57,
      longitude: -7.59,
      speed: 0,
      serverTime: iso,
      deviceTime: iso,
      fixTime: iso,
      attributes,
    }
    engine.observePowerTelemetry(position)
    for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setImmediate(resolve))
    return position
  }
  function fireTimers() {
    for (const [id, t] of [...timers.entries()]) {
      if (t.fire <= clock) { timers.delete(id); t.fn() }
    }
  }
  return {
    send,
    alerts,
    wsEvents,
    powerStates,
    engine,
    advance: (ms) => { clock += ms; fireTimers() },
    state: () => engine.powerTelemetry.get(String(TRACCAR_ID)),
  }
}

const CONNECTED = { charge: true, ignition: true, batteryLevel: 100, adc1: 13.6 }
const STANDALONE_LOSS = { charge: false, ignition: false, batteryLevel: 16, alarm: 'lowBattery', blocked: true }

test.beforeEach(() => {
  markVehicleConnected(TRACCAR_ID)
  engineCommandCooldowns.clear()
})

// ── Pure detector tests ──────────────────────────────────────────────────────

test('FIX 1: charge:false is never a power loss (everSeenBatteryVoltage gate obsolete)', () => {
  // charge:false is NOT a validated disconnect signal regardless of whether
  // the device previously reported a vehicle-battery voltage. The old
  // everSeenBatteryVoltage gate is obsolete — charge:false simply never fires.
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false } }, { everSeenBatteryVoltage: false }), null)
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false } }, { everSeenBatteryVoltage: true }), null)
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false } }), null)
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false, voltage: 12.7 } }, { everSeenBatteryVoltage: true }), null)
  // Explicit electrical signals (direct keys) are unaffected.
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { externalPower: false } })?.source, 'externalPower')
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { powerCut: true } })?.source, 'powerCut')
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { alarm: 'lowBattery' } }), null)
})

test('FIX 2: a bare voltage reading is not a restoration', () => {
  assert.equal(detectExternalPowerRestored({ attributes: { adc1: 13.4 } }), null)
  assert.equal(detectExternalPowerRestored({ attributes: { voltage: 12.8 } }), null)
  assert.equal(detectExternalPowerRestored({ attributes: { adc1: 4.7 } }), null)
  assert.equal(detectExternalPowerRestored({ attributes: {} }), null)
  assert.equal(detectExternalPowerRestored({ attributes: { charge: true } })?.source, 'charge:true')
  assert.equal(detectExternalPowerRestored({ attributes: { powerCut: false } })?.source, 'powerCut:false')
  assert.equal(detectExternalPowerRestored({ attributes: { externalPower: true } })?.source, 'externalPower:true')
})

// ── Engine lifecycle tests ────────────────────────────────────────

// 1. Standalone tracker: charge:false + no voltage -> NO power_disconnected
test('1. standalone charge:false + no voltage -> no disconnect', async () => {
  const h = makeHarness()
  await h.send({ charge: false })
  await h.send({ charge: false })
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 0)
  assert.equal(h.state()?.disconnected, false)
  assert.equal(isVehicleDisconnected(TRACCAR_ID), false)
})

// 2. Standalone: repeated charge:false + no voltage -> no alert flapping
test('2. standalone repeated charge:false -> no flapping', async () => {
  const h = makeHarness()
  for (let i = 0; i < 6; i += 1) await h.send({ charge: false, batteryLevel: 16 })
  assert.equal(h.alerts.length, 0)
  assert.equal(h.wsEvents.length, 0)
})

// 3. Connectivity silence only -> NO power_disconnected
test('3. connectivity silence only -> no disconnect', async () => {
  const h = makeHarness()
  await h.send(CONNECTED)
  h.advance(30 * 60 * 1000) // 30 min with no packets; silence timer fires
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 0)
  assert.equal(h.state()?.disconnected, false)
})

// 4. Reconnect: charge:true alone -> restore only if a real disconnect exists
test('4. reconnect charge:true alone -> restore only if real disconnect exists', async () => {
  const h = makeHarness()
  await h.send({ charge: true, batteryLevel: 100, adc1: 13.6 }) // online, no prior disconnect
  assert.equal(h.alerts.filter((a) => a === 'power_restored').length, 0)
})

// 5. Voltage appears without affirmative restore -> NO power_restored
test('5. voltage appears without affirmative restore -> no restore', async () => {
  const h = makeHarness()
  await h.send(CONNECTED)                       // vehicle context
  await h.send({ externalPower: false })        // explicit loss -> disconnect
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 1)
  await h.send({ adc1: 12.8 })                  // bare voltage, no affirmative restore
  await h.send({ adc1: 12.9 })
  assert.equal(h.alerts.filter((a) => a === 'power_restored').length, 0)
  assert.equal(h.state()?.disconnected, true)
})

// 6. Reconnect snapshot replay same signature -> NO duplicate transition
test('6. reconnect snapshot replay same signature -> no duplicate', async () => {
  const h = makeHarness()
  await h.send(CONNECTED)
  const lossPosition = await h.send({ externalPower: false }) // explicit loss -> disconnect
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 1)
  // Reconnect replays the SAME position (identical signature = last processed).
  h.engine.observePowerTelemetry(lossPosition)
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setImmediate(resolve))
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 1) // FIX 3: no duplicate
})

// 7. Real external-power context then validated loss -> exactly ONE disconnect
test('7. real vehicle context then validated loss -> one disconnect', async () => {
  const h = makeHarness()
  await h.send(CONNECTED)        // adc1:13.6 -> vehicle context established
  await h.send({ externalPower: false }) // explicit validated loss
  await h.send({ externalPower: false })
  await h.send({ externalPower: false })
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 1)
  assert.equal(h.state()?.disconnected, true)
  assert.equal(h.powerStates.get(String(TRACCAR_ID)), 'telemetry')
})

// 8. Real restoration after genuine disconnect -> exactly ONE restore
test('8. real restoration after genuine disconnect -> one restore', async () => {
  const h = makeHarness()
  await h.send(CONNECTED)
  await h.send({ externalPower: false })       // explicit loss -> disconnect
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 1)
  await h.send({ charge: true, batteryLevel: 100, adc1: 13.6 }) // affirmative restore
  await h.send({ charge: true, batteryLevel: 100, adc1: 13.6 }) // repeated -> no duplicate
  assert.equal(h.alerts.filter((a) => a === 'power_restored').length, 1)
  assert.equal(h.state()?.disconnected, false)
  assert.equal(h.powerStates.size, 0)
})

// 9. Existing power alert behavior remains compatible
test('9. existing behavior compatible: directKey loss + affirmative restore', () => {
  assert.equal(detectExternalPowerLoss({ deviceId: TRACCAR_ID, attributes: { externalPower: false } })?.source, 'externalPower')
  assert.equal(detectExternalPowerRestored({ attributes: { charge: true } })?.source, 'charge:true')
  assert.equal(detectExternalPowerRestored({ attributes: { powerCut: false } })?.source, 'powerCut:false')
  assert.equal(ENGINE_COMMAND_POWER_SUPPRESSION_MS, 60 * 1000)
})

// 10. No engine command code changed
test('10. engine-command code unchanged: cooldown API + isBatteryVoltage intact', () => {
  assert.equal(typeof engineCommandCooldowns, 'object')
  assert.equal(ENGINE_COMMAND_POWER_SUPPRESSION_MS, 60 * 1000)
  assert.equal(isBatteryVoltage(12.6), true)
  assert.equal(isBatteryVoltage(4.7), false)
})

// ── Phase 2G-FIX-2: legacy false-restore suppression ─────────────────────────────
// A standalone tracker (everSeenBatteryVoltage=false) that holds a stale
// disconnected=true row written by the pre-gate code must be restored SILENTLY:
// clear the device_power_states row, fire NO power_restored alert.

// 11. Legacy false-disconnect (trigger=telemetry) + standalone clean -> silent clear
test('11. legacy false-disconnect (trigger=telemetry) + standalone clean -> silent clear, zero restore', async () => {
  const h = makeHarness({ legacyDisconnect: true, legacyTrigger: 'telemetry' })
  await h.engine.loadPersistedPowerStates()
  assert.equal(h.state()?.disconnected, true)
  assert.equal(h.state()?.everSeenBatteryVoltage, false)
  assert.equal(h.powerStates.get(String(TRACCAR_ID)), 'telemetry')
  await h.send({ charge: false, batteryLevel: 83, adc1: 6.4 })
  await h.send({ charge: false, batteryLevel: 83, adc1: 6.4 })
  await h.send({ charge: false, batteryLevel: 83, adc1: 6.4 })
  assert.equal(h.alerts.filter((a) => a === 'power_restored').length, 0)
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 0)
  assert.equal(h.state()?.disconnected, false)
  assert.equal(h.powerStates.size, 0)
})

// 12. Real vehicle (everSeenBatteryVoltage=true) genuine disconnect + restore -> exactly one restore
test('12. real vehicle everSeenBatteryVoltage=true + genuine disconnect + restore -> exactly one power_restored', async () => {
  const h = makeHarness()
  await h.send(CONNECTED)
  await h.send({ externalPower: false })
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 1)
  await h.send({ charge: true, batteryLevel: 100, adc1: 13.6 })
  assert.equal(h.alerts.filter((a) => a === 'power_restored').length, 1)
  assert.equal(h.state()?.disconnected, false)
  assert.equal(h.powerStates.size, 0)
})

// 13. Standalone GT06 charge:false + no vehicle battery -> zero disconnect AND zero restore
test('13. standalone GT06 charge:false + no vehicle battery -> zero disconnect, zero restore', async () => {
  const h = makeHarness()
  for (let i = 0; i < 8; i += 1) await h.send({ charge: false, batteryLevel: 83, adc1: 6.4 })
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 0)
  assert.equal(h.alerts.filter((a) => a === 'power_restored').length, 0)
  assert.equal(h.alerts.length, 0)
  assert.equal(h.powerStates.size, 0)
})

// 14. Repeated clean packets after legacy stale state -> no restore flapping
test('14. repeated clean packets after legacy stale state -> no restore flapping', async () => {
  const h = makeHarness({ legacyDisconnect: true, legacyTrigger: 'telemetry' })
  await h.engine.loadPersistedPowerStates()
  for (let i = 0; i < 10; i += 1) await h.send({ charge: false, batteryLevel: 83, adc1: 6.4 })
  assert.equal(h.alerts.filter((a) => a === 'power_restored').length, 0)
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 0)
  assert.equal(h.state()?.disconnected, false)
  assert.equal(h.powerStates.size, 0)
})

// 15. Restart (loadPersistedPowerStates) + clean standalone -> no false restore (exact #1247 path)
test('15. restart with legacy silence-trigger + first clean standalone packet -> silent clear, no false restore', async () => {
  const h = makeHarness({ legacyDisconnect: true, legacyTrigger: 'silence' })
  await h.engine.loadPersistedPowerStates()
  assert.equal(h.state()?.disconnectTrigger, 'silence')
  await h.send({ charge: false, batteryLevel: 83, adc1: 6.4 })
  assert.equal(h.alerts.filter((a) => a === 'power_restored').length, 0)
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 0)
  assert.equal(h.state()?.disconnected, false)
  assert.equal(h.powerStates.size, 0)
})
