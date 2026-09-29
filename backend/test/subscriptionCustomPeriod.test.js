// Administrators can set an exact subscription period ("from" - "to"), not only 3 / 6 / 12 months.
//   node --experimental-test-module-mocks --test test/subscriptionCustomPeriod.test.js
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { resolveSubscriptionPeriod, getSubscriptionSnapshot } from '../src/services/subscriptions.js'

process.env.JWT_SECRET ||= 'test-secret'
const canMock = typeof mock.module === 'function'

test('fixed plans keep working (start = default start, end = start + months)', () => {
  const r = resolveSubscriptionPeriod('3_months', {}, '2026-09-29')
  assert.equal(r.startDate, '2026-09-29')
  assert.equal(r.endDate, '2026-12-29')
})

test('custom plan uses exactly the dates typed by the administrator', () => {
  const r = resolveSubscriptionPeriod('custom', { startDate: '2026-10-05', endDate: '2027-01-20' }, '2026-09-29')
  assert.equal(r.startDate, '2026-10-05')
  assert.equal(r.endDate, '2027-01-20')
  assert.equal(r.plan.custom, true)
})

test('custom plan rejects missing, impossible, reversed or absurdly long periods', () => {
  const bad = [
    {},
    { startDate: '2026-10-05' },
    { startDate: '2026-02-30', endDate: '2026-12-01' },
    { startDate: '05/10/2026', endDate: '2026-12-01' },
    { startDate: '2026-12-01', endDate: '2026-10-05' },
    { startDate: '2026-01-01', endDate: '2040-01-01' },
  ]
  for (const dates of bad) assert.ok(resolveSubscriptionPeriod('custom', dates, '2026-09-29').error, JSON.stringify(dates))
  assert.ok(resolveSubscriptionPeriod('nope', {}, '2026-09-29').error)
})

test('a same-day period is allowed and a custom period is read back by the snapshot', () => {
  const r = resolveSubscriptionPeriod('custom', { startDate: '2026-10-05', endDate: '2026-10-05' }, '2026-09-29')
  assert.equal(r.endDate, '2026-10-05')
  const snap = getSubscriptionSnapshot({ subscription_plan_id: 'custom', subscription_start_date: '2026-09-01', subscription_end_date: '2026-09-20' }, new Date('2026-09-29T10:00:00Z'))
  assert.equal(snap.subscriptionStatus, 'expired')
  assert.equal(snap.trackingEnabled, false)
  const live = getSubscriptionSnapshot({ subscription_plan_id: 'custom', subscription_start_date: '2026-09-01', subscription_end_date: '2026-12-20' }, new Date('2026-09-29T10:00:00Z'))
  assert.equal(live.subscriptionStatus, 'active')
})

// The router is imported once (module mocks are registered once), so the fake user and the recorded
// database writes live outside and are reset for every call.
let currentUser = null
let updates = []
let serverPromise = null
async function startApp() {
  const device = { id: 7, user_id: 5, name: 'Bike', imei: '000000000000007', subscription_end_date: '2026-10-10', subscription_plan_id: '3_months' }
  const query = async (sql, params) => {
    if (/UPDATE devices/.test(sql) && /subscription_plan_id/.test(sql)) {
      updates.push(params)
      return { rows: [{ ...device, subscription_plan_id: params[0], subscription_start_date: params[1], subscription_end_date: params[2] }] }
    }
    return { rows: [] }
  }
  mock.module('../src/db.js', { namedExports: { db: { query, connect: async () => ({ query, release() {} }), on() {} } } })
  mock.module('../src/services/traccar.js', { namedExports: { getAllPositions: async () => [], getAllDevices: async () => [] } })
  mock.module('../src/services/engineCommands.js', { namedExports: {} })
  mock.module('../src/middleware/auth.js', {
    namedExports: {
      requireAuth: (req, _res, next) => { req.user = currentUser; next() },
      requireMainAdmin: (_req, _res, next) => next(),
    },
  })
  mock.module('../src/middleware/requireRole.js', { namedExports: { requireRole: () => (_req, _res, next) => next() } })
  mock.module('../src/middleware/deviceAccess.js', {
    namedExports: {
      deviceAccessScope: () => ({ text: 'true', values: [] }),
      getAccessibleClient: async () => ({}),
      getAccessibleDevice: async () => device,
      requireDeviceOwner: (req, _res, next) => { req.device = device; next() },
    },
  })
  const { default: express } = await import('express')
  const { devicesRouter } = await import('../src/routes/devices.js')
  const app = express()
  app.use(express.json())
  app.use('/api/devices', devicesRouter)
  return new Promise(resolve => { const s = app.listen(0, () => resolve(s)) })
}

async function callRenew(user, body) {
  currentUser = user
  updates = []
  serverPromise ||= startApp()
  const server = await serverPromise
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/devices/7/subscription`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  return { status: res.status, json: await res.json(), updates }
}

test.after(async () => { if (serverPromise) (await serverPromise).close() })

test('PATCH /devices/:id/subscription: an admin sets an exact period and it is stored as typed', { skip: !canMock && 'needs --experimental-test-module-mocks' }, async () => {
  const r = await callRenew({ id: 1, is_admin: true }, { subscriptionPlanId: 'custom', subscriptionStartDate: '2026-11-01', subscriptionEndDate: '2027-02-15' })
  assert.equal(r.status, 200)
  assert.deepEqual(r.updates[0].slice(0, 3), ['custom', '2026-11-01', '2027-02-15'])
  assert.equal(r.json.subscriptionEndDate, '2027-02-15')
  assert.equal(r.json.subscriptionPlanId, 'custom')
  assert.equal(r.json.subscriptionStatus, 'active')
  assert.equal(r.json.trackingEnabled, true)
})

test('PATCH /devices/:id/subscription: an invalid period is refused and nothing is stored', { skip: !canMock && 'needs --experimental-test-module-mocks' }, async () => {
  const r = await callRenew({ id: 1, is_admin: true }, { subscriptionPlanId: 'custom', subscriptionStartDate: '2026-12-01', subscriptionEndDate: '2026-11-01' })
  assert.equal(r.status, 400)
  assert.equal(r.updates.length, 0)
})

test('PATCH /devices/:id/subscription: only an administrator can use a custom period; fixed plans still work', { skip: !canMock && 'needs --experimental-test-module-mocks' }, async () => {
  const denied = await callRenew({ id: 5, is_admin: false }, { subscriptionPlanId: 'custom', subscriptionStartDate: '2026-11-01', subscriptionEndDate: '2027-02-15' })
  assert.equal(denied.status, 403)
  assert.equal(denied.updates.length, 0)
  const fixed = await callRenew({ id: 1, is_admin: true }, { subscriptionPlanId: '6_months' })
  assert.equal(fixed.status, 200)
  // early renewal starts from the current end date (2026-10-10) so no paid time is lost
  assert.equal(fixed.updates[0][1], '2026-10-10')
  assert.equal(fixed.updates[0][2], '2027-04-10')
})
