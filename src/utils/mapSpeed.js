// Minimal transparent speed text logic for the live map marker.
// Shared between LiveVehicleMarker.jsx and backend tests so the speed
// badge behavior is verified without a browser environment.
//
// Rules:
// - Moving vehicle  -> show current speed (e.g. 23 km/h)
// - Stopped vehicle -> show 0 km/h
// - Offline / power-disconnected -> hide (never show stale speed)
// - Speed data unavailable (null/undefined/NaN) -> hide
//
// This module is PURE: it never touches the map, camera, zoom, or marker
// coordinates. It only computes the speed value and transparent text HTML.
// No background, no container, no border — text treatment only.

export function speedDisplay(device, status) {
  if (status === 'offline' || device?.powerDisconnected) return null
  if (device?.speed == null) return null
  const raw = Number(device?.speed)
  if (!Number.isFinite(raw)) return null
  const kmh = Math.max(0, Math.round(raw))
  const unit = device?.lang === 'fr' ? 'km/h' : 'كم/س'
  return { kmh, unit }
}

export function speedBadgeHtml(device, status) {
  const speed = speedDisplay(device, status)
  if (!speed) return '<span data-live-speed class="athar-live-speed is-hidden"></span>'
  return '<span data-live-speed class="athar-live-speed">' +
    '<span data-live-speed-num class="athar-live-speed__num">' + speed.kmh + '</span>' +
    '<span class="athar-live-speed__unit">' + speed.unit + '</span>' +
    '</span>'
}
