import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Polyline, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { getDeviceStatusKey } from './ui'
import { markerFor } from '../utils/vehicleAssets'
import { isMapReadyAndSized, safelyUseMap, safelyUseMarker, toValidLatLng } from '../utils/mapSafety'

const ANIMATION_MS = 1400
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
// The supplied reference assets are landscape cut-outs. Keep them large enough
// to read on the fleet map without letting the image dominate the map.
const MARKER_SIZE = { bike: 88, car: 96, truck: 108 }
const SELECTED_BOOST = 10
const MARKER_ASPECT_RATIO = 1024 / 1536

function markerScaleForZoom(zoom) {
  // Keep the artwork readable on phones without allowing it to dominate a
  // close-up map or disappear when the fleet is viewed from farther away.
  return Math.max(0.78, Math.min(1.12, 0.86 + (Number(zoom) - 12) * 0.04))
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

function getCourse(device) {
  const course = Number(device?.course ?? device?.attributes?.course)
  return Number.isFinite(course) ? course : null
}

function speedText(device) {
  const raw = Number(device?.speed)
  if (!Number.isFinite(raw)) return ''
  const kmh = Math.round(raw)
  if (kmh < 1) return ''
  return `${kmh} ${device?.lang === 'fr' ? 'km/h' : 'كم/س'}`
}

function createLiveVehicleIcon(device, isSelected, initialBearing = 0, lang = 'ar', zoom = 13) {
  const marker = markerFor(device?.type)
  const status = device?.powerDisconnected ? 'offline' : getDeviceStatusKey(device)
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline
  const vehicleType = device?.type || 'bike'
  const markerWidth = Math.round(((MARKER_SIZE[vehicleType] || MARKER_SIZE.bike) + (isSelected ? SELECTED_BOOST : 0)) * markerScaleForZoom(zoom))
  const markerHeight = Math.round(markerWidth * MARKER_ASPECT_RATIO)
  const iconWidth = markerWidth + 8
  const iconHeight = markerHeight + 8
  return L.divIcon({
    className: 'athar-live-marker-icon',
    html: `
      <div class="athar-live-marker" style="width:${iconWidth}px;height:${iconHeight}px;--athar-live-color:${color}">
        <span data-live-speed class="athar-live-speed${speedText(device) ? '' : ' is-hidden'}">${speedText(device)}</span>
        <span class="athar-live-marker-visual" style="width:${markerWidth}px;height:${markerHeight}px">
          <img data-live-vehicle src="${marker.url}" alt="" style="transform:rotate(${initialBearing + marker.offset}deg)" />
        </span>
      </div>
    `,
    iconSize: [iconWidth, iconHeight],
    // The geographic point is the bottom-center contact point, not the
    // center of the transparent image canvas.
    iconAnchor: [iconWidth / 2, markerHeight],
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
  onToggleFollow,
  onClick,
  now = Date.now(),
  children = null,
}) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom?.() ?? 13)
  const markerRef = useRef(null)
  const firstPositionRef = useRef(toPoint(device))
  const previousPointRef = useRef(firstPositionRef.current)
  const frameRef = useRef(null)
  const trailRef = useRef(firstPositionRef.current ? [firstPositionRef.current] : [])
  const [trail, setTrail] = useState(trailRef.current)
  const point = toPoint(device)
  const initialCourse = getCourse(device)
  const initialBearingRef = useRef(initialCourse ?? 0)
  const rotationRef = useRef(initialCourse ?? 0)
  const status = getDeviceStatusKey(device)
  const icon = useMemo(
    () => createLiveVehicleIcon(device, isSelected, initialBearingRef.current, device?.lang || 'ar', zoom),
    [device?.type, device?.lang, isSelected, status, device?.powerDisconnected, zoom]
  )

  useEffect(() => {
    const updateZoom = () => setZoom(map.getZoom?.() ?? 13)
    updateZoom()
    map.on?.('zoomend', updateZoom)
    return () => map.off?.('zoomend', updateZoom)
  }, [map])

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
    const course = getCourse(device)
    const distance = distanceBetween(start, point)
    previousPointRef.current = point

    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    // Course is authoritative when supplied by the GPS stream. When it is
    // temporarily absent, preserve the last valid course instead of rotating
    // to zero or inventing movement from screen coordinates.
    if (course !== null) updateMarkerRotation(marker, course, device?.type, rotationRef)
    if (distance < 0.0000001) {
      safelyUseMarker(marker, currentMarker => currentMarker.setLatLng(point))
      return
    }

    const startedAt = performance.now()
    const animate = now => {
      const progress = Math.min(1, (now - startedAt) / ANIMATION_MS)
      const eased = progress
      const next = [
        start[0] + (point[0] - start[0]) * eased,
        start[1] + (point[1] - start[1]) * eased,
      ]
      safelyUseMarker(marker, currentMarker => currentMarker.setLatLng(next))
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
      else frameRef.current = null
    }
    frameRef.current = requestAnimationFrame(animate)
  }, [point?.[0], point?.[1], device?.course, device?.attributes?.course, device?.type])

  useEffect(() => {
    safelyUseMarker(markerRef.current, marker => {
      const badge = marker.getElement()?.querySelector('[data-live-speed]')
      if (!badge) return
      const text = speedText(device)
      badge.textContent = text
      badge.classList.toggle('is-hidden', !text)
    })
  }, [device?.speed, device?.lang])

  useEffect(() => {
    if (!point) return
    const previous = trailRef.current[trailRef.current.length - 1]
    if (distanceBetween(previous, point) < 0.0000001) return
    const nextTrail = [...trailRef.current, point].slice(-TRAIL_LIMIT)
    trailRef.current = nextTrail
    setTrail(nextTrail)
  }, [point?.[0], point?.[1]])

  // Smart follow:
  // Keep the vehicle inside a central dead-zone instead of moving the
  // camera on every GPS packet. User zoom/drag takes priority.
  useEffect(() => {
    if (!autoFollow || !point || !isMapReadyAndSized(map)) return

    const pauseFollow = () => onToggleFollow?.(false)

    map.on?.('dragstart', pauseFollow)
    map.on?.('zoomstart', pauseFollow)

    safelyUseMap(map, currentMap => {
      const size = currentMap.getSize?.()
      const projected = currentMap.latLngToContainerPoint?.(
        L.latLng(point[0], point[1])
      )

      if (!size || !projected) return

      const left = size.x * 0.28
      const right = size.x * 0.72
      const top = size.y * 0.28
      const bottom = size.y * 0.72

      let dx = 0
      let dy = 0

      if (projected.x < left) dx = projected.x - left
      else if (projected.x > right) dx = projected.x - right

      if (projected.y < top) dy = projected.y - top
      else if (projected.y > bottom) dy = projected.y - bottom

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return

      currentMap.panBy([dx, dy], {
        animate: true,
        duration: 0.45,
        noMoveStart: true,
      })
    })

    return () => {
      map.off?.('dragstart', pauseFollow)
      map.off?.('zoomstart', pauseFollow)
    }
  }, [autoFollow, point?.[0], point?.[1], map, onToggleFollow])

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
