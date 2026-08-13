import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { db } from '../db.js'
import * as traccar from '../services/traccar.js'
import { getSubscriptionSnapshot } from '../services/subscriptions.js'
import { getAccessibleDevice } from '../middleware/deviceAccess.js'
import { speedKmh } from '../utils/speed.js'

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

// A trip is a continuous group of fixes that contains movement. A tracker
// usually keeps sending zero-speed fixes while parked, so splitting only on
// missing fixes would incorrectly turn a whole day of parking into one trip.
const GAP_MS = 5 * 60 * 1000
const MOVING_SPEED_KMH = 2
const MAX_REPORT_RANGE_MS = 31 * 24 * 60 * 60 * 1000

function buildTrips(positions) {
  if (!positions || positions.length === 0) return []
  const sorted = [...positions].sort((a, b) => new Date(a.fixTime) - new Date(b.fixTime))
  const movingIndexes = sorted
    .map((point, index) => speedKmh(point.speed) >= MOVING_SPEED_KMH ? index : -1)
    .filter(index => index !== -1)

  if (movingIndexes.length === 0) return []

  const trips = []
  let groupStart = movingIndexes[0]
  let previousMovingIndex = movingIndexes[0]

  function addTrip(firstMovingIndex, lastMovingIndex) {
    // Include one boundary fix on either side so the replay starts and ends
    // at the actual GPS fixes instead of cutting the route at the first
    // non-zero speed sample.
    const start = Math.max(0, firstMovingIndex - 1)
    const end = Math.min(sorted.length - 1, lastMovingIndex + 1)
    const trip = sorted.slice(start, end + 1)
    if (trip.length > 1) trips.push(trip)
  }

  for (let index = 1; index < movingIndexes.length; index += 1) {
    const movingIndex = movingIndexes[index]
    const gap = new Date(sorted[movingIndex].fixTime) - new Date(sorted[previousMovingIndex].fixTime)
    if (gap > GAP_MS) {
      addTrip(groupStart, previousMovingIndex)
      groupStart = movingIndex
    }
    previousMovingIndex = movingIndex
  }

  addTrip(groupStart, previousMovingIndex)
  return trips
}

