// A coordinate pair is a real GPS location only when it is finite, inside the
// valid range and not the "no fix" 0,0 placeholder that trackers/Traccar use.
export function isValidCoordinate(lat, lng) {
  if (lat == null || lng == null || lat === '' || lng === '') return false
  const latitude = Number(lat)
  const longitude = Number(lng)
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180
    && !(Math.abs(latitude) < 0.01 && Math.abs(longitude) < 0.01)
}

function coordinatesOf(position) {
  if (!position) return null
  const latitude = position.latitude ?? position.lat
  const longitude = position.longitude ?? position.lng
  return isValidCoordinate(latitude, longitude)
    ? { latitude: Number(latitude), longitude: Number(longitude) }
    : null
}

/**
 * Choose the location to show for a vehicle.
 *  1. the live Traccar position, when its coordinates are a real fix;
 *  2. otherwise the last valid position stored for the device (works while the
 *     tracker is offline or reporting without a GPS fix);
 *  3. otherwise null - never an invented or 0,0 location.
 * `at` is when that GPS fix happened, `source` says where it came from.
 */
export function pickLocation(livePosition, storedPosition) {
  const live = coordinatesOf(livePosition)
  if (live) {
    return { ...live, source: 'live', at: livePosition.fixTime ?? livePosition.serverTime ?? null }
  }
  const stored = coordinatesOf(storedPosition)
  if (stored) {
    return { ...stored, source: 'stored', at: storedPosition.fixTime ?? storedPosition.last_update ?? null }
  }
  return null
}
