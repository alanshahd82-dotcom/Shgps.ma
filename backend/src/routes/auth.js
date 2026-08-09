import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt    from 'jsonwebtoken'
import crypto from 'crypto'
import { Resend } from 'resend'
import { db }          from '../db.js'
import { config }      from '../config.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

import { revokeToken }              from '../services/tokenBlacklist.js'
import { validateBody, schemas }    from '../validation/schemas.js'
import { logAudit }                from '../services/auditLog.js'

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
authRouter.post('/login', validateBody(schemas.login), async (req, res) => {
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
        isSubAdmin: !!user.is_sub_admin, adminPermissions: user.admin_permissions || null,
        parentAdminId: user.parent_admin_id || null,
        isActive: user.is_active, expiryDate: user.expiry_date, maxDevices: user.max_devices,
        avatar: user.avatar, role: user.role || 'owner', parentClientId: user.parent_client_id || null,
        mustChangePassword: !!user.must_change_password,
        notificationPrefs: user.notification_prefs || {},
      },
    })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// ── POST /api/auth/change-password ────────────────────────────────────────
authRouter.post('/change-password', requireAuth, validateBody(schemas.changePassword), async (req, res) => {
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
    await logAudit(req.user.id, 'password_changed', 'user', req.user.id, {})
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// ── PUT /api/auth/profile ─────────────────────────────────────────────────
authRouter.put('/profile', requireAuth, validateBody(schemas.updateProfile), async (req, res) => {
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
    subscription: u.subscription, isAdmin: u.is_admin,
    isSubAdmin: !!u.is_sub_admin, adminPermissions: u.admin_permissions || null,
    parentAdminId: u.parent_admin_id || null,
    isActive: u.is_active, expiryDate: u.expiry_date, maxDevices: u.max_devices,
    avatar: u.avatar, role: u.role || 'owner',
    parentClientId: u.parent_client_id || null,
    mustChangePassword: !!u.must_change_password,
    notificationPrefs: u.notification_prefs || {},
  })
})

// ── POST /api/auth/forgot-password ────────────────────────────────────────
authRouter.post('/forgot-password', async (req, res) => {
  // Always return the same response to avoid revealing if email is registered
  const GENERIC_OK = { message: 'If this email is registered, you will receive a reset link shortly.' }
  const { email } = req.body
  if (!email || typeof email !== 'string') return res.json(GENERIC_OK)

  try {
    const { rows } = await db.query(
      'SELECT id, name, email FROM users WHERE email=$1 AND is_active=TRUE AND is_admin=FALSE',
      [email.toLowerCase().trim()]
    )
    if (!rows.length) return res.json(GENERIC_OK)
    const user = rows[0]

    // Invalidate any previous unused tokens for this user
    await db.query(
      'UPDATE password_reset_tokens SET used=TRUE WHERE user_id=$1 AND used=FALSE',
      [user.id]
    )

    // Create new token — 32 bytes hex, expires in 1 hour
    const token     = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    )

    // Send email via Resend
    if (config.resend.apiKey) {
      const resend      = new Resend(config.resend.apiKey)
      const resetUrl    = `${config.frontendUrl}/client/reset-password?token=${token}`
      const displayName = user.name || 'العميل'
      await resend.emails.send({
        from: config.resend.mailFrom,
        to:   user.email,
        subject: 'ATHAR GPS — إعادة تعيين كلمة المرور / Réinitialisation du mot de passe',
        html: `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7f8;font-family:sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
        <tr><td style="background:#17324d;padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#fff;font-size:20px;letter-spacing:3px;font-weight:900">ATHAR GPS</h1>
          <p style="margin:6px 0 0;color:#c1cfe0;font-size:12px">تتبع GPS احترافي</p>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 8px;color:#17324d;font-size:15px;font-weight:700">مرحباً ${displayName}،</p>
          <p style="margin:0 0 24px;color:#64748b;font-size:13px;line-height:1.7">
            تلقّينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك. اضغط على الزر أدناه لإعادة التعيين.
            صلاحية الرابط ساعة واحدة فقط وقابل للاستخدام مرة واحدة.
          </p>
          <div style="text-align:center;margin:24px 0">
            <a href="${resetUrl}" style="display:inline-block;background:#17324d;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:14px">
              إعادة تعيين كلمة المرور
            </a>
          </div>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
          <p style="margin:0 0 4px;color:#17324d;font-size:13px;font-weight:600">Bonjour ${displayName},</p>
          <p style="margin:0 0 16px;color:#64748b;font-size:12px;line-height:1.7;direction:ltr;text-align:left">
            Nous avons reçu une demande de réinitialisation de votre mot de passe.
            Ce lien est valable 1 heure et ne peut être utilisé qu'une seule fois.
          </p>
          <div style="text-align:center;margin:16px 0 24px">
            <a href="${resetUrl}" style="display:inline-block;background:#17324d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-weight:700;font-size:13px">
              Réinitialiser le mot de passe
            </a>
          </div>
          <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">
            إذا لم تطلب ذلك، تجاهل هذا البريد. / Si vous n'avez pas fait cette demande, ignorez cet email.
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px;text-align:center">
          <p style="margin:0;color:#94a3b8;font-size:11px">© ${new Date().getFullYear()} ATHAR GPS · Fleet intelligence</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      })
    }

    res.json(GENERIC_OK)
  } catch (err) {
    console.error('[forgot-password]', err.message)
    res.json(GENERIC_OK) // never expose errors
  }
})

// ── POST /api/auth/reset-password ────────────────────────────────────────
authRouter.post('/reset-password', validateBody(schemas.resetPassword), async (req, res) => {
  const { token, newPassword } = req.body
  try {
    const { rows } = await db.query(
      `SELECT t.id, t.user_id, t.expires_at, t.used
       FROM password_reset_tokens t
       WHERE t.token=$1`,
      [token]
    )
    if (!rows.length || rows[0].used || new Date(rows[0].expires_at) < new Date()) {
      return res.status(400).json({ code: 'TOKEN_INVALID', error: 'This link is invalid or has expired.' })
    }
    const { id: tokenId, user_id } = rows[0]
    const hash = await bcrypt.hash(newPassword, 12)

    await db.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, user_id])
    await db.query('UPDATE password_reset_tokens SET used=TRUE WHERE id=$1', [tokenId])

    res.json({ success: true })
  } catch (err) {
    console.error('[reset-password]', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

authRouter.post('/logout', requireAuth, (req, res) => {
  const token   = req.headers.authorization?.split(' ')[1]
  const decoded = jwt.decode(token)
  if (token && decoded?.exp) {
    revokeToken(token, decoded.exp) // يُضاف للقائمة السوداء حتى انتهاء صلاحيته الطبيعي
  }
  res.json({ success: true })
})
