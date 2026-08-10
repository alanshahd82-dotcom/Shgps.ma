import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'
import * as traccar from '../services/traccar.js'

export const statsRouter = Router()

const DEFAULT_HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000

function getHistoryDate(value, fallback) {
  if (value === undefined) return fallback.toISOString()
  if (Array.isArray(value)) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

// GET /api/stats/positions?deviceId=X&from=ISO_DATE&to=ISO_DATE
statsRouter.get('/positions', requireAuth, async (req, res) => {
  const { deviceId, from, to } = req.query

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

  try {
    const { rows } = await db.query(
      'SELECT id, traccar_id, user_id FROM devices WHERE id=$1',
      [deviceIdNumber]
    )
    const device = rows[0]

    if (!device) return res.status(404).json({ error: 'Device not found' })
    if (!req.user.is_admin && device.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }
    if (!device.traccar_id) {
      return res.status(502).json({ error: 'Device is not linked to the tracking service' })
    }

    const positions = await traccar.getHistory(device.traccar_id, fromDate, toDate)
    console.info('[stats/positions]', {
      deviceId: deviceIdNumber,
      from: fromDate,
      to: toDate,
      returned: Array.isArray(positions) ? positions.length : 0,
    })
    const replayPositions = (Array.isArray(positions) ? positions : [])
      .filter((position) => {
        const fixTime = new Date(position?.fixTime)
        return position?.fixTime
          && !Number.isNaN(fixTime.getTime())
          && Number.isFinite(Number(position.latitude))
          && Number.isFinite(Number(position.longitude))
      })
      .sort((a, b) => new Date(a.fixTime) - new Date(b.fixTime))
      .map((position) => ({
        latitude: Number(position.latitude),
        longitude: Number(position.longitude),
        speed: Number.isFinite(Number(position.speed))
          ? Math.max(0, Number(position.speed) * 1.852)
          : 0,
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