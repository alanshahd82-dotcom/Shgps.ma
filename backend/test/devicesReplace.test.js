// Replace-device route with faked database, Traccar and auth:
//   node --experimental-test-module-mocks --test test/devicesReplace.test.js
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'

process.env.JWT_SECRET ||= 'test-secret'
const canMock = typeof mock.module === 'function'
const skip = !canMock && 'needs --experimental-test-module-mocks'

const state = { taken: false, traccarError: null, dbUpdateError: null, user: { id: 1, is_admin: true, is_sub_admin: false }, traccarCalls: [], updates: [], audits: [] }
const device = { id: 7, traccar_id: 37, name: 'Dacia', imei: '111111111111111', user_id: 5, phone: '0600000000' }

let app, server, base
async function setup() {
  if (server) return
  const query = async (sql, params) => {
    if (/FROM devices d WHERE d\.id=\$1/.test(sql)) return { rows: [{ ...device }] }
    if (/SELECT id FROM devices WHERE imei=/.test(sql)) return { rows: state.taken ? [{ id: 99 }] : [] }
    if (/UPDATE devices SET imei=/.test(sql)) {
      state.updates.push(params)
      if (state.dbUpdateError) throw state.dbUpdateError
      return { rows: [{ id: device.id, imei: params[0], phone: params[1] ?? device.phone }] }
    }
    return { rows: [] }
  }
  mock.module('../src/db.js', { namedExports: { db: { query, connect: async () => ({ query, release() {} }), on() {} } } })
  mock.module('../src/services/traccar.js', {
    namedExports: {
      updateDeviceUniqueId: async (id, imei) => {
        state.traccarCalls.push([id, imei])
        if (state.traccarHold) await state.traccarHold
        if (state.rollbackFails && imei === device.imei) throw new Error('rollback failed')
        if (state.traccarError) throw state.traccarError
      },
    },
  })
  mock.module('../src/services/engineCommands.js', { namedExports: {} })
  mock.module('../src/services/auditLog.js', { namedExports: { logAudit: async (...args) => { state.audits.push(args) } } })
  mock.module('../src/middleware/auth.js', {
    namedExports: {
      requireAuth: (req, _res, next) => { req.user = { ...state.user }; next() },
      requireMainAdmin: (_req, _res, next) => next(),
    },
  })
  const { default: express } = await import('express')
  const { devicesRouter } = await import('../src/routes/devices.js')
  app = express()
  app.use(express.json())
  app.use('/api/devices', devicesRouter)
  server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)) })
  base = `http://127.0.0.1:${server.address().port}`
}
const reset = () => Object.assign(state, { taken: false, traccarError: null, dbUpdateError: null, user: { id: 1, is_admin: true, is_sub_admin: false }, traccarCalls: [], updates: [], audits: [] })
const replace = body => fetch(`${base}/api/devices/7/replace`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

test('replace: valid new IMEI updates the tracking service and the database', { skip }, async () => {
  await setup(); reset()
  const res = await replace({ imei: '222222222222222', phone: '0611111111' })
  assert.equal(res.status, 200)
  assert.deepEqual(state.traccarCalls, [[37, '222222222222222']])
  assert.equal(state.updates.length, 1)
  assert.equal(state.audits[0][1], 'device_replaced')
})

test('replace: invalid IMEI, same IMEI and non-admin are rejected without side effects', { skip }, async () => {
  await setup(); reset()
  assert.equal((await replace({ imei: '123' })).status, 400)
  assert.equal((await replace({ imei: '111111111111111' })).status, 400)
  state.user = { id: 2, is_admin: false, is_sub_admin: false }
  assert.equal((await replace({ imei: '222222222222222' })).status, 403)
  assert.equal(state.traccarCalls.length, 0)
  assert.equal(state.updates.length, 0)
})

test('replace: an IMEI already used by another device is refused (409) before touching Traccar', { skip }, async () => {
  await setup(); reset(); state.taken = true
  assert.equal((await replace({ imei: '222222222222222' })).status, 409)
  assert.equal(state.traccarCalls.length, 0)
})

test('replace: if the tracking service fails, nothing is changed locally', { skip }, async () => {
  await setup(); reset(); state.traccarError = Object.assign(new Error('down'), { status: 500 })
  assert.equal((await replace({ imei: '222222222222222' })).status, 502)
  assert.equal(state.updates.length, 0)
})

test('replace: if the local update fails, the tracking service is put back', { skip }, async () => {
  await setup(); reset(); state.dbUpdateError = new Error('db down')
  assert.equal((await replace({ imei: '222222222222222' })).status, 500)
  assert.deepEqual(state.traccarCalls, [[37, '222222222222222'], [37, '111111111111111']])
})

test('replace: a second replacement of the same device at the same time is refused', { skip }, async () => {
  await setup(); reset()
  let release
  const gate = new Promise(resolve => { release = resolve })
  const original = state.traccarHold
  state.traccarHold = gate
  const first = replace({ imei: '222222222222222' })
  await new Promise(r => setTimeout(r, 50))
  const second = await replace({ imei: '333333333333333' })
  assert.equal(second.status, 409)
  release()
  assert.equal((await first).status, 200)
  state.traccarHold = original
})

test('replace: if the rollback also fails the answer says so (no silent mismatch)', { skip }, async () => {
  await setup(); reset(); state.dbUpdateError = new Error('db down'); state.rollbackFails = true
  const res = await replace({ imei: '222222222222222' })
  assert.equal(res.status, 500)
  assert.equal((await res.json()).code, 'REPLACE_ROLLBACK_FAILED')
  state.rollbackFails = false
})

test.after(() => server?.close())
