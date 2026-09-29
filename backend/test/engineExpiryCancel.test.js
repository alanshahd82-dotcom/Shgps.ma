// Expiring a pending engine command must also remove it from Traccar when it
// was already queued there, otherwise it would still run when the tracker
// reconnects. Runs the real worker stage with faked db and Traccar:
//   node --experimental-test-module-mocks --test test/engineExpiryCancel.test.js
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'

const canMock = typeof mock.module === 'function'
const skip = !canMock && 'needs --experimental-test-module-mocks'

const state = { expiredRows: [], sql: [], cancelled: [], cancelError: null }
let engine
async function load() {
  if (engine) return engine
  const query = async (sql, params) => {
    state.sql.push(sql)
    if (/RETURNING \*/.test(sql) && /status = 'expired'/.test(sql)) return { rowCount: state.expiredRows.length, rows: state.expiredRows }
    if (/cancellation_state = 'pending' AND traccar_command_id > 0 ORDER BY/.test(sql)) return { rows: [] }
    if (/status = 'pending' AND e\.superseded_by_command_id IS NULL/.test(sql)) return { rows: [] }
    return { rowCount: 1, rows: [] }
  }
  mock.module('../src/db.js', { namedExports: { db: { query, connect: async () => ({ query, release() {} }) } } })
  mock.module('../src/services/traccar.js', {
    namedExports: {
      cancelQueuedCommand: async id => { state.cancelled.push(id); if (state.cancelError) throw state.cancelError },
      getDevice: async () => ({}), sendCommand: async () => ({}), getCommandDeliveryMeta: () => ({}),
    },
  })
  mock.module('../src/services/vehicleTelemetry.js', { namedExports: { registerEngineCommandCooldown() {}, positionIsFresh: () => false } })
  engine = await import('../src/services/engineCommands.js')
  return engine
}
const reset = rows => Object.assign(state, { expiredRows: rows, sql: [], cancelled: [], cancelError: null })
const row = (id, traccarId) => ({ id, device_id: 7, command_type: 'engineStop', requested_state: 'stopped', status: 'expired', traccar_command_id: traccarId, cancellation_state: traccarId > 0 ? 'pending' : null })

test('expiry marks a queued command for cancellation and removes it from Traccar', { skip }, async () => {
  const { processPendingCommands } = await load(); reset([row(1, 77)])
  await processPendingCommands()
  assert.deepEqual(state.cancelled, [77])
  assert.ok(state.sql.some(q => /CASE WHEN traccar_command_id > 0 THEN 'pending'/.test(q)), 'the expiry query marks the cancellation as pending')
  assert.ok(state.sql.some(q => /cancellation_state = 'confirmed'/.test(q)), 'confirmed once Traccar accepted')
})

test('expiry of a command that never reached Traccar does not call Traccar', { skip }, async () => {
  const { processPendingCommands } = await load(); reset([row(2, null)])
  await processPendingCommands()
  assert.deepEqual(state.cancelled, [])
})

test('if Traccar cannot cancel now, the cancellation stays pending for the worker to retry', { skip }, async () => {
  const { processPendingCommands } = await load(); reset([row(3, 88)]); state.cancelError = Object.assign(new Error('down'), { status: 503 })
  await processPendingCommands()
  assert.deepEqual(state.cancelled, [88])
  assert.equal(state.sql.some(q => /cancellation_state = 'confirmed'/.test(q)), false)
})
