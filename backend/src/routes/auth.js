import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { db } from '../db.js'
import { config } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { revokeToken } from '../services/tokenBlacklist.js'

export const authRouter = Router()

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    const { rows } = await db.query('SELECT * FROM users WHERE email=$1 AND is_active=true', [email.toLowerCase().trim()])
    const user = rows[0]
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })
    const token = jwt.sign({ userId: user.id, isAdmin: user.is_admin }, config.jwtSecret, { expiresIn: config.jwtExpiry })
    res.json({
      token,
      user: {
        id: user.id, email: user.email, name: user.name,
        isAdmin: user.is_admin, subscription: user.subscription,
        avatar: user.avatar, phone: user.phone, city: user.city,
        role: user.role, parentClientId: user.parent_client_id,
      },
    })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// Customer self-registration is intentionally disabled. Admins create customers
// through /api/clients and keep control of device assignment.
authRouter.post('/register', async (req, res) => {
  res.status(403).json({ error: 'Customer self-registration is disabled. Contact an administrator.' })
})

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req, res) => {
  const u = req.user
  res.json({
    id: u.id, email: u.email, name: u.name, phone: u.phone, city: u.city,
    isAdmin: u.is_admin, subscription: u.subscription, avatar: u.avatar,
    role: u.role, parentClientId: u.parent_client_id,
    maxDevices: u.max_devices, expiryDate: u.expiry_date,
    notificationPrefs: u.notification_prefs,
  })
})

// PATCH /api/auth/me
authRouter.patch('/me', requireAuth, async (req, res) => {
  try {
    const { name, city, notificationPrefs } = req.body
    await db.query(
      'UPDATE users SET name=COALESCE($1,name), city=COALESCE($2,city), notification_prefs=COALESCE($3,notification_prefs), updated_at=NOW() WHERE id=$4',
      [name || null, city || null, notificationPrefs ? JSON.stringify(notificationPrefs) : null, req.user.id]
    )
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// PATCH /api/auth/me/password
authRouter.patch('/me/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' })
    const valid = await bcrypt.compare(currentPassword, req.user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })
    const hash = await bcrypt.hash(newPassword, 10)
    await db.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.user.id])
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// PATCH /api/auth/me/phone
authRouter.patch('/me/phone', requireAuth, async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone) return res.status(400).json({ error: 'Phone required' })
    await db.query('UPDATE users SET phone=$1, updated_at=NOW() WHERE id=$2', [phone, req.user.id])
    res.json({ success: true, phone })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// POST /api/auth/logout
authRouter.post('/logout', requireAuth, async (req, res) => {
  try {
    const token = req.headers.authorization?.slice(7)
    if (token) {
      const decoded = jwt.decode(token)
      if (decoded?.exp) revokeToken(token, decoded.exp)
    }
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// POST /api/auth/forgot-password
authRouter.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })
    const { rows } = await db.query('SELECT id FROM users WHERE email=$1 AND is_active=true', [email.toLowerCase().trim()])
    if (!rows[0]) return res.json({ success: true, message: 'If email exists, OTP sent' })
    const token = crypto.randomInt(100000, 999999).toString()
    const expires = new Date(Date.now() + 15 * 60 * 1000)
    await db.query('INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1,$2,$3)', [rows[0].id, token, expires])
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
      'SELECT id FROM password_resets WHERE user_id=$1 AND token=$2 AND used=false AND expires_at > NOW()',
      [userId, token]
    )
    if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired OTP' })
    const hash = await bcrypt.hash(newPassword, 10)
    await db.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, userId])
    await db.query('UPDATE password_resets SET used=true WHERE id=$1', [rows[0].id])
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})
