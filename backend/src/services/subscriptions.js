export const SUBSCRIPTION_PLANS = Object.freeze([
  { id: '3_months', label: '3 أشهر', durationMonths: 3, price: 70 },
  { id: '6_months', label: '6 أشهر', durationMonths: 6, price: 120 },
  { id: '12_months', label: '12 شهراً', durationMonths: 12, price: 220 },
])

export const FREE_TRIAL_PLAN = Object.freeze({
  id: 'free_trial_3_months',
  label: 'تجربة مجانية — 3 أشهر',
  durationMonths: 3,
  price: 0,
  trial: true,
})

const DAY_MS = 24 * 60 * 60 * 1000

export function getSubscriptionPlan(planId) {
  return [...SUBSCRIPTION_PLANS, FREE_TRIAL_PLAN].find(plan => plan.id === planId) || null
}

export function dateOnly(value) {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

export function addDays(value, days) {
  const date = new Date(`${dateOnly(value)}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function addMonths(value, months) {
  const date = new Date(`${dateOnly(value)}T00:00:00.000Z`)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, lastDay))
  return date.toISOString().slice(0, 10)
}

export function getSubscriptionStatus(endDate, now = new Date()) {
  const end = dateOnly(endDate)
  if (!end) return 'active'
  const today = dateOnly(now)
  const daysRemaining = Math.round(
    (new Date(`${end}T00:00:00.000Z`).getTime() - new Date(`${today}T00:00:00.000Z`).getTime()) / DAY_MS
  )
  if (daysRemaining < 0) return 'expired'
  if (daysRemaining <= 10) return 'expiring_soon'
  return 'active'
}

export function getSubscriptionSnapshot(device, now = new Date()) {
  const startDate = dateOnly(device.subscription_start_date ?? device.subscriptionStartDate)
  const endDate = dateOnly(device.subscription_end_date ?? device.subscriptionEndDate)
  const planId = device.subscription_plan_id ?? device.subscriptionPlanId ?? null
  const status = !planId || !endDate ? 'unassigned' : getSubscriptionStatus(endDate, now)
  const daysRemaining = endDate
    ? Math.max(0, Math.round(
      (new Date(`${endDate}T00:00:00.000Z`).getTime() - new Date(`${dateOnly(now)}T00:00:00.000Z`).getTime()) / DAY_MS
    ) + 1)
    : null

  return {
    subscriptionPlanId: planId,
    subscriptionStartDate: startDate,
    subscriptionEndDate: endDate,
    subscriptionStatus: status,
    subscriptionDaysRemaining: daysRemaining,
    // Missing billing data must be visible to the client/admin, but it does not
    // disable an already-installed tracker. Only an expired plan stops live tracking.
    trackingEnabled: status !== 'expired',
  }
}

export async function syncSubscriptionState(db, device, clientName = null, now = new Date()) {
  const snapshot = getSubscriptionSnapshot(device, now)
  const currentStatus = device.subscription_status ?? device.subscriptionStatus ?? null

  if (currentStatus !== snapshot.subscriptionStatus) {
    await db.query(
      `UPDATE devices SET subscription_status=$1, updated_at=NOW() WHERE id=$2`,
      [snapshot.subscriptionStatus, device.id]
    )
  }

  if (snapshot.subscriptionStatus === 'active' || snapshot.subscriptionStatus === 'unassigned' || !device.id) return snapshot

  const alertType = snapshot.subscriptionStatus === 'expired'
    ? 'subscription_expired'
    : 'subscription_expiring'
  const plan = getSubscriptionPlan(snapshot.subscriptionPlanId)
  const planText = plan ? `${plan.label} — ${plan.price} MAD` : 'خطة غير محددة'
  const message = snapshot.subscriptionStatus === 'expired'
    ? `انتهى اشتراك جهاز ${device.name}. تم إيقاف التتبع المباشر. الخطة: ${planText}.`
    : `اشتراك جهاز ${device.name} سينتهي خلال ${snapshot.subscriptionDaysRemaining} يوم. الخطة: ${planText}.`

  const { rows } = await db.query(
    `SELECT id FROM alerts
     WHERE device_id=$1 AND type=$2 AND created_at::date=CURRENT_DATE
     LIMIT 1`,
    [device.id, alertType]
  )
  if (!rows[0]) {
    await db.query(
      `INSERT INTO alerts (device_id,user_id,type,message,data)
       VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [
        device.id,
        device.user_id ?? null,
        alertType,
        clientName ? `${message} العميل: ${clientName}.` : message,
        JSON.stringify({
          subscriptionStatus: snapshot.subscriptionStatus,
          subscriptionPlanId: snapshot.subscriptionPlanId,
          subscriptionEndDate: snapshot.subscriptionEndDate,
          daysRemaining: snapshot.subscriptionDaysRemaining,
        }),
      ]
    )
  }
  return snapshot
}
