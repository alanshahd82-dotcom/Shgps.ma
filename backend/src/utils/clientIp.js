// Extract the real client IP from request headers for rate-limit keying.
//
// Security: nginx overwrites X-Real-IP with $remote_addr (the real client IP as
// it sees the connection), so a client CANNOT spoof it. nginx APPENDS the real
// client IP to the END of X-Forwarded-For via $proxy_add_x_forwarded_for; the
// FIRST entry of X-Forwarded-For is client-supplied and therefore SPOOFABLE.
// Using the first XFF entry (as the old code did) let an attacker rotate the
// header to bypass brute-force protection. We therefore prefer X-Real-IP, then
// the LAST XFF entry, then '' (callers fall back to req.ip / socket peer).
//
// `headers` is a plain object with lowercased keys (e.g. req.headers).
export function getClientIp(headers = {}) {
  const xRealIp = (headers['x-real-ip'] || '').trim()
  if (xRealIp) return xRealIp

  const xff = (headers['x-forwarded-for'] || '').trim()
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }

  return ''
}
