import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'

export const leadsRouter = Router()

// POST /api/leads — public: submit a lead
leadsRouter.post('/', async (req, res) => {
  try {
    const { name, phone, email, package: pkg, message } = req.body
    if (!name || !phone) return res.status(400).json({ error: 'name and phone are required' })
    const { rows } = await db.query(
      `INSERT INTO leads (name, phone, email, package, message) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, phone, email || null, pkg || null, message || null]
    )
    res.status(201).json({ success: true, id: rows[0].id })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// GET /api/leads — admin only
leadsRouter.get('/', requireAuth, async (req, res) => {
  try {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' })
    const { rows } = await db.query('SELECT * FROM leads ORDER BY created_at DESC')
    res.json(rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})
