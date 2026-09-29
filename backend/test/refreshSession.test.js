import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-secret'
const { db } = await import('../src/db.js')
const { authRouter } = await import('../src/routes/auth.js')
const { revokeToken } = await import('../src/services/tokenBlacklist.js')

const tokens = []
let nextId = 1
const users = { 1: { is_admin: false, is_active: true }, 2: { is_admin: true, is_active: true } }

db.query = async (sql, params = []) => {
  const q = sql.replace(/\s+/g, ' ').trim()
  if (q.startsWith('SELECT is_admin, is_active FROM users')) return { rows: users[params[0]] ? [users[params[0]]] : [] }
  if (q.startsWith('INSERT INTO refresh_tokens')) {
    const row = { id: nextId++, user_id: params[0], hash: params[1], expires: params[2], revoked_at: null, replaced_by: null }
    tokens.push(row)
    return { rows: [{ id: row.id }] }
  }
  if (q.startsWith('UPDATE refresh_tokens SET revoked_at = NOW(), last_used_at = NOW() WHERE token_hash')) {
    const row = tokens.find(t => t.hash === params[0] && !t.revoked_at && t.expires > new Date())
    if (!row) return { rows: [] }
    row.revoked_at = new Date()
    return { rows: [{ id: row.id, user_id: row.user_id }] }
  }
  if (q.startsWith('UPDATE refresh_tokens SET replaced_by')) {
    tokens.find(t => t.id === params[0]).replaced_by = params[1]
    return { rows: [] }
  }
  if (q.startsWith('SELECT user_id FROM refresh_tokens')) {
    const row = tokens.find(t => t.hash === params[0] && t.replaced_by && t.revoked_at && Date.now() - t.revoked_at < 120000)
    return { rows: row ? [{ user_id: row.user_id }] : [] }
  }
  throw new Error('unexpected query: ' + q)
}

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
const server = app.listen(0)
const base = `http://127.0.0.1:${server.address().port}/api/auth`
test.after(() => server.close())

const cookieOf = res => (res.headers.get('set-cookie') || '').split(';')[0]
const post = (path, headers = {}) => fetch(base + path, { method: 'POST', headers })
const expired = (userId, agoSec) => jwt.sign({ userId, isAdmin: false, exp: Math.floor(Date.now() / 1000) - agoSec }, 'test-secret')

test('legacy session: expired access token without cookie is renewed and gets a cookie', async () => {
  const res = await post('/refresh', { Authorization: `Bearer ${expired(1, 3 * 86400)}` })
  assert.equal(res.status, 200)
  assert.ok((await res.json()).token)
  assert.match(cookieOf(res), /^athargps_refresh=/)
})

test('admin flag comes from the database on refresh', async () => {
  const res = await post('/refresh', { Authorization: `Bearer ${expired(2, 60)}` })
  assert.equal(jwt.decode((await res.json()).token).isAdmin, true)
})

test('token expired beyond the grace window is refused', async () => {
  const res = await post('/refresh', { Authorization: `Bearer ${expired(1, 450 * 86400)}` })
  assert.equal(res.status, 401)
})

test('a phone that was not opened for ~10 months stays signed in', async () => {
  const res = await post('/refresh', { Authorization: `Bearer ${expired(1, 300 * 86400)}` })
  assert.equal(res.status, 200)
  assert.ok((await res.json()).token)
})

test('revoked (logged out) token cannot be refreshed', async () => {
  const t = expired(1, 3600)
  revokeToken(t, Math.floor(Date.now() / 1000) + 3600)
  assert.equal((await post('/refresh', { Authorization: `Bearer ${t}` })).status, 401)
})

test('forged token is refused', async () => {
  const forged = jwt.sign({ userId: 1 }, 'other-secret', { expiresIn: '1h' })
  assert.equal((await post('/refresh', { Authorization: `Bearer ${forged}` })).status, 401)
})

test('inactive account is refused', async () => {
  users[3] = { is_admin: false, is_active: false }
  assert.equal((await post('/refresh', { Authorization: `Bearer ${expired(3, 60)}` })).status, 401)
})

test('cookie rotation, and a concurrent second use of the old cookie still works', async () => {
  const first = await post('/refresh', { Authorization: `Bearer ${expired(1, 60)}` })
  const c1 = cookieOf(first)
  const second = await post('/refresh', { Cookie: c1 })
  assert.equal(second.status, 200)
  const c2 = cookieOf(second)
  assert.notEqual(c1, c2)
  const replay = await post('/refresh', { Cookie: c1 })
  assert.equal(replay.status, 200)
  assert.equal(replay.headers.get('set-cookie'), null)
  assert.equal((await post('/refresh', { Cookie: c2 })).status, 200)
})

test('no cookie and no token is refused', async () => {
  assert.equal((await post('/refresh')).status, 401)
})
