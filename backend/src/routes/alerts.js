import { Router } from 'express'
    import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
    import { db } from '../db.js'
import { deviceAccessScope } from '../middleware/deviceAccess.js'

    export const alertsRouter = Router()

    alertsRouter.get('/', requireAuth, requireRole('manager', 'alerts'), async (req, res) => {
    try {
      const scope = deviceAccessScope(req.user, 'd')
      const { rows } = await db.query(
        `SELECT a.*,d.name AS device_name,u.name AS client_name
            FROM alerts a LEFT JOIN devices d ON a.device_id=d.id LEFT JOIN users u ON a.user_id=u.id
            WHERE ${scope.text}
            ORDER BY a.created_at DESC LIMIT 200`, scope.values)
      res.json(rows.map(a=>({
        id:a.id, type:a.type, message:a.message,
        deviceId:a.device_id, deviceName:a.device_name, clientName:a.client_name??null,
        read:a.is_read, time:a.created_at, data:a.data,
      })))
    } catch (err) { console.error(err); res.status(500).json({ error:'Server error' }) }
    })

    alertsRouter.patch('/read-all', requireAuth, async (req, res) => {
      try {
        const scope = deviceAccessScope(req.user, 'd')
        await db.query(
          `UPDATE alerts a SET is_read=true
           FROM devices d
           WHERE a.device_id=d.id AND ${scope.text}`,
          scope.values,
        )
        res.json({ success: true })
      } catch { res.status(500).json({ error: 'Server error' }) }
    })

    alertsRouter.patch('/:id/read', requireAuth, async (req, res) => {
      try {
        const scope = deviceAccessScope(req.user, 'd', 2)
        await db.query(
          `UPDATE alerts a SET is_read=true
           FROM devices d
           WHERE a.id=$1 AND a.device_id=d.id AND ${scope.text}`,
          [req.params.id, ...scope.values],
        )
        res.json({ success: true })
      } catch { res.status(500).json({ error: 'Server error' }) }
    })
    