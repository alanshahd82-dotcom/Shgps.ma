// Traccar reports speed in knots; the ATHAR GPS UI displays km/h.
export function speedKmh(speed) {
  const value = Number(speed)
  return Number.isFinite(value) ? Math.max(0, value * 1.852) : 0
}