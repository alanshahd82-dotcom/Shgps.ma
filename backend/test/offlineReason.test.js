import test from 'node:test'
import assert from 'node:assert/strict'
import { isNotConnected, offlineReason, offlineSortValue } from '../../src/utils/offline.js'

const now = Date.parse('2026-09-28T12:00:00Z')

test('not connected = not online, or tracking disabled', () => {
  assert.equal(isNotConnected({ status: 'online' }), false)
  assert.equal(isNotConnected({ status: 'offline' }), true)
  assert.equal(isNotConnected({ status: 'online', trackingEnabled: false }), true)
})

test('reason: expired subscription wins, then power, then never, then long/recent', () => {
  assert.equal(offlineReason({ status: 'offline', trackingEnabled: false, powerDisconnected: true }, now).code, 'subscription')
  assert.equal(offlineReason({ status: 'offline', subscriptionStatus: 'expired' }, now).code, 'subscription')
  assert.equal(offlineReason({ status: 'offline', powerDisconnected: true, lastUpdate: '2026-09-28T11:00:00Z' }, now).code, 'power')
  assert.equal(offlineReason({ status: 'offline', lastUpdate: null }, now).code, 'never')
  const long = offlineReason({ status: 'offline', lastUpdate: '2026-09-15T12:00:00Z' }, now)
  assert.deepEqual(long, { code: 'long', days: 13 })
  const recent = offlineReason({ status: 'offline', lastUpdate: '2026-09-28T11:30:00Z' }, now)
  assert.deepEqual(recent, { code: 'recent', minutes: 30 })
})

test('sort: never-connected first, then the longest disconnected', () => {
  const list = [
    { id: 'a', lastUpdate: '2026-09-28T11:00:00Z' },
    { id: 'b', lastUpdate: null },
    { id: 'c', lastUpdate: '2026-09-01T00:00:00Z' },
  ].sort((x, y) => offlineSortValue(x) - offlineSortValue(y))
  assert.deepEqual(list.map(d => d.id), ['b', 'c', 'a'])
})
