// Regression: proves charge:false can NEVER create a battery-disconnect alert.
// Locks down the fix for false-positive alerts (e.g. production alert #1267,
// data.reason="charge:false"). If any code path re-introduces charge:false as
// a disconnect signal, these tests will fail.
import test from 'node:test'
import assert from 'node:assert/strict'

import { createPowerAlertEngine } from '../src/services/powerAlerts.js'
import {
  detectExternalPowerLoss,
  detectExternalPowerRestored,
  isVehicleDisconnected,
  markVehicleConnected,
  clearVehicleVoltage,
  engineCommandCooldowns,
} from '../src/services/vehicleTelemetry.js'

const TRACCAR_ID = 70

function makeHarness() {
  const alerts = []
  const powerStates = new Map()
  const db = {
    query: async (sql, params = []) => {
      if (/FROM devices WHERE traccar_id/.test(sql)) return { rows: [{ id: 16, traccar_id: TRACCAR_ID, user_id: 3, name: 'DACIA' }] }
      if (/INSERT INTO alerts/.test(sql)) {
        const type = /power_restored/.test(sql) ? 'power_restored' : 'power_disconnected'
        alerts.push(type)
        return { rows: [{ id: alerts.length, type, data: JSON.parse(params[3] || '{}') }] }
      }
      if (/INSERT INTO device_power_states/.test(sql)) { powerStates.set(String(params[0]), params[1]); return { rows: [] } }
      if (/DELETE FROM device_power_states/.test(sql)) { powerStates.delete(String(params[0])); return { rows: [] } }
      return { rows: [] }
    },
  }
  let clock = Date.UTC(2026, 8, 2, 12, 0, 0)
  const engine = createPowerAlertEngine({ db, getAllPositions: async () => [], sendPowerDisconnectEvent: () => {}, sendPowerRestoredEvent: () => {}, now: () => clock, setTimeoutFn: () => 0, clearTimeoutFn: () => {} })
  markVehicleConnected(TRACCAR_ID)
  clearVehicleVoltage(TRACCAR_ID)
  engineCommandCooldowns.delete(String(TRACCAR_ID))
  let positionId = 9000
  async function send(attributes) {
    clock += 60_000
    positionId += 1
    const iso = new Date(clock).toISOString()
    engine.observePowerTelemetry({ id: positionId, deviceId: TRACCAR_ID, latitude: 33.57, longitude: -7.59, speed: 0, serverTime: iso, deviceTime: iso, fixTime: iso, attributes })
    for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setImmediate(resolve))
  }
  return { send, alerts, powerStates, engine, state: () => engine.powerTelemetry.get(String(TRACCAR_ID)) }
}

// ── Pure detector: charge:false is never a loss ──
test('regression: charge:false alone is never a power loss', () => {
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false } }), null)
})
test('regression: charge:false with voltage is never a power loss', () => {
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false, voltage: 12.7 } }), null)
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false, voltage: 24.2 } }), null)
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false, voltage: 4.7 } }), null)
})
test('regression: charge:false with low battery is never a power loss', () => {
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false, batteryLevel: 16 } }), null)
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false, batteryLevel: 5 } }), null)
})
test('regression: charge:false with alarm is never a power loss', () => {
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false, alarm: 'lowBattery' } }), null)
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false, alarm: 'powerCut' } }), null)
})
test('regression: charge:false with full noise payload is never a power loss', () => {
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false, ignition: false, blocked: true, alarm: 'lowBattery', batteryLevel: 16 } }), null)
})
test('regression: charge:false is never a loss regardless of everSeenBatteryVoltage', () => {
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false } }, { everSeenBatteryVoltage: false }), null)
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false } }, { everSeenBatteryVoltage: true }), null)
})

// ── Engine: repeated charge:false produces zero disconnect alerts ──
test('regression: repeated charge:false produces zero disconnect alerts', async () => {
  const h = makeHarness()
  await h.send({ charge: true, batteryLevel: 100, adc1: 13.6 })
  for (let i = 0; i < 10; i += 1) await h.send({ charge: false, batteryLevel: 16, alarm: 'lowBattery' })
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 0)
  assert.equal(h.state()?.disconnected, false)
  assert.equal(isVehicleDisconnected(TRACCAR_ID), false)
  assert.equal(h.powerStates.size, 0)
})
test('regression: charge:false after vehicle context still produces zero disconnects', async () => {
  const h = makeHarness()
  await h.send({ charge: true, batteryLevel: 100, adc1: 13.6 })
  for (let i = 0; i < 5; i += 1) await h.send({ charge: false, batteryLevel: 16 })
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 0)
  assert.equal(isVehicleDisconnected(TRACCAR_ID), false)
})

// ── Explicit validated signals still work ──
test('regression: explicit powerCut:true is still a valid disconnect', () => {
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { powerCut: true } })?.source, 'powerCut')
})
test('regression: explicit externalPowerLost:true is still a valid disconnect', () => {
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { externalPowerLost: true } })?.source, 'externalPowerLost')
})
test('regression: explicit externalPower:false is still a valid disconnect', () => {
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { externalPower: false } })?.source, 'externalPower')
})
test('regression: explicit loss then restore produces exactly one alert pair', async () => {
  const h = makeHarness()
  await h.send({ charge: true, batteryLevel: 100, adc1: 13.6 })
  await h.send({ externalPower: false })
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 1)
  await h.send({ charge: true, batteryLevel: 100, adc1: 13.6 })
  assert.equal(h.alerts.filter((a) => a === 'power_restored').length, 1)
  assert.equal(h.state()?.disconnected, false)
})

// ── Restore semantics ──
test('regression: charge:true is still a valid restore signal', () => {
  assert.equal(detectExternalPowerRestored({ attributes: { charge: true } })?.source, 'charge:true')
})
test('regression: explicit powerCut:false is still a valid restore signal', () => {
  assert.equal(detectExternalPowerRestored({ attributes: { powerCut: false } })?.source, 'powerCut:false')
})

// ── No duplicate spam ──
test('regression: repeated same explicit loss produces one disconnect, not spam', async () => {
  const h = makeHarness()
  await h.send({ charge: true, batteryLevel: 100, adc1: 13.6 })
  for (let i = 0; i < 5; i += 1) await h.send({ externalPower: false })
  assert.equal(h.alerts.filter((a) => a === 'power_disconnected').length, 1)
})
test('regression: repeated charge:true after restore produces one restore, not spam', async () => {
  const h = makeHarness()
  await h.send({ charge: true, batteryLevel: 100, adc1: 13.6 })
  await h.send({ externalPower: false })
  await h.send({ charge: true, batteryLevel: 100, adc1: 13.6 })
  assert.equal(h.alerts.filter((a) => a === 'power_restored').length, 1)
  await h.send({ charge: true, batteryLevel: 100, adc1: 13.6 })
  await h.send({ charge: true, batteryLevel: 100, adc1: 13.6 })
  assert.equal(h.alerts.filter((a) => a === 'power_restored').length, 1)
})
