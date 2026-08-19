import React, { useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { Car } from 'lucide-react'

function getMarkerState(vehicle) {
  if (!vehicle.charge && vehicle.status === 'offline') return 'danger'
  if (vehicle.alerts?.length > 0) return 'alert'
  if (vehicle.speed > 5) return 'moving'
  if (vehicle.status === 'online') return 'idle-online'
  return 'offline'
}

const stateStyles = {
  moving: { background: 'bg-emerald-500', text: 'text-white' },
  'idle-online': { background: 'bg-blue-500', text: 'text-white' },
  alert: { background: 'bg-amber-500', text: 'text-white' },
  danger: { background: 'bg-red-500', text: 'text-white' },
  offline: { background: 'bg-slate-700', text: 'text-white' },
}

export function VehicleMarker({ vehicle, onClick }) {
  const markerState = getMarkerState(vehicle)
  const selected = Boolean(vehicle.selected)
  const size = selected ? 48 : 40
  const style = stateStyles[markerState]

  const icon = useMemo(() => {
    const element = document.createElement('div')
    element.className = `flex items-center justify-center rounded-full border-[3px] border-white shadow-md transition-all ${style.background} ${style.text} ${selected ? 'ring-4 ring-accent/30' : ''}`
    element.style.width = `${size}px`
    element.style.height = `${size}px`
    createRoot(element).render(<Car className={selected ? 'h-6 w-6' : 'h-5 w-5'} strokeWidth={2.5} aria-hidden="true" />)
    return L.divIcon({
      className: 'athar-vehicle-marker',
      html: element,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    })
  }, [selected, size, style.background, style.text])

  return (
    <Marker position={[vehicle.lat, vehicle.lng]} icon={icon} eventHandlers={{ click: onClick }}>
      <Tooltip direction="top" offset={[0, -size / 2]} opacity={0.95}>
        <div dir="rtl" className="text-right">
          <strong className="block">{vehicle.name}</strong>
          {vehicle.lastUpdate && <span className="text-xs text-slate-500">{vehicle.lastUpdate}</span>}
        </div>
      </Tooltip>
    </Marker>
  )
}

export default VehicleMarker