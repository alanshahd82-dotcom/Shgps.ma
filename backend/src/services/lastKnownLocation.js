import { isValidCoordinate } from '../utils/location.js'

// A vehicle must never lose its place on the map. The last valid position is normally stored while the
// tracker reports (devices.last_lat / last_lng), and Traccar's newest position is used when it is a real
// fix. A device can still end up with neither: its last packets had no GPS fix (0,0) and it was silent
// while the stored copy was not being written. For those devices only, we look back into Traccar's own
// history for the newest valid fix, remember it in the database, and never ask again.
const WINDOWS_DAYS = [[0, 2], [2, 10], [10, 45]]   // [newer end, older start] in days ago, newest window first
const RETRY_AFTER_MS = 15 * 60 * 1000
const MAX_PER_CALL = 4
const BUDGET_MS = 2500
const DAY = 86400e3

const triedAt = new Map()   // device id -> last unsuccessful attempt (ms)
const inFlight = new Map()  // device id -> pending Promise

const hasStored = d => isValidCoordinate(d.last_lat, d.last_lng)

function newestValid(positions) {
  let best = null
  for (const p of positions || []) {
    if (!isValidCoordinate(p?.latitude, p?.longitude)) continue
    const at = Date.parse(p.fixTime ?? p.serverTime ?? '') || 0
    if (!best || at >= best.at) best = { at, p }
  }
  return best?.p ?? null
}

async function findInHistory(getWindow, traccarId, nowMs) {
  for (const [newerDays, olderDays] of WINDOWS_DAYS) {
    const end = new Date(nowMs - newerDays * DAY).toISOString()
    const start = new Date(nowMs - olderDays * DAY).toISOString()
    const found = newestValid(await getWindow(traccarId, start, end))
    if (found) return found
  }
  return null
}

/**
 * Fills `last_lat / last_lng / last_update` on the given device rows (in place) for devices that have
 * no valid location at all. `skip(row)` is true when the device needs nothing (Traccar currently gives a valid live fix, or tracking is off).
 * `getWindow` reads Traccar history (deviceId, fromISO, toISO); `persist(row, position)` stores it.
 * Bounded: a few devices per call, a total time budget, and a retry pause for devices with no history.
 */
export async function recoverLastLocations(rows, { skip = () => false, getWindow, persist, now = Date.now, budgetMs = BUDGET_MS }) {
  if (typeof getWindow !== 'function' || typeof persist !== 'function') return 0
  const nowMs = now()
  const candidates = (rows || [])
    .filter(d => d && d.traccar_id != null && !hasStored(d) && !skip(d))
    .filter(d => !(triedAt.get(d.id) > nowMs - RETRY_AFTER_MS))
    .slice(0, MAX_PER_CALL)
  if (!candidates.length) return 0

  const work = candidates.map(d => {
    if (!inFlight.has(d.id)) {
      const job = findInHistory(getWindow, d.traccar_id, nowMs)
        .then(async position => {
          if (!position) { triedAt.set(d.id, nowMs); return null }
          await persist(d, position)
          return position
        })
        .catch(() => { triedAt.set(d.id, nowMs); return null })
        .finally(() => inFlight.delete(d.id))
      inFlight.set(d.id, job)
    }
    return inFlight.get(d.id).then(position => {
      if (position) {
        d.last_lat = Number(position.latitude)
        d.last_lng = Number(position.longitude)
        d.last_update = position.fixTime ?? position.serverTime ?? d.last_update ?? null
        return 1
      }
      return 0
    })
  })

  let timer
  const budget = new Promise(resolve => { timer = setTimeout(() => resolve('timeout'), budgetMs) })
  const results = await Promise.race([Promise.all(work), budget])
  clearTimeout(timer)
  return Array.isArray(results) ? results.reduce((a, b) => a + b, 0) : 0
}

export function _resetLastLocationCache() { triedAt.clear(); inFlight.clear() }
