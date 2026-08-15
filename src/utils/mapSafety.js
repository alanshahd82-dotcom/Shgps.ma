function readCoordinate(point, keys) {
  for (const key of keys) {
    const value = Array.isArray(point)
      ? point[key === 'lat' ? 0 : 1]
      : point?.[key]
    if (value == null || value === '') continue
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return null
}

/**
 * Convert an API/device/location value into a Leaflet-safe [lat, lng] tuple.
 * Invalid, out-of-range, and empty 0,0 coordinates are intentionally ignored.
 */
export function toValidLatLng(point) {
  const lat = readCoordinate(point, ['lat', 'latitude', 'last_lat'])
  const lng = readCoordinate(point, ['lng', 'longitude', 'last_lng'])
  if (
    lat == null ||
    lng == null ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)
  ) {
    return null
  }
  return [lat, lng]
}

export function isMapReadyAndSized(map) {
  try {
    const size = map?.getSize?.()
    return Boolean(map?._loaded && size?.x > 0 && size?.y > 0)
  } catch {
    return false
  }
}

export function safelyUseMap(map, action) {
  if (!isMapReadyAndSized(map)) return false
  try {
    action(map)
    return true
  } catch {
    return false
  }
}

export function safelyUseMarker(marker, action) {
  if (!marker) return false
  try {
    action(marker)
    return true
  } catch {
    return false
  }
}