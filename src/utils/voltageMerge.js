// Phase 2H-2: pure voltage-merge helper used by the device snapshot merge.
//
// Kept free of React/JSX so it is unit-testable under node:test. The 30 s
// /devices poll sends voltage=null when a device is stale; a plain
// {...current, ...incoming} would wipe a previously known good reading.
// The live WS position handler already uses `?? current.voltage` — this
// mirrors that pattern so the poll cannot null a known voltage, while a
// fresh non-null voltage from the backend still wins.
//
// `lastVoltageAt` is only meaningful while the reading is stale; when the
// backend reports a fresh value (voltageStale=false) it is cleared.

export function mergeVoltageFields(current, incoming) {
  const voltageStale = incoming.voltageStale ?? current?.voltageStale ?? false
  return {
    voltage: incoming.voltage ?? current?.voltage ?? null,
    voltageStale,
    lastVoltageAt: voltageStale ? (incoming.lastVoltageAt ?? current?.lastVoltageAt ?? null) : null,
  }
}
