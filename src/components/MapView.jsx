import React, { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useApp } from '../context/AppContext'
import { t } from '../i18n/translations'

// Custom device icons
function createDeviceIcon(type, isSelected = false) {
  const colors = {
    car: { bg: '#0F2044', border: '#00D97E', emoji: '🚗' },
    bike: { bg: '#FF9500', border: '#fff', emoji: '🏍️' },
    truck: { bg: '#6B21A8', border: '#fff', emoji: '🚚' },
  }
  const c = colors[type] || colors.car
  const size = isSelected ? 40 : 34
  const html = `
    <div style="
      background:${c.bg};border:2.5px solid ${c.border};
      border-radius:50%;width:${size}px;height:${size}px;
      display:flex;align-items:center;justify-content:center;
      font-size:${isSelected ? 18 : 15}px;
      box-shadow:0 3px 10px rgba(0,0,0,0.35);
      transition:all 0.3s;
      ${isSelected ? 'box-shadow:0 0 0 4px rgba(0,217,126,0.3),0 4px 12px rgba(0,0,0,0.4)' : ''}
    ">${c.emoji}</div>
  `
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

function FlyToDevice({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 15, { duration: 1.2 })
    }
  }, [lat, lng])
  return null
}

/** Returns true only when both coordinates are valid non-zero numbers */
function hasValidCoords(device) {
  return (
    device &&
    typeof device.lat === 'number' &&
    typeof device.lng === 'number' &&
    (device.lat !== 0 || device.lng !== 0)
  )
}

export default function MapView({
  deviceId = null,
  showAllDevices = false,
  clientId = null,
  height = '100%',
  showGeofence = false,
  geofenceCenter = null,
  geofenceRadius = 500,
  onMapClick = null,
  zoom = 13,
}) {
  const { devices, lang } = useApp()

  const allCandidates = showAllDevices
    ? devices
    : clientId
      ? devices.filter(d => d.clientId === clientId)
      : deviceId
        ? devices.filter(d => d.id === deviceId)
        : devices

  // Only place markers for devices that have a real GPS fix
  const displayDevices = allCandidates.filter(hasValidCoords)

  const primaryDevice = deviceId ? devices.find(d => d.id === deviceId) : null
  const primaryHasCoords = hasValidCoords(primaryDevice)

  // If the primary device has no coordinates yet, show a "waiting" overlay instead of a broken map
  if (deviceId && primaryDevice && !primaryHasCoords && !showAllDevices) {
    return (
      <div
        style={{ height, width: '100%' }}
        className="flex flex-col items-center justify-center bg-gray-100 text-slate-400 gap-2"
      >
        <span className="text-3xl">📡</span>
        <p className="text-sm font-semibold">
          {lang === 'ar' ? 'في انتظار الإشارة...' : 'En attente du signal...'}
        </p>
      </div>
    )
  }

  // Default center: Morocco (Casablanca) when no device has a valid fix
  const center = primaryHasCoords
    ? [primaryDevice.lat, primaryDevice.lng]
    : displayDevices.length > 0
      ? [displayDevices[0].lat, displayDevices[0].lng]
      : [33.5731, -7.5898]

  // Simulated trip route for device detail
  const tripRoute =
    primaryHasCoords
      ? [
          [primaryDevice.lat + 0.02, primaryDevice.lng - 0.01],
          [primaryDevice.lat + 0.015, primaryDevice.lng + 0.005],
          [primaryDevice.lat + 0.005, primaryDevice.lng + 0.01],
          [primaryDevice.lat, primaryDevice.lng],
        ]
      : []

  const formatTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const diff = Math.floor((Date.now() - d.getTime()) / 60000)
    if (diff < 1) return t(lang, 'just_now')
    if (diff < 60) return `${diff} ${t(lang, 'minutes')}`
    return `${Math.floor(diff / 60)} ${t(lang, 'hours')}`
  }

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height, width: '100%' }}
      zoomControl={false}
      onClick={onMapClick}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {primaryHasCoords && <FlyToDevice lat={primaryDevice.lat} lng={primaryDevice.lng} />}

      {/* Trip route line */}
      {primaryHasCoords && tripRoute.length > 0 && (
        <Polyline
          positions={tripRoute}
          pathOptions={{ color: '#00D97E', weight: 3, opacity: 0.7, dashArray: '8,4' }}
        />
      )}

      {/* Geofence circle */}
      {showGeofence && geofenceCenter && (
        <Circle
          center={geofenceCenter}
          radius={geofenceRadius}
          pathOptions={{ color: '#00D97E', fillColor: '#00D97E', fillOpacity: 0.08, weight: 2, dashArray: '6,4' }}
        />
      )}

      {/* Device markers — only rendered for devices with a real GPS fix */}
      {displayDevices.map(device => (
        <Marker
          key={device.id}
          position={[device.lat, device.lng]}
          icon={createDeviceIcon(device.type, device.id === deviceId)}
        >
          <Popup>
            <div style={{ minWidth: 160, fontFamily: 'Cairo, Inter, sans-serif', direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#0F2044' }}>{device.name}</div>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>
                {device.plate}
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                <span style={{ color: device.status === 'online' ? '#00D97E' : '#94A3B8', fontWeight: 600 }}>
                  ● {device.status === 'online' ? t(lang, 'online') : t(lang, 'offline')}
                </span>
                {device.status === 'online' && (
                  <span style={{ color: '#0F2044', fontWeight: 600 }}>{device.speed} {t(lang, 'kmh')}</span>
                )}
              </div>
              {device.status === 'online' && (
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>
                  🔋 {device.battery}% · 📶 {device.signal}/4
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
