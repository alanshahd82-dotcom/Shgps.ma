import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'
import crypto from 'crypto'
import * as traccar from '../services/traccar.js'

export const sharingRouter = Router()

// POST /api/sharing — create share link for a device (24h)
sharingRouter.post('/', requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.body
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' })

    const { rows: devRows } = await db.query('SELECT * FROM devices WHERE id=$1', [deviceId])
    const dev = devRows[0]
    if (!dev) return res.status(404).json({ error: 'Device not found' })
    if (!req.user.is_admin && dev.user_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied' })

    const token = crypto.randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await db.query(
      `INSERT INTO share_links (token, device_id, expires_at) VALUES ($1,$2,$3)`,
      [token, deviceId, expiresAt]
    )

    res.status(201).json({ token, expiresAt })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// GET /api/sharing/:token — public: get device position (no auth)
sharingRouter.get('/:token', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT sl.*, d.name, d.plate, d.type, d.traccar_id
       FROM share_links sl JOIN devices d ON d.id=sl.device_id
       WHERE sl.token=$1 AND sl.expires_at > NOW()`,
      [req.params.token]
    )
    const link = rows[0]
    if (!link) return res.status(404).json({ error: 'Link not found or expired' })

    let position = null
    try {
      const positions = await traccar.getAllPositions()
      position = positions.find(p => p.deviceId === link.traccar_id) || null
    } catch {}

    res.json({
      deviceName: link.name,
      plate: link.plate,
      type: link.type,
      expiresAt: link.expires_at,
      position: position ? {
        lat: position.latitude,
        lng: position.longitude,
        speed: position.speed,
        fixTime: position.fixTime,
      } : null,
    })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})
