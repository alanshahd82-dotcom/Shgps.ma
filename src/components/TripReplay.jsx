import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  Activity, AlertTriangle, BarChart3, ChevronDown, ChevronRight, Clock3,
  Download, Gauge, MapPin, Navigation, Pause, Play, Route as RouteIcon,
  ShieldCheck, SkipBack, SkipForward, Square, Target, Timer, TrendingUp, X, Zap,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../api/index.js'
import { t } from '../i18n/translations'
import MapLayers from './MapLayers'
import MapStyleToggle from './MapStyleToggle'
import carUrl from '../assets/car-marker.png'

const CAR_ASSET_HEADING_OFFSET = -135
const STOP_SPEED = 2
const SPEED_LIMIT = 80
const MIN_STOP_MS = 2 * 60 * 1000
const ACCELERATION_LIMIT = 2.5
const BRAKING_LIMIT = -3
const MAX_EVENT_INTERVAL_MS = 30 * 1000
const TRAIL_POINT_LIMIT = 15
const MAP_STYLE_STORAGE_KEY = 'athargps_map_style'

function validPoint(point) {
  const latitude = Number(point?.latitude ?? point?.lat)
  const longitude = Number(point?.longitude ?? point?.lng)
  const time = new Date(point?.fixTime ?? point?.timestamp ?? point?.time)
  return Number.isFinite(latitude) && Number.isFinite(longitude) && !Number.isNaN(time.getTime())
}

function normalisePoint(point) {
  const pointBearing = Number(point.course ?? point.bearing ?? point.heading ?? point.direction)
  return {
    latitude: Number(point.latitude ?? point.lat),
    longitude: Number(point.longitude ?? point.lng),
    speed: Math.max(0, Number(point.speed ?? 0)),
    fixTime: point.fixTime ?? point.timestamp ?? point.time,
    address: point.address || null,
    bearing: Number.isFinite(pointBearing) ? (pointBearing + 360) % 360 : null,
  }
}

function haversine(a, b) {
  const radius = 6371
  const lat1 = a.latitude * Math.PI / 180
  const lat2 = b.latitude * Math.PI / 180
  const dLat = (b.latitude - a.latitude) * Math.PI / 180
  const dLng = (b.longitude - a.longitude) * Math.PI / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const value = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)))
}

function bearing(a, b) {
  const dLng = (b.longitude - a.longitude) * Math.PI / 180
  const lat1 = a.latitude * Math.PI / 180
  const lat2 = b.latitude * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function angleDifference(first, second) {
  return Math.abs(((second - first + 540) % 360) - 180)
}

function formatTime(value, lang, withSeconds = true) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      ...(withSeconds ? { second: '2-digit' } : {}),
    }).format(new Date(value))
  } catch {
    return '—'
  }
}

function formatDuration(ms, lang) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours) return lang === 'ar' ? `${hours} س ${minutes} د` : `${hours} h ${minutes} min`
  return lang === 'ar' ? `${minutes} د` : `${minutes} min`
}

function formatClock(ms, lang) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const value = [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
  return lang === 'ar' ? value : value
}

function timeForProgress(points, value) {
  if (!points.length) return 0
  const index = Math.min(points.length - 1, Math.max(0, Math.floor(value)))
  const nextIndex = Math.min(points.length - 1, index + 1)
  const ratio = Math.min(1, Math.max(0, value - index))
  const start = new Date(points[index].fixTime).getTime()
  const end = new Date(points[nextIndex].fixTime).getTime()
  return start + (end - start) * ratio
}

function progressForTime(points, time) {
  if (!points.length) return 0
  if (time <= new Date(points[0].fixTime).getTime()) return 0
  const lastIndex = points.length - 1
  if (time >= new Date(points[lastIndex].fixTime).getTime()) return lastIndex

  let low = 0
  let high = lastIndex
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const middleTime = new Date(points[middle].fixTime).getTime()
    if (middleTime === time) return middle
    if (middleTime < time) low = middle + 1
    else high = middle - 1
  }

  const index = Math.max(0, high)
  const start = new Date(points[index].fixTime).getTime()
  const end = new Date(points[index + 1].fixTime).getTime()
  const ratio = end > start ? (time - start) / (end - start) : 0
  return index + Math.min(1, Math.max(0, ratio))
}

