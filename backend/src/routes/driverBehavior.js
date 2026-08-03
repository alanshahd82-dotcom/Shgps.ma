import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'
import { requireActiveDeviceLicense } from '../services/deviceSubscriptions.js'

export const driverBehaviorRouter = Router()

driverBehaviorRouter.post('/scores', requireAuth, requireActiveDeviceLicense, async (req, res) => {
  try {
    const { deviceId, score, speedingEvents, idleMin, tripCount } = req.body
    if (!deviceId || score === undefined) return res.status(400).json({ error: 'deviceId and score are required' })
    const { rows: devRows } = await db.query('SELECT * FROM devices WHERE id=$1', [deviceId])
    const dev = devRows[0]
    if (!dev) return res.status(404).json({ error: 'Device not found' })
    if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    const today = new Date().toISOString().split('T')[0]
    const { rows } = await db.query(
      `INSERT INTO driver_behavior_scores (device_id, user_id, score, speeding_events, idle_min, trip_count, recorded_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (device_id, recorded_date) DO UPDATE SET
         score=EXCLUDED.score, speeding_events=EXCLUDED.speeding_events,
         idle_min=EXCLUDED.idle_min, trip_count=EXCLUDED.trip_count, updated_at=NOW()
       RETURNING *`,
      [deviceId, req.user.id, Math.round(score), speedingEvents||0, idleMin||0, tripCount||0, today]
    )
    res.status(201).json(rows[0])
  } catch (err) { console.error('[driver-behavior/scores POST]', err); res.status(500).json({ error: 'Server error' }) }
})

driverBehaviorRouter.get('/scores', requireAuth, requireActiveDeviceLicense, async (req, res) => {
  try {
    const { deviceId, days = 30 } = req.query
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' })
    const { rows: devRows } = await db.query('SELECT * FROM devices WHERE id=$1', [deviceId])
    const dev = devRows[0]
    if (!dev) return res.status(404).json({ error: 'Device not found' })
    if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    const { rows } = await db.query(
      `SELECT score, speeding_events, idle_min, trip_count, recorded_date FROM driver_behavior_scores WHERE device_id=$1 AND recorded_date >= NOW() - INTERVAL '${parseInt(days)} days' ORDER BY recorded_date DESC`,
      [deviceId]
    )
    res.json(rows)
  } catch (err) { console.error('[driver-behavior/scores GET]', err); res.status(500).json({ error: 'Server error' }) }
})

driverBehaviorRouter.get('/summary', requireAuth, requireActiveDeviceLicense, async (req, res) => {
  try {
    const { deviceId } = req.query
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' })
    const { rows: devRows } = await db.query('SELECT * FROM devices WHERE id=$1', [deviceId])
    const dev = devRows[0]
    if (!dev) return res.status(404).json({ error: 'Device not found' })
    if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    const { rows } = await db.query(
      'SELECT score, speeding_events, idle_min, trip_count, recorded_date FROM driver_behavior_scores WHERE device_id=$1 ORDER BY recorded_date DESC LIMIT 30',
      [deviceId]
    )
    const latest = rows[0] || null
    const trend  = rows.slice(0, 7).reverse()
    res.json({ latest, trend })
  } catch (err) { console.error('[driver-behavior/summary]', err); res.status(500).json({ error: 'Server error' }) }
})
