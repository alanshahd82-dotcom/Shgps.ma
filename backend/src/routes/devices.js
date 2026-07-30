import { Router } from 'express'
    import { requireAuth } from '../middleware/auth.js'
    import { db }          from '../db.js'
    import * as traccar    from '../services/traccar.js'

    export const devicesRouter = Router()

    devicesRouter.get('/', requireAuth, async (req, res) => {
    try {
      const { rows } = req.user.is_admin
        ? await db.query('SELECT d.*,u.name AS client_name FROM devices d LEFT JOIN users u ON d.user_id=u.id ORDER BY d.created_at DESC')
        : await db.query('SELECT * FROM devices WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id])

      let pm = {}
      try { for (const p of await traccar.getAllPositions()) pm[p.deviceId]=p } catch {}

      res.json(rows.map(d => {
        const p = pm[d.traccar_id]
        return {
          id:d.id, name:d.name, imei:d.imei, type:d.type, plate:d.plate,
          clientId:d.user_id, clientName:d.client_name??null,
          status:    p ? 'online' : 'offline',
          lat:       p?.latitude  ?? 0,
          lng:       p?.longitude ?? 0,
          speed:     p?.speed     ?? 0,
          lastUpdate:p?.fixTime   ?? null,
          engineOn:  p?.attributes?.ignition ?? false,
          battery:   p?.attributes?.battery  ?? null,
          signal:    p?.attributes?.rssi     ?? null,
          fuel:      p?.attributes?.fuel     ?? null,
        }
      }))
    } catch (err) { console.error(err); res.status(500).json({ error:'Server error' }) }
    })

    devicesRouter.get('/:id', requireAuth, async (req, res) => {
    try {
      const { rows } = await db.query('SELECT * FROM devices WHERE id=$1', [req.params.id])
      const dev = rows[0]
      if (!dev) return res.status(404).json({ error:'Device not found' })
      if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error:'Access denied' })
      let history = []
      try { history = await traccar.getHistory(dev.traccar_id) } catch {}
      res.json({ ...dev, history })
    } catch (err) { console.error(err); res.status(500).json({ error:'Server error' }) }
    })

    devicesRouter.post('/:id/command', requireAuth, async (req, res) => {
    try {
      const { rows } = await db.query('SELECT * FROM devices WHERE id=$1', [req.params.id])
      const dev = rows[0]
      if (!dev) return res.status(404).json({ error:'Device not found' })
      if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error:'Access denied' })
      await traccar.sendCommand(dev.traccar_id, req.body.type)
      res.json({ success:true })
    } catch (err) { console.error(err); res.status(500).json({ error:'Failed to send command' }) }
    })

    // POST /:id/geofence — ينشئ سياجاً جغرافياً ويربطه بالجهاز
    devicesRouter.post('/:id/geofence', requireAuth, async (req, res) => {
      try {
        const { rows } = await db.query('SELECT * FROM devices WHERE id=$1', [req.params.id])
        const dev = rows[0]
        if (!dev) return res.status(404).json({ error: 'Device not found' })
        if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })

        const { name, latitude, longitude, radius } = req.body
        if (!latitude || !longitude || !radius) return res.status(400).json({ error: 'latitude, longitude and radius are required' })

        const geofenceName = name || `Geofence-${dev.name}`
        const geofence = await traccar.createGeofence(geofenceName, latitude, longitude, radius)
        await traccar.linkGeofenceToDevice(dev.traccar_id, geofence.id)

        res.json({ success: true, geofence })
      } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create geofence' }) }
    })

    // DELETE /:id/geofence — يحذف السياج الجغرافي ويفك ربطه بالجهاز
    devicesRouter.delete('/:id/geofence', requireAuth, async (req, res) => {
      try {
        const { rows } = await db.query('SELECT * FROM devices WHERE id=$1', [req.params.id])
        const dev = rows[0]
        if (!dev) return res.status(404).json({ error: 'Device not found' })
        if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })

        const { geofenceId } = req.body
        if (!geofenceId) return res.status(400).json({ error: 'geofenceId is required' })

        await traccar.unlinkGeofenceFromDevice(dev.traccar_id, geofenceId)
        await traccar.deleteGeofence(geofenceId)

        res.json({ success: true })
      } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to delete geofence' }) }
    })
