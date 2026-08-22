import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'
import * as traccar from '../services/traccar.js'
import { getAccessibleDevice } from '../middleware/deviceAccess.js'
import { speedKmh } from '../utils/speed.js'

export const statsRouter = Router()

const DEFAULT_HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000

function samplePositions(points, maxPoints) {
  if (points.length <= maxPoints) return points
  const sampled = []
  const seen = new Set()
  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.round(index * (points.length - 1) / (maxPoints - 1))
    if (seen.has(sourceIndex)) continue
    seen.add(sourceIndex)
    sampled.push(points[sourceIndex])
  }
  return sampled
}

function getHistoryDate(value, fallback) {
  if (value === undefined) return fallback.toISOString()
  if (Array.isArray(value)) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

// GET /api/stats/positions?deviceId=X&from=ISO_DATE&to=ISO_DATE
statsRouter.get('/positions', requireAuth, async (req, res) => {
  const { deviceId, from, to, maxPoints: maxPointsQuery } = req.query

  if (!deviceId || Array.isArray(deviceId)) {
    return res.status(400).json({ error: 'deviceId required' })
  }

  const deviceIdNumber = Number(deviceId)
  if (!Number.isInteger(deviceIdNumber) || deviceIdNumber < 1) {
    return res.status(400).json({ error: 'deviceId must be a positive integer' })
  }

  const defaultFrom = new Date(Date.now() - DEFAULT_HISTORY_WINDOW_MS)
  const defaultTo = new Date()
  const fromDate = getHistoryDate(from, defaultFrom)
  const toDate = getHistoryDate(to, defaultTo)

  if (!fromDate || !toDate) {
    return res.status(400).json({ error: 'from and to must be valid ISO dates' })
  }
  if (new Date(fromDate) > new Date(toDate)) {
    return res.status(400).json({ error: 'from must be before to' })
  }
  if (Array.isArray(maxPointsQuery)) {
    return res.status(400).json({ error: 'maxPoints must be a positive integer' })
  }
  const maxPoints = maxPointsQuery === undefined
    ? null
    : Number(maxPointsQuery)
  if (maxPoints !== null && (!Number.isInteger(maxPoints) || maxPoints < 2 || maxPoints > 5000)) {
    return res.status(400).json({ error: 'maxPoints must be an integer between 2 and 5000' })
  }

  try {
    const device = await getAccessibleDevice(db, req.user, deviceIdNumber)

    if (!device) return res.status(404).json({ error: 'Device not found or access denied' })
    if (!device.traccar_id) {
      return res.status(502).json({ error: 'Device is not linked to the tracking service' })
    }

    const cleanedPositions = traccar.cleanPositions(await traccar.getHistory(device.traccar_id, fromDate, toDate))
    // Replay requests omit maxPoints so the complete cleaned GPS history,
    // including real stops, remains available to the client. Callers that
    // explicitly request a cap keep the existing display-oriented behavior.
    const positions = maxPoints === null
      ? cleanedPositions
      : samplePositions(cleanedPositions, maxPoints)
    console.info('[stats/positions]', {
      deviceId: deviceIdNumber,
      from: fromDate,
      to: toDate,
      maxPoints,
      cleaned: cleanedPositions.length,
      returned: positions.length,
    })
    const replayPositions = positions.map((position) => ({
        latitude: Number(position.latitude),
        longitude: Number(position.longitude),
        speed: speedKmh(position.speed),
        fixTime: position.fixTime,
        address: position.address || null,
      }))

    return res.json(replayPositions)
  } catch (error) {
    console.error('[stats/positions]', error)
    if (error.code === 'TRACCAR_AUTH_FAILED') {
      return res.status(503).json({
        code: 'TRACCAR_AUTH_REQUIRED',
        error: 'Tracking service authentication is unavailable. Contact the administrator.',
      })
    }
    if (error.code === 'TRACCAR_REQUEST_FAILED') {
      return res.status(502).json({ error: 'Unable to load positions from Traccar' })
    }
    return res.status(500).json({ error: 'Server error' })
  }
})