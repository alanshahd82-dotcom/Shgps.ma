// Deterministic tests for GT06 external-power detection.
//
// Confirmed real telemetry (Traccar REST, 2026-08-28):
//   DACIA  / 70: charge:false, ignition:false, blocked:true,
//                alarm:"lowBattery", batteryLevel:16, status offline
//   BEKANE / 37: charge:true, ignition:true, blocked:false, batteryLevel:100
//
// GT06 does NOT send externalPower / powerCut / powerLost. The `charge` field
// (charge:false = alternator idle) is NOT a validated battery-disconnect signal.
// Only explicit powerCut / externalPowerLost / externalPower:false triggers a
// disconnect — charge:false, missing voltage, and silence never do.
import test from 'node:test'
import assert from 'node:assert/strict'

import { createPowerAlertEngine } from '../src/services/powerAlerts.js'
import {
  detectExternalPowerLoss,
  detectExternalPowerRestored,
  markVehicleConnected,
  isVehicleDisconnected,
  registerEngineCommandCooldown,
  engineCommandCooldowns,
  ENGINE_COMMAND_POWER_SUPPRESSION_MS,
} from '../src/services/vehicleTelemetry.js'

const TRACCAR_ID = 70
const DEVICE_ROW = { id: 16, traccar_id: TRACCAR_ID, user_id: 3, name: 'DACIA' }

function pos(attributes) {
  return {
    deviceId: TRACCAR_ID,
    serverTime: new Date().toISOString(),
    latitude: 31.6,
    longitude: -8.0,
    attributes,
  }
}

test.beforeEach(() => {
  markVehicleConnected(TRACCAR_ID)
  engineCommandCooldowns.clear()
})

// ── Pure detector tests ──────────────────────────────────────────────────────

test('TEST 1 — charge:false is NOT an external power loss', () => {
  // GT06 charge:false means "alternator not charging" (engine off), not a
  // battery disconnect. It must never trigger a power-loss alert by itself.
  assert.equal(detectExternalPowerLoss(pos({ charge: false })), null)
})

test('charge:false is NOT a power loss regardless of voltage', () => {
  // charge:false never triggers a disconnect, whether voltage is present,
  // healthy, low, or absent. Only explicit powerCut/externalPowerLost signals.
  assert.equal(detectExternalPowerLoss(pos({ charge: false, power: 12.7 })), null)
  assert.equal(detectExternalPowerLoss(pos({ charge: false, voltage: 24.2 })), null)
  assert.equal(detectExternalPowerLoss(pos({ charge: false, power: 4.7 })), null)
  assert.equal(detectExternalPowerLoss(pos({ charge: false })), null)
})

test('TEST 2 — charge:true is an affirmative restore signal', () => {
  assert.deepEqual(detectExternalPowerRestored(pos({ charge: true })), { source: 'charge:true' })
})

test('TEST 3 — alarm:lowBattery alone is NOT a disconnect', () => {
  assert.equal(detectExternalPowerLoss(pos({ alarm: 'lowBattery' })), null)
})

test('TEST 4 — low batteryLevel alone is NOT a disconnect', () => {
  assert.equal(detectExternalPowerLoss(pos({ batteryLevel: 16 })), null)
})

test('TEST 5 — ignition:false alone is NOT a disconnect', () => {
  assert.equal(detectExternalPowerLoss(pos({ ignition: false })), null)
})

test('TEST 6 — blocked:true alone is NOT a disconnect', () => {
  assert.equal(detectExternalPowerLoss(pos({ blocked: true })), null)
})

test('TEST 7 — silence / no attributes is NOT a disconnect', () => {
  assert.equal(detectExternalPowerLoss(pos({})), null)
  assert.equal(detectExternalPowerLoss(undefined), null)
})

test('TEST 8 — charge:false during engine cooldown stays suppressed', () => {
  registerEngineCommandCooldown(TRACCAR_ID, DEVICE_ROW.id, Date.now())
  assert.equal(detectExternalPowerLoss(pos({ charge: false })), null)
  // Existing ~60s window is unchanged.
  assert.equal(ENGINE_COMMAND_POWER_SUPPRESSION_MS, 60 * 1000)
})

test('real DACIA packet: charge:false + lowBattery noise is NOT a power loss', () => {
  // The exact production packet that caused false alert #1267: charge:false
  // + alarm:lowBattery + batteryLevel:16. None of these are a validated
  // battery-disconnect signal, so the detector must return null.
  const signal = detectExternalPowerLoss(pos({
    charge: false, ignition: false, blocked: true, alarm: 'lowBattery', batteryLevel: 16,
  }))
  assert.equal(signal, null)
})

