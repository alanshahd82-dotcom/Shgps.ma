// Signal strength utility — extracted from VehicleCard for unit testing.
// GT06 protocol reports rssi on a 0-5 scale; other protocols may use dBm
// (negative) or percentage (0-100). This handler covers all three.

export function signalToBars(signal) {
  const s = Number(signal)
  if (!Number.isFinite(s)) return 0
  if (s < 0) {
    // dBm (negative, typical for GSM RSSI)
    if (s >= -60) return 4
    if (s >= -80) return 3
    if (s >= -100) return 2
    if (s >= -110) return 1
    return 0
  }
  // GT06 protocol reports rssi on a 0-5 scale (0=no signal, 5=excellent).
  // Map directly to bars so rssi=3 shows 3 bars, not 1.
  if (s <= 5) return Math.min(4, Math.round(s))
  // Larger positive values are treated as percentage (0-100)
  if (s >= 75) return 4
  if (s >= 50) return 3
  if (s >= 25) return 2
  if (s > 0) return 1
  return 0
}

export function signalColor(bars) {
  if (bars >= 3) return '#22c55e'
  if (bars === 2) return '#f59e0b'
  if (bars === 1) return '#ef4444'
  return '#cbd5e1'
}
