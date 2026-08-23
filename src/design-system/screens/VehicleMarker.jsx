import React, { useMemo } from 'react'
import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { markerFor } from '../../utils/vehicleAssets'

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
  if (!Number.isFinite(vehicle.lat) || !Number.isFinite(vehicle.lng) || (vehicle.lat === 0 && vehicle.lng === 0)) return null
  const markerState = getMarkerState(vehicle)
  const selected = Boolean(vehicle.selected)
  const size = selected ? 48 : 40
  const style = stateStyles[markerState]
  const marker = markerFor(vehicle.type)

  const icon = useMemo(() => {
    const element = document.createElement('div')
    element.className = `flex items-center justify-center transition-all ${selected ? 'ring-4 ring-accent/30' : ''}`
    element.style.width = `${size}px`
    element.style.height = `${size}px`
    element.innerHTML = `<img src="${marker.url}" alt="" style="display:block;width:${size}px;height:${Math.round(size * 2 / 3)}px;object-fit:contain;filter:drop-shadow(0 3px 5px rgba(0,0,0,.5));transform:rotate(${marker.offset}deg)" />`
    return L.divIcon({
      className: 'athar-vehicle-marker',
      html: element,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    })
  }, [marker.url, marker.offset, selected, size, style.background, style.text])

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