import test from 'node:test'
import assert from 'node:assert/strict'
import { signalToBars, signalColor } from '../../src/utils/signal.js'

// ── GT06 0-5 rssi scale (production devices 37 and 70) ──────────────────────
test('GT06 rssi=3 -> 3 bars (not 1)', () => {
  assert.equal(signalToBars(3), 3)
})

test('GT06 rssi=0 -> 0 bars (no signal)', () => {
  assert.equal(signalToBars(0), 0)
})

test('GT06 rssi=1 -> 1 bar', () => {
  assert.equal(signalToBars(1), 1)
})

test('GT06 rssi=2 -> 2 bars', () => {
  assert.equal(signalToBars(2), 2)
})

test('GT06 rssi=4 -> 4 bars', () => {
  assert.equal(signalToBars(4), 4)
})

test('GT06 rssi=5 -> 4 bars (capped)', () => {
  assert.equal(signalToBars(5), 4)
})

// ── dBm (negative) scale ────────────────────────────────────────────────────
test('dBm -50 -> 4 bars', () => {
  assert.equal(signalToBars(-50), 4)
})

test('dBm -70 -> 3 bars', () => {
  assert.equal(signalToBars(-70), 3)
})

test('dBm -90 -> 2 bars', () => {
  assert.equal(signalToBars(-90), 2)
})

test('dBm -105 -> 1 bar', () => {
  assert.equal(signalToBars(-105), 1)
})

test('dBm -120 -> 0 bars', () => {
  assert.equal(signalToBars(-120), 0)
})

// ── Percentage (0-100) scale ─────────────────────────────────────────────────
test('pct 80 -> 4 bars', () => {
  assert.equal(signalToBars(80), 4)
})

test('pct 60 -> 3 bars', () => {
  assert.equal(signalToBars(60), 3)
})

test('pct 30 -> 2 bars', () => {
  assert.equal(signalToBars(30), 2)
})

test('pct 10 -> 1 bar', () => {
  assert.equal(signalToBars(10), 1)
})

// ── Edge cases ───────────────────────────────────────────────────────────────
test('null -> 0 bars', () => {
  assert.equal(signalToBars(null), 0)
})

test('undefined -> 0 bars', () => {
  assert.equal(signalToBars(undefined), 0)
})

test('NaN -> 0 bars', () => {
  assert.equal(signalToBars(NaN), 0)
})

test('string "3" -> 3 bars (coerced)', () => {
  assert.equal(signalToBars('3'), 3)
})

// ── Signal color ─────────────────────────────────────────────────────────────
test('color: 3+ bars -> green', () => {
  assert.equal(signalColor(3), '#22c55e')
  assert.equal(signalColor(4), '#22c55e')
})

test('color: 2 bars -> amber', () => {
  assert.equal(signalColor(2), '#f59e0b')
})

test('color: 1 bar -> red', () => {
  assert.equal(signalColor(1), '#ef4444')
})

test('color: 0 bars -> gray', () => {
  assert.equal(signalColor(0), '#cbd5e1')
})
