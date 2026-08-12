import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { getBatteryColor, getDeviceStatusKey } from './ui'
import { markerFor } from '../utils/vehicleAssets'

const ANIMATION_MS = 800
const TRAIL_LIMIT = 20
const STATUS_COLORS = {
  moving: '#1DBF73',
  idle: '#FF9500',
  stopped: '#FF3B30',
  offline: '#94A3B8',
}

const STATUS_LABELS = {
  moving: { ar: 'يتحرك', fr: 'En mouvement' },
  idle: { ar: 'خامل', fr: 'Ralenti' },
  stopped: { ar: 'متوقف', fr: 'Arrêté' },
  offline: { ar: 'غير متصل', fr: 'Hors ligne' },
}

function toPoint(device) {
  const parseCoordinate = value => value == null || value === '' ? null : Number(value)
  const primaryLat = parseCoordinate(device?.lat)
  const fallbackLat = parseCoordinate(device?.last_lat)
  const primaryLng = parseCoordinate(device?.lng)
  const fallbackLng = parseCoordinate(device?.last_lng)
  const lat = Number.isFinite(primaryLat) ? primaryLat : fallbackLat
  const lng = Number.isFinite(primaryLng) ? primaryLng : fallbackLng
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)
    ? [lat, lng]
    : null
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

function createLiveVehicleIcon(device, isSelected, initialBearing = 0, lang = 'ar') {
  const marker = markerFor(device?.type)
  const status = getDeviceStatusKey(device)
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline
  const statusLabel = STATUS_LABELS[status]?.[lang] || STATUS_LABELS[status]?.fr || status
  const speed = Number(device?.speed ?? device?.last_speed ?? 0)
  const label = status === 'moving' && speed > 0 ? `${Math.round(speed)} km/h` : statusLabel
  const batteryValue = Number(device?.battery)
  const batteryColor = getBatteryColor(batteryValue)
  const size = isSelected ? 62 : 56
  const width = isSelected ? 142 : 136
  const height = 92
  return L.divIcon({
    className: 'athar-live-marker-icon',
    html: `
      <div class="athar-live-marker" style="width:${width}px;height:${height}px;--athar-live-color:${color};--athar-battery-color:${batteryColor}">
        <span class="athar-live-marker-visual" style="width:${size}px;height:${size}px">
          <span class="athar-live-marker-pulse"></span>
          <img data-live-vehicle src="${marker.url}" alt="" style="transform:rotate(${initialBearing + marker.offset}deg)" />
          <span class="athar-live-marker-ring"></span>
        </span>
        <span class="athar-live-label">
          <span class="athar-live-label-status" aria-hidden="true"></span>
          <span>${label}</span>
          <span class="athar-live-label-battery" aria-hidden="true"></span>
        </span>
      </div>
    `,
    iconSize: [width, height],
    iconAnchor: [width / 2, size / 2],
  })
}

function shortestTurn(from, to) {
  return ((to - from + 540) % 360) - 180
}

function updateMarkerRotation(marker, bearing, type, rotationRef) {
  const image = marker?.getElement()?.querySelector('[data-live-vehicle]')
  if (!image) return
  const nextBearing = rotationRef.current + shortestTurn(rotationRef.current, bearing)
  rotationRef.current = nextBearing
  image.style.transform = `rotate(${nextBearing + markerFor(type).offset}deg)`
}

export default function LiveVehicleMarker({
  device,
  isSelected = false,
  autoFollow = false,
  onClick,
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
  const initialBearingRef = useRef(getBearing(device, firstPositionRef.current, point))
  const rotationRef = useRef(initialBearingRef.current)
  const status = getDeviceStatusKey(device)
  const icon = useMemo(
    () => createLiveVehicleIcon(device, isSelected, initialBearingRef.current, device?.lang || 'ar'),
    [device?.type, device?.lang, isSelected, status, device?.speed, device?.last_speed, device?.battery]
  )

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
  }, [])

  useEffect(() => {
    if (!point || !markerRef.current) return
    const marker = markerRef.current
    const from = marker.getLatLng()
    const start = [from.lat, from.lng]
    const bearing = getBearing(device, previousPointRef.current, point)
    const distance = distanceBetween(start, point)
    previousPointRef.current = point

    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    updateMarkerRotation(marker, bearing, device?.type, rotationRef)
    if (distance < 0.0000001) {
      marker.setLatLng(point)
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
      marker.setLatLng(next)
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
      else frameRef.current = null
    }
    frameRef.current = requestAnimationFrame(animate)
  }, [point?.[0], point?.[1], device?.course, device?.attributes?.course, device?.type])

  useEffect(() => {
    if (!point) return
    const previous = trailRef.current[trailRef.current.length - 1]
    if (distanceBetween(previous, point) < 0.0000001) return
    const nextTrail = [...trailRef.current, point].slice(-TRAIL_LIMIT)
    trailRef.current = nextTrail
    setTrail(nextTrail)
  }, [point?.[0], point?.[1]])

  useEffect(() => {
    if (!autoFollow || !point) return
    map.panTo(point, { animate: true, duration: 0.45, noMoveStart: true })
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
              color: '#1DBF73',
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
        {children}
      </Marker>
    </>
  )
}

export { toPoint, calculateBearing }