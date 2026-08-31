// Phase 2H-1 - Tests for the strict notification/event policy.
// Verifies that raw Traccar connectivity/alarm/ignition events never become
// user notifications, while genuine application alerts (overspeed, geofence)
// and the dedicated power-alert path remain intact.
//
// No real device commands are issued by these tests.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  USER_ALERT_EVENT_TYPES,
  REJECTED_EVENT_TYPES,
  isUserAlertEvent,
  filterUserAlertEvents,
} from '../src/services/eventPolicy.js'

const DEVICE_ID = 77

function ev(type, extra = {}) {
  return { id: 1000, type, deviceId: DEVICE_ID, eventTime: '2026-08-31T17:00:00Z', ...extra }
}

// 1. deviceOffline -> no notification
test('deviceOffline is rejected', () => {
  assert.equal(isUserAlertEvent(ev('deviceOffline')), false)
})

// 2. deviceOnline -> no notification
test('deviceOnline is rejected', () => {
  assert.equal(isUserAlertEvent(ev('deviceOnline')), false)
})

// 3. alarm:powerCut -> no notification (and never a power-disconnected alert)
test('alarm:powerCut is rejected and cannot become a power-disconnected alert', () => {
  assert.equal(isUserAlertEvent(ev('alarm', { attributes: { alarm: 'powerCut' } })), false)
  assert.equal(USER_ALERT_EVENT_TYPES.has('power_disconnected'), false)
})

// 4. alarm:lowBattery -> no notification (no validated rule for it)
test('alarm:lowBattery is rejected', () => {
  assert.equal(isUserAlertEvent(ev('alarm', { attributes: { alarm: 'lowBattery' } })), false)
})

// 5. ignition events -> no power-disconnect notification
test('ignitionOn / ignitionOff are rejected', () => {
  assert.equal(isUserAlertEvent(ev('ignitionOn')), false)
  assert.equal(isUserAlertEvent(ev('ignitionOff')), false)
})

// 6. genuine application alerts still appear
test('deviceOverspeed, geofenceEnter, geofenceExit are accepted', () => {
  assert.equal(isUserAlertEvent(ev('deviceOverspeed')), true)
  assert.equal(isUserAlertEvent(ev('geofenceEnter')), true)
  assert.equal(isUserAlertEvent(ev('geofenceExit')), true)
})

// 7. genuine power-disconnected application event remains on its dedicated path
test('the events stream does not carry power_disconnected / power_restored', () => {
  assert.equal(USER_ALERT_EVENT_TYPES.has('power_disconnected'), false)
  assert.equal(USER_ALERT_EVENT_TYPES.has('power_restored'), false)
})

// 8. duplicate stable event ID -> filter keeps copies; dedup stays downstream
test('filterUserAlertEvents preserves duplicates for downstream dedup', () => {
  const e = ev('deviceOverspeed', { id: 555 })
  const out = filterUserAlertEvents([e, e, e])
  assert.equal(out.length, 3, 'filter keeps all copies; dedup is the frontend job')
  assert.deepEqual(out, [e, e, e])
})

// 9. reconnect / replayed rejected events -> zero new notifications
test('a reconnect burst of rejected events yields zero accepted events', () => {
  const burst = [
    ev('deviceOffline', { id: 1 }),
    ev('deviceOnline', { id: 2 }),
    ev('alarm', { id: 3, attributes: { alarm: 'powerCut' } }),
    ev('alarm', { id: 4, attributes: { alarm: 'lowBattery' } }),
    ev('ignitionOn', { id: 5 }),
    ev('ignitionOff', { id: 6 }),
    ev('deviceMoving', { id: 7 }),
    ev('deviceStopped', { id: 8 }),
  ]
  assert.equal(filterUserAlertEvents(burst).length, 0)
})

// 10. no engine-command paths are involved
test('eventPolicy does not surface engine-command types', () => {
  assert.equal(USER_ALERT_EVENT_TYPES.has('engine_stop'), false)
  assert.equal(USER_ALERT_EVENT_TYPES.has('engine_restore'), false)
})

// Defensive: non-object / unknown types are rejected (default-deny)
test('unknown and malformed events are rejected', () => {
  assert.equal(isUserAlertEvent(null), false)
  assert.equal(isUserAlertEvent(undefined), false)
  assert.equal(isUserAlertEvent({}), false)
  assert.equal(isUserAlertEvent(ev('someNewTraccarType')), false)
})

// Rejected-type documentation stays in sync with the allowlist
test('REJECTED_EVENT_TYPES does not overlap USER_ALERT_EVENT_TYPES', () => {
  for (const t of USER_ALERT_EVENT_TYPES) {
    assert.equal(REJECTED_EVENT_TYPES.has(t), false)
  }
})
