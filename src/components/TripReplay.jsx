import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  Activity, AlertTriangle, BarChart3, ChevronDown, ChevronRight, Clock3,
  Download, Gauge, Loader2, MapPin, Navigation, Pause, Play, Route as RouteIcon,
  ShieldCheck, SkipBack, SkipForward, Square, Target, Timer, TrendingUp, X, Zap,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../api/index.js'
import { t } from '../i18n/translations'
import GeoapifyTileLayer from './GeoapifyTileLayer'

const STOP_SPEED = 2
const SPEED_LIMIT = 80
const MIN_STOP_MS = 2 * 60 * 1000
const ACCELERATION_LIMIT = 2.5
const BRAKING_LIMIT = -3
const MAX_EVENT_INTERVAL_MS = 30 * 1000

function validPoint(point) {
  const latitude = Number(point?.latitude ?? point?.lat)
  const longitude = Number(point?.longitude ?? point?.lng)
  const time = new Date(point?.fixTime ?? point?.timestamp ?? point?.time)
  return Number.isFinite(latitude) && Number.isFinite(longitude) && !Number.isNaN(time.getTime())
}

function normalisePoint(point) {
  return {
    latitude: Number(point.latitude ?? point.lat),
    longitude: Number(point.longitude ?? point.lng),
    speed: Math.max(0, Number(point.speed ?? 0)),
    fixTime: point.fixTime ?? point.timestamp ?? point.time,
    address: point.address || null,
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

function labelIcon(label, background) {
  return L.divIcon({
    className: 'athar-replay-marker',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:${background};border:3px solid rgba(255,255,255,.95);box-shadow:0 5px 16px rgba(0,0,0,.42);color:white;font:800 12px Arial,sans-serif">${label}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function carIcon() {
  return L.divIcon({
    className: 'athar-replay-car',
    html: `<span class="athar-replay-car-body" style="display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:16px;background:#101e35;border:2px solid #ff534d;box-shadow:0 0 0 6px rgba(255,83,77,.18),0 10px 24px rgba(0,0,0,.5);transform:rotate(0deg);transition:transform .18s linear"><svg width="29" height="29" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7.4 5.25h9.2c.58 0 1.1.36 1.3.9L20 12v6.1c0 .5-.4.9-.9.9h-.8a.9.9 0 0 1-.9-.9v-1.05H6.6V18.1a.9.9 0 0 1-.9.9h-.8c-.5 0-.9-.4-.9-.9V12l2.1-5.85c.2-.54.72-.9 1.3-.9Z" fill="#F95752"/><path d="M6.2 11h11.6l-1.1-3.1a.85.85 0 0 0-.8-.55H8.1a.85.85 0 0 0-.8.55L6.2 11Z" fill="#FFD6D3"/><circle cx="7.2" cy="14.2" r="1.25" fill="#101e35"/><circle cx="16.8" cy="14.2" r="1.25" fill="#101e35"/><path d="M10 12.4h4" stroke="#101e35" stroke-width="1.2" stroke-linecap="round"/></svg></span>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  })
}

function CarMarker({ current, degrees, fast }) {
  const markerRef = useRef(null)
  const icon = useMemo(() => carIcon(), [])

  useEffect(() => {
    const element = markerRef.current?.getElement()
    const body = element?.querySelector('.athar-replay-car-body')
    if (body) {
      body.style.transform = `rotate(${degrees}deg)`
      body.style.boxShadow = fast
        ? '0 0 0 7px rgba(255,83,77,.28),0 0 25px rgba(255,83,77,.55),0 10px 24px rgba(0,0,0,.5)'
        : '0 0 0 6px rgba(255,83,77,.18),0 10px 24px rgba(0,0,0,.5)'
    }
  }, [degrees, fast])

  return <Marker ref={markerRef} position={[current.latitude, current.longitude]} icon={icon} />
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
  const icons = { stop: 'P', acceleration: '↗', braking: '!', turn: '↪', speeding: '!' }
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
  const [showAnalysis, setShowAnalysis] = useState(true)
  const [showStops, setShowStops] = useState(true)
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
  const currentBearing = current && route.length > 1
    ? bearing(route[Math.min(currentIndex, route.length - 2)], route[Math.min(route.length - 1, currentIndex + 1)])
    : 0
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
  const surface = 'rgba(7, 17, 31, .94)'
  const surfaceClass = 'border border-white/[.10] bg-[rgba(7,17,31,.94)] backdrop-blur-xl'
  const label = (ar, fr) => (isAr ? ar : fr)

  return (
    <div className="fixed inset-0 z-[1000] bg-[#07111f] text-[#edf4f2]" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 h-full w-full">
        <MapContainer center={[routeBounds[0].latitude, routeBounds[0].longitude]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl>
          <GeoapifyTileLayer />
          <Viewport route={route} current={current} />
          {route.length > 1 && <>
            <Polyline positions={route.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: '#06111e', weight: 10, opacity: .8 }} />
            <Polyline positions={route.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: '#35d39a', weight: 5, opacity: .95 }} />
          </>}
          {speedingSegments.map((segment, index) => <Polyline key={`speed-${index}`} positions={segment} pathOptions={{ color: '#ff625d', weight: 8, opacity: .95 }} />)}
          {route.length > 0 && <Marker position={[route[0].latitude, route[0].longitude]} icon={labelIcon('S', '#35a878')} />}
          {route.length > 1 && <Marker position={[route.at(-1).latitude, route.at(-1).longitude]} icon={labelIcon('E', '#d55356')} />}
          {showAnalysis && stops.map((stop, index) => <Marker key={`stop-${index}`} position={[stop.latitude, stop.longitude]} icon={labelIcon('P', '#e59518')} />)}
          {showAnalysis && events.filter((event) => event.type !== 'stop' && event.type !== 'speeding').map((event, index) => {
            const meta = eventMeta(event.type, lang)
            return <Marker key={`${event.type}-${event.index}-${index}`} position={[event.latitude, event.longitude]} icon={labelIcon(meta.icon, meta.color)} />
          })}
          {current && <CarMarker current={current} degrees={currentBearing} fast={currentSpeed > SPEED_LIMIT} />}
        </MapContainer>
      </div>

      <div className={`absolute top-0 ${isAr ? 'right-0' : 'left-0'} z-[1001] w-full max-w-[420px] p-3 sm:p-4`}>
        <div className={`${surfaceClass} max-h-[calc(100vh-230px)] overflow-y-auto rounded-3xl p-4 shadow-2xl`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#35d39a]">ATHAR GPS · {label('إعادة العرض', 'REPLAY')}</p>
              <h1 className="mt-1 truncate text-lg font-extrabold text-white">{deviceName || t(lang, 'device')}</h1>
              <p className="mt-1 text-[10px] text-white/50">{route.length ? `${formatTime(route[0].fixTime, lang, false)} — ${formatTime(route.at(-1).fixTime, lang, false)}` : '—'}</p>
            </div>
            <button onClick={onClose} aria-label={t(lang, 'close')} className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white"><X size={18} /></button>
          </div>

          {error && <div className="mt-3 rounded-2xl border border-[#ff625d]/30 bg-[#ff625d]/10 p-3 text-xs text-[#ffaaa6]">{error}</div>}
          {route.length > 0 && (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white/[.06] p-3"><p className="text-[10px] text-white/45">{label('السرعة الحالية', 'Vitesse actuelle')}</p><p className="mt-1 text-xl font-black text-[#35d39a]">{currentSpeed}<span className="ms-1 text-[10px] font-normal text-white/50">km/h</span></p></div>
                <div className="rounded-2xl bg-white/[.06] p-3"><p className="text-[10px] text-white/45">{label('الوقت الحالي', 'Heure actuelle')}</p><p className="mt-2 truncate text-xs font-bold text-white">{formatTime(current?.fixTime, lang)}</p></div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-white/50">
                <MapPin size={13} className="shrink-0 text-[#35d39a]" />
                <span className="truncate">{current?.address || `${current?.latitude?.toFixed(5) || '—'}, ${current?.longitude?.toFixed(5) || '—'}`}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
                <div className="text-center"><RouteIcon size={14} className="mx-auto text-[#35d39a]" /><p className="mt-1 text-xs font-bold text-white">{totalDistance.toFixed(1)} <small className="text-[9px] text-white/45">km</small></p></div>
                <div className="text-center"><Gauge size={14} className="mx-auto text-[#35d39a]" /><p className="mt-1 text-xs font-bold text-white">{Math.round(maxSpeed)} <small className="text-[9px] text-white/45">km/h</small></p></div>
                <div className="text-center"><Clock3 size={14} className="mx-auto text-[#35d39a]" /><p className="mt-1 text-xs font-bold text-white">{formatDuration(durationMs, lang)}</p></div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1001] px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
          {route.length > 0 && (
            <div className={`pointer-events-auto w-full rounded-3xl p-3 shadow-2xl sm:p-4 ${surfaceClass}`} style={{ background: surface }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button onClick={() => setShowAnalysis((value) => !value)} className="flex items-center gap-2 text-xs font-bold text-white/80">
                  <BarChart3 size={15} className="text-[#35d39a]" />{label('تحليل السائق', 'Analyse conducteur')}
                  <span className="rounded-full bg-[#35d39a]/15 px-2 py-0.5 text-[#8ceac5]">{events.length}</span>
                  {showAnalysis ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
                <button className="flex items-center gap-1.5 rounded-xl bg-white/[.06] px-3 py-2 text-[10px] font-bold text-white/60 hover:bg-white/[.12]">
                  <Download size={13} />{label('تصدير الرحلة', 'Exporter le trajet')}
                </button>
              </div>
              {showAnalysis && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                {[
                  [Target, stops.length, label('توقفات', 'Arrêts'), '#f5b54a'],
                  [Zap, events.filter((event) => event.type === 'acceleration').length, label('تسارع', 'Accélérations'), '#35d39a'],
                  [AlertTriangle, events.filter((event) => event.type === 'braking').length, label('كبح', 'Freinages'), '#ff625d'],
                  [Navigation, events.filter((event) => event.type === 'turn').length, label('انعطاف', 'Virages'), '#facc15'],
                  [TrendingUp, formatDuration(speedingMs, lang), label('سرعة عالية', 'Excès vitesse'), '#ff625d'],
                  [ShieldCheck, `${efficiencyScore}/100`, label('الكفاءة', 'Efficacité'), scoreColor],
                ].map(([Icon, value, text, color]) => <div key={text} className="rounded-2xl bg-white/[.055] p-2.5 text-center"><Icon size={14} className="mx-auto" style={{ color }} /><p className="mt-1 text-sm font-black text-white">{value}</p><p className="truncate text-[9px] text-white/45">{text}</p></div>)}
              </div>}
            </div>
          )}

          {route.length > 0 && (
            <div className={`pointer-events-auto w-full rounded-3xl p-3 shadow-2xl sm:p-4 ${surfaceClass}`} style={{ background: surface }}>
              <div className="mb-2 flex items-center justify-between gap-3 text-[10px] text-white/50">
                <span>{formatTime(route[0].fixTime, lang, false)}</span>
                <span className="flex items-center gap-1 font-bold text-white/75"><Timer size={13} className="text-[#35d39a]" />{formatClock(timeForProgress(route, progress) - new Date(route[0].fixTime).getTime(), lang)}</span>
                <span>{formatTime(route.at(-1).fixTime, lang, false)}</span>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-x-0 top-[9px] h-1 rounded-full bg-white/10" />
                {events.map((event, index) => <button key={`${event.type}-${event.index}-${index}`} onClick={() => jumpToEvent(event)} title={eventMessage(event, lang)} className="absolute top-[5px] z-10 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-[#07111f] transition hover:scale-150" style={{ left: `${route.length > 1 ? (event.index / (route.length - 1)) * 100 : 0}%`, background: eventMeta(event.type, lang).color }} />)}
                <input aria-label={label('مؤشر الرحلة', 'Progression du trajet')} type="range" min="0" max={Math.max(0, route.length - 1)} step="0.01" value={progress} onChange={(event) => jumpTo(event.target.value)} className="replay-range relative z-20 w-full" />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-white/45">
                <span>{label('النقطة', 'Point')} {currentIndex + 1} {label('من', 'sur')} {route.length} · {Math.round((progress / Math.max(1, route.length - 1)) * 100)}%</span>
                <span>{current?.speed > SPEED_LIMIT ? label('سرعة عالية', 'Vitesse élevée') : label('ضمن الحد', 'Dans la limite')}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {[8, 4, 2, 1].map((value) => <button key={value} onClick={() => setMultiplier(value)} className={`rounded-xl px-3 py-2 text-xs font-black transition ${multiplier === value ? 'bg-[#35d39a] text-[#07111f]' : 'bg-white/[.08] text-white/60 hover:bg-white/[.14]'}`}>{value}x</button>)}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => jumpByEvent(-1)} aria-label={label('الحدث السابق', 'Événement précédent')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[.08] text-white/70 hover:bg-white/[.14]"><SkipBack size={16} /></button>
                  <button onClick={reset} aria-label={t(lang, 'stop')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[.08] text-white/70 hover:bg-white/[.14]"><Square size={14} fill="currentColor" /></button>
                  <button onClick={() => setPlaying(false)} aria-label={t(lang, 'pause')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[.08] text-white/70 hover:bg-white/[.14]"><Pause size={16} /></button>
                  <button onClick={() => { if (progress >= route.length - 1) reset(); setPlaying(true) }} aria-label={t(lang, 'play')} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#35d39a] text-[#07111f] shadow-lg shadow-[#35d39a]/20 transition hover:brightness-110">{playing ? <Pause size={19} /> : <Play size={19} fill="currentColor" />}</button>
                  <button onClick={() => jumpByEvent(1)} aria-label={label('الحدث التالي', 'Événement suivant')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[.08] text-white/70 hover:bg-white/[.14]"><SkipForward size={16} /></button>
                </div>
              </div>
            </div>
          )}

          {route.length > 0 && showAnalysis && (
            <div className={`pointer-events-auto hidden max-h-32 w-full max-w-[420px] self-end overflow-y-auto rounded-3xl p-3 shadow-2xl sm:block ${surfaceClass}`} style={{ background: surface }}>
              <button onClick={() => setShowStops((value) => !value)} className="flex w-full items-center justify-between text-xs font-bold text-white/75">
                <span className="flex items-center gap-2"><Activity size={14} className="text-[#35d39a]" />{label('أحداث الرحلة', 'Événements du trajet')}</span>
                {showStops ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
              {showStops && <div className="mt-2 space-y-1.5">{events.length ? events.slice(0, 8).map((event, index) => <button key={`${event.type}-${event.index}-${index}`} onClick={() => jumpToEvent(event)} className="flex w-full items-center justify-between rounded-xl bg-white/[.05] px-3 py-2 text-start text-[10px] hover:bg-white/[.10]"><span className="flex items-center gap-2 text-white/65"><span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black text-[#07111f]" style={{ background: eventMeta(event.type, lang).color }}>{eventMeta(event.type, lang).icon}</span>{eventMessage(event, lang)}</span><span className="text-white/40">{formatTime(route[event.index]?.fixTime, lang, false)}</span></button>) : <p className="px-1 py-2 text-[10px] text-white/40">{label('لا توجد أحداث مسجلة', 'Aucun événement détecté')}</p>}</div>}
            </div>
          )}
        </div>
      </div>

      {loading && <div className="pointer-events-none absolute inset-0 z-[1002] flex items-center justify-center"><div className={`${surfaceClass} flex items-center gap-3 rounded-2xl px-5 py-4 text-sm text-white/70 shadow-2xl`} style={{ background: surface }}><Loader2 size={18} className="animate-spin text-[#35d39a]" />{t(lang, 'loadingPositions')}</div></div>}
    </div>
  )
}