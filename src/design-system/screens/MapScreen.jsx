import React, { useMemo, useState } from 'react'
import { LocateFixed } from 'lucide-react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { ClientLayout, Fab } from '../layout'
import VehicleBottomSheet from './VehicleBottomSheet'
import VehicleMarker from './VehicleMarker'

const defaultVehicles = [
  {
    id: 16,
    name: 'DACIA',
    status: 'online',
    lat: 33.5731,
    lng: -7.5898,
    speed: 0,
    battery: 85,
    charge: true,
    ignition: false,
    lastUpdate: 'منذ دقيقتين',
  },
  {
    id: 14,
    name: 'bekane',
    status: 'offline',
    lat: 33.58,
    lng: -7.6,
    speed: 0,
    battery: 45,
    charge: false,
    ignition: false,
    lastUpdate: 'منذ ساعة',
  },
]

function LocateControl() {
  const map = useMap()
  const locate = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => map.flyTo([coords.latitude, coords.longitude], 15, { duration: 0.8 }),
      () => map.setView([33.5731, -7.5898], 13),
    )
  }
  return locate
}

function MapActions({ onLocate }) {
  return <Fab icon={<LocateFixed className="h-6 w-6" aria-hidden="true" />} onClick={onLocate} label="تحديد موقعي" variant="white" />
}

export function MapScreen({
  vehicles = defaultVehicles,
  selectedVehicleId,
  onSelectVehicle,
  alertCount = 0,
  onTabChange,
  showTopBar = true,
  title = 'الخريطة',
}) {
  const [internalSelectedId, setInternalSelectedId] = useState(null)
  const [stage, setStage] = useState('peek')
  const selectedId = selectedVehicleId ?? internalSelectedId
  const selectedVehicle = useMemo(() => vehicles.find(vehicle => vehicle.id === selectedId), [selectedId, vehicles])

  const handleSelect = id => {
    setInternalSelectedId(id)
    onSelectVehicle?.(id)
    setStage('peek')
  }
  const handleClose = () => {
    setInternalSelectedId(null)
    onSelectVehicle?.(null)
  }

  return (
    <ClientLayout
      activeTab="map"
      onTabChange={onTabChange}
      alertCount={alertCount}
      showTopBar={showTopBar}
      title={title}
      topBarTransparent
      sheet={selectedVehicle ? <VehicleBottomSheet vehicle={selectedVehicle} stage={stage} onStageChange={setStage} onClose={handleClose} /> : null}
    >
      <div className="relative h-full w-full">
        <MapContainer center={[33.5731, -7.5898]} zoom={13} zoomControl={false} preferCanvas className="h-full w-full">
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
          {vehicles.map(vehicle => (
            <VehicleMarker key={vehicle.id} vehicle={{ ...vehicle, selected: vehicle.id === selectedId }} onClick={() => handleSelect(vehicle.id)} />
          ))}
          <LocateButton />
        </MapContainer>
      </div>
    </ClientLayout>
  )
}

function LocateButton() {
  const locate = LocateControl()
  return <MapActions onLocate={locate} />
}

export default MapScreen