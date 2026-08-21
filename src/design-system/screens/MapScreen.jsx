import React, { useMemo, useState } from 'react'
import { LocateFixed } from 'lucide-react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { useApp } from '../../context/AppContext'
import { ClientLayout, Fab } from '../layout'
import VehicleBottomSheet from './VehicleBottomSheet'
import VehicleMarker from './VehicleMarker'
import { useRealVehicles } from '../hooks/useRealVehicles'

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
  selectedVehicleId,
  onSelectVehicle,
  alertCount = 0,
  onTabChange,
  showTopBar = true,
  title = 'الخريطة',
}) {
  const { unreadCount } = useApp()
  const { vehicles } = useRealVehicles()
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

  // Use unreadCount from context as fallback
  const finalAlertCount = alertCount || unreadCount || 0

  return (
    <ClientLayout
      activeTab="map"
      onTabChange={onTabChange}
      alertCount={finalAlertCount}
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
