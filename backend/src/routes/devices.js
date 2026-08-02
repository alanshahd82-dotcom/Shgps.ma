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

      // Load active geofences from local DB for all devices
      let geofenceMap = {}
      try {
        const { rows: gRows } = await db.query(
          'SELECT device_id, id, name FROM local_geofences WHERE device_id = ANY($1::int[])',
          [rows.map(d => d.id)]
        )
        for (const g of gRows) geofenceMap[g.device_id] = g
      } catch {}

      res.json(rows.map(d => {
        const p = pm[d.traccar_id]
        const localGeo = geofenceMap[d.id] || null
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
          // Geofence state from local DB
          geofenceActive:   !!localGeo,
          activeGeofenceId: localGeo?.id ?? null,
          geofence: localGeo ? { id: localGeo.id, name: localGeo.name } : null,
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
        if (clientId) {
          const { rows: clientRows } = await db.query(
            `SELECT max_devices,
                    (SELECT COUNT(*)::int FROM devices WHERE user_id=users.id) AS devices_count
             FROM users WHERE id=$1 AND is_admin=false`,
            [clientId]
          )
          const client = clientRows[0]
          if (!client) return res.status(404).json({ error: 'Client not found' })
          if (Number(client.devices_count) >= Number(client.max_devices ?? 5)) {
            return res.status(409).json({
              code: 'DEVICE_LIMIT_REACHED',
              error: `Device limit reached (${client.devices_count}/${client.max_devices ?? 5}). Increase the client limit before adding another device. / Limite d'appareils atteinte.`,
            })
          }
        }
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
          geofenceActive: false, activeGeofenceId: null, geofence: null,
        })
      } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'IMEI already registered' })
        console.error(err); res.status(500).json({ error: 'Server error' })
      }
    })

    // POST /quick-add — إضافة سريعة: IMEI + عميل + عدد أجهزة + تاريخ انتهاء
    devicesRouter.post('/quick-add', requireAuth, async (req, res) => {
      if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' })
      const { imei, clientId, maxDevices, expiresAt } = req.body
      if (!imei)     return res.status(400).json({ error: 'IMEI required' })
      if (!clientId) return res.status(400).json({ error: 'Client required' })
      if (!/^\d{15}$/.test(imei)) return res.status(400).json({ error: 'IMEI must be exactly 15 digits' })

      try {
        // جلب بيانات العميل
        const { rows: clientRows } = await db.query(
          `SELECT id, name, max_devices,
                  (SELECT COUNT(*)::int FROM devices WHERE user_id=users.id) AS devices_count
           FROM users WHERE id=$1 AND is_admin=false`,
          [clientId]
        )
        const client = clientRows[0]
        if (!client) return res.status(404).json({ error: 'Client not found' })

        const newMax = maxDevices ? Number(maxDevices) : (client.max_devices ?? 5)

        // اسم الجهاز تلقائي: "اسم العميل - #N"
        const seq = client.devices_count + 1
        const deviceName = `${client.name} - #${seq}`

        // إنشاء الجهاز في Traccar
        let traccarId = null
        try {
          const td = await traccar.createDevice(deviceName, imei)
          traccarId = td.id
          const { rows: ur } = await db.query('SELECT traccar_id FROM users WHERE id=$1', [clientId])
          if (ur[0]?.traccar_id) await traccar.linkDevice(ur[0].traccar_id, traccarId)
        } catch (e) { console.warn('Traccar skipped:', e.message) }

        // معاملة واحدة: إدراج الجهاز + تحديث الاشتراك
        await db.query('BEGIN')
        try {
          const { rows } = await db.query(
            `INSERT INTO devices (name,imei,type,plate,user_id,traccar_id)
             VALUES ($1,$2,'car',null,$3,$4) RETURNING *`,
            [deviceName, imei, clientId, traccarId]
          )
          await db.query(
            `UPDATE users SET max_devices=$1, expiry_date=$2 WHERE id=$3`,
            [newMax, expiresAt || null, clientId]
          )
          await db.query('COMMIT')
          const d = rows[0]
          res.status(201).json({
            id: d.id, name: d.name, imei: d.imei, type: 'car',
            clientId: d.user_id, status: 'offline',
            lat: 0, lng: 0, speed: 0, lastUpdate: null,
            engineOn: false, battery: null, signal: null, fuel: null,
            geofenceActive: false, activeGeofenceId: null, geofence: null,
            // subscription info updated
            maxDevices: newMax,
            expiresAt: expiresAt || null,
          })
        } catch (e) {
          await db.query('ROLLBACK')
          throw e
        }
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

      // Load geofence state from local DB
      let localGeo = null
      try {
        const { rows: gRows } = await db.query(
          'SELECT id, name FROM local_geofences WHERE device_id=$1 LIMIT 1',
          [dev.id]
        )
        localGeo = gRows[0] || null
      } catch {}

      res.json({
        ...dev, history,
        geofenceActive:   !!localGeo,
        activeGeofenceId: localGeo?.id ?? null,
        geofence: localGeo ? { id: localGeo.id, name: localGeo.name } : null,
      })
    } catch (err) { console.error(err); res.status(500).json({ error:'Server error' }) }
    })

    devicesRouter.post('/:id/command', requireAuth, async (req, res) => {
    try {
      const { rows } = await db.query('SELECT * FROM devices WHERE id=$1', [req.params.id])
      const dev = rows[0]
      if (!dev) return res.status(404).json({ error:'Device not found' })
      if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error:'Access denied' })

      // ── تحقق من وجود traccar_id قبل إرسال الأمر ──────────────────────────
      if (!dev.traccar_id) {
        return res.status(400).json({
          error: 'الجهاز غير مرتبط بالمتتبع. تواصل مع المدير. / Appareil non lié au tracker. Contactez l\'admin.'
        })
      }

      await traccar.sendCommand(dev.traccar_id, req.body.type)
      res.json({ success:true })
    } catch (err) { console.error(err); res.status(500).json({ error:'Failed to send command' }) }
    })

    // POST /:id/geofence — ينشئ سياجاً جغرافياً ويخزّنه محلياً وفي Traccar (إن أمكن)
    devicesRouter.post('/:id/geofence', requireAuth, async (req, res) => {
      try {
        const { rows } = await db.query('SELECT * FROM devices WHERE id=$1', [req.params.id])
        const dev = rows[0]
        if (!dev) return res.status(404).json({ error: 'Device not found' })
        if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })

        const { name, latitude, longitude, radius } = req.body
        if (!latitude || !longitude || !radius) {
          return res.status(400).json({ error: 'latitude, longitude and radius are required' })
        }

        const geofenceName = name || `Geofence-${dev.name}`

        // حذف أي سياج سابق لهذا الجهاز
        await db.query('DELETE FROM local_geofences WHERE device_id=$1', [dev.id])

        // حفظ السياج في قاعدة البيانات المحلية (fallback دائم)
        const coords = JSON.stringify({ lat: latitude, lng: longitude })
        const { rows: gRows } = await db.query(
          `INSERT INTO local_geofences (user_id, device_id, name, type, coords, radius)
           VALUES ($1, $2, $3, 'circle', $4, $5) RETURNING *`,
          [req.user.id, dev.id, geofenceName, coords, radius]
        )
        const localGeofence = gRows[0]

        // محاولة المزامنة مع Traccar (اختيارية — لا تُفشل الطلب عند فشلها)
        let traccarGeofence = null
        try {
          traccarGeofence = await traccar.createGeofence(geofenceName, latitude, longitude, radius)
          await traccar.linkGeofenceToDevice(dev.traccar_id, traccarGeofence.id)
        } catch (e) {
          console.warn('[Geofence] Traccar sync skipped:', e.message)
        }

        res.json({
          success: true,
          geofence: {
            id:   localGeofence.id,
            name: localGeofence.name,
            traccarId: traccarGeofence?.id ?? null,
          },
        })
      } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to create geofence' })
      }
    })

    // DELETE /:id/geofence — يحذف السياج الجغرافي من المحلي ومن Traccar (إن أمكن)
    devicesRouter.delete('/:id/geofence', requireAuth, async (req, res) => {
      try {
        const { rows } = await db.query('SELECT * FROM devices WHERE id=$1', [req.params.id])
        const dev = rows[0]
        if (!dev) return res.status(404).json({ error: 'Device not found' })
        if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })

        // حذف من قاعدة البيانات المحلية
        await db.query('DELETE FROM local_geofences WHERE device_id=$1', [dev.id])

        // محاولة حذف من Traccar (اختيارية)
        const { geofenceId } = req.body
        if (geofenceId) {
          try {
            await traccar.unlinkGeofenceFromDevice(dev.traccar_id, geofenceId)
            await traccar.deleteGeofence(geofenceId)
          } catch (e) {
            console.warn('[Geofence] Traccar delete skipped:', e.message)
          }
        }

        res.json({ success: true })
      } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete geofence' })
      }
    })
