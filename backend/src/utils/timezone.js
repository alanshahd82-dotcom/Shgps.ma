// Single source of truth for app timezone (Morocco).
export const APP_TZ = 'Africa/Casablanca'

function partsIn(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const out = {}
  for (const p of dtf.formatToParts(date)) if (p.type !== 'literal') out[p.type] = p.value
  return out
}

// Offset (ms) of APP_TZ at the given instant: tzTime - utcTime
export function tzOffsetMs(date = new Date(), tz = APP_TZ) {
  const p = partsIn(date, tz)
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  return asUTC - Math.floor(date.getTime() / 1000) * 1000
}

// 'YYYY-MM-DD' for the given instant, in APP_TZ
export function dayKey(value = new Date(), tz = APP_TZ) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

// Instant of 00:00 local (APP_TZ) for the day containing `value`
export function startOfDay(value = new Date(), tz = APP_TZ) {
  const date = value instanceof Date ? value : new Date(value)
  const guess = new Date(`${dayKey(date, tz)}T00:00:00Z`)
  return new Date(guess.getTime() - tzOffsetMs(guess, tz))
}

// Shift by whole local days, keeping 00:00 local
export function addDays(value, n, tz = APP_TZ) {
  const base = startOfDay(value, tz)
  return startOfDay(new Date(base.getTime() + n * 86400000 + 3600000 * 12), tz)
}
