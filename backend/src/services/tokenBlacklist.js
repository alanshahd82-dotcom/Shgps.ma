// tokenBlacklist.js — blacklist بانتهاء تلقائي لكل token
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
  }, 60 * 60 * 1000) // تنظيف بعد ساعة
}

/**
 * يضيف token للقائمة السوداء حتى وقت انتهائه الطبيعي
 * @param {string} token
 * @param {number} expiresAt - Unix timestamp بالثواني (من حقل exp في JWT)
 */
export function revokeToken(token, expiresAt) {
  blacklist.set(token, expiresAt * 1000) // نحوّل للميلي ثانية
  scheduleCleanup()
}

/**
 * يتحقق إذا كان الـ token مُبطَلاً
 * @param {string} token
 * @returns {boolean}
 */
export function isRevoked(token) {
  const exp = blacklist.get(token)
  if (exp === undefined) return false
  if (Date.now() > exp) { blacklist.delete(token); return false }
  return true
}
