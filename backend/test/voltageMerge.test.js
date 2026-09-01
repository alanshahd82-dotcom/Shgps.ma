// Phase 2H-2 — frontend voltage-merge contract.
//
// Locks mergeVoltageFields (src/utils/voltageMerge.js) so the 30 s /devices
// poll cannot null a known vehicle voltage when the backend reports stale,
// and a fresh non-null voltage still wins. Pure JS (no React) so it runs
// under node:test.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeVoltageFields } from '../../src/utils/voltageMerge.js'

test('2H-2 #6: stale poll (incoming.voltage=null) preserves current voltage', () => {
  const current = { voltage: 13.6, voltageStale: true, lastVoltageAt: '2026-09-01T08:00:00.000Z' }
  const incoming = { voltage: null, voltageStale: true, lastVoltageAt: '2026-09-01T08:00:00.000Z' }
  const m = mergeVoltageFields(current, incoming)
  assert.equal(m.voltage, 13.6)
  assert.equal(m.voltageStale, true)
  assert.equal(m.lastVoltageAt, '2026-09-01T08:00:00.000Z')
})

test('2H-2 #7: fresh incoming voltage wins and clears stale', () => {
  const current = { voltage: 13.6, voltageStale: true, lastVoltageAt: '2026-09-01T08:00:00.000Z' }
  const incoming = { voltage: 13.8, voltageStale: false, lastVoltageAt: null }
  const m = mergeVoltageFields(current, incoming)
  assert.equal(m.voltage, 13.8)
  assert.equal(m.voltageStale, false)
  assert.equal(m.lastVoltageAt, null)
})

test('2H-2 #6b: fresh null with stale=false does not fabricate a value', () => {
  const current = { voltage: null, voltageStale: false, lastVoltageAt: null }
  const incoming = { voltage: null, voltageStale: false, lastVoltageAt: null }
  const m = mergeVoltageFields(current, incoming)
  assert.equal(m.voltage, null)
  assert.equal(m.voltageStale, false)
})
