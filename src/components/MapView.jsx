import React, { useEffect, useRef } from 'react'
import MapLayers from './MapLayers'
import { MapContainer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import LiveVehicleMarker from './LiveVehicleMarker'
import { useApp } from '../context/AppContext'
import { t } from '../i18n/translations'

// Professional SVG vehicle icons (no emoji)
function createDeviceIcon(type, isSelected = false) {
  const configs = {
    car: {
      bg: '#0F2044',
      border: isSelected ? '#00D97E' : '#1e3a6e',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
      </svg>`,
    },
    bike: {
      bg: '#c2410c',
      border: isSelected ? '#00D97E' : '#ea580c',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16">
        <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4C7.4 8.8 7 9.5 7 10c0 .6.2 1.2.8 1.6l3.2 2.4V18h2v-5l-3.2-2.5.8-.8-.8-.7zm8.2 1.5c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>
      </svg>`,
    },
    truck: {
      bg: '#6B21A8',
      border: isSelected ? '#00D97E' : '#7e22ce',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16">
        <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
      </svg>`,
    },
  }
  const c = configs[type] || configs.car
  const size = isSelected ? 42 : 36
  const pulse = isSelected
    ? `box-shadow:0 0 0 4px rgba(0,217,126,0.25),0 0 0 8px rgba(0,217,126,0.08),0 4px 14px rgba(0,0,0,0.45);`
    : `box-shadow:0 2px 8px rgba(0,0,0,0.32);`

  const html = `
    <div style="
      background:${c.bg};
      border:2.5px solid ${c.border};
      border-radius:50%;
      width:${size}px;height:${size}px;
      display:flex;align-items:center;justify-content:center;
      ${pulse}
      transition:all 0.25s;
    ">
      ${c.svg}
    </div>
  `
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

function FlyToDevice({ lat, lng, deviceKey }) {
  const map = useMap()
  const previousDeviceKey = useRef(null)
  useEffect(() => {
    const _lat = parseFloat(lat)
    const _lng = parseFloat(lng)
    if (previousDeviceKey.current === deviceKey) return
    if (_lat !== undefined && _lng !== undefined && !isNaN(_lat) && !isNaN(_lng)) {
      previousDeviceKey.current = deviceKey
      map.flyTo([_lat, _lng], 15, { duration: 1.2 })
    }
  }, [deviceKey, lat, lng, map])
  return null
}

/** Returns true only when both coordinates are finite GPS numbers */
function hasValidCoords(device) {
  return (
    device &&
    typeof device.lat === 'number' &&
    typeof device.lng === 'number' &&
    Number.isFinite(device.lat) &&
    Number.isFinite(device.lng) &&
    device.lat >= -90 &&
    device.lat <= 90 &&
    device.lng >= -180 &&
    device.lng <= 180 &&
    !(Math.abs(device.lat) < 0.01 && Math.abs(device.lng) < 0.01)
  )
}

function parseCoordinate(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

// ── Simple marker clustering ──────────────────────────────────────────────────
// Groups markers that fall within CLUSTER_PX pixels of each other at given zoom.
function clusterDevices(devs, zoom) {
  // At high zoom, no clustering needed
  if (zoom >= 13 || devs.length <= 3) return devs.map(d => ({ ...d, _clustered: false, _count: 1 }))

  // Convert lat/lng to pixel space (Mercator approximation)
  const CLUSTER_RADIUS = 60 // px
  const scale = 256 * Math.pow(2, zoom)
  function toPixel(lat, lng) {
    const x = ((lng + 180) / 360) * scale
    const sinLat = Math.sin((lat * Math.PI) / 180)
    const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
    return { x, y }
  }

  const result = []
  const assigned = new Set()

  for (let i = 0; i < devs.length; i++) {
    if (assigned.has(i)) continue
    const pi = toPixel(devs[i].lat, devs[i].lng)
    const group = [i]
    for (let j = i + 1; j < devs.length; j++) {
      if (assigned.has(j)) continue
      const pj = toPixel(devs[j].lat, devs[j].lng)
      const dist = Math.sqrt((pi.x - pj.x) ** 2 + (pi.y - pj.y) ** 2)
      if (dist < CLUSTER_RADIUS) { group.push(j); assigned.add(j) }
    }
    assigned.add(i)
    if (group.length === 1) {
      result.push({ ...devs[i], _clustered: false, _count: 1 })
    } else {
      // Use the first device as cluster center, show count badge
      const avgLat = group.reduce((s, idx) => s + devs[idx].lat, 0) / group.length
      const avgLng = group.reduce((s, idx) => s + devs[idx].lng, 0) / group.length
      const onlineCount = group.filter(idx => devs[idx].status === 'online').length
      result.push({ ...devs[i], lat: avgLat, lng: avgLng, _clustered: true, _count: group.length, _onlineCount: onlineCount })
    }
  }
  return result
}

function createClusterIcon(count, onlineCount) {
  const allOnline = onlineCount === count
  const bg = allOnline ? '#00D97E' : onlineCount > 0 ? '#f97316' : '#64748b'
  return L.divIcon({
    html: `<div style="width:44px;height:44px;border-radius:50%;background:${bg};border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;flex-direction:column;">
      <span style="font-size:15px;font-weight:900;color:white;line-height:1">${count}</span>
      <span style="font-size:7px;color:white;opacity:.85;line-height:1">${onlineCount}✓</span>
    </div>`,
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
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
  satelliteMode = false,
  autoFollow = false,
  onDeviceClick = null,
  onRouteRequest = null,
  routeLoadingDeviceId = null,
  children = null,
}) {
  const { devices, lang } = useApp()

  const allCandidates = showAllDevices
    ? devices
    : clientId
      ? devices.filter(d => d.clientId === clientId)
      : deviceId
        ? devices.filter(d => d.id === deviceId)
        : devices

  // Normalise coordinates to numbers before any check
  const normalised = allCandidates.map(d => {
    const primaryLat = parseCoordinate(d.lat)
    const fallbackLat = parseCoordinate(d.last_lat)
    const primaryLng = parseCoordinate(d.lng)
    const fallbackLng = parseCoordinate(d.last_lng)
    return {
      ...d,
      lat: Number.isFinite(primaryLat) ? primaryLat : fallbackLat,
      lng: Number.isFinite(primaryLng) ? primaryLng : fallbackLng,
    }
  })

  // Only place markers for devices that have a real GPS fix
  const displayDevices = normalised.filter(d => d.trackingEnabled !== false && hasValidCoords(d))

  const primaryDevice = deviceId
    ? normalised.find(d => String(d.id) === String(deviceId))
    : null
  const primaryHasCoords = primaryDevice?.trackingEnabled !== false && hasValidCoords(primaryDevice)

  // If the primary device has no coordinates yet, show a "waiting" overlay instead of a broken map
  if (deviceId && primaryDevice && !primaryHasCoords && !showAllDevices) {
    return (
      <div
        style={{ height, width: '100%' }}
        className="flex flex-col items-center justify-center bg-gray-100 text-slate-400 gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>
        </svg>
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
      minZoom={3}
      maxZoom={19}
      preferCanvas
      onClick={onMapClick}
    >
      <MapLayers satellite={satelliteMode} />

      {primaryHasCoords && <FlyToDevice deviceKey={deviceId} lat={primaryDevice.lat} lng={primaryDevice.lng} />}

      {/* Extra layers injected by parent (user location, routing, etc.) */}
      {children}

      {/* Geofence circle */}
      {showGeofence && geofenceCenter && (
        <Circle
          center={geofenceCenter}
          radius={geofenceRadius}
          pathOptions={{ color: '#00D97E', fillColor: '#00D97E', fillOpacity: 0.08, weight: 2, dashArray: '6,4' }}
        />
      )}

      {/* Keep the existing low-zoom grouping, while individual vehicles use the live marker. */}
      {(showAllDevices && displayDevices.length > 3
        ? clusterDevices(displayDevices, zoom)
        : displayDevices.map(d => ({ ...d, _clustered: false, _count: 1 }))
      ).map(device => device._clustered ? (
        <Marker
          key={device.id}
          position={[device.lat, device.lng]}
          icon={createClusterIcon(device._count, device._onlineCount)}
        >
          <Popup>
            <div style={{ fontFamily: 'Cairo, Inter, sans-serif', padding: '4px' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0F2044', marginBottom: 4 }}>
                {device._count} {lang === 'ar' ? 'أجهزة' : 'appareils'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {device._onlineCount} {lang === 'ar' ? 'متصل' : 'en ligne'}
              </div>
            </div>
          </Popup>
        </Marker>
      ) : (
        <LiveVehicleMarker
          key={device.id}
          device={device}
          isSelected={device.id === deviceId}
          autoFollow={autoFollow && device.id === deviceId}
          onClick={() => onDeviceClick?.(device)}
        >
          <Popup>
            <div style={{ minWidth: 160, fontFamily: 'Cairo, Inter, sans-serif', direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#0F2044' }}>{device.name}</div>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>{device.plate}</div>
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
                  {lang === 'ar' ? `بطارية ${device.battery}% · إشارة ${device.signal}/4` : `Batt. ${device.battery}% · Signal ${device.signal}/4`}
                </div>
              )}
              {onRouteRequest && (
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation()
                    onRouteRequest(device)
                  }}
                  disabled={routeLoadingDeviceId === device.id}
                  style={{
                    width: '100%',
                    marginTop: 8,
                    padding: '7px 9px',
                    border: '1px solid rgba(15,32,68,.16)',
                    borderRadius: 9,
                    background: '#0F2044',
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: routeLoadingDeviceId === device.id ? 'wait' : 'pointer',
                    opacity: routeLoadingDeviceId === device.id ? 0.65 : 1,
                  }}
                >
                  {routeLoadingDeviceId === device.id
                    ? (lang === 'ar' ? 'جاري التحميل…' : 'Chargement…')
                    : (lang === 'ar' ? 'عرض مسار اليوم' : 'Voir trajet du jour')}
                </button>
              )}
            </div>
          </Popup>
        </LiveVehicleMarker>
      ))}
    </MapContainer>
  )
}
