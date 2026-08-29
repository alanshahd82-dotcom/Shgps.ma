import React, { useEffect, useMemo, useState } from 'react'
import { LocateFixed } from 'lucide-react'
import { CircleMarker, MapContainer, Popup, useMap } from 'react-leaflet'
import MapTileLayer from '../../components/MapTileLayer'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { ClientLayout, Fab } from '../layout'
import VehicleBottomSheet from './VehicleBottomSheet'
import VehicleMarker from './VehicleMarker'
import { useRealVehicles } from '../hooks/useRealVehicles'
import FleetOverview from './FleetOverview'

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

function MapActions({ onLocate, isAr = true }) {
  return <Fab icon={<LocateFixed className="h-6 w-6" aria-hidden="true" />} onClick={onLocate} label={isAr ? 'تحديد موقعي' : 'Ma position'} variant="white" />
}

function EventFocus({ latitude, longitude }) {
  const map = useMap()
  useEffect(() => {
    if (latitude == null || longitude == null) return
    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), { duration: 0.8 })
  }, [latitude, longitude, map])
  return null
}

function FitVehicles({ vehicles, vehicleSetKey }) {
  const map = useMap()

  useEffect(() => {
    if (!vehicles.length) return
    const points = vehicles.map(vehicle => [vehicle.lat, vehicle.lng])
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 15), { animate: false })
      return
    }
    map.fitBounds(points, { padding: [44, 44], maxZoom: 16, animate: false })
  }, [map, vehicleSetKey])

  return null
}

function AlertEventMarker({ latitude, longitude, isAr = true }) {
  if (latitude == null || longitude == null) return null
  return (
    <CircleMarker center={[latitude, longitude]} radius={10} pathOptions={{ color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.75, weight: 3 }}>
      <Popup>
        <span className="text-xs font-semibold">{isAr ? 'موقع التنبيه' : "Lieu de l'alerte"}</span>
      </Popup>
    </CircleMarker>
  )
}

