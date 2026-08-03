import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'
import { getDeviceLicense, requireActiveDeviceLicense } from '../services/deviceSubscriptions.js'

export const maintenanceRouter = Router()

maintenanceRouter.get('/', requireAuth, requireActiveDeviceLicense, async (req, res) => {
  try {
    const { deviceId } = req.query
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' })
    const { rows: devRows } = await db.query('SELECT * FROM devices WHERE id=$1', [deviceId])
    const dev = devRows[0]
    if (!dev) return res.status(404).json({ error: 'Device not found' })
    if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    const { rows } = await db.query('SELECT * FROM maintenance_logs WHERE device_id=$1 ORDER BY date DESC', [deviceId])
    res.json(rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

maintenanceRouter.post('/', requireAuth, requireActiveDeviceLicense, async (req, res) => {
  try {
    const { deviceId, type, note, mileage, date, nextDueMileage } = req.body
    if (!deviceId || !type) return res.status(400).json({ error: 'deviceId and type are required' })
    const { rows: devRows } = await db.query('SELECT * FROM devices WHERE id=$1', [deviceId])
    const dev = devRows[0]
    if (!dev) return res.status(404).json({ error: 'Device not found' })
    if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    const { rows } = await db.query(
      `INSERT INTO maintenance_logs (device_id, type, note, mileage, date, next_due_mileage)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [deviceId, type, note || null, mileage || null, date || new Date().toISOString(), nextDueMileage || null]
    )
    res.status(201).json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

maintenanceRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT ml.*, d.user_id FROM maintenance_logs ml JOIN devices d ON d.id=ml.device_id WHERE ml.id=$1', [req.params.id])
    const log = rows[0]
    if (!log) return res.status(404).json({ error: 'Not found' })
    if (!req.user.is_admin && log.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    if (!req.user.is_admin) {
      const license = await getDeviceLicense(log.device_id)
      if (!license?.applicationAccess) {
        return res.status(403).json({ error: 'Device application access is unavailable until renewal' })
      }
    }
    await db.query('DELETE FROM maintenance_logs WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})
