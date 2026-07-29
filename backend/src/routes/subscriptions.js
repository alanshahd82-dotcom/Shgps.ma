import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { db } from '../db.js'

export const subscriptionsRouter = Router()

// GET /api/subscription — current user's subscription
subscriptionsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, u.name AS user_name
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       WHERE s.user_id=$1 AND s.is_active=true
       ORDER BY s.end_date DESC LIMIT 1`,
      [req.user.id]
    )
    if (!rows[0]) {
      // Return a basic default if no subscription exists
      const deviceCount = await db.query('SELECT COUNT(*) FROM devices WHERE user_id=$1', [req.user.id])
      return res.json({
        plan: req.user.subscription || 'Basic',
        device_limit: 3,
        start_date: null,
        end_date: null,
        is_active: false,
        devices_used: parseInt(deviceCount.rows[0].count),
      })
    }
    const deviceCount = await db.query('SELECT COUNT(*) FROM devices WHERE user_id=$1', [req.user.id])
    res.json({
      ...rows[0],
      devices_used: parseInt(deviceCount.rows[0].count),
    })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// GET /api/admin/subscriptions — all subscriptions (admin)
subscriptionsRouter.get('/admin', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query
    let query = `
      SELECT s.*, u.name AS user_name, u.email AS user_email,
             (SELECT COUNT(*) FROM devices d WHERE d.user_id=s.user_id) AS devices_used
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
    `
    const now = new Date().toISOString()
    if (status === 'active') {
      query += ` WHERE s.is_active=true AND s.end_date > '${now}'`
    } else if (status === 'expired') {
      query += ` WHERE s.end_date <= '${now}'`
    } else if (status === 'expiring') {
      const in7 = new Date(Date.now() + 7 * 24 * 3600000).toISOString()
      query += ` WHERE s.is_active=true AND s.end_date > '${now}' AND s.end_date <= '${in7}'`
    }
    query += ' ORDER BY s.end_date ASC'
    const { rows } = await db.query(query)
    res.json(rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// PATCH /api/admin/subscriptions/:id — renew or update
subscriptionsRouter.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { plan, device_limit, months, end_date } = req.body
    const { rows: current } = await db.query('SELECT * FROM subscriptions WHERE id=$1', [req.params.id])
    if (!current[0]) return res.status(404).json({ error: 'Subscription not found' })

    let newEndDate = end_date ? new Date(end_date) : new Date(current[0].end_date)
    if (months) {
      const base = newEndDate < new Date() ? new Date() : newEndDate
      newEndDate = new Date(base)
      newEndDate.setMonth(newEndDate.getMonth() + parseInt(months))
    }

    const { rows } = await db.query(
      `UPDATE subscriptions
       SET plan=$1, device_limit=$2, end_date=$3, is_active=true
       WHERE id=$4 RETURNING *`,
      [plan || current[0].plan, device_limit || current[0].device_limit, newEndDate, req.params.id]
    )

    // Sync plan to users table
    await db.query('UPDATE users SET subscription=$1 WHERE id=$2', [rows[0].plan, rows[0].user_id])

    res.json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// POST /api/admin/subscriptions — create subscription for a user
subscriptionsRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const { user_id, plan, device_limit, months } = req.body
    if (!user_id || !months) return res.status(400).json({ error: 'user_id and months required' })
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + parseInt(months))

    // Deactivate previous subscriptions
    await db.query('UPDATE subscriptions SET is_active=false WHERE user_id=$1', [user_id])

    const { rows } = await db.query(
      `INSERT INTO subscriptions (user_id, plan, device_limit, end_date)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [user_id, plan || 'Basic', device_limit || 3, endDate]
    )
    await db.query('UPDATE users SET subscription=$1 WHERE id=$2', [rows[0].plan, user_id])
    res.status(201).json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})