function labelIcon(label, background, size = 26) {
  return L.divIcon({
    className: 'athar-replay-marker',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${background};border:1.5px solid rgba(255,255,255,.98);box-shadow:0 5px 16px rgba(0,0,0,.42);color:white;font:800 ${size < 24 ? 10 : 11}px Arial,sans-serif">${label}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function carIcon(initialBearing = 0) {
  const width = 54
  const height = 38
  return L.divIcon({
    className: 'athar-replay-car',
    html: `<span class="athar-replay-car-body" style="display:flex;align-items:center;justify-content:center;width:${width}px;height:${height}px;transform-origin:center;transform:rotate(${initialBearing + CAR_ASSET_HEADING_OFFSET}deg);transition:transform .3s linear"><img src="${carUrl}" alt="" draggable="false" style="display:block;width:${width}px;height:${height}px;object-fit:contain;mix-blend-mode:multiply;filter:drop-shadow(0 5px 10px rgba(0,0,0,.45));pointer-events:none;user-select:none" /></span>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
  })
}

function shortestTurn(from, to) {
  return ((to - from + 540) % 360) - 180
}

function interpolateBearing(first, second, ratio) {
  if (first === null && second === null) return null
  if (first === null) return second
  if (second === null) return first
  return first + shortestTurn(first, second) * ratio
}

function CarMarker({ current, degrees, fast }) {
  const markerRef = useRef(null)
  const rotationRef = useRef(degrees)
  const icon = useMemo(() => carIcon(degrees), [])

  useEffect(() => {
    const element = markerRef.current?.getElement()
    const body = element?.querySelector('.athar-replay-car-body')
    if (body) {
      const nextRotation = rotationRef.current + shortestTurn(rotationRef.current, degrees)
      rotationRef.current = nextRotation
      body.style.transform = `rotate(${nextRotation + CAR_ASSET_HEADING_OFFSET}deg)`
      body.style.filter = fast
        ? 'drop-shadow(0 6px 5px rgba(0,0,0,.48))'
        : 'drop-shadow(0 5px 4px rgba(0,0,0,.42))'
    }
  }, [degrees, fast])

  return <Marker ref={markerRef} position={[current.latitude, current.longitude]} icon={icon} />
}

function speedColor(speed) {
  if (speed < 50) return '#1DBF73'
  if (speed <= SPEED_LIMIT) return '#F59E0B'
  return '#EF4444'
}

function Viewport({ route, current }) {
  const map = useMap()

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize()
      if (route.length) {
        const point = current || route[0]
        map.setView([point.latitude, point.longitude], 16, { animate: false })
      }
    }, 100)
    return () => window.clearTimeout(timer)
  }, [map, route.length])

  useEffect(() => {
    if (current) map.panTo([current.latitude, current.longitude], { animate: true, duration: 0.22 })
  }, [current?.latitude, current?.longitude, map])

  return null
}

function eventMeta(type, lang) {
  const labels = {
    stop: lang === 'ar' ? 'توقف' : 'Arrêt',
    acceleration: lang === 'ar' ? 'تسارع مفاجئ' : 'Accélération brusque',
    braking: lang === 'ar' ? 'كبح مفاجئ' : 'Freinage brusque',
    turn: lang === 'ar' ? 'انعطاف حاد' : 'Virage serré',
    speeding: lang === 'ar' ? 'تجاوز السرعة' : 'Excès de vitesse',
  }
  const colors = { stop: '#f59e0b', acceleration: '#35d39a', braking: '#ff625d', turn: '#facc15', speeding: '#ff625d' }
  const icons = { stop: 'P', acceleration: '⚡', braking: '⚡', turn: '↪', speeding: '!' }
  return { label: labels[type], color: colors[type], icon: icons[type] }
}

function detectBehaviors(route) {
  const events = []
  let stopStart = null

  for (let index = 0; index < route.length; index += 1) {
    const point = route[index]
    const stopped = point.speed < STOP_SPEED
    if (stopped && stopStart === null) stopStart = index
    const closesStop = stopStart !== null && (!stopped || index === route.length - 1)
    if (closesStop) {
      const endIndex = stopped ? index : index - 1
      const duration = new Date(route[endIndex].fixTime) - new Date(route[stopStart].fixTime)
      if (duration >= MIN_STOP_MS) {
        events.push({
          type: 'stop',
          index: stopStart,
          endIndex,
          duration,
          latitude: route[stopStart].latitude,
          longitude: route[stopStart].longitude,
        })
      }
      stopStart = null
    }

    if (index === 0) continue
    const previous = route[index - 1]
    const deltaMs = new Date(point.fixTime) - new Date(previous.fixTime)
    if (deltaMs > 0 && deltaMs <= MAX_EVENT_INTERVAL_MS) {
      const acceleration = ((point.speed - previous.speed) / 3.6) / (deltaMs / 1000)
      if (acceleration > ACCELERATION_LIMIT && previous.speed > 5) {
        events.push({ type: 'acceleration', index, acceleration, latitude: point.latitude, longitude: point.longitude })
      } else if (acceleration < BRAKING_LIMIT && point.speed > 5) {
        events.push({ type: 'braking', index, acceleration, latitude: point.latitude, longitude: point.longitude })
      }
    }

    if (point.speed > SPEED_LIMIT && previous.speed <= SPEED_LIMIT) {
      events.push({ type: 'speeding', index, latitude: point.latitude, longitude: point.longitude })
    }

    if (index > 1) {
      const before = route[index - 2]
      const firstBearing = bearing(before, previous)
      const secondBearing = bearing(previous, point)
      const turnMs = new Date(point.fixTime) - new Date(before.fixTime)
      if (turnMs > 0 && turnMs < 3000 && angleDifference(firstBearing, secondBearing) > 45 && previous.speed > 10) {
        events.push({
          type: 'turn',
          index,
          angle: Math.round(angleDifference(firstBearing, secondBearing)),
          latitude: point.latitude,
          longitude: point.longitude,
        })
      }
    }
  }

  return events.sort((a, b) => a.index - b.index)
}

function eventMessage(event, lang) {
  const meta = eventMeta(event.type, lang)
  if (event.type === 'stop') return `${meta.label} · ${formatDuration(event.duration, lang)}`
  if (event.type === 'acceleration' || event.type === 'braking') return `${meta.label} · ${Math.abs(event.acceleration).toFixed(1)} m/s²`
  if (event.type === 'turn') return `${meta.label} · ${event.angle}°`
  return meta.label
}

export default function TripReplay({ deviceId, deviceName, startTime, endTime, positions: suppliedPositions = [], onClose }) {
  const { lang } = useApp()
  const isAr = lang === 'ar'
  const [route, setRoute] = useState(() => suppliedPositions.filter(validPoint).map(normalisePoint))
  const [loading, setLoading] = useState(route.length === 0)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [multiplier, setMultiplier] = useState(2)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [showStops, setShowStops] = useState(true)
  const [satelliteMode, setSatelliteMode] = useState(() => {
    const storedStyle = localStorage.getItem(MAP_STYLE_STORAGE_KEY)
    return storedStyle ? storedStyle === 'satellite' : true
  })
  const rafRef = useRef(null)
  const virtualTimeRef = useRef(null)
  const lastFrameRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    if (suppliedPositions.length) {
      setRoute(suppliedPositions.filter(validPoint).map(normalisePoint))
      setLoading(false)
      return () => { cancelled = true }
    }

    setLoading(true)
    setError('')
    api.stats.getPositions(deviceId, startTime, endTime)
      .then((data) => {
        if (!cancelled) setRoute(Array.isArray(data) ? data.filter(validPoint).map(normalisePoint) : [])
      })
      .catch(() => {
        if (!cancelled) setError(isAr ? 'تعذّر تحميل نقاط الرحلة. حاول مرة أخرى.' : 'Impossible de charger les points du trajet.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [deviceId, endTime, isAr, startTime, suppliedPositions])

  const durationMs = useMemo(() => route.length > 1
    ? new Date(route.at(-1).fixTime) - new Date(route[0].fixTime)
    : 0, [route])

  const currentIndex = Math.min(route.length - 1, Math.max(0, Math.floor(progress)))
  const current = useMemo(() => {
    if (!route.length) return null
    const index = Math.min(route.length - 1, Math.max(0, Math.floor(progress)))
    const next = route[Math.min(route.length - 1, index + 1)]
    const ratio = Math.min(1, Math.max(0, progress - index))
    const start = route[index]
    return {
      ...start,
      latitude: start.latitude + (next.latitude - start.latitude) * ratio,
      longitude: start.longitude + (next.longitude - start.longitude) * ratio,
      speed: start.speed + (next.speed - start.speed) * ratio,
      fixTime: new Date(new Date(start.fixTime).getTime() + (new Date(next.fixTime) - new Date(start.fixTime)) * ratio).toISOString(),
      address: ratio > 0.55 && next.address ? next.address : start.address,
      bearing: interpolateBearing(start.bearing, next.bearing, ratio),
    }
  }, [progress, route])

  const events = useMemo(() => detectBehaviors(route), [route])
  const stops = useMemo(() => events.filter((event) => event.type === 'stop'), [events])
  const speedingSegments = useMemo(() => route.slice(1).flatMap((point, index) => (
    point.speed > SPEED_LIMIT || route[index].speed > SPEED_LIMIT
      ? [[[route[index].latitude, route[index].longitude], [point.latitude, point.longitude]]]
      : []
  )), [route])
  const totalDistance = useMemo(() => route.slice(1).reduce((sum, point, index) => sum + haversine(route[index], point), 0), [route])
  const maxSpeed = useMemo(() => route.reduce((max, point) => Math.max(max, point.speed), 0), [route])
  const movingMs = useMemo(() => route.slice(1).reduce((sum, point, index) => {
    const segmentMs = new Date(point.fixTime) - new Date(route[index].fixTime)
    return point.speed >= STOP_SPEED ? sum + Math.max(0, segmentMs) : sum
  }, 0), [route])
  const totalStopMs = useMemo(() => stops.reduce((sum, stop) => sum + stop.duration, 0), [stops])
  const speedingMs = useMemo(() => route.slice(1).reduce((sum, point, index) => {
    if (point.speed <= SPEED_LIMIT && route[index].speed <= SPEED_LIMIT) return sum
    return sum + Math.max(0, new Date(point.fixTime) - new Date(route[index].fixTime))
  }, 0), [route])
  const currentSpeed = current ? Math.round(current.speed) : 0
  const currentBearing = current?.bearing ?? (current && route.length > 1
    ? bearing(route[Math.min(currentIndex, route.length - 2)], route[Math.min(route.length - 1, currentIndex + 1)])
    : 0)
  const routePositions = useMemo(() => route.map((point) => [point.latitude, point.longitude]), [route])
  const traveledPositions = useMemo(() => {
    if (!current) return []
    const positions = route.slice(0, currentIndex + 1).map((point) => [point.latitude, point.longitude])
    const currentPosition = [current.latitude, current.longitude]
    const lastPosition = positions.at(-1)
    if (!lastPosition || lastPosition[0] !== currentPosition[0] || lastPosition[1] !== currentPosition[1]) {
      positions.push(currentPosition)
    }
    return positions
  }, [current, currentIndex, route])
  const motionTrail = useMemo(() => {
    if (traveledPositions.length < 2) return []
    const visibleTrail = traveledPositions.slice(-TRAIL_POINT_LIMIT)
    return visibleTrail.slice(0, -1).map((point, index) => ({
      positions: [point, visibleTrail[index + 1]],
      opacity: 0.1 + ((index + 1) / Math.max(1, visibleTrail.length - 1)) * 0.62,
    }))
  }, [traveledPositions])
  const efficiencyScore = Math.max(0, Math.min(100, Math.round(
    100 - stops.length * 1.5 - events.filter((event) => event.type === 'acceleration').length * 4
      - events.filter((event) => event.type === 'braking').length * 5
      - events.filter((event) => event.type === 'turn').length * 3
      - Math.min(30, speedingMs / 60000),
  )))
  const scoreColor = efficiencyScore >= 80 ? '#35d39a' : efficiencyScore >= 60 ? '#f5b54a' : '#ff625d'

  useEffect(() => {
    if (!route.length || route.length < 2 || !playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      return undefined
    }
    if (virtualTimeRef.current === null) virtualTimeRef.current = timeForProgress(route, progress)
    const step = (frameTime) => {
      if (lastFrameRef.current === null) lastFrameRef.current = frameTime
      const delta = Math.min(100, frameTime - lastFrameRef.current)
      lastFrameRef.current = frameTime
      virtualTimeRef.current += delta * multiplier
      const nextProgress = progressForTime(route, virtualTimeRef.current)
      setProgress(nextProgress)
      if (nextProgress >= route.length - 1) {
        setPlaying(false)
        virtualTimeRef.current = null
        lastFrameRef.current = null
        return
      }
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastFrameRef.current = null
    }
  }, [multiplier, playing, route])

  useEffect(() => {
    if (route.length > 1 && !loading && !error) {
      setProgress(0)
      setPlaying(true)
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [error, loading, route])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === ' ') {
        event.preventDefault()
        if (route.length > 1) setPlaying((value) => !value)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, route.length])

  useEffect(() => {
    localStorage.setItem(MAP_STYLE_STORAGE_KEY, satelliteMode ? 'satellite' : 'map')
  }, [satelliteMode])

  function jumpTo(value) {
    setPlaying(false)
    virtualTimeRef.current = null
    lastFrameRef.current = null
    setProgress(Number(value))
  }

  function jumpToEvent(event) {
    jumpTo(event.index)
  }

  function jumpByEvent(direction) {
    const candidates = direction > 0 ? events : [...events].reverse()
    const target = candidates.find((event) => direction > 0 ? event.index > currentIndex : event.index < currentIndex)
    if (target) jumpToEvent(target)
  }

  function reset() {
    jumpTo(0)
  }

  const routeBounds = route.length ? route : [{ latitude: 33.5731, longitude: -7.5898 }]
  const surfaceClass = 'border border-white/[.10] bg-[rgba(7,17,31,.94)] backdrop-blur-xl'
  const label = (ar, fr) => (isAr ? ar : fr)

  return (
    <div className="fixed inset-0 z-[1000] bg-[#07111f] text-[#edf4f2]" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 h-full w-full">
          <MapContainer center={[routeBounds[0].latitude, routeBounds[0].longitude]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <MapLayers satellite={satelliteMode} />
          <Viewport route={route} current={current} />
          {route.length > 1 && <>
            <Polyline positions={routePositions} pathOptions={{ color: '#ffffff', weight: 8, opacity: .85, lineCap: 'round', lineJoin: 'round' }} />
            <Polyline positions={routePositions} pathOptions={{ color: '#1DBF73', weight: 4, opacity: .95, lineCap: 'round', lineJoin: 'round' }} />
            {traveledPositions.length > 1 && <Polyline positions={traveledPositions} pathOptions={{ color: '#66F2B5', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }} />}
          </>}
          {motionTrail.map((segment, index) => <Polyline key={`trail-${index}`} positions={segment.positions} pathOptions={{ color: '#B6F8D9', weight: 3, opacity: segment.opacity, lineCap: 'round', lineJoin: 'round' }} />)}
          {speedingSegments.map((segment, index) => <Polyline key={`speed-${index}`} positions={segment} pathOptions={{ color: '#ff625d', weight: 8, opacity: .95 }} />)}
          {route.length > 0 && <Marker position={[route[0].latitude, route[0].longitude]} icon={labelIcon(isAr ? 'ب' : 'S', '#35a878')} />}
          {route.length > 1 && <Marker position={[route.at(-1).latitude, route.at(-1).longitude]} icon={labelIcon(isAr ? 'ن' : 'E', '#d55356')} />}
          {showAnalysis && stops.map((stop, index) => <Marker key={`stop-${index}`} position={[stop.latitude, stop.longitude]} icon={labelIcon('P', '#e59518', 24)} />)}
          {showAnalysis && events.filter((event) => event.type !== 'stop' && event.type !== 'speeding').map((event, index) => {
            const meta = eventMeta(event.type, lang)
            return <Marker key={`${event.type}-${event.index}-${index}`} position={[event.latitude, event.longitude]} icon={labelIcon(meta.icon, meta.color, 22)} />
          })}
          {current && <CarMarker current={current} degrees={currentBearing} fast={currentSpeed > SPEED_LIMIT} />}
        </MapContainer>
      </div>

      <MapStyleToggle
        lang={lang}
        satellite={satelliteMode}
        onSatelliteChange={setSatelliteMode}
        style={{ top: 72, left: isAr ? 'auto' : 14, right: isAr ? 14 : 'auto' }}
      />

      <header className={`absolute inset-x-3 top-3 z-[1001] flex h-[52px] items-center gap-3 rounded-2xl px-3 shadow-2xl sm:inset-x-4 ${surfaceClass}`} style={{ background: 'rgba(11,18,32,.90)' }}>
        <button onClick={onClose} aria-label={t(lang, 'close')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/65 transition hover:bg-white/10 hover:text-white"><X size={18} /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-white">{deviceName || t(lang, 'device')}</p>
          <p className="truncate text-[10px] text-white/50">{label('إعادة عرض الرحلة', 'Relecture du trajet')} · {route.length ? `${formatTime(route[0].fixTime, lang, false)} — ${formatTime(route.at(-1).fixTime, lang, false)}` : '—'}</p>
        </div>
        <span className="hidden shrink-0 rounded-lg bg-[#35d39a]/10 px-2 py-1 text-[9px] font-bold tracking-[.12em] text-[#8ceac5] sm:inline">ATHAR GPS</span>
      </header>

      <section className={`pointer-events-auto absolute inset-x-0 bottom-0 z-[1001] flex max-h-[min(82vh,680px)] flex-col rounded-t-3xl shadow-[0_-16px_50px_rgba(0,0,0,.3)] ${surfaceClass}`} style={{ background: 'rgba(11,18,32,.95)' }}>
        <button onClick={() => setShowAnalysis((value) => !value)} aria-expanded={showAnalysis} className="flex w-full shrink-0 items-center justify-center py-2.5">
          <span className="h-1 w-12 rounded-full bg-white/25 transition hover:bg-white/45" />
        </button>

        {error && <div className="mx-4 mb-3 shrink-0 rounded-2xl border border-[#ff625d]/30 bg-[#ff625d]/10 p-3 text-xs text-[#ffaaa6]">{error}</div>}

        {route.length > 0 ? (
          <>
            <div className="shrink-0 px-4 pb-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-white/50">
                <span className="truncate">{formatTime(route[0].fixTime, lang, false)}</span>
                <span className="flex items-center gap-1 rounded-full border border-[#35d39a]/30 bg-[#35d39a]/10 px-2.5 py-1 font-bold text-[#8ceac5]"><Timer size={12} />{formatClock(timeForProgress(route, progress) - new Date(route[0].fixTime).getTime(), lang)}</span>
                <span className="truncate text-end">{formatTime(route.at(-1).fixTime, lang, false)}</span>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-x-0 top-[9px] h-1 rounded-full bg-white/10" />
                <div className="pointer-events-none absolute inset-x-0 top-[9px] h-1 rounded-full bg-[#35d39a]" style={{ width: `${route.length > 1 ? (progress / (route.length - 1)) * 100 : 0}%` }} />
                <input aria-label={label('مؤشر الرحلة', 'Progression du trajet')} type="range" min="0" max={Math.max(0, route.length - 1)} step="0.01" value={progress} onChange={(event) => jumpTo(event.target.value)} className="replay-range relative z-20 w-full" />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-white/45">
                <span className="truncate">{label('النقطة', 'Point')} {currentIndex + 1} {label('من', 'sur')} {route.length} · {Math.round((progress / Math.max(1, route.length - 1)) * 100)}%</span>
                <span className="shrink-0 font-semibold" style={{ color: speedColor(currentSpeed) }}>{current?.speed > SPEED_LIMIT ? label('سرعة عالية', 'Vitesse élevée') : label('ضمن الحد', 'Dans la limite')}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-white/10 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                {[1, 2, 4, 8].map((value) => <button key={value} onClick={() => setMultiplier(value)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black transition ${multiplier === value ? 'bg-[#35d39a] text-[#07111f]' : 'bg-white/[.08] text-white/60 hover:bg-white/[.14]'}`}>{value}x</button>)}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button onClick={() => jumpByEvent(-1)} aria-label={label('الحدث السابق', 'Événement précédent')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[.08] text-white/70 transition hover:bg-white/[.14]"><SkipBack size={15} /></button>
                <button onClick={reset} aria-label={t(lang, 'stop')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[.08] text-white/70 transition hover:bg-white/[.14]"><Square size={13} fill="currentColor" /></button>
                <button onClick={() => { if (progress >= route.length - 1) reset(); setPlaying(true) }} aria-label={t(lang, 'play')} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#35d39a] text-[#07111f] shadow-lg shadow-[#35d39a]/20 transition hover:brightness-110">{playing ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}</button>
                <button onClick={() => setPlaying(false)} aria-label={t(lang, 'pause')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[.08] text-white/70 transition hover:bg-white/[.14]"><Pause size={15} /></button>
                <button onClick={() => jumpByEvent(1)} aria-label={label('الحدث التالي', 'Événement suivant')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[.08] text-white/70 transition hover:bg-white/[.14]"><SkipForward size={15} /></button>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-4 gap-1.5 px-4 pb-3">
              {[
                [RouteIcon, totalDistance.toFixed(1), 'km', label('المسافة', 'Distance')],
                [Gauge, Math.round(maxSpeed), 'km/h', label('السرعة القصوى', 'Vitesse max')],
                [Clock3, formatDuration(durationMs, lang), '', label('المدة', 'Durée')],
                [Navigation, currentSpeed, 'km/h', label('السرعة الحالية', 'Vitesse actuelle'), speedColor(currentSpeed)],
              ].map(([Icon, value, unit, text, accent]) => <div key={text} className="min-w-0 rounded-xl bg-white/[.06] px-1.5 py-2 text-center"><Icon size={13} className="mx-auto" style={{ color: accent || '#35d39a' }} /><p className="mt-1 truncate text-[11px] font-black" style={{ color: accent || '#fff' }}>{value}<small className="ms-0.5 text-[8px] font-normal text-white/45">{unit}</small></p><p className="truncate text-[8px] text-white/40">{text}</p></div>)}
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-white/10 px-4 py-2 text-[10px] text-white/45">
              <MapPin size={13} className="shrink-0 text-[#35d39a]" />
              <span className="truncate">{current?.address || `${current?.latitude?.toFixed(5) || '—'}, ${current?.longitude?.toFixed(5) || '—'}`}</span>
            </div>

            {showAnalysis && <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/10 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white/80"><BarChart3 size={15} className="text-[#35d39a]" />{label('تحليل السائق', 'Analyse conducteur')}<span className="rounded-full bg-[#35d39a]/15 px-2 py-0.5 text-[10px] text-[#8ceac5]">{events.length}</span></div>
                <button className="flex items-center gap-1.5 rounded-xl bg-white/[.06] px-3 py-2 text-[10px] font-bold text-white/60 transition hover:bg-white/[.12]"><Download size={13} />{label('تصدير الرحلة', 'Exporter le trajet')}</button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                {[
                  [Target, stops.length, label('توقفات', 'Arrêts'), '#f5b54a'],
                  [Zap, events.filter((event) => event.type === 'acceleration').length, label('تسارع', 'Accélérations'), '#35d39a'],
                  [AlertTriangle, events.filter((event) => event.type === 'braking').length, label('كبح', 'Freinages'), '#ff625d'],
                  [Navigation, events.filter((event) => event.type === 'turn').length, label('انعطاف', 'Virages'), '#facc15'],
                  [TrendingUp, formatDuration(speedingMs, lang), label('سرعة عالية', 'Excès vitesse'), '#ff625d'],
                  [ShieldCheck, `${efficiencyScore}/100`, label('الكفاءة', 'Efficacité'), scoreColor],
                ].map(([Icon, value, text, color]) => <div key={text} className="rounded-2xl bg-white/[.055] p-2.5 text-center"><Icon size={14} className="mx-auto" style={{ color }} /><p className="mt-1 text-sm font-black text-white">{value}</p><p className="truncate text-[9px] text-white/45">{text}</p></div>)}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-bold text-white/75">
                <span className="flex items-center gap-2"><Activity size={14} className="text-[#35d39a]" />{label('أحداث الرحلة', 'Événements du trajet')}</span>
                <button onClick={() => setShowStops((value) => !value)} aria-expanded={showStops} className="rounded-lg p-1 text-white/50 hover:bg-white/10">{showStops ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
              </div>
              {showStops && <div className="mt-2 space-y-1.5">{events.length ? events.map((event, index) => <button key={`${event.type}-${event.index}-${index}`} onClick={() => jumpToEvent(event)} className="flex w-full items-center justify-between gap-2 rounded-xl bg-white/[.05] px-3 py-2 text-start text-[10px] transition hover:bg-white/[.10]"><span className="flex min-w-0 items-center gap-2 text-white/65"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-[#07111f]" style={{ background: eventMeta(event.type, lang).color }}>{eventMeta(event.type, lang).icon}</span><span className="truncate">{eventMessage(event, lang)}</span></span><span className="shrink-0 text-white/40">{formatTime(route[event.index]?.fixTime, lang, false)}</span></button>) : <p className="px-1 py-2 text-[10px] text-white/40">{label('لا توجد أحداث مسجلة', 'Aucun événement détecté')}</p>}</div>}
            </div>}
          </>
        ) : (
          <div className="flex min-h-[150px] shrink-0 items-center justify-center px-4 pb-6 text-center text-xs text-white/50">{error || (loading ? label('جار تحميل الرحلة…', 'Chargement du trajet…') : label('لا توجد نقاط لهذه الرحلة', 'Aucun point pour ce trajet'))}</div>
        )}
      </section>

    </div>
  )
}