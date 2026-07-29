import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'
import * as traccar from '../services/traccar.js'

export const statsRouter = Router()

// GET /api/stats/trips?deviceId=&from=&to=
statsRouter.get('/trips', requireAuth, async (req, res) => {
  try {
    const { deviceId, from, to } = req.query
    // Verify device belongs to user (or user is admin)
    if (deviceId) {
      const { rows } = await db.query('SELECT user_id FROM devices WHERE id=$1', [deviceId])
      const dev = rows[0]
      if (!dev) return res.status(404).json({ error: 'Device not found' })
      if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    }

    // Get devices for this user if no deviceId specified
    let deviceIds = []
    if (deviceId) {
      const { rows } = await db.query('SELECT traccar_id FROM devices WHERE id=$1', [deviceId])
      if (rows[0]?.traccar_id) deviceIds = [rows[0].traccar_id]
    } else {
      const { rows } = req.user.is_admin
        ? await db.query('SELECT traccar_id FROM devices WHERE traccar_id IS NOT NULL')
        : await db.query('SELECT traccar_id FROM devices WHERE user_id=$1 AND traccar_id IS NOT NULL', [req.user.id])
      deviceIds = rows.map(r => r.traccar_id)
    }

    if (!deviceIds.length) return res.json([])

    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600000)
    const toDate   = to   ? new Date(to)   : new Date()

    // Fetch trips from Traccar for each device
    let trips = []
    for (const tid of deviceIds) {
      try {
        const raw = await traccar.getTrips(tid, fromDate.toISOString(), toDate.toISOString())
        trips = trips.concat(raw.map(tr => ({
          id:           tr.id,
          deviceId:     tr.deviceId,
          startTime:    tr.startTime,
          endTime:      tr.endTime,
          distance:     +(tr.distance / 1000).toFixed(2), // m → km
          duration:     Math.round(tr.duration / 60000),   // ms → min
          maxSpeed:     +(tr.maxSpeed * 1.852).toFixed(1), // knots → km/h
          averageSpeed: +(tr.averageSpeed * 1.852).toFixed(1),
          startAddress: tr.startAddress || '',
          endAddress:   tr.endAddress   || '',
          startLat:     tr.startLat,
          startLon:     tr.startLon,
          endLat:       tr.endLat,
          endLon:       tr.endLon,
        })))
      } catch {}
    }

    trips.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    res.json(trips)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// GET /api/stats/monthly?deviceId=
statsRouter.get('/monthly', requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.query
    let deviceIds = []
    if (deviceId) {
      const { rows } = await db.query('SELECT traccar_id, user_id FROM devices WHERE id=$1', [deviceId])
      const dev = rows[0]
      if (!dev) return res.status(404).json({ error: 'Device not found' })
      if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
      if (dev.traccar_id) deviceIds = [dev.traccar_id]
    } else {
      const { rows } = req.user.is_admin
        ? await db.query('SELECT traccar_id FROM devices WHERE traccar_id IS NOT NULL')
        : await db.query('SELECT traccar_id FROM devices WHERE user_id=$1 AND traccar_id IS NOT NULL', [req.user.id])
      deviceIds = rows.map(r => r.traccar_id)
    }

    const now   = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    let totalKm = 0, totalTrips = 0
    const dayMap = {}

    for (const tid of deviceIds) {
      try {
        const trips = await traccar.getTrips(tid, start.toISOString(), end.toISOString())
        for (const tr of trips) {
          totalKm    += tr.distance / 1000
          totalTrips += 1
          const day = new Date(tr.startTime).getDate()
          dayMap[day] = (dayMap[day] || 0) + tr.distance / 1000
        }
      } catch {}
    }

    let mostActiveDay = null, maxKm = 0
    for (const [day, km] of Object.entries(dayMap)) {
      if (km > maxKm) { maxKm = km; mostActiveDay = parseInt(day) }
    }

    res.json({
      totalKm:    +totalKm.toFixed(2),
      totalTrips,
      mostActiveDay: mostActiveDay ? `${mostActiveDay}/${now.getMonth() + 1}` : null,
    })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// GET /api/stats/activity?deviceId=&days=7
statsRouter.get('/activity', requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.query
    const days = parseInt(req.query.days) || 7

    let deviceIds = []
    if (deviceId) {
      const { rows } = await db.query('SELECT traccar_id, user_id FROM devices WHERE id=$1', [deviceId])
      const dev = rows[0]
      if (!dev) return res.status(404).json({ error: 'Device not found' })
      if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
      if (dev.traccar_id) deviceIds = [dev.traccar_id]
    } else {
      const { rows } = req.user.is_admin
        ? await db.query('SELECT traccar_id FROM devices WHERE traccar_id IS NOT NULL')
        : await db.query('SELECT traccar_id FROM devices WHERE user_id=$1 AND traccar_id IS NOT NULL', [req.user.id])
      deviceIds = rows.map(r => r.traccar_id)
    }

    const result = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      result.push({ date: d.toISOString().slice(0, 10), km: 0, trips: 0 })
    }

    for (const tid of deviceIds) {
      try {
        const from = result[0].date + 'T00:00:00Z'
        const to   = result[result.length - 1].date + 'T23:59:59Z'
        const trips = await traccar.getTrips(tid, from, to)
        for (const tr of trips) {
          const day = new Date(tr.startTime).toISOString().slice(0, 10)
          const entry = result.find(r => r.date === day)
          if (entry) {
            entry.km    += tr.distance / 1000
            entry.trips += 1
          }
        }
      } catch {}
    }

    result.forEach(r => { r.km = +r.km.toFixed(2) })
    res.json(result)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})
