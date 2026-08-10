import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Activity, ChevronDown, ChevronRight, Gauge, Loader2, MapPin, Pause, Play, Route as RouteIcon, Square, Target, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../api/index.js'
import { t } from '../i18n/translations'
import GeoapifyTileLayer from './GeoapifyTileLayer'

const STOP_SPEED = 2
const SPEED_LIMIT = 80
const MIN_STOP_MS = 2 * 60 * 1000

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
  const R = 6371
  const lat1 = a.latitude * Math.PI / 180
  const lat2 = b.latitude * Math.PI / 180
  const dLat = (b.latitude - a.latitude) * Math.PI / 180
  const dLng = (b.longitude - a.longitude) * Math.PI / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng), Math.sqrt(1 - sinLat * sinLat - Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng))
}

function formatTime(value, lang, withSeconds = true) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}),
    }).format(new Date(value))
  } catch { return '—' }
}

function formatDuration(ms, lang) {
  const minutes = Math.max(0, Math.round(ms / 60000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours) return lang === 'ar' ? `${hours} س ${rest} د` : `${hours} h ${rest} min`
  return lang === 'ar' ? `${minutes} د` : `${minutes} min`
}

function bearing(a, b) {
  const y = Math.sin((b.longitude - a.longitude) * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180)
  const x = Math.cos(a.latitude * Math.PI / 180) * Math.sin(b.latitude * Math.PI / 180) - Math.sin(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) * Math.cos((b.longitude - a.longitude) * Math.PI / 180)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
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
    html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:${background};border:3px solid rgba(255,255,255,.92);box-shadow:0 4px 14px rgba(0,0,0,.38);color:white;font:800 12px Cairo,sans-serif">${label}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

function carIcon(degrees) {
  return L.divIcon({
    className: 'athar-replay-car',
    html: `<span class="athar-replay-car-body" style="display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:50%;background:#0f2044;border:2px solid #1dbf73;box-shadow:0 0 0 5px rgba(29,191,115,.16),0 8px 20px rgba(0,0,0,.42);transform:rotate(${degrees}deg);transition:transform .2s linear"><svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5S16.67 13 17.5 13s1.5.67 1.5 1.5S16.67 16 17.5 16zM5 11l1.5-4.5h11L19 11H5z"/></svg></span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  })
}

function CarMarker({ current, degrees }) {
  const markerRef = useRef(null)
  const icon = useMemo(() => carIcon(0), [])

  useEffect(() => {
    const body = markerRef.current?.getElement()?.querySelector('.athar-replay-car-body')
    if (body) body.style.transform = `rotate(${degrees}deg)`
  }, [degrees])

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
    if (current) map.panTo([current.latitude, current.longitude], { animate: true, duration: 0.3 })
  }, [current, map])
  return null
}

export default function TripReplay({ deviceId, deviceName, startTime, endTime, positions: suppliedPositions = [], onClose }) {
  const { lang } = useApp()
  const isAr = lang === 'ar'
  const [route, setRoute] = useState(() => suppliedPositions.filter(validPoint).map(normalisePoint))
  const [loading, setLoading] = useState(route.length === 0)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [multiplier, setMultiplier] = useState(1)
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
      .then(data => {
        if (!cancelled) setRoute((Array.isArray(data) ? data : []).filter(validPoint).map(normalisePoint))
      })
      .catch(() => { if (!cancelled) setError(t(lang, 'replayError')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [deviceId, startTime, endTime, lang, suppliedPositions])

  const durationMs = useMemo(() => route.length > 1 ? Math.max(1000, new Date(route.at(-1).fixTime) - new Date(route[0].fixTime)) : 0, [route])
  const currentIndex = route.length ? Math.min(route.length - 1, Math.floor(progress)) : 0
  const current = useMemo(() => {
    if (!route.length) return null
    const a = route[currentIndex]
    const b = route[Math.min(route.length - 1, currentIndex + 1)] || a
    const ratio = Math.min(1, Math.max(0, progress - currentIndex))
    return {
      ...a,
      latitude: a.latitude + (b.latitude - a.latitude) * ratio,
      longitude: a.longitude + (b.longitude - a.longitude) * ratio,
      speed: a.speed + (b.speed - a.speed) * ratio,
      fixTime: new Date(new Date(a.fixTime).getTime() + (new Date(b.fixTime).getTime() - new Date(a.fixTime).getTime()) * ratio).toISOString(),
      address: ratio > 0.55 && b.address ? b.address : a.address,
    }
  }, [route, currentIndex, progress])

  const stops = useMemo(() => {
    const result = []
    let start = null
    for (let i = 0; i < route.length; i++) {
      const stopped = route[i].speed < STOP_SPEED
      if (stopped && start === null) start = i
      const nextMoving = !stopped || i === route.length - 1
      if (start !== null && nextMoving) {
        const end = stopped ? i : i - 1
        const duration = new Date(route[end].fixTime) - new Date(route[start].fixTime)
        if (duration >= MIN_STOP_MS) result.push({ ...route[start], endTime: route[end].fixTime, duration })
        start = null
      }
    }
    return result
  }, [route])

  const speedingSegments = useMemo(() => route.slice(1).flatMap((point, index) => point.speed > SPEED_LIMIT ? [[route[index].latitude, route[index].longitude], [point.latitude, point.longitude]] : []), [route])
  const speedingCount = useMemo(() => route.filter(point => point.speed > SPEED_LIMIT).length, [route])
  const totalDistance = useMemo(() => route.slice(1).reduce((sum, point, index) => sum + haversine(route[index], point), 0), [route])
  const maxSpeed = useMemo(() => route.reduce((max, point) => Math.max(max, point.speed), 0), [route])
  const currentSpeed = current ? Math.round(current.speed) : 0
  const currentBearing = current && route.length > 1 ? bearing(route[currentIndex], route[Math.min(route.length - 1, currentIndex + 1)]) : 0

  useEffect(() => {
    if (!route.length || route.length < 2) return undefined
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      return undefined
    }
    if (virtualTimeRef.current === null) virtualTimeRef.current = timeForProgress(route, progress)
    const step = frameTime => {
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
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; lastFrameRef.current = null }
  }, [playing, multiplier, route, durationMs])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      } else if (event.key === ' ') {
        event.preventDefault()
        if (route.length > 1) {
          if (progress >= route.length - 1) reset()
          setPlaying(value => !value)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, route.length, progress])

  useEffect(() => {
    if (route.length > 1 && !loading && !error) {
      setProgress(0)
      setPlaying(true)
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [route, loading, error])

  function jumpTo(value) {
    setPlaying(false)
    virtualTimeRef.current = null
    lastFrameRef.current = null
    setProgress(Number(value))
  }

  function reset() {
    setPlaying(false)
    virtualTimeRef.current = null
    lastFrameRef.current = null
    setProgress(0)
  }

  const routeBounds = route.length ? route : [{ latitude: 33.5731, longitude: -7.5898 }]
  const panelDirection = isAr ? 'right' : 'left'
  const surface = 'rgba(10,18,32,0.94)'
  const surfaceClass = 'border border-white/[.08] bg-[rgba(10,18,32,.94)] backdrop-blur-md'

  return (
    <div className="fixed inset-0 z-[1000] bg-[#07111f] text-[#edf4f2]" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 h-full w-full">
        <MapContainer center={[routeBounds[0].latitude, routeBounds[0].longitude]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl>
          <GeoapifyTileLayer />
          <Viewport route={route} current={current} />
          {route.length > 1 && <>
            <Polyline positions={route.map(point => [point.latitude, point.longitude])} pathOptions={{ color: 'rgba(0,0,0,.28)', weight: 9, opacity: .9 }} />
            <Polyline positions={route.map(point => [point.latitude, point.longitude])} pathOptions={{ color: '#10B981', weight: 5, opacity: .96 }} />
          </>}
          {speedingSegments.map((segment, index) => <Polyline key={`speed-${index}`} positions={segment} pathOptions={{ color: '#ef6860', weight: 7, opacity: .92 }} />)}
          {route.length > 0 && <Marker position={[route[0].latitude, route[0].longitude]} icon={labelIcon('S', '#2dbb79')} />}
          {route.length > 1 && <Marker position={[route.at(-1).latitude, route.at(-1).longitude]} icon={labelIcon('E', '#e46b68')} />}
          {showStops && stops.map((stop, index) => <Marker key={`stop-${index}`} position={[stop.latitude, stop.longitude]} icon={labelIcon('P', '#f59e0b')} />)}
          {current && <CarMarker current={current} degrees={currentBearing} />}
        </MapContainer>
      </div>

      <div className={`absolute top-0 ${panelDirection}-0 z-[1001] w-full max-w-[390px] p-3 sm:p-4`}>
        <div className={`${surfaceClass} max-h-[180px] overflow-hidden rounded-2xl p-3 shadow-2xl`} style={{ background: surface }}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#1DBF73]">إعادة العرض · ATHAR GPS</p>
            <button onClick={onClose} aria-label={t(lang, 'close')} className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"><X size={16} /></button>
          </div>
          <h1 className="mt-1 truncate text-base font-extrabold text-white">{deviceName || t(lang, 'device')}</h1>
          <p className="mt-0.5 truncate text-[10px] text-white/50">{route.length ? `${formatTime(route[0].fixTime, lang, false)} — ${formatTime(route.at(-1).fixTime, lang, false)}` : '—'}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/[.06] px-2.5 py-1.5"><p className="text-[9px] text-white/50">{t(lang, 'speed')}</p><p className="mt-0.5 text-lg font-black text-[#1DBF73]">{currentSpeed}<span className="ms-1 text-[10px] font-normal text-white/55">km/h</span></p></div>
            <div className="rounded-xl bg-white/[.06] px-2.5 py-1.5"><p className="text-[9px] text-white/50">{t(lang, 'timestamp')}</p><p className="mt-1 truncate text-[10px] font-bold text-white">{current ? formatTime(current.fixTime, lang) : '—'}</p></div>
          </div>
          <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[10px] text-white/45">
            <MapPin size={12} className="shrink-0 text-[#1DBF73]" />
            <p className="truncate">{current?.address || `${current?.latitude?.toFixed(5) || '—'}, ${current?.longitude?.toFixed(5) || '—'}`}</p>
          </div>
          {error && <div className="mt-3 rounded-2xl border border-[#e46b68]/30 bg-[#e46b68]/10 p-3 text-xs text-[#ffaaa6]">{error}</div>}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1001] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
          <div className={`pointer-events-auto w-full max-w-[390px] self-start rounded-2xl p-3 shadow-2xl ${surfaceClass}`} style={{ background: surface }}>
            <button onClick={() => setShowStops(value => !value)} className="flex w-full items-center justify-between text-xs font-bold text-white/75">
              <span className="flex items-center gap-2"><Target size={14} className="text-[#1DBF73]" />{t(lang, 'stops')} <span className="rounded-full bg-[#1DBF73]/15 px-2 py-0.5 text-[#75e6bd]">{stops.length}</span></span>
              {showStops ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
            {showStops && <div className="mt-2 space-y-1.5">{stops.length ? stops.map((stop, index) => <div key={index} className="flex items-center justify-between rounded-xl bg-white/[.05] px-3 py-2 text-[10px]"><span className="text-white/60">{formatTime(stop.fixTime, lang, false)}</span><span className="font-bold text-[#f5b54a]">{formatDuration(stop.duration, lang)}</span></div>) : <p className="px-1 py-2 text-[10px] text-white/40">{t(lang, 'noStops')}</p>}</div>}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3 text-[10px]"><span className="text-white/45">{t(lang, 'speeding')}</span><span className={`font-bold ${speedingCount ? 'text-[#ff8c86]' : 'text-white/60'}`}>{speedingCount ? `${speedingCount}` : t(lang, 'none')}</span></div>
          </div>

          <div className={`pointer-events-auto w-full rounded-2xl p-3 shadow-2xl sm:p-4 ${surfaceClass}`} style={{ background: surface }}>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-5 text-sm text-white/60"><Loader2 size={18} className="animate-spin text-[#38d39f]" />{t(lang, 'loadingPositions')}</div>
          ) : !route.length ? (
            <div className="py-5 text-center text-sm text-white/55">{t(lang, 'noPositions')}</div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <input aria-label={t(lang, 'point')} type="range" min="0" max={Math.max(0, route.length - 1)} step="0.01" value={progress} onChange={event => jumpTo(event.target.value)} className="replay-range flex-1" />
                <span className="min-w-[84px] text-end text-[11px] font-bold text-white/65">{t(lang, 'point')} {currentIndex + 1} {t(lang, 'of')} {route.length}</span>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2 border-b border-white/10 pb-3 text-[10px] text-white/60">
                <span className="flex items-center justify-center gap-1"><RouteIcon size={13} className="text-[#1DBF73]" />{totalDistance.toFixed(1)} km</span>
                <span className="flex items-center justify-center gap-1"><Gauge size={13} className="text-[#1DBF73]" />{Math.round(maxSpeed)} km/h</span>
                <span className="flex items-center justify-center gap-1"><Activity size={13} className="text-[#1DBF73]" />{currentSpeed} km/h</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {[8, 4, 2, 1].map(value => <button key={value} onClick={() => setMultiplier(value)} className={`rounded-xl px-3 py-2 text-xs font-black transition ${multiplier === value ? 'bg-[#1DBF73] text-[#07111f]' : 'bg-white/[.08] text-white/60 hover:bg-white/[.14]'}`}>{value}x</button>)}
                  <div className="mx-1 h-7 w-px bg-white/10" />
                  <button onClick={reset} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[.08] text-white/80 transition hover:bg-white/[.14]" aria-label={t(lang, 'stop')}><Square size={16} fill="currentColor" /></button>
                  <button onClick={() => setPlaying(false)} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[.08] text-white/80 transition hover:bg-white/[.14]" aria-label={t(lang, 'pause')}><Pause size={17} /></button>
                  <button onClick={() => { if (progress >= route.length - 1) reset(); setPlaying(true) }} className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[#1DBF73] text-[#07111f] shadow-lg shadow-[#1DBF73]/20 transition hover:brightness-110" aria-label={t(lang, 'play')}>{playing ? <Pause size={19} /> : <Play size={19} fill="currentColor" />}</button>
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
