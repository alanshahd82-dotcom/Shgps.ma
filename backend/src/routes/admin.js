import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { db } from '../db.js'
import * as traccar from '../services/traccar.js'

export const adminRouter = Router()

// GET /api/admin/stats — live dashboard stats
adminRouter.get('/stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [usersRes, devicesRes, alertsTodayRes, noSignalRes] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS total_clients FROM users WHERE is_admin=false AND is_active=true`),
      db.query(`SELECT COUNT(*)::int AS total FROM devices`),
      db.query(`SELECT COUNT(*)::int AS today FROM alerts WHERE created_at >= NOW() - INTERVAL '24 hours'`),
      db.query(`SELECT COUNT(*)::int AS no_signal FROM devices WHERE updated_at < NOW() - INTERVAL '24 hours' OR updated_at IS NULL`),
    ])

    // Get live device statuses from Traccar (best-effort)
    let onlineCount  = 0
    let offlineCount = 0
    try {
      const traccarDevices = await traccar.getAllDevices()
      onlineCount  = traccarDevices.filter(d => d.status === 'online').length
      offlineCount = traccarDevices.filter(d => d.status !== 'online').length
    } catch {
      // fallback to DB count
      offlineCount = devicesRes.rows[0].total
    }

    res.json({
      totalClients: usersRes.rows[0].total_clients,
      totalDevices: devicesRes.rows[0].total,
      onlineDevices: onlineCount,
      offlineDevices: offlineCount,
      todayAlerts: alertsTodayRes.rows[0].today,
      noSignalDevices: noSignalRes.rows[0].no_signal,
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

    for (const td of traccarDevices) {
      const local = localByTraccarId.get(td.id)
      if (!local) {
        results.notInLocal.push({ traccarId: td.id, name: td.name, uniqueId: td.uniqueId, status: td.status })
      } else {
        // Update status and last seen
        await db.query(
          'UPDATE devices SET updated_at=NOW() WHERE id=$1',
          [local.id]
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
