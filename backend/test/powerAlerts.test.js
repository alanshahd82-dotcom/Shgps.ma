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

// 1. Two concurrent silence checks for one device → exactly one alert inserted.
test('concurrent silence checks insert exactly one alert', async () => {
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

  assert.equal(powerAlerts(h.db).length, 1, 'exactly one disconnect alert inserted')
  assert.equal(h.disconnectEvents.length, 1, 'exactly one WS event sent')
  assert.equal(traccarCalls, 1, 'second concurrent check bailed before verification')
  assert.equal(h.db.powerStates.get(String(DEVICE_TRACCAR_ID))?.disconnected, true)

  // A later re-check while the episode persists must also stay silent.
  await h.engine.createPowerDisconnectedAlert(DEVICE_TRACCAR_ID)
  assert.equal(powerAlerts(h.db).length, 1, 'no duplicate alert while disconnected')
})

// 2. Traccar returns a fresh position → alert cancelled, device stays online.
test('fresh Traccar position cancels the silence alert', async () => {
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

  await h.engine.createPowerDisconnectedAlert(DEVICE_TRACCAR_ID)

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

// 3. Traccar request hangs → verification times out and a 60s retry is
//    scheduled; no blind alert is fired.
test('hung Traccar verification times out and schedules a retry, no blind alert', async () => {
  const h = createHarness({
    getAllPositions: () => new Promise(() => {}), // hangs forever
  })
  const state = seedSilentDevice(h)

  const alertPromise = h.engine.createPowerDisconnectedAlert(DEVICE_TRACCAR_ID)
  // The only short timer pending is the verification timeout ceiling.
  const verifyTimers = [...h.timers.pending.values()].filter((t) => t.delay === POWER_VERIFY_TIMEOUT_MS)
  assert.equal(verifyTimers.length, 1, 'verification guarded by POWER_VERIFY_TIMEOUT_MS')
  await h.timers.runPending(POWER_VERIFY_TIMEOUT_MS) // fire the timeout
  await alertPromise

  assert.equal(h.db.alerts.length, 0, 'no alert fired blindly')
  assert.equal(state.alerting, false, 'alerting flag released for the retry')
  assert.equal(state.disconnected, false)
  const retry = h.timers.pending.get(h.engine.powerDisconnectRetryTimers.get(String(DEVICE_TRACCAR_ID)))
  assert.ok(retry, 'a retry timer is registered for the device')
  assert.equal(retry.delay, 60_000, 'retry scheduled in 60s')
})

// 3b. The scheduled retry itself re-verifies and may then fire (regression
//     guard: deferral must not drop the episode entirely).
test('deferred alert fires after retry once Traccar is reachable and silent', async () => {
  let hang = true
  const h = createHarness({
    verifyTimeoutMs: 50,
    getAllPositions: () => (hang ? new Promise(() => {}) : Promise.resolve([])),
  })
  seedSilentDevice(h)

  const p = h.engine.createPowerDisconnectedAlert(DEVICE_TRACCAR_ID)
  await h.timers.runPending(50)
  await p
  assert.equal(h.db.alerts.length, 0)

  hang = false
  h.clock.nowMs += 60_000
  await h.timers.runPending(60_000) // run the scheduled retry
  // Let the retried createPowerDisconnectedAlert finish its awaited queries.
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(powerAlerts(h.db).length, 1, 'retry fired exactly one verified alert')
})

// 4. Traccar confirms silence → exactly one alert; restore packet → one
//    restore alert.
test('confirmed silence fires one alert; restore packet fires one restore alert', async () => {
  const h = createHarness({
    getAllPositions: async () => [{
      deviceId: DEVICE_TRACCAR_ID,
      // Traccar's last position is as stale as ours — device truly silent.
      serverTime: isoAt(h.clock.nowMs - POWER_SILENCE_WINDOW_MS - 1000),
      latitude: 1,
      longitude: 2,
      attributes: {},
    }],
  })
  const state = seedSilentDevice(h)

  await h.engine.createPowerDisconnectedAlert(DEVICE_TRACCAR_ID)

  const disconnects = powerAlerts(h.db)
  assert.equal(disconnects.length, 1, 'exactly one disconnect alert')
  assert.equal(disconnects[0].data.trigger, 'silence')
  assert.equal(state.disconnected, true)
  assert.equal(isVehicleDisconnected(DEVICE_TRACCAR_ID), true)
  assert.equal(h.db.powerStates.get(String(DEVICE_TRACCAR_ID))?.trigger, 'silence')

  // Device comes back: a new packet arrives.
  h.clock.nowMs += 60_000
  h.engine.observePowerTelemetry({
    deviceId: DEVICE_TRACCAR_ID,
    serverTime: isoAt(h.clock.nowMs),
    latitude: 1,
    longitude: 2,
    attributes: { charge: true },
  })
  await new Promise((resolve) => setImmediate(resolve)) // let restore alert insert settle

  const restoredState = h.engine.powerTelemetry.get(String(DEVICE_TRACCAR_ID))
  const restores = h.db.alerts.filter((a) => a.type === 'power_restored')
  assert.equal(restores.length, 1, 'exactly one restore alert')
  assert.equal(h.restoreEvents.length, 1)
  assert.equal(restoredState.disconnected, false)
  assert.equal(isVehicleDisconnected(DEVICE_TRACCAR_ID), false)
  assert.equal(h.db.powerStates.size, 0, 'persisted disconnect state cleared')

  // Another healthy packet must NOT fire a second restore alert.
  h.clock.nowMs += 30_000
  h.engine.observePowerTelemetry({
    deviceId: DEVICE_TRACCAR_ID,
    serverTime: isoAt(h.clock.nowMs),
    latitude: 1,
    longitude: 2,
    attributes: { charge: true },
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(h.db.alerts.filter((a) => a.type === 'power_restored').length, 1)
  assert.equal(powerAlerts(h.db).length, 1, 'still exactly one disconnect alert overall')
})

// withTimeout unit guard: resolves normally, rejects on timeout.
test('withTimeout resolves fast promises and rejects hung ones', async () => {
  assert.equal(await withTimeout(Promise.resolve('ok'), 1000, 'nope'), 'ok')
  await assert.rejects(
    withTimeout(new Promise(() => {}), 10, 'traccar positions verification timed out'),
    /verification timed out/,
  )
})
