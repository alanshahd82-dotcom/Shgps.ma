import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-secret'
const { db } = await import('../src/db.js')
const { maintenanceRouter } = await import('../src/routes/maintenance.js')

let inserted = null
db.query = async (sql, params = []) => {
  if (sql.includes('FROM users')) return { rows: [{ id: 1, is_active: true, is_admin: false, parent_client_id: null }] }
  if (sql.includes('FROM devices d')) return { rows: [{ id: 9, user_id: 1 }] }
  if (sql.includes('INSERT INTO maintenance_logs')) {
    inserted = params
    return { rows: [{ id: 1, device_id: 9, type: params[1], note: params[2], mileage: params[3], next_due_mileage: params[5] }] }
  }
  if (sql.includes('FROM maintenance_logs')) return { rows: [{ id: 1, type: 'oil_change', note: 'Filtre changé', next_due_mileage: 90000 }] }
  throw new Error('unexpected query: ' + sql.replace(/\s+/g, ' ').slice(0, 80))
}

const app = express()
app.use(express.json())
app.use('/api/maintenance', maintenanceRouter)
const server = app.listen(0)
const base = `http://127.0.0.1:${server.address().port}/api/maintenance`
test.after(() => server.close())
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ userId: 1 }, 'test-secret')}` }

test('notes and next_mileage sent by the app are saved', async () => {
  const res = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ deviceId: 9, type: 'oil_change', mileage: '80000', notes: 'Filtre changé', next_mileage: '90000' }) })
  assert.equal(res.status, 201)
  assert.equal(inserted[2], 'Filtre changé')
  assert.equal(inserted[5], '90000')
  const body = await res.json()
  assert.equal(body.notes, 'Filtre changé')
  assert.equal(body.next_mileage, '90000')
})

test('legacy note / nextDueMileage names still work', async () => {
  await fetch(base, { method: 'POST', headers, body: JSON.stringify({ deviceId: 9, type: 'oil_change', note: 'x', nextDueMileage: 5 }) })
  assert.equal(inserted[2], 'x')
  assert.equal(inserted[5], 5)
})

test('listing returns the fields the app reads', async () => {
  const rows = await (await fetch(`${base}?deviceId=9`, { headers })).json()
  assert.equal(rows[0].notes, 'Filtre changé')
  assert.equal(rows[0].next_mileage, 90000)
})
