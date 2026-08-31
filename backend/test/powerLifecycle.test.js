// Deterministic coverage for the REPEATABLE external-power episode lifecycle.
//
// Real production symptom this locks down: the first charge:false disconnect
// alerted, but later disconnects stayed silent because the episode never
// closed when the restore packet omitted `charge` (GT06 frequently does after
// the tracker reboots on restored power). A stuck DISCONNECTED state makes
// every later loss signal a no-op.
import test from 'node:test'
import assert from 'node:assert/strict'

import { createPowerAlertEngine } from '../src/services/powerAlerts.js'
import {
  detectExternalPowerLoss,
  detectExternalPowerRestored,
  isVehicleDisconnected,
  markVehicleConnected,
  readVehicleVoltage,
  clearVehicleVoltage,
  registerEngineCommandCooldown,
  engineCommandCooldowns,
} from '../src/services/vehicleTelemetry.js'

const TRACCAR_ID = 70

function makeHarness() {
  const alerts = []
  const powerStates = new Map()
  const db = {
    query: async (sql, params = []) => {
      if (/FROM devices WHERE traccar_id/.test(sql)) {
        return { rows: [{ id: 7, traccar_id: TRACCAR_ID, user_id: 1, name: 'DACIA' }] }
      }
      if (/INSERT INTO alerts/.test(sql)) {
        const type = /power_restored/.test(sql) ? 'power_restored' : 'power_disconnected'
        alerts.push(type)
        return { rows: [{ id: alerts.length, type, message: '', data: {}, created_at: new Date() }] }
      }
      if (/INSERT INTO device_power_states/.test(sql)) {
        powerStates.set(params[0], params[1])
        return { rows: [] }
      }
      if (/DELETE FROM device_power_states/.test(sql)) {
        powerStates.delete(params[0])
        return { rows: [] }
      }
      return { rows: [] }
    },
  }

  const wsEvents = []
  let clock = Date.UTC(2026, 7, 28, 12, 0, 0)
  const engine = createPowerAlertEngine({
    db,
    getAllPositions: async () => [],
    sendPowerDisconnectEvent: () => wsEvents.push('device:power-disconnected'),
    sendPowerRestoredEvent: () => wsEvents.push('device:power-restored'),
    now: () => clock,
    setTimeoutFn: () => 0,
    clearTimeoutFn: () => {},
  })

  markVehicleConnected(TRACCAR_ID)
  clearVehicleVoltage(TRACCAR_ID)
  engineCommandCooldowns.delete(String(TRACCAR_ID))

  let positionId = 5000
  async function send(attributes) {
    clock += 60_000
    positionId += 1
    const iso = new Date(clock).toISOString()
    engine.observePowerTelemetry({
      id: positionId,
      deviceId: TRACCAR_ID,
      latitude: 33.57,
      longitude: -7.59,
      speed: 0,
      serverTime: iso,
      deviceTime: iso,
      fixTime: iso,
      attributes,
    })
    // Let the awaited alert inserts settle.
    for (let i = 0; i < 4; i += 1) await new Promise(resolve => setImmediate(resolve))
  }

  return {
    send,
    alerts,
    wsEvents,
    powerStates,
    engine,
    advance: ms => { clock += ms },
    state: () => engine.powerTelemetry.get(String(TRACCAR_ID)),
  }
}

const CONNECTED = { charge: true, ignition: true, batteryLevel: 100, adc1: 13.6 }
const LOST = { charge: false, ignition: false, batteryLevel: 16, alarm: 'lowBattery', blocked: true }
// A real post-reboot GT06 frame: no `charge` field, but a genuine 12V reading.
const RESTORED_NO_CHARGE = { ignition: false, batteryLevel: 40, adc1: 13.4 }

test('signal detection: only explicit electrical feedback counts', () => {
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: false } })?.source, 'charge:false')
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { charge: true } }), null)
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { alarm: 'lowBattery' } }), null)
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { batteryLevel: 5 } }), null)
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { ignition: false } }), null)
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: { blocked: true } }), null)
  assert.equal(detectExternalPowerLoss({ deviceId: 1, attributes: {} }), null)

  assert.equal(detectExternalPowerRestored({ attributes: { charge: true } })?.source, 'charge:true')
  // FIX 2: a bare voltage reading is NOT an affirmative restoration signal.
  assert.equal(detectExternalPowerRestored({ attributes: { adc1: 13.4 } }), null)
  // The internal backup cell (≈4.7V measured on DACIA) is NOT a restore proof.
  assert.equal(detectExternalPowerRestored({ attributes: { adc1: 4.7 } }), null)
  assert.equal(detectExternalPowerRestored({ attributes: {} }), null)
})