function parseReportDate(value, fallback) {
  if (value === undefined) return fallback
  if (Array.isArray(value) || typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// GET /api/reports/trips?deviceId=X&from=ISO&to=ISO
// Keep the original /api/reports route as a backwards-compatible alias.
reportsRouter.get(['/', '/trips'], requireAuth, requireRole('manager', 'reports'), async (req, res) => {
  const { deviceId, from, to } = req.query
  if (!deviceId || Array.isArray(deviceId)) return res.status(400).json({ error: 'deviceId required' })
  if (!Number.isInteger(Number(deviceId)) || Number(deviceId) < 1) {
    return res.status(400).json({ error: 'deviceId must be a positive integer' })
  }

  const now = new Date()
  const defaultFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const fromDate = parseReportDate(from, defaultFrom)
  const toDate = parseReportDate(to, now)
  if (!fromDate || !toDate) return res.status(400).json({ error: 'from and to must be valid dates' })
  if (fromDate >= toDate) return res.status(400).json({ error: 'from must be before to' })
  if (toDate.getTime() - fromDate.getTime() > MAX_REPORT_RANGE_MS) {
    return res.status(400).json({ error: 'The report range cannot exceed 31 days' })
  }

  try {
    // Check device ownership
    const dev = await getAccessibleDevice(db, req.user, deviceId)
    if (!dev) return res.status(404).json({ error: 'Device not found or access denied' })
    if (!dev.traccar_id) {
      return res.status(502).json({
        code: 'DEVICE_NOT_LINKED',
        error: 'Device is not linked to the tracking service',
      })
    }
    if (!getSubscriptionSnapshot(dev).trackingEnabled) {
      return res.json({
        totalDistanceKm: 0,
        movingDurationMin: 0,
        stoppedDurationMin: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        trips: [],
        speedSeries: [],
        trackingEnabled: false,
      })
    }

    // Fetch positions from Traccar
    try {
      const positions = traccar.cleanPositions(await traccar.getHistory(
        dev.traccar_id,
        fromDate.toISOString(),
        toDate.toISOString()
      ))
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
        const currentSpeed = speedKmh(cur.speed)
        totalDist += segDist
        if (currentSpeed > 2) movingMs += segMs
        if (currentSpeed > maxSpeed) maxSpeed = currentSpeed
        speedSeries.push({ time: cur.fixTime, speed: Math.round(currentSpeed) })
      }

      const allMs       = new Date(sorted[sorted.length - 1].fixTime) - new Date(sorted[0].fixTime)
      const stoppedMs   = Math.max(0, allMs - movingMs)
      const validSpeeds = sorted.map(p => speedKmh(p.speed)).filter(s => s > 0)
      const avgSpeed    = validSpeeds.length ? validSpeeds.reduce((a, b) => a + b, 0) / validSpeeds.length : 0

      // Build trips and expose the real route points for the replay screen.
      const rawTrips = buildTrips(positions)
      const trips = rawTrips.map((pts, i) => {
        let dist = 0
        for (let j = 1; j < pts.length; j++) {
          dist += haversine(pts[j-1].latitude, pts[j-1].longitude, pts[j].latitude, pts[j].longitude)
        }
        const durationMs  = new Date(pts[pts.length - 1].fixTime) - new Date(pts[0].fixTime)
        const speeds      = pts.map(p => speedKmh(p.speed)).filter(s => s > 0)
        const tripAvgSpd  = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0
        const tripMaxSpd  = speeds.length ? Math.max(...speeds) : 0
        // Compute stop time (segments where speed == 0)
        let stopMs = 0
        for (let j = 1; j < pts.length; j++) {
          if (speedKmh(pts[j].speed) < 2) {
            stopMs += new Date(pts[j].fixTime) - new Date(pts[j-1].fixTime)
          }
        }
        return {
          index:       i + 1,
          startTime:   pts[0].fixTime,
          endTime:     pts[pts.length - 1].fixTime,
          durationMin: Math.round(durationMs / 60000),
          distanceKm:  Math.round(dist * 10) / 10,
          avgSpeed:    Math.round(tripAvgSpd),
          maxSpeed:    Math.round(tripMaxSpd),
          stopMin:     Math.round(stopMs / 60000),
          points:      pts.length,
        }
      })

      return res.json({
        totalDistanceKm:   Math.round(totalDist * 10) / 10,
        movingDurationMin: Math.round(movingMs / 60000),
        stoppedDurationMin:Math.round(stoppedMs / 60000),
        avgSpeed:          Math.round(avgSpeed),
        maxSpeed:          Math.round(maxSpeed),
        trips,
        speedSeries: speedSeries.slice(-200), // keep the most recent points for the chart
      })
    } catch (e) {
      console.error('[reports] Traccar history error:', e.message)
      if (e.code === 'TRACCAR_AUTH_FAILED') {
        return res.status(503).json({
          code: 'TRACCAR_AUTH_REQUIRED',
          error: 'Tracking service authentication is unavailable. Contact the administrator.',
        })
      }
      return res.status(502).json({ error: 'Unable to load trip history from Traccar' })
    }
  } catch (err) {
    console.error('[reports]', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/reports/daily-summary?days=7
// Returns today's total km and daily km chart data for all client devices
reportsRouter.get('/daily-summary', requireAuth, async (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 7, 30)
  try {
    // Get all devices for this user
    const { rows: deviceRows } = await db.query(
      req.user.is_admin
        ? `SELECT id, traccar_id, subscription_end_date FROM devices
           WHERE traccar_id IS NOT NULL
             AND (subscription_end_date IS NULL OR subscription_end_date >= CURRENT_DATE)`
        : `SELECT id, traccar_id, subscription_end_date FROM devices
           WHERE user_id=$1 AND traccar_id IS NOT NULL
             AND (subscription_end_date IS NULL OR subscription_end_date >= CURRENT_DATE)`,
      req.user.is_admin ? [] : [req.user.id]
    )

    if (!deviceRows.length) {
      return res.json({ todayKm: 0, dailyData: [] })
    }

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    // Build daily buckets
    const dailyData = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      dailyData.push({ date: d.toISOString().split('T')[0], km: 0 })
    }

    let todayKm = 0
    const from = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
    const to   = now.toISOString()

    // Fetch each device in parallel (limit concurrency to avoid hammering Traccar)
    const BATCH = 5
    for (let b = 0; b < deviceRows.length; b += BATCH) {
      const batch = deviceRows.slice(b, b + BATCH)
      await Promise.allSettled(batch.map(async (dev) => {
        try {
          const positions = traccar.cleanPositions(await traccar.getHistory(dev.traccar_id, from, to))
          if (!positions || positions.length < 2) return
          const sorted = [...positions].sort((a, b) => new Date(a.fixTime) - new Date(b.fixTime))
          for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1]
            const cur  = sorted[i]
            const dist = haversine(prev.latitude, prev.longitude, cur.latitude, cur.longitude)
            const dayStr = new Date(cur.fixTime).toISOString().split('T')[0]
            const bucket = dailyData.find(d => d.date === dayStr)
            if (bucket) bucket.km += dist
            if (new Date(cur.fixTime) >= todayStart) todayKm += dist
          }
        } catch { /* skip individual device errors */ }
      }))
    }

    dailyData.forEach(d => { d.km = Math.round(d.km * 10) / 10 })
    todayKm = Math.round(todayKm * 10) / 10

    return res.json({ todayKm, dailyData })
  } catch (err) {
    console.error('[reports/daily-summary]', err)
    res.status(500).json({ error: 'Server error' })
  }
})
