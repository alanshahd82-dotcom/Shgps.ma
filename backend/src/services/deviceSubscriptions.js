import { db } from '../db.js'

export const SUBSCRIPTION_PLANS = Object.freeze({
  3: { months: 3, priceMad: 70, label: '3 Months' },
  6: { months: 6, priceMad: 120, label: '6 Months' },
  12: { months: 12, priceMad: 220, label: '12 Months' },
})

export const LICENSE_STATUSES = Object.freeze({
  ACTIVE: 'active',
  EXPIRING_SOON: 'expiring_soon',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
})

function planFor(months) {
  const plan = SUBSCRIPTION_PLANS[Number(months)]
  if (!plan) throw new Error('Unsupported subscription plan')
  return plan
}

function addMonths(date, months) {
  const result = new Date(date)
  const originalDay = result.getDate()
  result.setDate(1)
  result.setMonth(result.getMonth() + months)
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(originalDay, lastDay))
  return result
}

function remainingDays(endDate, now = new Date()) {
  if (!endDate) return 0
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - now.getTime()) / 86400000))
}

export function publicLicenseStatus(status) {
  return {
    active: 'Active',
    expiring_soon: 'Expiring Soon',
    expired: 'Expired',
    suspended: 'Suspended',
  }[status] || 'Expired'
}

export async function refreshDeviceLicense(deviceId, client = db) {
  const { rows } = await client.query(
    `SELECT dl.status, dl.start_date, dl.end_date, dl.suspended_at,
            ds.plan_months, ds.price_mad
       FROM device_licenses dl
       LEFT JOIN LATERAL (
         SELECT plan_months, price_mad
           FROM device_subscriptions
          WHERE device_id = dl.device_id AND is_active = true
          ORDER BY end_date DESC, id DESC
          LIMIT 1
       ) ds ON true
      WHERE dl.device_id = $1
      FOR UPDATE OF dl`,
    [deviceId],
  )
  const current = rows[0]
  if (!current) return null
  if (current.status === LICENSE_STATUSES.SUSPENDED) return current

  const days = remainingDays(current.end_date)
  const nextStatus = current.end_date && new Date(current.end_date) > new Date()
    ? (days <= 10 ? LICENSE_STATUSES.EXPIRING_SOON : LICENSE_STATUSES.ACTIVE)
    : LICENSE_STATUSES.EXPIRED

  if (nextStatus !== current.status) {
    await client.query(
      `UPDATE device_licenses
          SET status = $1, updated_at = NOW()
        WHERE device_id = $2`,
      [nextStatus, deviceId],
    )
  }
  return { ...current, status: nextStatus }
}

export async function refreshAllDeviceLicenses() {
  const { rows } = await db.query('SELECT device_id FROM device_licenses')
  for (const row of rows) {
    try {
      await refreshDeviceLicense(row.device_id)
    } catch (error) {
      console.error('[Licenses] refresh failed for device', row.device_id, error.message)
    }
  }
}

export async function getDeviceLicense(deviceId, client = db) {
  const license = await refreshDeviceLicense(deviceId, client)
  if (!license) return null
  return {
    status: license.status,
    statusLabel: publicLicenseStatus(license.status),
    subscriptionType: license.plan_months ? `${license.plan_months} Months` : null,
    planMonths: license.plan_months ? Number(license.plan_months) : null,
    priceMad: license.price_mad ? Number(license.price_mad) : null,
    startDate: license.start_date,
    endDate: license.end_date,
    remainingDays: remainingDays(license.end_date),
    applicationAccess: [LICENSE_STATUSES.ACTIVE, LICENSE_STATUSES.EXPIRING_SOON].includes(license.status),
  }
}

export async function ensureDeviceLicense(deviceId, client = db) {
  await client.query(
    `INSERT INTO device_licenses (device_id, status)
     VALUES ($1, 'expired')
     ON CONFLICT (device_id) DO NOTHING`,
    [deviceId],
  )
}

export async function requireActiveDeviceLicense(req, res, next) {
  if (req.user?.is_admin) return next()
  const deviceId = req.params.id || req.query.deviceId || req.body?.deviceId
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' })

  try {
    const { rows } = await db.query(
      'SELECT id, user_id FROM devices WHERE id = $1',
      [deviceId],
    )
    const device = rows[0]
    if (!device) return res.status(404).json({ error: 'Device not found' })
    if (device.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })

    const license = await getDeviceLicense(deviceId)
    if (!license?.applicationAccess) {
      return res.status(403).json({
        error: 'Device application access is unavailable until the subscription is renewed',
        code: license?.status || LICENSE_STATUSES.EXPIRED,
        license,
      })
    }
    req.deviceLicense = license
    next()
  } catch (error) {
    console.error('[Licenses] access check failed:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

export function validatePlan(months) {
  return planFor(months)
}

export function calculateSubscriptionDates(currentEndDate, months, now = new Date()) {
  const plan = planFor(months)
  const startDate = currentEndDate && new Date(currentEndDate) > now
    ? new Date(currentEndDate)
    : now
  return {
    plan,
    startDate,
    endDate: addMonths(startDate, plan.months),
  }
}

export { remainingDays }