import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { db }       from '../db.js'
import * as traccar from '../services/traccar.js'

export const mapRouter = Router()

mapRouter.get('/positions', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [{ rows }, positions] = await Promise.all([
      db.query('SELECT d.*,u.name AS client_name FROM devices d LEFT JOIN users u ON d.user_id=u.id'),
      traccar.getAllPositions().catch(()=>[]),
    ])
    const pm = {}
    for (const p of positions) pm[p.deviceId]=p
    res.json(rows.map(d=>({
      id:d.id, name:d.name, type:d.type, plate:d.plate, clientName:d.client_name,
      lat:pm[d.traccar_id]?.latitude??null, lng:pm[d.traccar_id]?.longitude??null,
      speed:pm[d.traccar_id]?.speed??0,
      status:pm[d.traccar_id]?'online':'offline',
      lastUpdate:pm[d.traccar_id]?.fixTime??null,
    })))
  } catch (err) { console.error(err); res.status(500).json({ error:'Server error' }) }
})
