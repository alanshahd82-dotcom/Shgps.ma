// A vehicle keeps its place on the map: devices with no valid stored/live location get the newest valid
// fix from Traccar's history (once), and devices without any history are not hammered.
import test from 'node:test'
import assert from 'node:assert/strict'
import { recoverLastLocations, _resetLastLocationCache } from '../src/services/lastKnownLocation.js'

const NOW = Date.parse('2026-09-29T10:00:00Z')
const iso = ms => new Date(ms).toISOString()
const fix = (lat, lng, at) => ({ latitude: lat, longitude: lng, fixTime: iso(at), valid: true })
const nofix = at => ({ latitude: 0, longitude: 0, fixTime: iso(at), valid: false })

test('recovers the newest valid fix, persists it and fills the row', async () => {
  _resetLastLocationCache()
  const rows = [{ id: 1, traccar_id: 10, last_lat: null, last_lng: null, last_update: null }]
  const saved = []
  const n = await recoverLastLocations(rows, {
    now: () => NOW,
    getWindow: async () => [fix(33.1, -7.1, NOW - 5 * 86400e3), nofix(NOW - 4 * 86400e3), fix(33.2, -7.2, NOW - 3 * 86400e3)],
    persist: async (row, p) => saved.push([row.id, p.latitude, p.longitude]),
  })
  assert.equal(n, 1)
  assert.deepEqual(saved, [[1, 33.2, -7.2]])
  assert.equal(rows[0].last_lat, 33.2)
  assert.equal(rows[0].last_lng, -7.2)
})

test('leaves devices alone that already have a stored location or are skipped', async () => {
  _resetLastLocationCache()
  let calls = 0
  const rows = [
    { id: 1, traccar_id: 10, last_lat: 30, last_lng: -5 },
    { id: 2, traccar_id: 11, last_lat: null, last_lng: null },
    { id: 3, traccar_id: null, last_lat: null, last_lng: null },
  ]
  await recoverLastLocations(rows, {
    now: () => NOW, skip: d => d.id === 2,
    getWindow: async () => { calls++; return [fix(1, 1, NOW)] },
    persist: async () => {},
  })
  assert.equal(calls, 0)
})

test('searches newer windows first and stops at the first valid fix', async () => {
  _resetLastLocationCache()
  const windows = []
  const rows = [{ id: 1, traccar_id: 10, last_lat: null, last_lng: null }]
  await recoverLastLocations(rows, {
    now: () => NOW,
    getWindow: async (_id, from) => { windows.push(from); return windows.length === 2 ? [fix(34, -6, NOW - 6 * 86400e3)] : [nofix(NOW)] },
    persist: async () => {},
  })
  assert.equal(windows.length, 2)
  assert.equal(rows[0].last_lat, 34)
})

test('a device with no history is retried only after a pause', async () => {
  _resetLastLocationCache()
  let calls = 0
  const opts = { now: () => NOW, getWindow: async () => { calls++; return [nofix(NOW)] }, persist: async () => {} }
  const rows = [{ id: 1, traccar_id: 10, last_lat: null, last_lng: null }]
  await recoverLastLocations(rows, opts)
  const first = calls
  await recoverLastLocations(rows, opts)
  assert.equal(calls, first)
  assert.equal(rows[0].last_lat, null)
  await recoverLastLocations(rows, { ...opts, now: () => NOW + 16 * 60e3 })
  assert.ok(calls > first)
})

test('a failing Traccar or database never breaks the response', async () => {
  _resetLastLocationCache()
  const rows = [{ id: 1, traccar_id: 10, last_lat: null, last_lng: null }]
  const n = await recoverLastLocations(rows, { now: () => NOW, getWindow: async () => { throw new Error('down') }, persist: async () => {} })
  assert.equal(n, 0)
  assert.equal(rows[0].last_lat, null)
})

test('at most a few devices are searched per call and a slow Traccar cannot stall the page', async () => {
  _resetLastLocationCache()
  let calls = 0
  const rows = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, traccar_id: 100 + i, last_lat: null, last_lng: null }))
  const t0 = Date.now()
  await recoverLastLocations(rows, { now: () => NOW, budgetMs: 80, getWindow: () => { calls++; return new Promise(() => {}) }, persist: async () => {} })
  assert.ok(Date.now() - t0 < 1000)
  assert.equal(calls, 4)
})
