const VOLTAGE_ATTRIBUTE_KEYS = [
  'voltage',
  'power',
  'externalPower',
  'adc1',
  'adc',
  'analog1',
  'vbat',
  'supply',
]

function toFinitePositiveNumber(raw) {
  if (raw == null || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

function isBatteryVoltage(value) {
  return value >= 9 && value <= 15
}

/**
 * Return only a voltage explicitly reported by the tracker.
 *
 * `batteryLevel` is deliberately excluded because Traccar exposes it as a
 * percentage. Some GT06 firmware uses `battery` for either a percentage or
 * a voltage, so that field is accepted only when it looks like car voltage.
 */
export function extractReportedVoltage(position) {
  const attributes = position?.attributes || {}

  for (const key of VOLTAGE_ATTRIBUTE_KEYS) {
    const value = toFinitePositiveNumber(attributes[key])
    if (value !== null) return value
  }

  const batteryValue = toFinitePositiveNumber(attributes.battery)
  return batteryValue !== null && isBatteryVoltage(batteryValue) ? batteryValue : null
}

export function readBatteryLevel(position) {
  const attributes = position?.attributes || {}
  const raw = attributes.batteryLevel ?? (
    isBatteryVoltage(Number(attributes.battery)) ? undefined : attributes.battery
  )
  const value = raw == null || raw === '' ? NaN : Number(raw)
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null
}