test('engine cooldown suppresses the relay echo and expires', () => {
  const key = String(TRACCAR_ID)
  engineCommandCooldowns.delete(key)
  registerEngineCommandCooldown(TRACCAR_ID, 7, Date.now())
  assert.equal(detectExternalPowerLoss({ deviceId: TRACCAR_ID, attributes: { charge: false } }), null)
  // 60s later the same signal is honoured again — the cooldown never
  // permanently suppresses a genuine later disconnect.
  engineCommandCooldowns.set(key, Date.now() - 61_000)
  assert.equal(
    detectExternalPowerLoss({ deviceId: TRACCAR_ID, attributes: { charge: false } })?.source,
    'charge:false',
  )
  engineCommandCooldowns.delete(key)
})

test('three real disconnect episodes each produce exactly one alert pair', async () => {
  const h = makeHarness()

  await h.send(CONNECTED)
  assert.deepEqual(h.alerts, [])
  assert.equal(h.powerStates.size, 0)

  // Episode 1 — repeated identical loss packets must not duplicate.
  await h.send(LOST)
  await h.send(LOST)
  await h.send(LOST)
  assert.deepEqual(h.alerts, ['power_disconnected'])
  assert.equal(h.state().disconnected, true)
  assert.equal(h.powerStates.get(TRACCAR_ID), 'telemetry')
  assert.equal(isVehicleDisconnected(TRACCAR_ID), true)

  // Restore #1 through charge:true, repeated packets must not duplicate.
  await h.send(CONNECTED)
  await h.send(CONNECTED)
  assert.deepEqual(h.alerts, ['power_disconnected', 'power_restored'])
  assert.equal(h.state().disconnected, false)
  assert.equal(h.powerStates.size, 0)
  assert.equal(isVehicleDisconnected(TRACCAR_ID), false)

  // Episode 2.
  await h.send(LOST)
  assert.equal(h.alerts.filter(a => a === 'power_disconnected').length, 2)
  assert.equal(h.powerStates.get(TRACCAR_ID), 'telemetry')

  // Restore #2 WITHOUT a charge field — three clean packets (no loss signal)
  // close the episode via the clean-telemetry probation. A single bare voltage
  // reading no longer restores by itself (FIX 2).
  await h.send(RESTORED_NO_CHARGE)
  await h.send(RESTORED_NO_CHARGE)
  await h.send(RESTORED_NO_CHARGE)
  assert.equal(h.alerts.filter(a => a === 'power_restored').length, 2)
  assert.equal(h.state().disconnected, false)
  assert.equal(h.powerStates.size, 0)

  // Episode 3.
  await h.send(LOST)
  assert.equal(h.alerts.filter(a => a === 'power_disconnected').length, 3)
  assert.equal(h.powerStates.get(TRACCAR_ID), 'telemetry')

  assert.deepEqual(h.wsEvents, [
    'device:power-disconnected',
    'device:power-restored',
    'device:power-disconnected',
    'device:power-restored',
    'device:power-disconnected',
  ])
})

test('silence alone never creates a battery disconnect', async () => {
  const h = makeHarness()
  await h.send(CONNECTED)
  h.advance(30 * 60 * 1000) // half an hour with no packets at all
  assert.deepEqual(h.alerts, [])
  assert.equal(h.state().disconnected, false)
  assert.equal(h.powerStates.size, 0)
})

test('voltage is not served from cache while the disconnect is confirmed', async () => {
  const h = makeHarness()
  await h.send(CONNECTED)
  const connectedPosition = { deviceId: TRACCAR_ID, attributes: {} }
  // Field temporarily missing but power still present → keep the last reading.
  assert.equal(readVehicleVoltage(connectedPosition, TRACCAR_ID), 13.6)

  await h.send(LOST)
  assert.equal(isVehicleDisconnected(TRACCAR_ID), true)
  assert.equal(readVehicleVoltage(connectedPosition, TRACCAR_ID), null)

  // After a real restore the genuine reading is available again.
  await h.send(CONNECTED)
  assert.equal(readVehicleVoltage(connectedPosition, TRACCAR_ID), 13.6)
})
