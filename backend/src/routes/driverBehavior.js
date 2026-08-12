import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validateBody, schemas } from '../validation/schemas.js'
import { db } from '../db.js'
import { getAccessibleDevice } from '../middleware/deviceAccess.js'

export const driverBehaviorRouter = Router()

// POST /api/driver-behavior/scores — save a score
driverBehaviorRouter.post('/scores', requireAuth, validateBody(schemas.driverBehaviorScore), async (req, res) => {
  try {
    const { deviceId, score, speedingEvents, idleMin, tripCount } = req.body
    if (!deviceId || score === undefined) {
      return res.status(400).json({ error: 'deviceId and score are required' })
    }

    // Verify device access
    const dev = await getAccessibleDevice(db, req.user, deviceId)
    if (!dev) return res.status(404).json({ error: 'Device not found or access denied' })

    // Upsert: one score per device per day
    const today = new Date().toISOString().split('T')[0]
    const { rows } = await db.query(
      `INSERT INTO driver_behavior_scores
         (device_id, user_id, score, speeding_events, idle_min, trip_count, recorded_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (device_id, recorded_date)
       DO UPDATE SET
         score           = EXCLUDED.score,
         speeding_events = EXCLUDED.speeding_events,
         idle_min        = EXCLUDED.idle_min,
         trip_count      = EXCLUDED.trip_count,
         updated_at      = NOW()
       RETURNING *`,
      [deviceId, req.user.id, Math.round(score), speedingEvents || 0, idleMin || 0, tripCount || 0, today]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('[driver-behavior/scores POST]', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/driver-behavior/scores?deviceId=X&days=30 — fetch history
driverBehaviorRouter.get('/scores', requireAuth, async (req, res) => {
  try {
    const { deviceId, days = 30 } = req.query
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' })
    const parsedDays = Math.min(Math.max(Number.parseInt(String(days), 10) || 30, 1), 365)

    // Verify device access
    const dev = await getAccessibleDevice(db, req.user, deviceId)
    if (!dev) return res.status(404).json({ error: 'Device not found or access denied' })

    const { rows } = await db.query(
      `SELECT score, speeding_events, idle_min, trip_count, recorded_date
       FROM driver_behavior_scores
       WHERE device_id=$1 AND recorded_date >= CURRENT_DATE - $2::int
       ORDER BY recorded_date DESC`,
      [deviceId, parsedDays]
    )
    res.json(rows)
  } catch (err) {
    console.error('[driver-behavior/scores GET]', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/driver-behavior/summary?deviceId=X — latest score + 7-day trend
driverBehaviorRouter.get('/summary', requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.query
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' })

    const dev = await getAccessibleDevice(db, req.user, deviceId)
    if (!dev) return res.status(404).json({ error: 'Device not found or access denied' })

    const { rows } = await db.query(
      `SELECT score, speeding_events, idle_min, trip_count, recorded_date
       FROM driver_behavior_scores
       WHERE device_id=$1
       ORDER BY recorded_date DESC
       LIMIT 30`,
      [deviceId]
    )

    const latest = rows[0] || null
    const trend  = rows.slice(0, 7).reverse() // last 7 days ascending

    res.json({ latest, trend })
  } catch (err) {
    console.error('[driver-behavior/summary]', err)
    res.status(500).json({ error: 'Server error' })
  }
})
