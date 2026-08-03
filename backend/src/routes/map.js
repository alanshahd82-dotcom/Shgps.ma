import { Router } from 'express'
    import { requireAuth, requireAdmin } from '../middleware/auth.js'
    import { db }       from '../db.js'
    import * as traccar from '../services/traccar.js'
import { getSubscriptionSnapshot } from '../services/subscriptions.js'

    export const mapRouter = Router()

    mapRouter.get('/positions', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const [{ rows }, positions] = await Promise.all([
        db.query('SELECT d.*,u.name AS client_name FROM devices d LEFT JOIN users u ON d.user_id=u.id'),
        traccar.getAllPositions().catch(()=>[]),
      ])
      const pm = {}
      for (const p of positions) pm[p.deviceId]=p
      res.json(rows.map(d => {
        const subscription = getSubscriptionSnapshot(d)
        const position = subscription.trackingEnabled ? pm[d.traccar_id] : null
        return {
          id: d.id, name: d.name, type: d.type, plate: d.plate, clientName: d.client_name,
          lat: position?.latitude ?? null, lng: position?.longitude ?? null,
          speed: position?.speed ?? 0,
          status: position ? 'online' : 'offline',
          lastUpdate: position?.fixTime ?? null,
          subscriptionStatus: subscription.subscriptionStatus,
          trackingEnabled: subscription.trackingEnabled,
        }
      }))
    } catch (err) { console.error(err); res.status(500).json({ error:'Server error' }) }
    })
    