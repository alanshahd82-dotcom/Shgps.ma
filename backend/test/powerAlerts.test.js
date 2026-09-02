// Deterministic tests for the silence-alert verification logic that fixed the
// false "power disconnected" spam for idle devices. Every silence-triggered
// alert must be verified against Traccar REST before firing; a fresh Traccar
// position cancels the alert; a hung Traccar request is timed out and retried
// instead of firing blindly.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createPowerAlertEngine,
  withTimeout,
  POWER_VERIFY_TIMEOUT_MS,
} from '../src/services/powerAlerts.js'
import {
  POWER_SILENCE_WINDOW_MS,
  isVehicleDisconnected,
  markVehicleConnected,
} from '../src/services/vehicleTelemetry.js'

const DEVICE_TRACCAR_ID = 77
const DEVICE_ROW = { id: 5, traccar_id: DEVICE_TRACCAR_ID, user_id: 9, name: 'bekane' }

// ── Test doubles ──────────────────────────────────────────────────────────────

function createMockDb() {
  const alerts = []
  const powerStates = new Map()
  return {
    alerts,
    powerStates,
    async query(sql, params = []) {
      if (sql.includes('FROM devices')) {
        return { rows: [DEVICE_ROW] }
      }
      if (sql.includes('INSERT INTO alerts')) {
        const alert = {
          id: alerts.length + 1,
          device_id: params[0],
          user_id: params[1],
          type: sql.includes("'power_restored'") ? 'power_restored' : 'power_disconnected',
          message: params[2],
          data: JSON.parse(params[3]),
          created_at: new Date(0).toISOString(),
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
      if (sql.includes('FROM device_power_states')) {
        return { rows: [] }
      }
      throw new Error('Unexpected query in test: ' + sql)
    },
  }
}

/**
 * Manual timer registry so tests control exactly which scheduled callbacks run
 * and when — no real waiting, fully deterministic.
 */
function createManualTimers() {
  let seq = 0
  const pending = new Map() // id -> { fn, delay }
  return {
    pending,
    setTimeoutFn(fn, delay) {
      const id = ++seq
      pending.set(id, { fn, delay })
      return id
    },
    clearTimeoutFn(id) {
      pending.delete(id)
    },
    /** Run and remove every currently pending timer whose delay <= maxDelay. */
    async runPending(maxDelay = Infinity) {
      const entries = [...pending.entries()].filter(([, t]) => t.delay <= maxDelay)
      for (const [id, t] of entries) {
        pending.delete(id)
        await t.fn()
      }
    },
  }
}

function createHarness({ getAllPositions, verifyTimeoutMs = POWER_VERIFY_TIMEOUT_MS }) {
  const db = createMockDb()
  const timers = createManualTimers()
  const clock = { nowMs: 1_000_000_000_000 }
  const disconnectEvents = []
  const restoreEvents = []
  const engine = createPowerAlertEngine({
    db,
    getAllPositions,
    sendPowerDisconnectEvent: (device, alert) => disconnectEvents.push({ device, alert }),
    sendPowerRestoredEvent: (device, alert) => restoreEvents.push({ device, alert }),
    verifyTimeoutMs,
    now: () => clock.nowMs,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  })
  return { db, timers, clock, engine, disconnectEvents, restoreEvents }
}

function isoAt(ms) {
  return new Date(ms).toISOString()
}

/** Feed one keep-alive position, then advance the clock past the silence window. */
function seedSilentDevice({ engine, clock }) {
  engine.observePowerTelemetry({
    deviceId: DEVICE_TRACCAR_ID,
    serverTime: isoAt(clock.nowMs),
    latitude: 1,
    longitude: 2,
    attributes: {},
  })
  const state = engine.powerTelemetry.get(String(DEVICE_TRACCAR_ID))
  assert.ok(state, 'telemetry state created')
  clock.nowMs += POWER_SILENCE_WINDOW_MS + 1000
  // What the silence timer callback does once the grace window has elapsed.
  state.missingSince = state.lastPositionAt
  return state
}

function powerAlerts(db) {
  return db.alerts.filter((a) => a.type === 'power_disconnected')
}

test.beforeEach(() => {
  // Shared module-level Set in vehicleTelemetry — keep tests independent.
  markVehicleConnected(DEVICE_TRACCAR_ID)
})

// 1. Silence alone is never a battery-disconnect alert.
test('silence alone does not insert a battery alert', async () => {
  let traccarCalls = 0
  const h = createHarness({
    getAllPositions: async () => {
      traccarCalls += 1
      return [] // Traccar confirms: no position for the device at all.
    },
  })
  seedSilentDevice(h)

  await Promise.all([
    h.engine.createPowerDisconnectedAlert(DEVICE_TRACCAR_ID),
    h.engine.createPowerDisconnectedAlert(DEVICE_TRACCAR_ID),
  ])

  assert.equal(powerAlerts(h.db).length, 0, 'silence does not create a battery alert')
  assert.equal(h.disconnectEvents.length, 0, 'silence does not emit a battery event')
  assert.equal(traccarCalls, 0, 'silence does not query Traccar for battery proof')
  await h.engine.createPowerDisconnectedAlert(DEVICE_TRACCAR_ID)
  assert.equal(powerAlerts(h.db).length, 0, 'repeated silence stays quiet')
})

// 2. A fresh Traccar position still refreshes the state when explicitly fed
// through the observer; it is not needed as battery-alert proof anymore.
test('fresh Traccar position keeps the device online', async () => {
  const h = createHarness({
    getAllPositions: async () => [{
      deviceId: DEVICE_TRACCAR_ID,
      serverTime: isoAt(h.clock.nowMs - 30_000), // fresh keep-alive 30s ago
      fixTime: isoAt(h.clock.nowMs - 6 * 60 * 60 * 1000), // stale GPS fix — idle device
      latitude: 1,
      longitude: 2,
      attributes: {},
    }],
  })
  seedSilentDevice(h)

  h.engine.observePowerTelemetry({
    deviceId: DEVICE_TRACCAR_ID,
    serverTime: isoAt(h.clock.nowMs),
    latitude: 1,
    longitude: 2,
    attributes: {},
  })

  // The reducer replaces the state object, so re-read it from the engine.
  const state = h.engine.powerTelemetry.get(String(DEVICE_TRACCAR_ID))
  assert.equal(h.db.alerts.length, 0, 'no alert inserted')
  assert.equal(h.disconnectEvents.length, 0, 'no WS event sent')
  assert.equal(state.disconnected, false, 'state not marked disconnected')
  assert.equal(state.alerting, false, 'alerting flag released')
  assert.equal(state.missingSince, null, 'fresh position fed back through observePowerTelemetry')
  assert.ok(
    h.clock.nowMs - state.lastPositionAt < POWER_SILENCE_WINDOW_MS,
    'lastPositionAt refreshed by the verified live position',
  )
  assert.equal(isVehicleDisconnected(DEVICE_TRACCAR_ID), false, 'device stays online')
  assert.equal(h.db.powerStates.size, 0, 'no disconnect state persisted')
})

// 3. Explicit power telemetry still produces exactly one alert and one restore.
test('explicit power telemetry creates one alert and one restore', async () => {
  const h = createHarness({ getAllPositions: async () => [] })
  h.engine.observePowerTelemetry({
    deviceId: DEVICE_TRACCAR_ID,
    serverTime: isoAt(h.clock.nowMs),
    latitude: 1,
    longitude: 2,
    attributes: { powerCut: true },
  })
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(powerAlerts(h.db).length, 1, 'one explicit-loss alert')
  assert.equal(h.disconnectEvents.length, 1, 'one explicit-loss event')
  assert.equal(h.db.alerts[0].data.trigger, 'telemetry')
  assert.equal(isVehicleDisconnected(DEVICE_TRACCAR_ID), true)

  h.clock.nowMs += 1_000
  h.engine.observePowerTelemetry({
    deviceId: DEVICE_TRACCAR_ID,
    serverTime: isoAt(h.clock.nowMs),
    latitude: 1,
    longitude: 2,
    attributes: { powerCut: false },
  })
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(h.db.alerts.filter((a) => a.type === 'power_restored').length, 1)
  assert.equal(h.restoreEvents.length, 1)
  assert.equal(isVehicleDisconnected(DEVICE_TRACCAR_ID), false)
})

// Generic alarm labels are not electrical feedback.
test('alarm:powerCut alone stays quiet', async () => {
  const h = createHarness({ getAllPositions: async () => [] })
  h.engine.observePowerTelemetry({
    deviceId: DEVICE_TRACCAR_ID,
    serverTime: isoAt(h.clock.nowMs),
    latitude: 1,
    longitude: 2,
    attributes: { alarm: 'powerCut' },
  })
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(powerAlerts(h.db).length, 0)
  assert.equal(h.disconnectEvents.length, 0)
  assert.equal(isVehicleDisconnected(DEVICE_TRACCAR_ID), false)
})

// withTimeout unit guard: resolves normally, rejects on timeout.
test('withTimeout resolves fast promises and rejects hung ones', async () => {
  assert.equal(await withTimeout(Promise.resolve('ok'), 1000, 'nope'), 'ok')
  await assert.rejects(
    withTimeout(new Promise(() => {}), 10, 'traccar positions verification timed out'),
    /verification timed out/,
  )
})

// ── charge:false false-positive regression ─────────────────────────────────
// GT06 emits charge:false whenever the engine/alternator is off (every parked
// vehicle) and intermittently omits the voltage field. Neither is a validated
// battery-disconnect signal, so neither may create a power alert.

test('charge:false without voltage does NOT create a disconnect alert', async () => {
  const h = createHarness({ getAllPositions: async () => [] })
  h.engine.observePowerTelemetry({
    deviceId: DEVICE_TRACCAR_ID,
    serverTime: isoAt(h.clock.nowMs),
    latitude: 1, longitude: 2,
    attributes: { charge: false },
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(powerAlerts(h.db).length, 0, 'charge:false alone must not alert')
  assert.equal(h.disconnectEvents.length, 0)
  assert.equal(isVehicleDisconnected(DEVICE_TRACCAR_ID), false)
})

test('charge:false with voltage does NOT create a disconnect alert', async () => {
  const h = createHarness({ getAllPositions: async () => [] })
  h.engine.observePowerTelemetry({
    deviceId: DEVICE_TRACCAR_ID,
    serverTime: isoAt(h.clock.nowMs),
    latitude: 1, longitude: 2,
    attributes: { charge: false, voltage: 12.7 },
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(powerAlerts(h.db).length, 0, 'charge:false + voltage must not alert')
  assert.equal(isVehicleDisconnected(DEVICE_TRACCAR_ID), false)
})

test('charge:false repeated does NOT re-alert (edge-triggered)', async () => {
  const h = createHarness({ getAllPositions: async () => [] })
  for (let i = 0; i < 5; i++) {
    h.clock.nowMs += 60_000
    h.engine.observePowerTelemetry({
      deviceId: DEVICE_TRACCAR_ID,
      serverTime: isoAt(h.clock.nowMs),
      latitude: 1, longitude: 2,
      attributes: { charge: false },
    })
  }
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(powerAlerts(h.db).length, 0, 'repeated charge:false never alerts')
})

test('explicit powerCut:true DOES create exactly one disconnect alert', async () => {
  const h = createHarness({ getAllPositions: async () => [] })
  h.engine.observePowerTelemetry({
    deviceId: DEVICE_TRACCAR_ID,
    serverTime: isoAt(h.clock.nowMs),
    latitude: 1, longitude: 2,
    attributes: { powerCut: true },
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(powerAlerts(h.db).length, 1, 'validated powerCut alerts once')
  assert.equal(isVehicleDisconnected(DEVICE_TRACCAR_ID), true)
  // Second identical packet must NOT re-alert (edge-triggered)
  h.clock.nowMs += 60_000
  h.engine.observePowerTelemetry({
    deviceId: DEVICE_TRACCAR_ID,
    serverTime: isoAt(h.clock.nowMs),
    latitude: 1, longitude: 2,
    attributes: { powerCut: true },
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(powerAlerts(h.db).length, 1, 'repeated powerCut does not re-alert')
})

test('power restore is edge-triggered (no repeated restore alerts)', async () => {
  const h = createHarness({ getAllPositions: async () => [] })
  h.engine.observePowerTelemetry({
    deviceId: DEVICE_TRACCAR_ID, serverTime: isoAt(h.clock.nowMs),
    latitude: 1, longitude: 2, attributes: { powerCut: true },
  })
  await new Promise((resolve) => setImmediate(resolve))
  h.clock.nowMs += 1_000
  h.engine.observePowerTelemetry({
    deviceId: DEVICE_TRACCAR_ID, serverTime: isoAt(h.clock.nowMs),
    latitude: 1, longitude: 2, attributes: { powerCut: false },
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(h.restoreEvents.length, 1, 'one restore event')
  h.clock.nowMs += 1_000
  h.engine.observePowerTelemetry({
    deviceId: DEVICE_TRACCAR_ID, serverTime: isoAt(h.clock.nowMs),
    latitude: 1, longitude: 2, attributes: { powerCut: false },
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(h.restoreEvents.length, 1, 'no duplicate restore event')
})
