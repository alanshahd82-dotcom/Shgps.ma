import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt    from 'jsonwebtoken'
import crypto from 'crypto'
import { db }          from '../db.js'
import { config }      from '../config.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase().trim()])
    const user = rows[0]
    if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid credentials' })
    if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' })
    const token = jwt.sign({ userId: user.id, isAdmin: user.is_admin }, config.jwtSecret, { expiresIn: config.jwtExpiry })
    res.json({
      token,
      user: {
        id: user.id, email: user.email, name: user.name, phone: user.phone, city: user.city,
        subscription: user.subscription, isAdmin: user.is_admin, avatar: user.avatar,
        alertSettings: user.alert_settings,
      },
    })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req, res) => {
  const u = req.user
  res.json({
    id: u.id, email: u.email, name: u.name, phone: u.phone, city: u.city,
    subscription: u.subscription, isAdmin: u.is_admin, avatar: u.avatar,
    alertSettings: u.alert_settings,
  })
})

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => res.json({ success: true }))

// PATCH /api/auth/me/settings — alert settings
authRouter.patch('/me/settings', requireAuth, async (req, res) => {
  try {
    const { speed, geofence, battery } = req.body
    const settings = { speed: !!speed, geofence: !!geofence, battery: !!battery }
    await db.query('UPDATE users SET alert_settings=$1, updated_at=NOW() WHERE id=$2', [JSON.stringify(settings), req.user.id])
    res.json({ success: true, alertSettings: settings })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// PATCH /api/auth/me/password — change password
authRouter.patch('/me/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'All fields required' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    const { rows } = await db.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id])
    if (!rows[0] || !await bcrypt.compare(currentPassword, rows[0].password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }
    const hash = await bcrypt.hash(newPassword, 10)
    await db.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.user.id])
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// PATCH /api/auth/me/phone — update phone
authRouter.patch('/me/phone', requireAuth, async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone) return res.status(400).json({ error: 'Phone required' })
    await db.query('UPDATE users SET phone=$1, updated_at=NOW() WHERE id=$2', [phone, req.user.id])
    res.json({ success: true, phone })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// POST /api/auth/forgot-password
authRouter.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })
    const { rows } = await db.query('SELECT id FROM users WHERE email=$1 AND is_active=true', [email.toLowerCase().trim()])
    // Always respond with success to prevent user enumeration
    if (!rows[0]) return res.json({ success: true, message: 'If email exists, OTP sent' })
    const token = crypto.randomInt(100000, 999999).toString()
    const expires = new Date(Date.now() + 15 * 60 * 1000) // 15 min
    await db.query('INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1,$2,$3)', [rows[0].id, token, expires])
    // TODO: send email — for now log it
    console.log(`[Auth] Password reset OTP for ${email}: ${token}`)
    res.json({ success: true, message: 'If email exists, OTP sent', _dev_otp: process.env.NODE_ENV !== 'production' ? token : undefined })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// POST /api/auth/reset-password
authRouter.post('/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body
    if (!email || !token || !newPassword) return res.status(400).json({ error: 'All fields required' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    const { rows: userRows } = await db.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase().trim()])
    if (!userRows[0]) return res.status(400).json({ error: 'Invalid request' })
    const userId = userRows[0].id
    const { rows } = await db.query(
      `SELECT id FROM password_resets WHERE user_id=$1 AND token=$2 AND used=false AND expires_at > NOW()`,
      [userId, token]
    )
    if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired OTP' })
    const hash = await bcrypt.hash(newPassword, 10)
    await db.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, userId])
    await db.query('UPDATE password_resets SET used=true WHERE id=$1', [rows[0].id])
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})