export function MapScreen({
  selectedVehicleId,
  onSelectVehicle,
  alertCount = 0,
  onTabChange,
  showTopBar = true,
  title,
}) {
  const { unreadCount, lang } = useApp()
  const isAr = lang !== 'fr'
  const screenTitle = title ?? (isAr ? 'الخريطة' : 'Carte')
  const { vehicles: allVehicles, loading, error } = useRealVehicles()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const eventLatitude = Number(searchParams.get('lat'))
  const eventLongitude = Number(searchParams.get('lng'))
  const hasEventLocation = Number.isFinite(eventLatitude) && Number.isFinite(eventLongitude)
    && eventLatitude >= -90 && eventLatitude <= 90
    && eventLongitude >= -180 && eventLongitude <= 180
    && !(Math.abs(eventLatitude) < 0.01 && Math.abs(eventLongitude) < 0.01)
  const vehicles = useMemo(
    () => allVehicles.filter(vehicle => Number.isFinite(vehicle.lat) && Number.isFinite(vehicle.lng) && (vehicle.lat !== 0 || vehicle.lng !== 0)),
    [allVehicles],
  )
  const vehicleSetKey = useMemo(
    () => vehicles.map(vehicle => String(vehicle.id)).sort().join(','),
    [vehicles],
  )
  const [internalSelectedId, setInternalSelectedId] = useState(() => searchParams.get('device'))
  const [stage, setStage] = useState('peek')
  const selectedId = selectedVehicleId ?? internalSelectedId
  const selectedVehicle = useMemo(() => vehicles.find(vehicle => String(vehicle.id) === String(selectedId)), [selectedId, vehicles])

  useEffect(() => {
    const requestedId = searchParams.get('device')
    if (requestedId) setInternalSelectedId(requestedId)
  }, [searchParams])

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
      activeTab="home"
      onTabChange={onTabChange}
      alertCount={finalAlertCount}
      showTopBar={showTopBar}
      title={screenTitle}
      topBarTransparent
      onBack={searchParams.get('alert') ? () => navigate(-1) : undefined}
      sheet={selectedVehicle ? <VehicleBottomSheet vehicle={selectedVehicle} stage={stage} onStageChange={setStage} onClose={handleClose} /> : null}
    >
      <div className="relative h-full w-full">
        <FleetOverview />
        <MapContainer center={[33.5731, -7.5898]} zoom={13} zoomControl={false} preferCanvas className="h-full w-full">
          <MapTileLayer />
          <FitVehicles vehicles={vehicles} vehicleSetKey={vehicleSetKey} />
          <EventFocus latitude={hasEventLocation ? eventLatitude : null} longitude={hasEventLocation ? eventLongitude : null} />
          <AlertEventMarker isAr={isAr} latitude={hasEventLocation ? eventLatitude : null} longitude={hasEventLocation ? eventLongitude : null} />
          {vehicles.map(vehicle => (
            <VehicleMarker key={vehicle.id} vehicle={{ ...vehicle, selected: vehicle.id === selectedId }} onClick={() => handleSelect(vehicle.id)} />
          ))}
          <LocateButton isAr={isAr} />
        </MapContainer>
          {loading && (
            <div className="pointer-events-none absolute inset-x-4 top-1/2 z-[500] -translate-y-1/2 rounded-2xl border border-slate-200 bg-white/95 p-5 text-center shadow-lg" role="status" dir={isAr ? 'rtl' : 'ltr'}>
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-accent" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-primary">{isAr ? 'جاري تحميل المركبات' : 'Chargement des véhicules'}</p>
            </div>
          )}
          {!loading && error && (
            <div className="pointer-events-none absolute inset-x-4 top-1/2 z-[500] -translate-y-1/2 rounded-2xl border border-red-200 bg-red-50/95 p-5 text-center shadow-lg" role="alert" dir={isAr ? 'rtl' : 'ltr'}>
              <p className="text-sm font-semibold text-red-700">{isAr ? 'تعذّر تحميل المركبات' : 'Impossible de charger les véhicules'}</p>
              <p className="mt-1 text-xs text-red-600">{isAr ? 'تحقق من الاتصال وحاول مرة أخرى.' : 'Vérifiez la connexion et réessayez.'}</p>
            </div>
          )}
          {!loading && !error && allVehicles.length === 0 && (
            <div className="pointer-events-none absolute inset-x-4 top-1/2 z-[500] -translate-y-1/2 rounded-2xl border border-slate-200 bg-white/95 p-5 text-center shadow-lg" role="status" dir={isAr ? 'rtl' : 'ltr'}>
              <p className="text-sm font-semibold text-primary">{isAr ? 'لا توجد مركبات مرتبطة' : 'Aucun véhicule associé'}</p>
              <p className="mt-1 text-xs text-slate-500">{isAr ? 'ستظهر المركبات هنا عند توفر أجهزة تتبع مرتبطة بحسابك.' : 'Les véhicules apparaîtront ici dès qu’un traceur sera lié à votre compte.'}</p>
            </div>
          )}
          {!loading && !error && allVehicles.length > 0 && vehicles.length === 0 && (
            <div className="pointer-events-none absolute inset-x-4 top-1/2 z-[500] -translate-y-1/2 rounded-2xl border border-slate-200 bg-white/95 p-5 text-center shadow-lg" role="status" dir={isAr ? 'rtl' : 'ltr'}>
              <p className="text-sm font-semibold text-primary">{isAr ? 'الموقع غير متاح' : 'Position indisponible'}</p>
              <p className="mt-1 text-xs text-slate-500">{isAr ? 'لا تتوفر إحداثيات صالحة للمركبات حالياً.' : 'Aucune coordonnée valide pour le moment.'}</p>
            </div>
          )}
      </div>
    </ClientLayout>
  )
}

function LocateButton({ isAr = true }) {
  const locate = LocateControl()
  return <MapActions onLocate={locate} isAr={isAr} />
}

export default MapScreen
