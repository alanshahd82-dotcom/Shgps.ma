import { toValidLatLng } from './mapSafety'

// The single rule for "does this vehicle have a real location?": finite,
// in range and not the 0,0 "no fix" placeholder. Everything in the user app
// must go through this instead of printing raw lat/lng.
export function vehiclePoint(vehicle) {
  return toValidLatLng([
    vehicle?.lat ?? vehicle?.latitude ?? vehicle?.last_lat,
    vehicle?.lng ?? vehicle?.longitude ?? vehicle?.last_lng,
  ])
}

/**
 * What to tell the user about a vehicle's position:
 *  point      - [lat, lng] or null (never 0,0)
 *  lastKnown  - the point is not a live fix (vehicle offline, or stored fix)
 *  noGps      - the tracker is connected but currently has no GPS fix
 *  at         - when that position was recorded (ISO) if known
 */
export function locationState(vehicle) {
  const point = vehiclePoint(vehicle)
  const online = vehicle?.status === 'online'
  const lastKnown = Boolean(point) && (!online || vehicle?.locationSource === 'stored')
  const noGps = online && Boolean(point) && vehicle?.gpsValid === false
  return {
    point,
    lastKnown,
    noGps,
    at: point ? (vehicle?.locationAt ?? vehicle?.fixTime ?? vehicle?.lastUpdate ?? null) : null,
  }
}

// "3 h ago" style label, Arabic or French, for last contact / last position.
export function agoLabel(iso, lang = 'ar') {
  if (!iso) return null
  const time = new Date(iso).getTime()
  if (!Number.isFinite(time)) return null
  const ar = lang !== 'fr'
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000))
  if (minutes < 1) return ar ? 'الآن' : "à l'instant"
  if (minutes < 60) return ar ? `منذ ${minutes} د` : `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return ar ? `منذ ${hours} س` : `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return ar ? `منذ ${days} ي` : `il y a ${days} j`
}
