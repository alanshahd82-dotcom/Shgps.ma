// tokenBlacklist.js — in-memory blacklist with automatic expiry
const blacklist = new Map() // token → expiryTimestamp (ms)

let cleanupScheduled = false
function scheduleCleanup() {
  if (cleanupScheduled) return
  cleanupScheduled = true
  setTimeout(() => {
    const now = Date.now()
    for (const [token, exp] of blacklist) {
      if (now > exp) blacklist.delete(token)
    }
    cleanupScheduled = false
  }, 60 * 60 * 1000)
}

/**
 * Add a token to the blacklist until its natural expiry
 * @param {string} token
 * @param {number} expiresAt - Unix timestamp in seconds (JWT exp field)
 */
export function revokeToken(token, expiresAt) {
  blacklist.set(token, expiresAt * 1000)
  scheduleCleanup()
}

/**
 * Check if a token has been revoked
 * @param {string} token
 * @returns {boolean}
 */
export function isRevoked(token) {
  const exp = blacklist.get(token)
  if (exp === undefined) return false
  if (Date.now() > exp) { blacklist.delete(token); return false }
  return true
}
