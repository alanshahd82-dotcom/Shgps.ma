import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import {
  calculateSubscriptionDates,
  getDeviceLicense,
  refreshDeviceLicense,
  SUBSCRIPTION_PLANS,
  validatePlan,
} from '../services/deviceSubscriptions.js'

export const subscriptionsRouter = Router()

function serializeRequest(row) {
  return {
    id: row.id,
    deviceId: row.device_id,
    customerId: row.customer_id,
    customer: row.customer_name,
    email: row.customer_email,
    phone: row.customer_phone,
    deviceName: row.device_name,
    imei: row.imei,
    selectedPlan: Number(row.plan_months),
    planLabel: `${row.plan_months} Months`,
    price: Number(row.price_mad),
    requestDate: row.requested_at,
    status: row.status,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
  }
}

subscriptionsRouter.get('/plans', (_req, res) => {
  res.json(Object.values(SUBSCRIPTION_PLANS))
})

// Customer-facing: status remains available even when feature access is blocked.
subscriptionsRouter.get('/devices', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT d.id, d.name, d.imei,
              u.id AS customer_id, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
         FROM devices d
         JOIN users u ON u.id = d.user_id
        WHERE d.user_id = $1
        ORDER BY d.created_at DESC`,
      [req.user.id],
    )
    const devices = []
    for (const row of rows) {
      devices.push({
        deviceId: row.id,
        deviceName: row.name,
        imei: row.imei,
        customer: {
          id: row.customer_id,
          name: row.customer_name,
          email: row.customer_email,
          phone: row.customer_phone,
        },
        license: await getDeviceLicense(row.id),
      })
    }
    res.json(devices)
  } catch (error) {
    console.error('[Subscriptions] customer status failed:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

subscriptionsRouter.post('/renewals', requireAuth, async (req, res) => {
  const { deviceId, planMonths } = req.body
  try {
    const plan = validatePlan(planMonths)
    const { rows } = await db.query(
      `SELECT d.id, d.name, d.imei, d.user_id,
              u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
         FROM devices d
         JOIN users u ON u.id = d.user_id
        WHERE d.id = $1`,
      [deviceId],
    )
    const device = rows[0]
    if (!device) return res.status(404).json({ error: 'Device not found' })
    if (!req.user.is_admin && device.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const { rows: pending } = await db.query(
      `SELECT id FROM renewal_requests
        WHERE device_id = $1 AND status = 'pending'`,
      [device.id],
    )
    if (pending[0]) return res.status(409).json({ error: 'A renewal request is already pending' })

    const { rows: requestRows } = await db.query(
      `INSERT INTO renewal_requests
        (device_id, customer_id, customer_name, customer_email, customer_phone,
         device_name, imei, plan_months, price_mad)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        device.id, device.user_id, device.customer_name, device.customer_email,
        device.customer_phone, device.name, device.imei, plan.months, plan.priceMad,
      ],
    )
    res.status(201).json(serializeRequest(requestRows[0]))
  } catch (error) {
    if (error.message === 'Unsupported subscription plan') {
      return res.status(400).json({ error: 'Plan must be 3, 6, or 12 months' })
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A renewal request is already pending' })
    }
    console.error('[Subscriptions] renewal request failed:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

subscriptionsRouter.get('/renewals', requireAdmin, async (req, res) => {
  try {
    const status = req.query.status || 'pending'
    const allowed = ['pending', 'approved', 'rejected']
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid renewal status' })
    const { rows } = await db.query(
      `SELECT * FROM renewal_requests
        WHERE status = $1
        ORDER BY requested_at DESC`,
      [status],
    )
    res.json(rows.map(serializeRequest))
  } catch (error) {
    console.error('[Subscriptions] renewal list failed:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

subscriptionsRouter.post('/renewals/:id/approve', requireAdmin, async (req, res) => {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `SELECT rr.*, dl.end_date AS current_end_date
         FROM renewal_requests rr
         LEFT JOIN device_licenses dl ON dl.device_id = rr.device_id
        WHERE rr.id = $1
        FOR UPDATE OF rr`,
      [req.params.id],
    )
    const request = rows[0]
    if (!request) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Renewal request not found' })
    }
    if (request.status !== 'pending') {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'Renewal request has already been reviewed' })
    }

    const dates = calculateSubscriptionDates(request.current_end_date, request.plan_months)
    await client.query(
      `INSERT INTO device_subscriptions
        (device_id, plan_months, price_mad, start_date, end_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [request.device_id, dates.plan.months, dates.plan.priceMad, dates.startDate, dates.endDate, req.user.id],
    )
    await client.query(
      `INSERT INTO device_licenses
        (device_id, status, subscription_type, start_date, end_date, suspended_at, suspended_reason, updated_at)
       VALUES ($1, 'active', $2, $3, $4, NULL, NULL, NOW())
       ON CONFLICT (device_id) DO UPDATE SET
         status = 'active',
         subscription_type = EXCLUDED.subscription_type,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         suspended_at = NULL,
         suspended_reason = NULL,
         updated_at = NOW()`,
      [request.device_id, `${dates.plan.months} Months`, dates.startDate, dates.endDate],
    )
    const { rows: updated } = await client.query(
      `UPDATE renewal_requests
          SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1
        WHERE id = $2
        RETURNING *`,
      [req.user.id, request.id],
    )
    await client.query('COMMIT')
    res.json({ request: serializeRequest(updated[0]), license: await getDeviceLicense(request.device_id) })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[Subscriptions] renewal approval failed:', error)
    res.status(500).json({ error: 'Server error' })
  } finally {
    client.release()
  }
})

subscriptionsRouter.post('/renewals/:id/reject', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE renewal_requests
          SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $1,
              rejection_reason = $2
        WHERE id = $3 AND status = 'pending'
        RETURNING *`,
      [req.user.id, req.body.reason || null, req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Pending renewal request not found' })
    res.json(serializeRequest(rows[0]))
  } catch (error) {
    console.error('[Subscriptions] renewal rejection failed:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

subscriptionsRouter.post('/devices/:id/suspend', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE device_licenses
          SET status = 'suspended', suspended_at = NOW(), suspended_reason = $1, updated_at = NOW()
        WHERE device_id = $2
        RETURNING *`,
      [req.body.reason || null, req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Device license not found' })
    res.json(await getDeviceLicense(req.params.id))
  } catch (error) {
    console.error('[Subscriptions] suspend failed:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

subscriptionsRouter.post('/devices/:id/reactivate', requireAdmin, async (req, res) => {
  try {
    const license = await refreshDeviceLicense(req.params.id)
    if (!license) return res.status(404).json({ error: 'Device license not found' })
    if (!license.end_date || new Date(license.end_date) <= new Date()) {
      return res.status(409).json({ error: 'Device has no active subscription to reactivate' })
    }
    await db.query(
      `UPDATE device_licenses
          SET status = CASE WHEN end_date <= NOW() + INTERVAL '10 days' THEN 'expiring_soon' ELSE 'active' END,
              suspended_at = NULL, suspended_reason = NULL, updated_at = NOW()
        WHERE device_id = $1`,
      [req.params.id],
    )
    res.json(await getDeviceLicense(req.params.id))
  } catch (error) {
    console.error('[Subscriptions] reactivate failed:', error)
    res.status(500).json({ error: 'Server error' })
  }
})