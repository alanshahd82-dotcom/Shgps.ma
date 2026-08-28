import React, { useMemo } from 'react'
import { Tooltip } from 'react-leaflet'
import LiveVehicleMarker from '../../components/LiveVehicleMarker'
import { useApp } from '../../context/AppContext'

/**
 * Client map marker.
 *
 * This component is kept as a thin compatibility wrapper: the verified marker
 * behaviour (official artwork, type-aware size, bottom-center GPS anchor,
 * real-course rotation with shortest-turn handling and smooth interpolation
 * between REAL positions only) lives in `src/components/LiveVehicleMarker.jsx`
 * and is shared with the admin map. No marker logic is duplicated here.
 */
export function VehicleMarker({ vehicle, onClick }) {
  const { lang } = useApp()

  // Map the design-system vehicle shape onto the device shape consumed by the
  // shared live marker. Only real GPS values are forwarded — nothing synthetic.
  const device = useMemo(() => ({
    ...vehicle,
    lang: lang || 'ar',
    course: vehicle?.course ?? vehicle?._raw?.course,
    type: vehicle?.type,
    engineOn: vehicle?.ignition ?? vehicle?._raw?.engineOn,
  }), [vehicle, lang])

  if (!vehicle) return null

  const selected = Boolean(vehicle.selected)

  return (
    <LiveVehicleMarker
      device={device}
      isSelected={selected}
      onClick={() => onClick?.()}
    >
      {!selected && (
        <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
          <div dir="rtl" className="text-right">
            <strong className="block">{vehicle.name}</strong>
            {vehicle.lastUpdateFormatted && <span className="text-xs text-slate-500">{vehicle.lastUpdateFormatted}</span>}
          </div>
        </Tooltip>
      )}
    </LiveVehicleMarker>
  )
}

export default VehicleMarker
