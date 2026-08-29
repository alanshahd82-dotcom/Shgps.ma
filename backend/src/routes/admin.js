import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { db } from '../db.js'
import * as traccar from '../services/traccar.js'

export const adminRouter = Router()

// GET /api/admin/stats — live dashboard stats
adminRouter.get('/stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [usersRes, devicesRes, alertsTodayRes] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS total_clients FROM users WHERE is_admin=false`),
      db.query(`SELECT id, traccar_id FROM devices`),
      db.query(`SELECT COUNT(*)::int AS today FROM alerts WHERE created_at >= NOW() - INTERVAL '24 hours'`),
    ])

    const localDevices = devicesRes.rows
    const totalDevices = localDevices.length

    // Freshness rule shared with the client app: a device counts as "en ligne"
    // only when Traccar holds it online AND it actually sent data recently.
    // A socket that stays open while the tracker has been mute for hours used
    // to be counted as online, which contradicted the "last update" column.
    const FRESH_MS   = 15 * 60 * 1000
    const NO_SIG_MS  = 24 * 60 * 60 * 1000
    const now = Date.now()

    let onlineCount = 0
    let staleCount = 0
    let offlineCount = 0
    let noSignalCount = 0

    try {
      const traccarDevices = await traccar.getAllDevices()
      const byId = new Map(traccarDevices.map(d => [String(d.id), d]))
      for (const local of localDevices) {
        const remote = local.traccar_id != null ? byId.get(String(local.traccar_id)) : null
        const lastUpdate = remote?.lastUpdate ? new Date(remote.lastUpdate).getTime() : null
        const age = Number.isFinite(lastUpdate) ? now - lastUpdate : null
        if (age === null || age > NO_SIG_MS) noSignalCount++

        if (!remote || remote.status !== 'online') offlineCount++
        else if (age !== null && age <= FRESH_MS) onlineCount++
        else staleCount++
      }
    } catch {
      // Traccar unreachable: every device is unknown, never fake "online".
      offlineCount = totalDevices
      noSignalCount = totalDevices
    }

    res.json({
      totalClients: usersRes.rows[0].total_clients,
      totalDevices,
      onlineDevices: onlineCount,
      staleDevices: staleCount,
      offlineDevices: offlineCount,
      todayAlerts: alertsTodayRes.rows[0].today,
      noSignalDevices: noSignalCount,
    })
  } catch (err) {
    console.error('[admin/stats]', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/admin/traccar-sync — sync Traccar devices with local DB
adminRouter.post('/traccar-sync', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const traccarDevices = await traccar.getAllDevices()
    const { rows: localDevices } = await db.query('SELECT * FROM devices')

    const results = {
      synced: 0,
      notInLocal: [],
      notInTraccar: [],
      updated: 0,
    }

    const localByTraccarId = new Map(localDevices.filter(d => d.traccar_id).map(d => [d.traccar_id, d]))

    // Fetch live positions for status sync
    let positionMap = {}
    try {
      const positions = await traccar.getAllPositions()
      for (const p of positions) positionMap[p.deviceId] = p
    } catch { /* non-critical */ }

    for (const td of traccarDevices) {
      const local = localByTraccarId.get(td.id)
      if (!local) {
        results.notInLocal.push({ traccarId: td.id, name: td.name, uniqueId: td.uniqueId, status: td.status })
      } else {
        const pos = positionMap[td.id]
        // Sync live position + status into local DB so DB reflects reality
        await db.query(
          `UPDATE devices SET
             updated_at = NOW(),
             last_lat    = $2,
             last_lng    = $3,
             last_speed  = $4,
             last_update = $5
           WHERE id = $1`,
          [
            local.id,
            pos?.latitude  ?? local.last_lat  ?? null,
            pos?.longitude ?? local.last_lng  ?? null,
            pos?.speed     ?? 0,
            pos?.fixTime   ?? null,
          ]
        )
        results.updated++
        results.synced++
      }
    }

    const traccarIds = new Set(traccarDevices.map(d => d.id))
    for (const local of localDevices) {
      if (local.traccar_id && !traccarIds.has(local.traccar_id)) {
        results.notInTraccar.push({ id: local.id, name: local.name, imei: local.imei })
      }
    }

    res.json(results)
  } catch (err) {
    console.error('[traccar-sync]', err)
    res.status(500).json({ error: 'Sync failed: ' + err.message })
  }
})

// GET /api/admin/monthly-stats — real monthly clients & devices registered per month (last 6 months)
adminRouter.get('/monthly-stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await db.query(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', NOW() - INTERVAL '5 months'),
          date_trunc('month', NOW()),
          '1 month'::interval
        ) AS m
      )
      SELECT
        to_char(m.m, 'MM/YYYY') AS month,
        COALESCE(c.clients, 0)  AS clients,
        COALESCE(d.devices, 0)  AS devices
      FROM months m
      LEFT JOIN (
        SELECT date_trunc('month', created_at) AS mo, COUNT(*)::int AS clients
        FROM users WHERE is_admin = false
        GROUP BY mo
      ) c ON c.mo = m.m
      LEFT JOIN (
        SELECT date_trunc('month', created_at) AS mo, COUNT(*)::int AS devices
        FROM devices
        GROUP BY mo
      ) d ON d.mo = m.m
      ORDER BY m.m
    `)
    res.json(rows)
  } catch (err) {
    console.error('[admin/monthly-stats]', err)
    res.status(500).json({ error: 'Server error' })
  }
})
