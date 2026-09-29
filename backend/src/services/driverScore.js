import { dayKey } from '../utils/timezone.js'
import { speedKmh } from '../utils/speed.js'

// Daily driving score computed from raw GPS fixes.
//   speeding: time above the limit (share of moving time) and number of episodes
//   harsh braking / acceleration: speed change per second between close fixes
// GPS fixes are seconds apart, so thresholds are approximations of ~0.3 g / ~0.25 g.
export const DEFAULT_SPEED_LIMIT_KMH = 110
const MOVING_KMH = 2
const MAX_SAMPLE_GAP_S = 60
const MAX_ACCEL_GAP_S = 15
const HARSH_BRAKE_KMH_PER_S = 10
const HARSH_ACCEL_KMH_PER_S = 8
const TRIP_GAP_MS = 5 * 60 * 1000

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function computeDailyScores(positions, { limitKmh = DEFAULT_SPEED_LIMIT_KMH } = {}) {
  const sorted = (Array.isArray(positions) ? positions : [])
    .filter(p => p?.fixTime && !Number.isNaN(new Date(p.fixTime).getTime()))
    .sort((a, b) => new Date(a.fixTime) - new Date(b.fixTime))

  const days = new Map()
  const day = key => {
    if (!days.has(key)) {
      days.set(key, { movingSec: 0, overSec: 0, speeding: 0, brake: 0, accel: 0, trips: 0, lastMovingAt: null, over: false })
    }
    return days.get(key)
  }

  for (let i = 0; i < sorted.length; i += 1) {
    const point = sorted[i]
    const at = new Date(point.fixTime).getTime()
    const key = dayKey(point.fixTime)
    if (!key) continue
    const d = day(key)
    const v2 = speedKmh(point.speed)

    if (v2 >= MOVING_KMH) {
      if (d.lastMovingAt === null || at - d.lastMovingAt > TRIP_GAP_MS) d.trips += 1
      d.lastMovingAt = at
    }

    const prev = sorted[i - 1]
    if (prev && dayKey(prev.fixTime) === key) {
      const dt = (at - new Date(prev.fixTime).getTime()) / 1000
      const v1 = speedKmh(prev.speed)
      if (dt > 0 && dt <= MAX_SAMPLE_GAP_S) {
        if (v2 >= MOVING_KMH) d.movingSec += dt
        if (v2 > limitKmh) d.overSec += dt
      }
      if (dt > 0 && dt <= MAX_ACCEL_GAP_S) {
        if (v1 >= 20 && (v1 - v2) / dt >= HARSH_BRAKE_KMH_PER_S) d.brake += 1
        if (v2 >= 15 && (v2 - v1) / dt >= HARSH_ACCEL_KMH_PER_S) d.accel += 1
      }
    }

    if (v2 > limitKmh) {
      if (!d.over) d.speeding += 1
      d.over = true
    } else {
      d.over = false
    }
  }

  const rows = []
  for (const [key, d] of days) {
    if (d.trips === 0 || d.movingSec < 60) continue
    const overShare = d.movingSec > 0 ? d.overSec / d.movingSec : 0
    const penalty = Math.min(45, overShare * 250)
      + Math.min(20, d.speeding * 2)
      + Math.min(20, d.brake * 2)
      + Math.min(15, d.accel * 1.5)
    rows.push({
      recorded_date: key,
      score: Math.round(clamp(100 - penalty, 0, 100)),
      speeding_events: d.speeding,
      harsh_brake_events: d.brake,
      harsh_accel_events: d.accel,
      idle_min: 0,
      trip_count: d.trips,
    })
  }
  return rows.sort((a, b) => (a.recorded_date < b.recorded_date ? 1 : -1))
}
