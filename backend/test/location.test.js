import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidCoordinate, pickLocation } from '../src/utils/location.js'

const good = { latitude: 33.5731, longitude: -7.5898, fixTime: '2026-09-28T10:00:00Z' }
const stored = { latitude: 34.02, longitude: -6.84, fixTime: '2026-09-27T08:00:00Z' }

test('0,0 and invalid coordinates are not a location', () => {
  assert.equal(isValidCoordinate(0, 0), false)
  assert.equal(isValidCoordinate(0.001, -0.002), false)
  assert.equal(isValidCoordinate(null, 5), false)
  assert.equal(isValidCoordinate('', ''), false)
  assert.equal(isValidCoordinate(91, 10), false)
  assert.equal(isValidCoordinate(10, 181), false)
  assert.equal(isValidCoordinate('abc', 1), false)
  assert.equal(isValidCoordinate(33.5, -7.5), true)
  assert.equal(isValidCoordinate('33.5', '-7.5'), true)
})

test('online vehicle with a real fix uses the live position', () => {
  const r = pickLocation(good, stored)
  assert.equal(r.source, 'live')
  assert.equal(r.latitude, 33.5731)
  assert.equal(r.at, '2026-09-28T10:00:00Z')
})

test('live 0,0 falls back to the stored last valid location (the reported bug)', () => {
  const r = pickLocation({ latitude: 0, longitude: 0, valid: false, fixTime: '2026-09-28T11:00:00Z' }, stored)
  assert.equal(r.source, 'stored')
  assert.equal(r.latitude, 34.02)
  assert.equal(r.at, '2026-09-27T08:00:00Z')
})

test('offline vehicle without a live position keeps its stored location', () => {
  const r = pickLocation(null, { latitude: 34.02, longitude: -6.84, last_update: '2026-09-20T00:00:00Z' })
  assert.equal(r.source, 'stored')
  assert.equal(r.at, '2026-09-20T00:00:00Z')
})

test('device that never had a valid fix has no location at all', () => {
  assert.equal(pickLocation({ latitude: 0, longitude: 0 }, null), null)
  assert.equal(pickLocation({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), null)
  assert.equal(pickLocation(null, null), null)
})
