// Phase 2H-1 - Strict notification/event policy.
//
// The Traccar WebSocket forwards every device event (connectivity, alarms,
// ignition, geofence, overspeed, ...). Only a small subset is a genuine
// USER-FACING alert that should enter the notification stream. Everything
// else is telemetry/connectivity state and must NOT become a notification.
//
// This is an ALLOWLIST (not a blocklist): any Traccar event type not listed
// here is rejected by default, so a new Traccar event type can never silently
// start producing user notifications.
//
// Power-disconnected / power-restored alerts are NOT part of this stream:
// they are produced exclusively by the dedicated power-alert engine
// (services/powerAlerts.js) and delivered over the dedicated
// `device:power-disconnected` / `device:power-restored` WebSocket messages.
// A raw Traccar `alarm` event (powerCut, lowBattery, ...) is never a confirmed
// power alert and is rejected here.

// Traccar event `type` values that are genuine, validated user alerts the
// application explicitly supports. Each entry is justified below.
export const USER_ALERT_EVENT_TYPES = new Set([
  // Overspeed - surfaced as a speeding alert (Alerts.jsx ALERT_CFG.speeding,
  // driverBehavior speeding_events). Traccar emits this only when a computed
  // speed exceeds the device's configured speed limit.
  'deviceOverspeed',
  // Geofence enter/exit - surfaced as geofence alerts (Alerts.jsx
  // ALERT_CFG.geofence_enter / geofence_exit, Geofences page). Traccar emits
  // these only for configured geofences.
  'geofenceEnter',
  'geofenceExit',
])

// Traccar event `type` values that are explicitly REJECTED as user alerts,
// with the reason each cannot be a notification. This set is documentation -
// enforcement is the allowlist above (default-deny), so a type missing from
// USER_ALERT_EVENT_TYPES is rejected even if it is not named here.
export const REJECTED_EVENT_TYPES = new Set([
  'deviceOnline',    // connectivity state - not a user alert
  'deviceOffline',   // connectivity state - not a user alert
  'deviceMoving',    // movement state - derived from positions, not an alert
  'deviceStopped',   // movement state - derived from positions, not an alert
  'alarm',           // generic alarm (powerCut/lowBattery/sos/...): no validated
                     // application rule turns a raw alarm into a user alert.
                     // powerCut is handled by the dedicated power-alert engine
                     // via telemetry, not via this event stream.
  'ignitionOn',      // ignition state - not a power-disconnect alert
  'ignitionOff',     // ignition state - not a power-disconnect alert
  'maintenance',     // not surfaced by the application
  'driverChanged',   // not surfaced by the application
])

// True when the Traccar event is a genuine user-facing alert that may enter
// the notification stream.
export function isUserAlertEvent(event) {
  if (!event || typeof event !== 'object') return false
  return USER_ALERT_EVENT_TYPES.has(event.type)
}

// Returns only the events that pass the user-alert allowlist. Preserves order
// and duplicates verbatim - deduplication is the frontend's responsibility
// (seenEventIdsRef in AppContext) and remains intact.
export function filterUserAlertEvents(events) {
  if (!Array.isArray(events)) return []
  return events.filter(isUserAlertEvent)
}
