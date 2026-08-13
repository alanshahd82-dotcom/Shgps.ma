import { Router } from 'express'
import { requireAuth }    from '../middleware/auth.js'
import { requireRole }    from '../middleware/requireRole.js'
import { validateBody, schemas } from '../validation/schemas.js'
import { db } from '../db.js'
import * as traccar from '../services/traccar.js'
import { deviceAccessScope, getAccessibleDevice } from '../middleware/deviceAccess.js'

export const geofencesRouter = Router()

// GET /api/geofences?deviceId=X — يجلب السياجات (مع تصفية اختيارية بالجهاز)
geofencesRouter.get('/', requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.query

    if (deviceId) {
      // تحقق من أن المستخدم يملك صلاحية الوصول للجهاز
      const dev = await getAccessibleDevice(db, req.user, deviceId)
      if (!dev) return res.status(404).json({ error: 'Device not found or access denied' })
      const geofences = await traccar.getGeofencesByDevice(dev.traccar_id)
      return res.json(geofences)
    }

    // المشرف يرى كل السياجات، العميل يرى سياجات أجهزته فقط
    if (req.user.is_admin) {
      const geofences = await traccar.getGeofencesByDevice('')
      return res.json(geofences)
    }

    // جمع traccar_id لأجهزة المستخدم الحالي
    const scope = deviceAccessScope(req.user, 'd')
    const { rows: devRows } = await db.query(
      `SELECT d.traccar_id FROM devices d WHERE ${scope.text}`,
      scope.values
    )
    if (devRows.length === 0) return res.json([])

    // جلب السياجات لكل جهاز وإرجاعها مجمّعة بدون تكرار
    const results = await Promise.all(
      devRows.map(d => traccar.getGeofencesByDevice(d.traccar_id).catch(() => []))
    )
    const seen = new Set()
    const merged = results.flat().filter(g => {
      if (seen.has(g.id)) return false
      seen.add(g.id)
      return true
    })
    return res.json(merged)
  } catch (err) {
    console.error('[geofences GET]', err.message)
    res.status(500).json({ error: 'Failed to fetch geofences' })
  }
})

// GET /api/geofences/:id — يجلب سياجاً واحداً بالـ ID
geofencesRouter.get('/:id', requireAuth, async (req, res) => {
  try {
    // Try local DB first
    const { rows } = await db.query(
      `SELECT lg.*, d.id AS device_id
       FROM local_geofences lg
       LEFT JOIN devices d ON d.id=lg.device_id
       WHERE lg.id=$1`,
      [req.params.id]
    )
    const localGeofence = rows[0]
    if (localGeofence) {
      const allowed = req.user.is_admin ||
        (localGeofence.device_id
          ? await getAccessibleDevice(db, req.user, localGeofence.device_id)
          : String(localGeofence.user_id) === String(req.user.id))
      if (allowed) return res.json(localGeofence)
      return res.status(404).json({ error: 'Geofence not found' })
    }
    // Fallback to Traccar
    if (!req.user.is_admin) return res.status(404).json({ error: 'Geofence not found' })
    const geofences = await traccar.getGeofencesByDevice('').catch(() => [])
    const geofence  = geofences.find(g => String(g.id) === String(req.params.id))
    if (!geofence) return res.status(404).json({ error: 'Geofence not found' })
    res.json(geofence)
  } catch (err) {
    console.error('[geofences GET/:id]', err.message)
    res.status(500).json({ error: 'Failed to fetch geofence' })
  }
})

// POST /api/geofences — create a geofence (local + attempt Traccar sync)
geofencesRouter.post('/', requireAuth, requireRole('manager'), validateBody(schemas.createGeofence), async (req, res) => {
  try {
    const { name, center, radius, deviceId, notifyEnter, notifyExit } = req.body
    if (!name || !center || !radius) {
      return res.status(400).json({ error: 'name, center, and radius are required' })
    }

    let dbDeviceId = null
    if (deviceId) {
      const dev = await getAccessibleDevice(db, req.user, deviceId)
      if (dev) {
        dbDeviceId = dev.id
      }
    }

    // Save locally
    const coords = JSON.stringify({ lat: center.lat, lng: center.lng })
    const { rows } = await db.query(
      `INSERT INTO local_geofences (user_id, device_id, name, type, coords, radius, notify_enter, notify_exit)
       VALUES ($1, $2, $3, 'circle', $4, $5, $6, $7)
       RETURNING *`,
      [req.user.id, dbDeviceId, name.trim(), coords, Number(radius), notifyEnter !== false, notifyExit !== false]
    )
    const saved = rows[0]

    // Attempt Traccar sync (non-blocking, don't fail on error)
    let syncFailed = false
    try {
      await traccar.createGeofence(name.trim(), center.lat, center.lng, Number(radius))
    } catch (syncErr) {
      console.warn('[geofences POST] Traccar sync failed:', syncErr.message)
      syncFailed = true
    }

    res.status(201).json({ ...saved, syncFailed })
  } catch (err) {
    console.error('[geofences POST]', err.message)
    res.status(500).json({ error: 'Failed to create geofence' })
  }
})

// DELETE /api/geofences/:id
geofencesRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT lg.*, d.id AS device_id
       FROM local_geofences lg
       LEFT JOIN devices d ON d.id=lg.device_id
       WHERE lg.id=$1`,
      [req.params.id]
    )
    const geofence = rows[0]
    if (!geofence) return res.status(404).json({ error: 'Geofence not found' })
    if (geofence.device_id && !await getAccessibleDevice(db, req.user, geofence.device_id)) {
      return res.status(404).json({ error: 'Geofence not found' })
    }
    await db.query('DELETE FROM local_geofences WHERE id=$1', [req.params.id])

    // Attempt Traccar delete (non-blocking)
    if (geofence) {
      traccar.deleteGeofence(req.params.id).catch(() => {})
    }

    res.json({ success: true })
  } catch (err) {
    console.error('[geofences DELETE]', err.message)
    res.status(500).json({ error: 'Failed to delete geofence' })
  }
})
