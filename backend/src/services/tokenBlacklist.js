// tokenBlacklist.js — Durable JWT revocation (security hardening).
//
// Revoked access tokens are persisted in PostgreSQL (revoked_tokens) so a
// backend restart no longer resurrects logged-out/admin-revoked sessions.
// The in-memory Map remains the hot-path check (sync isRevoked, unchanged
// call sites); it is hydrated from the DB on startup by initRevocationStore()
// and refreshed periodically. Only sha256 hashes are stored, never raw tokens.
//
// Failure mode: if the DB is unreachable, isRevoked() returns false (fail
// open) to preserve login availability — identical to the legacy in-memory
// behavior on restart. Revocation persistence is best-effort during an
// outage and is reconciled on the next hydrate.
//
// Single-instance by design (the app runs one backend container). A future
// multi-instance deploy must add a shared revocation signal or rely on the
// refresh interval.
import { createHash } from 'crypto'
import { db } from '../db.js'

const _revoked = new Map() // tokenHash -> expiresAtMs
const REFRESH_MS = 5 * 60 * 1000
let _refreshTimer = null

function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex')
}

function prune() {
  const now = Date.now()
  for (const [h, exp] of _revoked) if (now > exp) _revoked.delete(h)
}

async function hydrate() {
  try {
    const { rows } = await db.query(
      `SELECT token_hash, EXTRACT(EPOCH FROM expires_at)::bigint AS exp
       FROM revoked_tokens WHERE expires_at > NOW()`
    )
    _revoked.clear()
    for (const r of rows) _revoked.set(r.token_hash, Number(r.exp) * 1000)
  } catch (err) {
    console.warn('[tokenBlacklist] hydrate skipped:', err.message)
  }
}

export async function initRevocationStore() {
  await hydrate()
  if (_refreshTimer) clearInterval(_refreshTimer)
  _refreshTimer = setInterval(hydrate, REFRESH_MS)
  _refreshTimer.unref?.()
}

export function revokeToken(token, expiresAt) {
  const tokenHash = hashToken(token)
  const expMs = expiresAt * 1000
  _revoked.set(tokenHash, expMs)
  prune()
  db.query(
    `INSERT INTO revoked_tokens (token_hash, expires_at)
     VALUES ($1, to_timestamp($2))
     ON CONFLICT (token_hash)
     DO UPDATE SET expires_at = GREATEST(revoked_tokens.expires_at, EXCLUDED.expires_at)`,
    [tokenHash, expiresAt]
  ).catch(err => console.error('[tokenBlacklist] persist failed:', err.message))
}

export function isRevoked(token) {
  const tokenHash = hashToken(token)
  const exp = _revoked.get(tokenHash)
  if (exp === undefined) return false
  if (Date.now() > exp) { _revoked.delete(tokenHash); return false }
  return true
}

export function __resetForTests() {
  _revoked.clear()
  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null }
}
