// Vehicle marker dimensions — extracted so the size contract is unit-testable.
// Only the rendered marker dimensions live here; map camera, zoom, follow,
// and position behavior are NOT affected by these values.
export const MARKER_SIZE = { bike: 88, car: 96, truck: 108 }
export const SELECTED_BOOST = 10
export const MARKER_ASPECT_RATIO = 1024 / 1536

// Keep the artwork readable on phones without allowing it to dominate a
// close-up map or disappear when the fleet is viewed from farther away.
// This is a PURE visual scale — it never calls setView/flyTo/fitBounds/panBy.
export function markerScaleForZoom(zoom) {
  return Math.max(0.78, Math.min(1.12, 0.86 + (Number(zoom) - 12) * 0.04))
}
