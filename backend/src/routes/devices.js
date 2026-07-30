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

    // POST / — إنشاء جهاز جديد مباشرة (أدمن فقط)
    devicesRouter.post('/', requireAuth, async (req, res) => {
      if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' })
      const { name, imei, type, plate, clientId } = req.body
      if (!name || !imei) return res.status(400).json({ error: 'Name and IMEI required' })
      if (!/^\d{15}$/.test(imei)) return res.status(400).json({ error: 'IMEI must be exactly 15 digits' })
      try {
        let traccarId = null
        try {
          const td = await traccar.createDevice(name, imei)
          traccarId = td.id
          if (clientId) {
            const { rows: ur } = await db.query('SELECT traccar_id FROM users WHERE id=$1', [clientId])
            if (ur[0]?.traccar_id) await traccar.linkDevice(ur[0].traccar_id, traccarId)
          }
        } catch (e) { console.warn('Traccar device skipped:', e.message) }
        const { rows } = await db.query(
          `INSERT INTO devices (name,imei,type,plate,user_id,traccar_id)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [name, imei, type || 'car', plate || null, clientId || null, traccarId]
        )
        const d = rows[0]
        res.status(201).json({
          id: d.id, name: d.name, imei: d.imei, type: d.type, plate: d.plate,
          clientId: d.user_id, status: 'offline', lat: 0, lng: 0, speed: 0,
          lastUpdate: null, engineOn: false, battery: null, signal: null, fuel: null,
        })
      } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'IMEI already registered' })
        console.error(err); res.status(500).json({ error: 'Server error' })
      }
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
