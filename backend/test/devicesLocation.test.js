// Route-level test for the "0,0 / offline loses last location" fix: GET /api/devices
// with faked database, Traccar and auth. Needs Node's module mocking:
//   node --experimental-test-module-mocks --test test/devicesLocation.test.js
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'

process.env.JWT_SECRET ||= 'test-secret'
const canMock = typeof mock.module === 'function'

const now = Date.now()
const iso = ms => new Date(ms).toISOString()
const deviceRows = [
  { id: 1, traccar_id: 136, name: 'online-no-fix', imei: '000000000000001', type: 'car', user_id: 5, client_name: 'Client A', client_phone: '0600000001', last_lat: 33.9, last_lng: -6.9, last_update: iso(now - 3600e3), subscription_plan_id: '3_months', subscription_end_date: '2099-01-01', subscription_status: 'active' },
  { id: 2, traccar_id: 70, name: 'offline-never-fixed', imei: '000000000000002', type: 'car', user_id: 5, client_name: 'Client A', client_phone: '0600000001', last_lat: null, last_lng: null, last_update: null, subscription_plan_id: '3_months', subscription_end_date: '2099-01-01', subscription_status: 'active' },
  { id: 3, traccar_id: 37, name: 'online-fixed', imei: '000000000000003', type: 'car', user_id: 5, client_name: 'Client A', client_phone: '0600000001', last_lat: 30, last_lng: -5, last_update: iso(now - 86400e3), subscription_plan_id: '3_months', subscription_end_date: '2099-01-01', subscription_status: 'active' },
  { id: 4, traccar_id: 55, name: 'offline-with-stored', imei: '000000000000004', type: 'car', user_id: 5, client_name: 'Client A', client_phone: '0600000001', last_lat: 34.02, last_lng: -6.84, last_update: iso(now - 13 * 86400e3), subscription_plan_id: '3_months', subscription_end_date: '2099-01-01', subscription_status: 'active' },
]
const positions = [
  { deviceId: 136, latitude: 0, longitude: 0, valid: false, fixTime: iso(now - 3300e3), serverTime: iso(now - 60e3), attributes: {} },
  { deviceId: 70, latitude: 0, longitude: 0, valid: false, fixTime: iso(now - 13 * 86400e3), serverTime: iso(now - 13 * 86400e3), attributes: {} },
  { deviceId: 37, latitude: 33.5731, longitude: -7.5898, valid: true, fixTime: iso(now - 120e3), serverTime: iso(now - 60e3), attributes: {} },
]
const traccarDevices = [
  { id: 136, status: 'online', lastUpdate: iso(now - 60e3) },
  { id: 70, status: 'offline', lastUpdate: iso(now - 13 * 86400e3) },
  { id: 37, status: 'online', lastUpdate: iso(now - 60e3) },
  { id: 55, status: 'offline', lastUpdate: iso(now - 13 * 86400e3) },
]

test('GET /api/devices never returns 0,0 and keeps the last valid location', { skip: !canMock && 'needs --experimental-test-module-mocks' }, async () => {
  const query = async sql => {
    if (/FROM devices d/.test(sql)) return { rows: deviceRows.map(r => ({ ...r })) }
    return { rows: [] }
  }
  mock.module('../src/db.js', { namedExports: { db: { query, connect: async () => ({ query, release() {} }), on() {} } } })
  mock.module('../src/services/traccar.js', {
    namedExports: {
      getAllPositions: async () => positions,
      getAllDevices: async () => traccarDevices,
    },
  })
  mock.module('../src/services/engineCommands.js', { namedExports: {} })
  mock.module('../src/middleware/auth.js', {
    namedExports: {
      requireAuth: (req, _res, next) => { req.user = { id: 1, is_admin: true, is_sub_admin: false, name: 'Admin' }; next() },
      requireMainAdmin: (_req, _res, next) => next(),
    },
  })

  const { default: express } = await import('express')
  const { devicesRouter } = await import('../src/routes/devices.js')
  const app = express()
  app.use('/api/devices', devicesRouter)
  const server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)) })
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/devices`)
    assert.equal(res.status, 200)
    const list = await res.json()
    const byName = Object.fromEntries(list.map(d => [d.name, d]))

    // online tracker with no GPS fix (live 0,0): falls back to the stored valid location
    assert.equal(byName['online-no-fix'].lat, 33.9)
    assert.equal(byName['online-no-fix'].locationSource, 'stored')
    assert.equal(byName['online-no-fix'].gpsValid, false)
    assert.equal(byName['online-no-fix'].status, 'online')
    assert.equal(byName['online-no-fix'].clientPhone, '0600000001')

    // never had a valid fix: no location at all, and never 0,0
    assert.equal(byName['offline-never-fixed'].lat, null)
    assert.equal(byName['offline-never-fixed'].lng, null)

    // healthy vehicle: live position wins over the older stored one
    assert.equal(byName['online-fixed'].lat, 33.5731)
    assert.equal(byName['online-fixed'].locationSource, 'live')

    // offline vehicle without any live position keeps its stored location
    assert.equal(byName['offline-with-stored'].lat, 34.02)
    assert.equal(byName['offline-with-stored'].status, 'offline')
    for (const d of list) assert.ok(!(d.lat === 0 && d.lng === 0), `${d.name} must not be 0,0`)
  } finally {
    server.close()
  }
})
