// active-command route: the additive `deviceReply` field (tracker's own answer)
// must never change or break the command state itself.
//   node --experimental-test-module-mocks --test test/activeCommandReply.test.js
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'

process.env.JWT_SECRET ||= 'test-secret'
const canMock = typeof mock.module === 'function'
const skip = !canMock && 'needs --experimental-test-module-mocks'

const created = new Date(Date.now() - 60_000).toISOString()
let nextId = 100
const state = { command: null, positions: [], historyError: null, historyCalls: 0 }
const device = { id: 7, traccar_id: 37, name: 'Dacia', imei: '111111111111111', user_id: 5 }

let server, base
async function setup() {
  if (server) return
  const query = async sql => (/FROM devices d WHERE d\.id=\$1/.test(sql) ? { rows: [{ ...device }] } : { rows: [] })
  mock.module('../src/db.js', { namedExports: { db: { query, connect: async () => ({ query, release() {} }), on() {} } } })
  mock.module('../src/services/traccar.js', {
    namedExports: {
      getHistory: async () => { state.historyCalls += 1; if (state.historyError) throw state.historyError; return state.positions },
    },
  })
  mock.module('../src/services/engineCommands.js', { namedExports: { getActiveCommand: async () => state.command } })
  mock.module('../src/services/auditLog.js', { namedExports: { logAudit: async () => {} } })
  mock.module('../src/middleware/auth.js', {
    namedExports: {
      requireAuth: (req, _res, next) => { req.user = { id: 1, is_admin: true, is_sub_admin: false }; next() },
      requireMainAdmin: (_req, _res, next) => next(),
    },
  })
  const { default: express } = await import('express')
  const { devicesRouter } = await import('../src/routes/devices.js')
  const app = express()
  app.use(express.json())
  app.use('/api/devices', devicesRouter)
  server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)) })
  base = `http://127.0.0.1:${server.address().port}`
}
const reset = (status = 'unconfirmed') => Object.assign(state, {
  command: { id: ++nextId, command_type: 'engineStop', requested_state: 'stopped', status, created_at: created, traccar_command_id: 9 },
  positions: [], historyError: null, historyCalls: 0,
})
const get = () => fetch(`${base}/api/devices/7/active-command`).then(async r => ({ status: r.status, body: await r.json() }))

test('the tracker answer is returned next to the unchanged command', { skip }, async () => {
  await setup(); reset()
  state.positions = [{ deviceTime: new Date().toISOString(), attributes: { result: 'Cut off the fuel supply: Success!' } }]
  const { status, body } = await get()
  assert.equal(status, 200)
  assert.equal(body.command.status, 'unconfirmed')
  assert.equal(body.command.requested_state, 'stopped')
  assert.equal(body.deviceReply.outcome, 'success')
})

test('no answer yet gives deviceReply null and the same command', { skip }, async () => {
  await setup(); reset('sent')
  const { body } = await get()
  assert.equal(body.deviceReply, null)
  assert.equal(body.command.status, 'sent')
})

test('a failing tracking service never breaks the command state', { skip }, async () => {
  await setup(); reset(); state.historyError = new Error('traccar down')
  const { status, body } = await get()
  assert.equal(status, 200)
  assert.equal(body.command.id, state.command.id)
  assert.equal(body.deviceReply, null)
})

test('a command still waiting for the vehicle does not query the tracking service', { skip }, async () => {
  await setup(); reset('pending')
  const { body } = await get()
  assert.equal(state.historyCalls, 0)
  assert.equal(body.deviceReply, null)
})

test('no active command stays { command: null }', { skip }, async () => {
  await setup(); reset(); state.command = null
  assert.deepEqual((await get()).body, { command: null })
})

test.after(() => server?.close())
