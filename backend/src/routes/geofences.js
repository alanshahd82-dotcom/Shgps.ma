import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'
import * as traccar from '../services/traccar.js'

export const geofencesRouter = Router()

// GET /api/geofences?deviceId=X — يجلب السياجات (مع تصفية اختيارية بالجهاز)
geofencesRouter.get('/', requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.query

    if (deviceId) {
      // تحقق من أن المستخدم يملك صلاحية الوصول للجهاز
      const { rows } = await db.query('SELECT * FROM devices WHERE id=$1', [deviceId])
      const dev = rows[0]
      if (!dev) return res.status(404).json({ error: 'Device not found' })
      if (!req.user.is_admin && dev.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' })
      }
      const geofences = await traccar.getGeofencesByDevice(dev.traccar_id)
      return res.json(geofences)
    }

    // المشرف يرى كل السياجات، العميل يرى سياجات أجهزته فقط
    if (req.user.is_admin) {
      const geofences = await traccar.getGeofencesByDevice('')
      return res.json(geofences)
    }

    // جمع traccar_id لأجهزة المستخدم الحالي
    const { rows: devRows } = await db.query(
      'SELECT traccar_id FROM devices WHERE user_id=$1',
      [req.user.id]
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
    const geofences = await traccar.getGeofencesByDevice('')
    const geofence = geofences.find(g => String(g.id) === String(req.params.id))
    if (!geofence) return res.status(404).json({ error: 'Geofence not found' })
    res.json(geofence)
  } catch (err) {
    console.error('[geofences GET/:id]', err.message)
    res.status(500).json({ error: 'Failed to fetch geofence' })
  }
})
