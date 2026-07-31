import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'
import * as traccar from '../services/traccar.js'

export const reportsRouter = Router()

// Haversine distance in km between two lat/lng points
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Group positions into trips separated by stops > GAP_MS milliseconds
const GAP_MS = 5 * 60 * 1000 // 5-minute gap = new trip

function buildTrips(positions) {
  if (!positions || positions.length === 0) return []
  const sorted = [...positions].sort((a, b) => new Date(a.fixTime) - new Date(b.fixTime))
  const trips  = []
  let current  = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur  = sorted[i]
    const gap  = new Date(cur.fixTime) - new Date(prev.fixTime)
    if (gap > GAP_MS) {
      if (current.length > 1) trips.push(current)
      current = [cur]
    } else {
      current.push(cur)
    }
  }
  if (current.length > 1) trips.push(current)
  return trips
}

// GET /api/reports?deviceId=X&from=ISO&to=ISO
reportsRouter.get('/', requireAuth, async (req, res) => {
  const { deviceId, from, to } = req.query
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' })

  try {
    // Check device ownership
    const { rows } = await db.query('SELECT * FROM devices WHERE id=$1', [deviceId])
    const dev = rows[0]
    if (!dev) return res.status(404).json({ error: 'Device not found' })
    if (!req.user.is_admin && dev.user_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied' })

    // Fetch positions from Traccar
    let positions = []
    try {
      positions = await traccar.getHistory(
        dev.traccar_id,
        from || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        to   || new Date().toISOString()
      )
    } catch (e) {
      console.warn('[reports] Traccar history error:', e.message)
    }

    if (!positions || positions.length === 0) {
      return res.json({
        totalDistanceKm: 0,
        movingDurationMin: 0,
        stoppedDurationMin: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        trips: [],
        speedSeries: [],
      })
    }

    // Compute overall stats
    let totalDist = 0
    let movingMs  = 0
    let maxSpeed  = 0
    const speedSeries = []

    const sorted = [...positions].sort((a, b) => new Date(a.fixTime) - new Date(b.fixTime))

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const cur  = sorted[i]
      const segDist = haversine(prev.latitude, prev.longitude, cur.latitude, cur.longitude)
      const segMs   = new Date(cur.fixTime) - new Date(prev.fixTime)
      totalDist += segDist
      if ((cur.speed || 0) > 2) movingMs += segMs
      if ((cur.speed || 0) > maxSpeed) maxSpeed = cur.speed || 0
      speedSeries.push({ time: cur.fixTime, speed: Math.round(cur.speed || 0) })
    }

    const allMs       = new Date(sorted[sorted.length - 1].fixTime) - new Date(sorted[0].fixTime)
    const stoppedMs   = Math.max(0, allMs - movingMs)
    const validSpeeds = sorted.filter(p => (p.speed || 0) > 0).map(p => p.speed || 0)
    const avgSpeed    = validSpeeds.length ? validSpeeds.reduce((a, b) => a + b, 0) / validSpeeds.length : 0

    // Build trips
    const rawTrips = buildTrips(positions)
    const trips = rawTrips.map((pts, i) => {
      let dist = 0
      for (let j = 1; j < pts.length; j++) {
        dist += haversine(pts[j-1].latitude, pts[j-1].longitude, pts[j].latitude, pts[j].longitude)
      }
      const durationMs  = new Date(pts[pts.length - 1].fixTime) - new Date(pts[0].fixTime)
      const speeds      = pts.map(p => p.speed || 0).filter(s => s > 0)
      const tripAvgSpd  = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0
      const tripMaxSpd  = speeds.length ? Math.max(...speeds) : 0
      return {
        index:       i + 1,
        startTime:   pts[0].fixTime,
        endTime:     pts[pts.length - 1].fixTime,
        durationMin: Math.round(durationMs / 60000),
        distanceKm:  Math.round(dist * 10) / 10,
        avgSpeed:    Math.round(tripAvgSpd),
        maxSpeed:    Math.round(tripMaxSpd),
        points:      pts.length,
      }
    })

    res.json({
      totalDistanceKm:   Math.round(totalDist * 10) / 10,
      movingDurationMin: Math.round(movingMs / 60000),
      stoppedDurationMin:Math.round(stoppedMs / 60000),
      avgSpeed:          Math.round(avgSpeed),
      maxSpeed:          Math.round(maxSpeed),
      trips,
      speedSeries: speedSeries.slice(0, 200), // limit points for chart
    })
  } catch (err) {
    console.error('[reports]', err)
    res.status(500).json({ error: 'Server error' })
  }
})
