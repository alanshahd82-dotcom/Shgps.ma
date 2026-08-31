// Phase 2H-1 - Strict notification/event policy (frontend defensive copy).
//
// The backend WS bridge filters the Traccar event stream through the same
// allowlist before forwarding to clients. This module is a defensive second
// layer: even if a raw event reaches the frontend by another path, it can
// never become a user notification unless its type is explicitly allowed.
//
// Power-disconnected / power-restored alerts travel on the dedicated
// device:power-disconnected / device:power-restored WebSocket messages and
// are NOT part of this event stream.
//
// Keep this list in sync with backend/src/services/eventPolicy.js.

export const USER_ALERT_EVENT_TYPES = new Set([
  'deviceOverspeed',
  'geofenceEnter',
  'geofenceExit',
])

export function isUserAlertEvent(event) {
  if (!event || typeof event !== 'object') return false
  return USER_ALERT_EVENT_TYPES.has(event.type)
}

export function filterUserAlertEvents(events) {
  if (!Array.isArray(events)) return []
  return events.filter(isUserAlertEvent)
}
