// Regression tests for durable JWT revocation (security hardening).
import '../src/env.js'
import test from 'node:test'
import assert from 'node:assert/strict'

if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-jwt-secret-do-not-use'

const { db } = await import('../src/db.js')
const { revokeToken, isRevoked, initRevocationStore, __resetForTests } =
  await import('../src/services/tokenBlacklist.js')

let store = []
db.query = async (sql, params) => {
  const s = String(sql).trim().toUpperCase()
  if (s.startsWith('INSERT')) {
    store.push({ token_hash: params[0], expires_at: params[1] * 1000 })
    return { rows: [] }
  }
  if (s.startsWith('SELECT')) {
    const now = Date.now()
    return {
      rows: store
        .filter(r => r.expires_at > now)
        .map(r => ({ token_hash: r.token_hash, exp: String(Math.floor(r.expires_at / 1000)) })),
    }
  }
  return { rows: [] }
}
const flush = () => new Promise(r => setImmediate(r))
const soon = () => Math.floor(Date.now() / 1000) + 3600

test('a revoked token is rejected by isRevoked', async () => {
  __resetForTests(); store = []
  revokeToken('tokA', soon())
  await flush()
  assert.equal(isRevoked('tokA'), true)
})

test('an unknown token is not revoked', () => {
  assert.equal(isRevoked('unknown-token'), false)
})

test('revocation survives a simulated backend restart (durable)', async () => {
  __resetForTests(); store = []
  revokeToken('tokC', soon())
  await flush()
  assert.equal(isRevoked('tokC'), true)
  __resetForTests()
  assert.equal(isRevoked('tokC'), false, 'memory wiped before hydrate')
  await initRevocationStore()
  assert.equal(isRevoked('tokC'), true, 'revocation must survive restart')
})

test('an already-expired revocation is pruned and not reloaded', async () => {
  __resetForTests(); store = []
  revokeToken('tokD', Math.floor(Date.now() / 1000) - 10)
  await flush()
  assert.equal(isRevoked('tokD'), false)
  __resetForTests()
  await initRevocationStore()
  assert.equal(isRevoked('tokD'), false)
})
