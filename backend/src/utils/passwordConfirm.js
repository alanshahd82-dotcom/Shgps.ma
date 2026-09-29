import bcrypt from 'bcryptjs'

// Engine cut / resume needs the password of the signed-in account, checked on
// the server (the app alone can never be trusted for this). Wrong attempts are
// limited per account so the password cannot be guessed through this endpoint.

export const MAX_FAILED_ATTEMPTS = 5
export const LOCK_MS = 10 * 60 * 1000
const attempts = new Map() // userId -> { failures, lockedUntil }
// One check at a time per account: without this, several wrong guesses sent in
// parallel would all read the same failure count and the lockout would never
// trigger. Each account's checks are chained onto its own promise.
const inFlight = new Map() // userId -> Promise

export function resetPasswordAttempts() { attempts.clear(); inFlight.clear() }

function enabled() {
  return String(process.env.ENGINE_REQUIRE_PASSWORD ?? 'true').toLowerCase() !== 'false'
}

/**
 * @returns {Promise<{ok:true}|{ok:false,status:number,code:string,error:string}>}
 * `db` is the app's database wrapper (query), `user` is req.user.
 */
export async function confirmAccountPassword(db, user, password, now = Date.now()) {
  if (!enabled()) return { ok: true }
  if (typeof password !== 'string' || password.length === 0 || password.length > 200) {
    return { ok: false, status: 400, code: 'PASSWORD_REQUIRED', error: 'Password is required' }
  }
  const previous = inFlight.get(user.id) || Promise.resolve()
  const run = previous.catch(() => {}).then(() => checkOnce(db, user, password))
  const settled = run.catch(() => {})
  inFlight.set(user.id, settled)
  try {
    return await run
  } finally {
    // Drop the chain entry only when no further check was queued behind this one.
    if (inFlight.get(user.id) === settled) inFlight.delete(user.id)
  }
}

async function checkOnce(db, user, password, now = Date.now()) {
  const state = attempts.get(user.id) || { failures: 0, lockedUntil: 0 }
  if (state.lockedUntil > now) {
    return { ok: false, status: 429, code: 'TOO_MANY_ATTEMPTS', error: 'Too many wrong attempts. Try again later.' }
  }
  const { rows } = await db.query('SELECT password_hash FROM users WHERE id=$1', [user.id])
  const hash = rows[0]?.password_hash
  const valid = Boolean(hash) && await bcrypt.compare(password, hash)
  if (!valid) {
    const failures = state.lockedUntil && state.lockedUntil <= now ? 1 : state.failures + 1
    attempts.set(user.id, failures >= MAX_FAILED_ATTEMPTS
      ? { failures: 0, lockedUntil: now + LOCK_MS }
      : { failures, lockedUntil: 0 })
    return { ok: false, status: 403, code: 'INVALID_PASSWORD', error: 'Incorrect password' }
  }
  attempts.delete(user.id)
  return { ok: true }
}
