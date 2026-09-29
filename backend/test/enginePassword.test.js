// Engine cut / resume requires the account password, checked on the server.
//   node --experimental-test-module-mocks --test test/enginePassword.test.js
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'

process.env.JWT_SECRET ||= 'test-secret'
const canMock = typeof mock.module === 'function'
const skip = !canMock && 'needs --experimental-test-module-mocks'

const hash = bcrypt.hashSync('Correct-Horse-9', 4)
const state = { created: [], delivered: 0, audits: [] }
const device = { id: 7, traccar_id: 37, name: 'Dacia', imei: '111111111111111', user_id: 5 }
let base, server, resetAttempts
async function setup() {
  if (server) return
  const query = async (sql) => {
    if (/FROM devices d WHERE d\.id=\$1/.test(sql)) return { rows: [{ ...device }] }
    if (/SELECT password_hash FROM users/.test(sql)) return { rows: [{ password_hash: hash }] }
    return { rows: [] }
  }
  mock.module('../src/db.js', { namedExports: { db: { query, connect: async () => ({ query, release() {} }), on() {} } } })
  mock.module('../src/services/traccar.js', { namedExports: {} })
  mock.module('../src/services/engineCommands.js', {
    namedExports: {
      createRequest: async args => { state.created.push(args); return { id: state.created.length, status: 'pending', traccar_command_id: null } },
      deliverOnce: async command => { state.delivered += 1; return { ...command, status: 'unconfirmed' } },
    },
  })
  mock.module('../src/services/auditLog.js', { namedExports: { logAudit: async (...a) => { state.audits.push(a) } } })
  mock.module('../src/middleware/auth.js', {
    namedExports: {
      requireAuth: (req, _res, next) => { req.user = { id: 1, is_admin: true, is_sub_admin: false }; next() },
      requireMainAdmin: (_req, _res, next) => next(),
    },
  })
  const { default: express } = await import('express')
  const { devicesRouter } = await import('../src/routes/devices.js')
  ;({ resetPasswordAttempts: resetAttempts } = await import('../src/utils/passwordConfirm.js'))
  const app = express()
  app.use(express.json())
  app.use('/api/devices', devicesRouter)
  server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)) })
  base = `http://127.0.0.1:${server.address().port}`
}
const reset = () => { state.created = []; state.delivered = 0; state.audits = []; resetAttempts() }
const send = body => fetch(`${base}/api/devices/7/command`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }))

test('no password: refused, nothing is created or sent', { skip }, async () => {
  await setup(); reset()
  const r = await send({ type: 'engineStop' })
  assert.equal(r.status, 400)
  assert.equal(r.body.code, 'PASSWORD_REQUIRED')
  assert.equal(state.created.length, 0)
  assert.equal(state.delivered, 0)
})

test('wrong password: refused for cut and for resume, nothing is created or sent', { skip }, async () => {
  await setup(); reset()
  for (const type of ['engineStop', 'engineResume']) {
    const r = await send({ type, password: 'not-it' })
    assert.equal(r.status, 403)
    assert.equal(r.body.code, 'INVALID_PASSWORD')
  }
  assert.equal(state.created.length, 0)
  assert.equal(state.delivered, 0)
})

test('correct password: the command goes through as before (cut and resume)', { skip }, async () => {
  await setup(); reset()
  for (const type of ['engineStop', 'engineResume']) {
    const r = await send({ type, password: 'Correct-Horse-9' })
    assert.equal(r.status, 200)
    assert.equal(r.body.ok, true)
  }
  assert.deepEqual(state.created.map(c => c.commandType), ['engineStop', 'engineResume'])
  assert.equal(state.delivered, 2)
})

test('the password is never written to the audit log', { skip }, async () => {
  await setup(); reset()
  await send({ type: 'engineStop', password: 'Correct-Horse-9' })
  assert.equal(JSON.stringify(state.audits).includes('Correct-Horse-9'), false)
})

test('five wrong attempts lock the account for a while, even the right password is refused', { skip }, async () => {
  await setup(); reset()
  for (let i = 0; i < 5; i += 1) await send({ type: 'engineStop', password: 'nope' + i })
  const locked = await send({ type: 'engineStop', password: 'Correct-Horse-9' })
  assert.equal(locked.status, 429)
  assert.equal(locked.body.code, 'TOO_MANY_ATTEMPTS')
  assert.equal(state.created.length, 0)
})

test('a correct password resets the failed-attempt counter', { skip }, async () => {
  await setup(); reset()
  for (let i = 0; i < 4; i += 1) await send({ type: 'engineStop', password: 'nope' })
  assert.equal((await send({ type: 'engineStop', password: 'Correct-Horse-9' })).status, 200)
  for (let i = 0; i < 4; i += 1) await send({ type: 'engineStop', password: 'nope' })
  assert.equal((await send({ type: 'engineStop', password: 'Correct-Horse-9' })).status, 200)
})

test.after(() => server?.close())
