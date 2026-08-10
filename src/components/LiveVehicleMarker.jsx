import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import carMarkerImage from '../assets/car-marker.png'
import { getDeviceStatusKey } from './ui'

const CAR_ASSET_HEADING_OFFSET = -135
const ANIMATION_MS = 800
const TRAIL_LIMIT = 20
const STATUS_COLORS = {
  moving: '#1DBF73',
  idle: '#FF9500',
  stopped: '#FF3B30',
  offline: '#94A3B8',
}

function toPoint(device) {
  const lat = Number(device?.lat ?? device?.last_lat)
  const lng = Number(device?.lng ?? device?.last_lng)
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
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

function createLiveVehicleIcon(isSelected, initialBearing = 0) {
  const size = isSelected ? 62 : 56
  return L.divIcon({
    className: 'athar-live-marker-icon',
    html: `
      <div class="athar-live-marker" style="width:${size}px;height:${size}px">
        <span class="athar-live-marker-pulse"></span>
        <img data-live-car src="${carMarkerImage}" alt="" style="transform:rotate(${initialBearing + CAR_ASSET_HEADING_OFFSET}deg)" />
        <span class="athar-live-marker-ring"></span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function updateMarkerRotation(marker, bearing) {
  const image = marker?.getElement()?.querySelector('[data-live-car]')
  if (!image) return
  image.style.transform = `rotate(${bearing + CAR_ASSET_HEADING_OFFSET}deg)`
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
  const icon = useMemo(() => createLiveVehicleIcon(isSelected, initialBearingRef.current), [isSelected])
  const status = getDeviceStatusKey(device)
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline

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
    if (distance < 0.0000001) {
      marker.setLatLng(point)
      updateMarkerRotation(marker, bearing)
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
      updateMarkerRotation(marker, bearing)
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
      else frameRef.current = null
    }
    frameRef.current = requestAnimationFrame(animate)
  }, [point?.[0], point?.[1], device?.course, device?.attributes?.course])

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