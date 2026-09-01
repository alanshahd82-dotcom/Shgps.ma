import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveDeviceStatus, positionIsFresh, positionIsSilent, POWER_SILENCE_WINDOW_MS } from '../src/services/vehicleTelemetry.js'

test('Traccar online -> online, even with stale position', () => {
  const td = { status: 'online', lastUpdate: new Date().toISOString() }
  const stalePosition = { fixTime: new Date(Date.now() - 60 * 60 * 1000).toISOString() }
  assert.equal(resolveDeviceStatus(td, stalePosition), 'online')
})

test('Traccar online -> online, even with no position at all', () => {
  const td = { status: 'online', lastUpdate: new Date().toISOString() }
  assert.equal(resolveDeviceStatus(td, null), 'online')
})

test('Traccar online -> online, even with null fixTime', () => {
  const td = { status: 'online' }
  const pos = { fixTime: null, serverTime: null }
  assert.equal(resolveDeviceStatus(td, pos), 'online')
})

test('Traccar offline -> offline, even with fresh position', () => {
  const td = { status: 'offline' }
  const freshPosition = { fixTime: new Date().toISOString() }
  assert.equal(resolveDeviceStatus(td, freshPosition), 'offline')
})

test('Traccar offline -> offline, with no position', () => {
  const td = { status: 'offline' }
  assert.equal(resolveDeviceStatus(td, null), 'offline')
})

test('No Traccar device + fresh position -> online (fallback)', () => {
  const freshPosition = { serverTime: new Date().toISOString() }
  assert.equal(resolveDeviceStatus(null, freshPosition), 'online')
})

test('No Traccar device + stale position -> offline (fallback)', () => {
  const stalePosition = { fixTime: new Date(Date.now() - 60 * 60 * 1000).toISOString() }
  assert.equal(resolveDeviceStatus(null, stalePosition), 'offline')
})

test('No Traccar device + no position -> offline (fallback)', () => {
  assert.equal(resolveDeviceStatus(null, null), 'offline')
})

test('Traccar status unknown + fresh position -> online (fallback)', () => {
  const td = { status: 'unknown' }
  const freshPosition = { serverTime: new Date().toISOString() }
  assert.equal(resolveDeviceStatus(td, freshPosition), 'online')
})

test('Traccar status unknown + stale position -> offline (fallback)', () => {
  const td = { status: 'unknown' }
  const stalePosition = { fixTime: new Date(Date.now() - 60 * 60 * 1000).toISOString() }
  assert.equal(resolveDeviceStatus(td, stalePosition), 'offline')
})

test('Heartbeat: Traccar online with no GPS fix -> online', () => {
  const td = { status: 'online', lastUpdate: new Date().toISOString() }
  assert.equal(resolveDeviceStatus(td, null), 'online')
})

test('Status packet: Traccar online with old fixTime -> online', () => {
  const td = { status: 'online', lastUpdate: new Date().toISOString() }
  const pos = { fixTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }
  assert.equal(resolveDeviceStatus(td, pos), 'online')
})

test('GPS position: fresh position with Traccar online -> online', () => {
  const td = { status: 'online' }
  const pos = { fixTime: new Date().toISOString(), serverTime: new Date().toISOString() }
  assert.equal(resolveDeviceStatus(td, pos), 'online')
})

test('Old fixTime with Traccar online -> online (not offline)', () => {
  const td = { status: 'online' }
  const pos = { fixTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() }
  assert.equal(resolveDeviceStatus(td, pos), 'online')
})

test('Old fixTime with no Traccar device -> offline (fallback)', () => {
  const pos = { fixTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() }
  assert.equal(resolveDeviceStatus(null, pos), 'offline')
})

test('Device becomes offline when Traccar says offline', () => {
  const td = { status: 'offline' }
  const oldPos = { fixTime: new Date(Date.now() - 60 * 60 * 1000).toISOString() }
  assert.equal(resolveDeviceStatus(td, oldPos), 'offline')
})

test('Device stays online while Traccar says online, regardless of position age', () => {
  const td = { status: 'online' }
  const oldPos = { fixTime: new Date(Date.now() - 60 * 60 * 1000).toISOString() }
  assert.equal(resolveDeviceStatus(td, oldPos), 'online')
  const veryOldPos = { fixTime: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() }
  assert.equal(resolveDeviceStatus(td, veryOldPos), 'online')
  assert.equal(resolveDeviceStatus(td, null), 'online')
})

test('Reconnect: Traccar transitions from offline to online -> online', () => {
  const tdOffline = { status: 'offline' }
  assert.equal(resolveDeviceStatus(tdOffline, null), 'offline')
  const tdOnline = { status: 'online', lastUpdate: new Date().toISOString() }
  assert.equal(resolveDeviceStatus(tdOnline, null), 'online')
})

test('Fresh serverTime with old fixTime -> online when Traccar unavailable', () => {
  const pos = {
    serverTime: new Date().toISOString(),
    fixTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  }
  assert.equal(resolveDeviceStatus(null, pos), 'online')
})

test('Fresh deviceTime with old fixTime -> online when Traccar unavailable', () => {
  const pos = {
    deviceTime: new Date().toISOString(),
    fixTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  }
  assert.equal(resolveDeviceStatus(null, pos), 'online')
})

test('Multiple devices: each has independent status', () => {
  const tdOnline = { status: 'online', id: 1 }
  const tdOffline = { status: 'offline', id: 2 }
  const tdUnknown = { status: 'unknown', id: 3 }
  assert.equal(resolveDeviceStatus(tdOnline, null), 'online')
  assert.equal(resolveDeviceStatus(tdOffline, null), 'offline')
  assert.equal(resolveDeviceStatus(tdUnknown, null), 'offline')
  const freshPos = { serverTime: new Date().toISOString() }
  assert.equal(resolveDeviceStatus(tdUnknown, freshPos), 'online')
})
