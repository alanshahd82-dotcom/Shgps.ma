import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Polyline, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { getDeviceStatusKey } from './ui'
import { markerFor } from '../utils/vehicleAssets'
import { isMapReadyAndSized, safelyUseMap, safelyUseMarker, toValidLatLng } from '../utils/mapSafety'

const ANIMATION_MS = 800
const TRAIL_LIMIT = 20
const STATUS_COLORS = {
  moving: 'var(--ds-color-primary)',
  idle: 'var(--ds-color-warning)',
  stopped: 'var(--ds-color-cool-gray)',
  offline: 'var(--ds-color-danger)',
}

const STATUS_LABELS = {
  moving: { ar: 'متصل', fr: 'En ligne' },
  idle: { ar: 'خامل', fr: 'Ralenti' },
  stopped: { ar: 'متوقفة', fr: 'À l’arrêt' },
  offline: { ar: 'مفصول', fr: 'Déconnecté' },
}

// Keep these values together so mobile marker sizing is a one-line tune per type.
const MARKER_SIZE = { bike: 42, car: 48, truck: 56 }
const SELECTED_BOOST = 8
const MARKER_ASPECT_RATIO = {
  bike: 256 / 152,
  car: 256 / 171,
  truck: 256 / 150,
}

function toPoint(device) {
  return toValidLatLng(device)
}

function distanceBetween(a, b) {
  if (!a || !b) return 0
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}

