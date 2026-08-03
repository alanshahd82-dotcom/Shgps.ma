export const SUBSCRIPTION_PLANS = Object.freeze([
  { id: '3_months', label: '3 أشهر', labelFr: '3 mois', durationMonths: 3, price: 70 },
  { id: '6_months', label: '6 أشهر', labelFr: '6 mois', durationMonths: 6, price: 120 },
  { id: '12_months', label: '12 شهراً', labelFr: '12 mois', durationMonths: 12, price: 220 },
])

export const FREE_TRIAL_PLAN = Object.freeze({
  id: 'free_trial_3_months',
  label: 'تجربة مجانية — 3 أشهر',
  labelFr: 'Essai gratuit — 3 mois',
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
  const startDate = dateOnly(device?.subscriptionStartDate ?? device?.subscription_start_date)
  const endDate = dateOnly(device?.subscriptionEndDate ?? device?.subscription_end_date)
  const planId = device?.subscriptionPlanId ?? device?.subscription_plan_id ?? null
  const status = !planId || !endDate ? 'unassigned' : getSubscriptionStatus(endDate, now)
  const daysRemaining = endDate
    ? Math.max(0, Math.round(
      (new Date(`${endDate}T00:00:00.000Z`).getTime() - new Date(`${dateOnly(now)}T00:00:00.000Z`).getTime()) / DAY_MS
    ) + 1)
    : null
  return {
    planId,
    startDate,
    endDate,
    status,
    daysRemaining,
    trackingEnabled: status !== 'expired',
  }
}
