// Phase 2H-2 — last-known vehicle-voltage contract.
//
// Locks the read boundary in vehicleTelemetry.js:
//   - a valid 12V/24V battery voltage is served fresh, and (when telemetry is
//     silent) as last-known with voltageStale=true;
//   - an invalid generic adc1 reading (e.g. 6.4 V) is NEVER surfaced as a
//     vehicle-battery voltage, fresh or stale;
//   - telemetry silence never fabricates a value or a power disconnect;
//   - a confirmed external-power disconnect does not expose a stale voltage.
//
// These tests do not touch power-alert detection or the engine state machine.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isBatteryVoltage,
  isVehicleDisconnected,
  markVehicleConnected,
  markVehicleDisconnected,
  clearVehicleVoltage,
  observeVehicleVoltage,
  readVehicleVoltage,
  readLastKnownVehicleVoltage,
} from '../src/services/vehicleTelemetry.js'

const D = 9001

function pos(id, attributes) {
  const iso = new Date().toISOString()
  return { deviceId: id, serverTime: iso, deviceTime: iso, fixTime: iso, attributes }
}

function reset(id) {
  markVehicleConnected(id)
  clearVehicleVoltage(id)
}

test('2H-2 #1: fresh valid 12V adc1 is served and not stale', () => {
  reset(D)
  observeVehicleVoltage(pos(D, { adc1: 13.6 }))
  assert.equal(readVehicleVoltage(pos(D, { adc1: 13.6 }), D), 13.6)
  // connected with no voltage this packet -> cached 13.6 still served (online)
  assert.equal(readVehicleVoltage(pos(D, {}), D, { connected: true }), 13.6)
})

test('2H-2 #2: fresh valid 24V adc1 is accepted', () => {
  reset(D)
  assert.equal(readVehicleVoltage(pos(D, { adc1: 24.1 }), D), 24.1)
  assert.equal(isBatteryVoltage(24.1), true)
})

test('2H-2 #3: invalid GT06 adc1=6.4 is NOT surfaced as vehicle voltage', () => {
  reset(D)
  assert.equal(readVehicleVoltage(pos(D, { adc1: 6.4 }), D), null)
  assert.equal(isBatteryVoltage(6.4), false)
  // 6.4 enters the generic cache but is not served as last-known vehicle voltage
  observeVehicleVoltage(pos(D, { adc1: 6.4 }))
  assert.equal(readLastKnownVehicleVoltage(D), null)
  assert.equal(readVehicleVoltage(pos(D, {}), D, { connected: true }), null)
})

test('2H-2 #4: no previous valid battery voltage -> null', () => {
  reset(D)
  assert.equal(readLastKnownVehicleVoltage(D), null)
  assert.equal(readVehicleVoltage(pos(D, {}), D, { connected: false }), null)
})

test('2H-2 #5: previous valid battery voltage is retained as last-known', () => {
  reset(D)
  observeVehicleVoltage(pos(D, { adc1: 13.6 }))
  const last = readLastKnownVehicleVoltage(D)
  assert.ok(last, 'expected a last-known entry')
  assert.equal(last.voltage, 13.6)
  assert.ok(last.lastSeenAt, 'lastSeenAt populated')
  // stale read (connected:false) still returns null via gate A, but last-known is available
  assert.equal(readVehicleVoltage(pos(D, {}), D, { connected: false }), null)
  assert.equal(readLastKnownVehicleVoltage(D).voltage, 13.6)
})

test('2H-2 #8: confirmed power disconnect does not expose stale voltage', () => {
  reset(D)
  observeVehicleVoltage(pos(D, { adc1: 13.6 }))
  markVehicleDisconnected(D)
  assert.equal(isVehicleDisconnected(D), true)
  assert.equal(readVehicleVoltage(pos(D, {}), D, { connected: true }), null)
  assert.equal(readLastKnownVehicleVoltage(D), null)
})

test('2H-2 #9: reconnect serves the latest valid value', () => {
  reset(D)
  observeVehicleVoltage(pos(D, { adc1: 13.6 }))
  markVehicleDisconnected(D)
  markVehicleConnected(D)
  assert.equal(readVehicleVoltage(pos(D, { adc1: 13.8 }), D), 13.8)
  assert.equal(readLastKnownVehicleVoltage(D).voltage, 13.8)
})

test('2H-2 #10: multiple devices are isolated', () => {
  const A = 9101, B = 9102, C = 9103
  ;[A, B, C].forEach(reset)
  observeVehicleVoltage(pos(A, { adc1: 13.6 }))
  observeVehicleVoltage(pos(B, { adc1: 14.2 }))
  assert.equal(readLastKnownVehicleVoltage(A).voltage, 13.6)
  assert.equal(readLastKnownVehicleVoltage(B).voltage, 14.2)
  assert.equal(readLastKnownVehicleVoltage(C), null)
  assert.equal(readVehicleVoltage(pos(B, { adc1: 14.2 }), B), 14.2)
  assert.equal(readVehicleVoltage(pos(C, {}), C, { connected: true }), null)
  ;[A, B, C].forEach(clearVehicleVoltage)
})

test('2H-2 #11: empty cache fabricates no stale value (restart behavior)', () => {
  reset(D)
  assert.equal(readLastKnownVehicleVoltage(D), null)
  assert.equal(readVehicleVoltage(pos(D, {}), D, { connected: false }), null)
})
