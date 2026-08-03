import { Router } from 'express'
import { requireAdmin } from '../middleware/auth.js'
import { db } from '../db.js'
import * as traccar from '../services/traccar.js'
import { refreshAllDeviceLicenses } from '../services/deviceSubscriptions.js'

export const adminRouter = Router()

adminRouter.get('/stats', requireAdmin, async (req, res) => {
  try {
    await refreshAllDeviceLicenses()
    const [clients, devices, alerts, revenue, expiring, unactivated] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users WHERE is_admin=false AND is_active=true AND (parent_client_id IS NULL)'),
      db.query('SELECT COUNT(*) FROM devices'),
      db.query("SELECT COUNT(*) FROM alerts WHERE created_at >= CURRENT_DATE"),
      db.query(`SELECT COALESCE(SUM(price_mad), 0) AS revenue FROM device_subscriptions
                 WHERE is_active=true AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`),
      db.query(`SELECT COUNT(*) FROM device_licenses
                 WHERE status='expiring_soon'`),
      db.query('SELECT COUNT(*) FROM devices WHERE is_activated=false OR is_activated IS NULL'),
    ])
    let onlineCount = 0
    try { const positions = await traccar.getAllPositions(); onlineCount = positions.length } catch {}
    const totalDevices = parseInt(devices.rows[0].count)
    res.json({
      totalClients:       parseInt(clients.rows[0].count),
      totalDevices,
      onlineDevices:      onlineCount,
      offlineDevices:     totalDevices - onlineCount,
      todayAlerts:        parseInt(alerts.rows[0].count),
      monthlyRevenue:     parseInt(revenue.rows[0].revenue),
      expiringIn7Days:    parseInt(expiring.rows[0].count),
      unactivatedDevices: parseInt(unactivated.rows[0].count),
    })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

adminRouter.get('/stats/revenue', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT TO_CHAR(DATE_TRUNC('month', s.created_at), 'Mon') AS month,
             DATE_TRUNC('month', s.created_at) AS month_date,
             COUNT(DISTINCT s.user_id) AS clients,
             SUM(CASE s.plan WHEN 'Basic' THEN 99 WHEN 'Pro' THEN 199 WHEN 'Enterprise' THEN 399 ELSE 99 END) AS revenue
      FROM subscriptions s WHERE s.created_at >= NOW() - INTERVAL '7 months'
      GROUP BY DATE_TRUNC('month', s.created_at) ORDER BY month_date ASC`)
    res.json(rows.map(r => ({ month: r.month, revenue: parseInt(r.revenue)||0, clients: parseInt(r.clients)||0 })))
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

adminRouter.get('/reports', requireAdmin, async (req, res) => {
  try {
    const { clientId, from, to } = req.query
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600000)
    const toDate   = to   ? new Date(to)   : new Date()
    let deviceRows
    if (clientId) {
      const { rows } = await db.query('SELECT d.*, u.name AS client_name FROM devices d JOIN users u ON d.user_id=u.id WHERE d.user_id=$1', [clientId])
      deviceRows = rows
    } else {
      const { rows } = await db.query('SELECT d.*, u.name AS client_name FROM devices d JOIN users u ON d.user_id=u.id ORDER BY u.name')
      deviceRows = rows
    }
    const report = []
    for (const dev of deviceRows) {
      let trips = 0, totalKm = 0, overSpeed = 0, geofenceEvents = 0
      if (dev.traccar_id) {
        try { const t = await traccar.getTrips(dev.traccar_id, fromDate.toISOString(), toDate.toISOString()); trips = t.length; totalKm = t.reduce((s, tr) => s + tr.distance / 1000, 0) } catch {}
      }
      const { rows: alertRows } = await db.query('SELECT type FROM alerts WHERE device_id=$1 AND created_at >= $2 AND created_at <= $3', [dev.id, fromDate, toDate])
      overSpeed      = alertRows.filter(a => a.type === 'speed').length
      geofenceEvents = alertRows.filter(a => a.type === 'geofence').length
      report.push({ deviceId: dev.id, deviceName: dev.name, clientName: dev.client_name, trips, totalKm: +totalKm.toFixed(2), overSpeedEvents: overSpeed, geofenceAlerts: geofenceEvents })
    }
    res.json(report)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

adminRouter.get('/settings', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT key, value FROM system_settings')
    const settings = {}
    for (const r of rows) settings[r.key] = r.value
    res.json(settings)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

adminRouter.patch('/settings', requireAdmin, async (req, res) => {
  try {
    const { company, plans } = req.body
    if (company) await db.query(`INSERT INTO system_settings (key, value) VALUES ('company', $1) ON CONFLICT (key) DO UPDATE SET value=$1`, [JSON.stringify(company)])
    if (plans)   await db.query(`INSERT INTO system_settings (key, value) VALUES ('plans', $1)   ON CONFLICT (key) DO UPDATE SET value=$1`, [JSON.stringify(plans)])
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})
