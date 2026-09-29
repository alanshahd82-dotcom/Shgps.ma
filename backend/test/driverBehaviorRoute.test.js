import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-secret'
const { db } = await import('../src/db.js')
const { driverBehaviorRouter } = await import('../src/routes/driverBehavior.js')

db.query = async (sql) => {
  if (sql.includes('FROM users')) return { rows: [{ id: 1, is_active: true, is_admin: false }] }
  if (sql.includes('FROM devices d')) return { rows: [{ id: 9, user_id: 1, traccar_id: null }] }
  throw new Error('unexpected query: ' + sql.replace(/\s+/g, ' ').slice(0, 80))
}

const app = express()
app.use('/api/driver-behavior', driverBehaviorRouter)
const server = app.listen(0)
const base = `http://127.0.0.1:${server.address().port}/api/driver-behavior`
test.after(() => server.close())
const headers = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, 'test-secret')}` }

test('device without a tracker link returns empty scores and summary (no crash)', async () => {
  const scores = await fetch(`${base}/scores?deviceId=9&days=7`, { headers })
  assert.equal(scores.status, 200)
  assert.deepEqual(await scores.json(), [])
  const summary = await fetch(`${base}/summary?deviceId=9`, { headers })
  assert.equal(summary.status, 200)
  assert.deepEqual(await summary.json(), { latest: null, trend: [] })
})
