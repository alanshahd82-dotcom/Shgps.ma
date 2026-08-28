// Single source of truth for "is this vehicle moving?" across the whole UI.
//
// Before this module every screen used its own threshold: 2 km/h in the device
// list and the backend trip reports, but 5 km/h on the map markers and on the
// fleet overview. The same vehicle could therefore be shown as moving on one
// screen and stopped on another. The tracker `motion` flag was ignored too.
//
// Rules:
//   - the tracker `motion` flag wins when it is explicitly reported as true
//   - otherwise a speed at or above MOVING_SPEED_KMH means moving
// Keep MOVING_SPEED_KMH identical to the backend reports threshold (2 km/h).
export const MOVING_SPEED_KMH = 2

export function readMotionFlag(source) {
  const raw = source?.motion ?? source?.attributes?.motion
  if (raw === true || raw === 1) return true
  if (raw === false || raw === 0) return false
  if (typeof raw === 'string') {
    const value = raw.trim().toLowerCase()
    if (['true', '1', 'yes', 'on', 'moving'].includes(value)) return true
    if (['false', '0', 'no', 'off', 'stopped'].includes(value)) return false
  }
  return null
}

export function readSpeedKmh(source) {
  const value = Number(source?.speed ?? source?.last_speed)
  return Number.isFinite(value) ? value : null
}

/**
 * True when the vehicle is moving right now.
 * `motion: true` is authoritative; speed is the fallback for the many GT06
 * trackers that never send a motion flag at all.
 */
export function isMoving(source) {
  if (readMotionFlag(source) === true) return true
  const speed = readSpeedKmh(source)
  return speed !== null && speed >= MOVING_SPEED_KMH
}