function calculateBearing(from, to) {
  if (!from || !to) return 0
  const lat1 = from[0] * Math.PI / 180
  const lat2 = to[0] * Math.PI / 180
  const deltaLng = (to[1] - from[1]) * Math.PI / 180
  const y = Math.sin(deltaLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function getBearing(device, from, to) {
  const course = Number(device?.course ?? device?.attributes?.course)
  return Number.isFinite(course) ? course : calculateBearing(from, to)
}

function getRenderedBearing(device, from, to) {
  const speed = Number(device?.speedKmh ?? device?.speed ?? device?.last_speed ?? 0)
  return getDeviceStatusKey(device) === 'stopped' || speed === 0
    ? 0
    : getBearing(device, from, to)
}

function createLiveVehicleIcon(device, isSelected, initialBearing = 0, lang = 'ar') {
  const marker = markerFor(device?.type)
  const status = device?.powerDisconnected ? 'offline' : getDeviceStatusKey(device)
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline
  const vehicleType = device?.type || 'bike'
  const markerWidth = (MARKER_SIZE[vehicleType] || MARKER_SIZE.bike) + (isSelected ? SELECTED_BOOST : 0)
  const markerHeight = Math.round(markerWidth * (MARKER_ASPECT_RATIO[vehicleType] || MARKER_ASPECT_RATIO.bike))
  const iconWidth = markerWidth + 20
  const iconHeight = markerHeight + 20
  const rawSpeed = device?.speedKmh ?? device?.speed ?? device?.last_speed
  const speedLabel = Number.isFinite(Number(rawSpeed))
    ? `${Math.round(Math.max(0, Number(rawSpeed)))} ${lang === 'ar' ? 'كم/س' : 'km/h'}`
    : ''
  return L.divIcon({
    className: 'athar-live-marker-icon',
    html: `
      <div class="athar-live-marker" style="width:${iconWidth}px;height:${iconHeight}px;--athar-live-color:${color}">
        ${speedLabel ? `<span class="athar-live-speed">${speedLabel}</span>` : ''}
        <span class="athar-live-marker-visual" style="width:${markerWidth}px;height:${markerHeight}px">
          <img data-live-vehicle src="${marker.url}" alt="" style="transform:rotate(${initialBearing + marker.offset}deg)" />
          <span class="athar-live-marker-ring" style="${isSelected ? 'border:2px solid var(--ds-color-primary);' : ''}"></span>
        </span>
      </div>
    `,
    iconSize: [iconWidth, iconHeight],
    iconAnchor: [iconWidth / 2, markerHeight / 2],
  })
}

function shortestTurn(from, to) {
  return ((to - from + 540) % 360) - 180
}

function updateMarkerRotation(marker, bearing, type, rotationRef) {
  safelyUseMarker(marker, currentMarker => {
    const image = currentMarker.getElement()?.querySelector('[data-live-vehicle]')
    if (!image) return
    const nextBearing = rotationRef.current + shortestTurn(rotationRef.current, bearing)
    rotationRef.current = nextBearing
    image.style.transform = `rotate(${nextBearing + markerFor(type).offset}deg)`
  })
}

export default function LiveVehicleMarker({
  device,
  isSelected = false,
  autoFollow = false,
  onClick,
  now = Date.now(),
  children = null,
}) {
  const map = useMap()
  const markerRef = useRef(null)
  const firstPositionRef = useRef(toPoint(device))
  const previousPointRef = useRef(firstPositionRef.current)
  const frameRef = useRef(null)
  const trailRef = useRef(firstPositionRef.current ? [firstPositionRef.current] : [])
  const [trail, setTrail] = useState(trailRef.current)
  const point = toPoint(device)
  const initialBearingRef = useRef(getRenderedBearing(device, firstPositionRef.current, point))
  const rotationRef = useRef(initialBearingRef.current)
  const status = getDeviceStatusKey(device)
  const icon = useMemo(
    () => createLiveVehicleIcon(device, isSelected, initialBearingRef.current, device?.lang || 'ar'),
    [device?.type, device?.lang, isSelected, status, device?.speed, device?.last_speed, device?.powerDisconnected]
  )

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
  }, [])

  useEffect(() => {
    if (!point || !markerRef.current) return
    const marker = markerRef.current
    let from
    try {
      from = marker.getLatLng()
    } catch {
      return
    }
    const start = toValidLatLng([from?.lat, from?.lng])
    if (!start) return
    const speed = Number(device?.speedKmh ?? device?.speed ?? device?.last_speed ?? 0)
    const isStopped = status === 'stopped' || speed === 0
    const bearing = getRenderedBearing(device, previousPointRef.current, point)
    const distance = distanceBetween(start, point)
    previousPointRef.current = point

    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    if (isStopped) {
      rotationRef.current = 0
      safelyUseMarker(marker, currentMarker => {
        const image = currentMarker.getElement()?.querySelector('[data-live-vehicle]')
        if (image) image.style.transform = `rotate(${markerFor(device?.type).offset}deg)`
      })
    } else {
      updateMarkerRotation(marker, bearing, device?.type, rotationRef)
    }
    if (distance < 0.0000001) {
      safelyUseMarker(marker, currentMarker => currentMarker.setLatLng(point))
      return
    }

    const startedAt = performance.now()
    const animate = now => {
      const progress = Math.min(1, (now - startedAt) / ANIMATION_MS)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = [
        start[0] + (point[0] - start[0]) * eased,
        start[1] + (point[1] - start[1]) * eased,
      ]
      safelyUseMarker(marker, currentMarker => currentMarker.setLatLng(next))
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
      else frameRef.current = null
    }
    frameRef.current = requestAnimationFrame(animate)
  }, [point?.[0], point?.[1], device?.course, device?.attributes?.course, device?.type, device?.speedKmh, device?.speed, device?.last_speed, status])

  useEffect(() => {
    if (!point) return
    const previous = trailRef.current[trailRef.current.length - 1]
    if (distanceBetween(previous, point) < 0.0000001) return
    const nextTrail = [...trailRef.current, point].slice(-TRAIL_LIMIT)
    trailRef.current = nextTrail
    setTrail(nextTrail)
  }, [point?.[0], point?.[1]])

  useEffect(() => {
    if (!autoFollow || !point || !isMapReadyAndSized(map)) return
    safelyUseMap(map, currentMap => {
      currentMap.panTo(point, { animate: true, duration: 0.45, noMoveStart: true })
    })
  }, [autoFollow, point?.[0], point?.[1], map])

  if (!point) return null

  return (
    <>
      {isSelected && trail.length > 1 && trail.slice(0, -1).map((_, index) => {
        const segment = trail.slice(index, index + 2)
        return (
          <Polyline
            key={`${device.id}-trail-${index}`}
            positions={segment}
            pathOptions={{
              color: 'var(--ds-color-primary-strong)',
              opacity: 0.12 + ((index + 1) / trail.length) * 0.68,
              weight: 3,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )
      })}
      <Marker
        ref={markerRef}
        position={firstPositionRef.current || point}
        icon={icon}
        eventHandlers={{ click: () => onClick?.(device) }}
      >
        {isSelected && (
          <Tooltip permanent direction="top" offset={[0, -20]} opacity={1} className="athar-map-status-tooltip">
            <span className="athar-map-status-bubble" dir={device?.lang === 'ar' ? 'rtl' : 'ltr'}>
              <i style={{ background: device?.powerDisconnected || status === 'offline' ? 'var(--ds-color-danger)' : STATUS_COLORS[status] }} />
              <strong>{STATUS_LABELS[device?.powerDisconnected ? 'offline' : status]?.[device?.lang || 'ar']}</strong>
              <small>{device?.serverTime || device?.server_time || device?.fixTime || device?.lastUpdate
                ? formatAge(device?.serverTime || device?.server_time || device?.fixTime || device?.lastUpdate, device?.lang || 'ar', now)
                : (device?.lang === 'ar' ? 'غير متاح' : 'Indisponible')}</small>
            </span>
          </Tooltip>
        )}
        {children}
      </Marker>
    </>
  )
}

function formatAge(value, lang, now) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return lang === 'ar' ? 'غير متاح' : 'Indisponible'
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return lang === 'ar' ? `${seconds} ث` : `${seconds} s`
  return lang === 'ar' ? `${Math.floor(seconds / 60)} د` : `${Math.floor(seconds / 60)} min`
}

export { toPoint, calculateBearing }