// ── Engine tests (existing state machine, no parallel implementation) ────────

function createMockDb() {
  const alerts = []
  const powerStates = new Map()
  return {
    alerts,
    powerStates,
    async query(sql, params = []) {
      if (sql.includes('FROM devices')) return { rows: [DEVICE_ROW] }
      if (sql.includes('INSERT INTO alerts')) {
        const alert = {
          id: alerts.length + 1,
          type: sql.includes("'power_restored'") ? 'power_restored' : 'power_disconnected',
          data: JSON.parse(params[3]),
        }
        alerts.push(alert)
        return { rows: [alert] }
      }
      if (sql.includes('INSERT INTO device_power_states')) {
        powerStates.set(String(params[0]), { disconnected: true, trigger: params[1] })
        return { rows: [] }
      }
      if (sql.includes('DELETE FROM device_power_states')) {
        powerStates.delete(String(params[0]))
        return { rows: [] }
      }
      if (sql.includes('FROM device_power_states')) return { rows: [] }
      throw new Error('Unexpected query in test: ' + sql)
    },
  }
}

function createHarness() {
  const db = createMockDb()
  const clock = { nowMs: 1_000_000_000_000 }
  const disconnectEvents = []
  const restoreEvents = []
  const engine = createPowerAlertEngine({
    db,
    getAllPositions: async () => [],
    sendPowerDisconnectEvent: (d, a) => disconnectEvents.push({ d, a }),
    sendPowerRestoredEvent: (d, a) => restoreEvents.push({ d, a }),
    now: () => clock.nowMs,
    setTimeoutFn: () => 0,
    clearTimeoutFn: () => {},
  })
  return { db, clock, engine, disconnectEvents, restoreEvents }
}

const flush = () => new Promise((resolve) => setImmediate(resolve))

function feed(h, attributes) {
  h.clock.nowMs += 1000
  h.engine.observePowerTelemetry({
    deviceId: TRACCAR_ID,
    serverTime: new Date(h.clock.nowMs).toISOString(),
    latitude: 31.6,
    longitude: -8.0,
    attributes,
  })
  return flush()
}

const typed = (db, type) => db.alerts.filter((a) => a.type === type)

test('TEST 9 — repeated charge:false produces ZERO disconnect transitions', async () => {
  const h = createHarness()
  await feed(h, { charge: true, batteryLevel: 100, adc1: 13.6 })
  await feed(h, { charge: false, alarm: 'lowBattery', batteryLevel: 16 })
  await feed(h, { charge: false, batteryLevel: 15 })
  await feed(h, { charge: false, batteryLevel: 14 })

  // charge:false is not a validated disconnect signal — zero alerts, zero
  // state transitions, no flapping.
  assert.equal(typed(h.db, 'power_disconnected').length, 0)
  assert.equal(h.disconnectEvents.length, 0)
  assert.equal(h.db.powerStates.size, 0)
  assert.equal(isVehicleDisconnected(TRACCAR_ID), false)
})

test('TEST 10 — explicit loss then charge:true restore produces ONE restore transition', async () => {
  const h = createHarness()
  await feed(h, { charge: true, batteryLevel: 100, adc1: 13.6 })
  await feed(h, { externalPower: false })  // explicit validated loss → disconnect
  assert.equal(typed(h.db, 'power_disconnected').length, 1)

  await feed(h, { charge: true, batteryLevel: 100 })
  await feed(h, { charge: true, batteryLevel: 100 })
  await feed(h, { charge: true, ignition: true })

  assert.equal(typed(h.db, 'power_restored').length, 1)
  assert.equal(h.restoreEvents.length, 1)
  assert.equal(h.db.powerStates.size, 0)
  assert.equal(isVehicleDisconnected(TRACCAR_ID), false)
})

test('lowBattery / low batteryLevel alone never reaches the alert engine', async () => {
  const h = createHarness()
  await feed(h, { alarm: 'lowBattery', batteryLevel: 16, ignition: false, blocked: true })
  assert.equal(typed(h.db, 'power_disconnected').length, 0)
  assert.equal(h.disconnectEvents.length, 0)
  assert.equal(isVehicleDisconnected(TRACCAR_ID), false)
})
