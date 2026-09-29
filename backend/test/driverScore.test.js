import test from 'node:test'
import assert from 'node:assert/strict'
import { computeDailyScores } from '../src/services/driverScore.js'

const KN = 1 / 1.852 // km/h -> knots (Traccar unit)
const T0 = Date.parse('2026-09-20T09:00:00Z')
const fix = (sec, kmh, base = T0) => ({ fixTime: new Date(base + sec * 1000).toISOString(), speed: kmh * KN })

// A steady 60 km/h drive sampled every 10 s for 5 minutes.
const calm = Array.from({ length: 31 }, (_, i) => fix(i * 10, 60))

test('calm driving scores 100 with no events', () => {
  const [row] = computeDailyScores(calm)
  assert.equal(row.score, 100)
  assert.equal(row.speeding_events, 0)
  assert.equal(row.harsh_brake_events, 0)
  assert.equal(row.trip_count, 1)
})

test('speeding lowers the score and counts one episode', () => {
  const drive = calm.map((p, i) => (i >= 10 && i < 20 ? fix(i * 10, 130) : p))
  const [row] = computeDailyScores(drive)
  assert.equal(row.speeding_events, 1)
  assert.ok(row.score < 100 && row.score > 40, `score ${row.score}`)
})

test('a sudden stop counts as harsh braking', () => {
  const drive = [fix(0, 80), fix(3, 80), fix(6, 20), ...Array.from({ length: 12 }, (_, i) => fix(16 + i * 10, 40))]
  const [row] = computeDailyScores(drive)
  assert.equal(row.harsh_brake_events, 1)
  assert.ok(row.score < 100)
})

test('parked or too-short movement produces no score', () => {
  assert.deepEqual(computeDailyScores(Array.from({ length: 20 }, (_, i) => fix(i * 30, 0))), [])
  assert.deepEqual(computeDailyScores([fix(0, 50), fix(10, 50)]), [])
  assert.deepEqual(computeDailyScores(undefined), [])
})

test('each day is scored separately, newest first', () => {
  const dayMs = 24 * 60 * 60 * 1000
  const rows = computeDailyScores([...calm, ...Array.from({ length: 31 }, (_, i) => fix(i * 10, 60, T0 + dayMs))])
  assert.equal(rows.length, 2)
  assert.ok(rows[0].recorded_date > rows[1].recorded_date)
})
