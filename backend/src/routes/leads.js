// backend/src/routes/leads.js
import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'

export const leadsRouter = Router()

// Rate limiting in-memory
const leadsAttempts = new Map()
const LEADS_LIMIT  = 3               // 3 محاولات
const LEADS_WINDOW = 60 * 60 * 1000  // خلال ساعة واحدة

setInterval(() => {
  const now = Date.now()
  for (const [key, val] of leadsAttempts)
    if (now - val.first > LEADS_WINDOW) leadsAttempts.delete(key)
}, LEADS_WINDOW)

function leadsRateLimit(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
           || req.socket?.remoteAddress || 'unknown'
  const now = Date.now()
  const entry = leadsAttempts.get(ip)
  if (entry && now - entry.first < LEADS_WINDOW && entry.count >= LEADS_LIMIT) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' })
  }
  if (!entry || now - entry.first >= LEADS_WINDOW) {
    leadsAttempts.set(ip, { count: 1, first: now })
  } else {
    entry.count++
  }
  next()
}

// POST /api/leads — public مع rate limit
leadsRouter.post('/', leadsRateLimit, async (req, res) => {
  try {
    const { name, phone, email, package: pkg, message } = req.body
    if (!name || !phone) return res.status(400).json({ error: 'name and phone are required' })
    if (!/^\+?[\d\s\-]{8,15}$/.test(phone))
      return res.status(400).json({ error: 'Invalid phone number' })
    const { rows } = await db.query(
      `INSERT INTO leads (name, phone, email, package, message) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        name.trim().slice(0, 100),
        phone.trim().slice(0, 20),
        email?.slice(0, 100) || null,
        pkg?.slice(0, 50)    || null,
        message?.slice(0, 1000) || null,
      ]
    )
    res.status(201).json({ success: true, id: rows[0].id })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// GET /api/leads — admin only
leadsRouter.get('/', requireAuth, async (req, res) => {
  try {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' })
    const { rows } = await db.query('SELECT * FROM leads ORDER BY created_at DESC LIMIT 200')
    res.json(rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})
