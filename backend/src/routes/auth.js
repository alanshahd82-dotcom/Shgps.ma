import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt    from 'jsonwebtoken'
import { db }          from '../db.js'
import { config }      from '../config.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

import { revokeToken, isRevoked } from '../services/tokenBlacklist.js'

// ── Rate limiting (in-memory) ──────────────────────────────────────────────
const loginAttempts = new Map()
const LIMIT     = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 min

setInterval(() => {
  const now = Date.now()
  for (const [key, val] of loginAttempts) {
    if (now - val.firstAttempt > WINDOW_MS) loginAttempts.delete(key)
  }
}, WINDOW_MS)

function checkRateLimit(ip) {
  const now   = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry) return null
  if (now - entry.firstAttempt > WINDOW_MS) { loginAttempts.delete(ip); return null }
  return entry.count >= LIMIT
    ? Math.ceil((entry.firstAttempt + WINDOW_MS - now) / 1000)
    : null
}
function recordAttempt(ip) {
  const now   = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now })
  } else {
    entry.count++
  }
}
function clearAttempts(ip) { loginAttempts.delete(ip) }

// ── POST /api/auth/login ───────────────────────────────────────────────────
authRouter.post('/login', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
          || req.socket?.remoteAddress
          || 'unknown'

  const remainingSec = checkRateLimit(ip)
  if (remainingSec !== null) {
    const minutes = Math.ceil(remainingSec / 60)
    return res.status(429).json({
      error: `محاولات كثيرة. حاول مجدداً بعد ${minutes} دقيقة. / Trop de tentatives. Réessayez dans ${minutes} min.`
    })
  }

  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  try {
    const { rows } = await db.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase().trim()])
    const user = rows[0]

    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
      recordAttempt(ip)
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    clearAttempts(ip)
    const token = jwt.sign(
      { userId: user.id, isAdmin: user.is_admin },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    )
    res.json({
      token,
      user: {
        id: user.id, email: user.email, name: user.name, phone: user.phone,
        city: user.city, subscription: user.subscription, isAdmin: user.is_admin,
         isActive: user.is_active, expiryDate: user.expiry_date, maxDevices: user.max_devices,
         avatar: user.avatar, role: user.role || 'owner', parentClientId: user.parent_client_id || null,
         mustChangePassword: !!user.must_change_password,
        notificationPrefs: user.notification_prefs || {},
      },
    })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// ── POST /api/auth/change-password ────────────────────────────────────────
authRouter.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Both passwords required' })

  // Strength: 8+ chars, at least one uppercase, one digit, one special char
  const strongPwd = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+{};:',.<>?/\\|`~]).{8,}$/.test(newPassword)
  if (!strongPwd) return res.status(400).json({ error: 'WEAK_PASSWORD' })

  try {
    const { rows } = await db.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id])
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    if (!(await bcrypt.compare(currentPassword, rows[0].password_hash)))
      return res.status(401).json({ error: 'WRONG_CURRENT' })

    const hash = await bcrypt.hash(newPassword, 10)
    await db.query(
      'UPDATE users SET password_hash=$1, must_change_password=false, updated_at=NOW() WHERE id=$2',
      [hash, req.user.id]
    )
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// ── PUT /api/auth/profile ─────────────────────────────────────────────────
authRouter.put('/profile', requireAuth, async (req, res) => {
  const { name, phone, email, notificationPrefs } = req.body
  const normalizedEmail = email === undefined ? null : String(email).trim().toLowerCase()
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ code: 'INVALID_EMAIL', error: 'A valid email address is required' })
  }
  try {
    const { rows } = await db.query(
      `UPDATE users SET
        name              = COALESCE($1, name),
        phone             = COALESCE($2, phone),
        email             = COALESCE($3, email),
        notification_prefs = COALESCE($4, notification_prefs),
        updated_at        = NOW()
       WHERE id = $5
       RETURNING id, email, name, phone, city, subscription, is_admin,
                 is_active, expiry_date, max_devices, avatar, role,
                 parent_client_id, must_change_password, notification_prefs`,
      [name || null, phone || null,
       normalizedEmail,
       notificationPrefs ? JSON.stringify(notificationPrefs) : null,
       req.user.id]
    )
    const u = rows[0]
    res.json({
      success: true,
      user: {
        id: u.id, email: u.email, name: u.name, phone: u.phone, city: u.city,
        subscription: u.subscription, isAdmin: u.is_admin, isActive: u.is_active,
        expiryDate: u.expiry_date, maxDevices: u.max_devices, avatar: u.avatar,
        role: u.role || 'owner', parentClientId: u.parent_client_id || null,
        mustChangePassword: !!u.must_change_password,
        notificationPrefs: u.notification_prefs || {},
      },
    })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ code: 'EMAIL_ALREADY_EXISTS', error: 'Email already exists' })
    }
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/auth/me ──────────────────────────────────────────────────────
authRouter.get('/me', requireAuth, (req, res) => {
  const u = req.user
  res.json({
    id: u.id, email: u.email, name: u.name, phone: u.phone, city: u.city,
    subscription: u.subscription, isAdmin: u.is_admin, isActive: u.is_active,
    expiryDate: u.expiry_date, maxDevices: u.max_devices, avatar: u.avatar,
    role: u.role || 'owner',
    parentClientId: u.parent_client_id || null,
    mustChangePassword: !!u.must_change_password,
    notificationPrefs: u.notification_prefs || {},
  })
})

authRouter.post('/logout', requireAuth, (req, res) => {
  const token   = req.headers.authorization?.split(' ')[1]
  const decoded = jwt.decode(token)
  if (token && decoded?.exp) {
    revokeToken(token, decoded.exp) // يُضاف للقائمة السوداء حتى انتهاء صلاحيته الطبيعي
  }
  res.json({ success: true })
})
