import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Activity, ChevronDown, ChevronLeft, ChevronRight, Clock3, Gauge, Loader2, MapPin, Pause, Play, RotateCcw, Route as RouteIcon, Square, Target, X } from 'lucide-react'
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
    html: `<span style="display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:50%;background:#102b4c;border:2px solid #38d39f;box-shadow:0 0 0 5px rgba(56,211,159,.16),0 8px 20px rgba(0,0,0,.42);transform:rotate(${degrees}deg);transition:transform .1s linear"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m5 16 1.7-7.1A2 2 0 0 1 8.65 7.4h6.7a2 2 0 0 1 1.95 1.5L19 16"/><path d="M4 16h16v3H4z"/><path d="M7 19v2M17 19v2M7 12h10"/></svg></span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  })
}

function Viewport({ route, current }) {
  const map = useMap()
  const fitDone = useRef(false)
  useEffect(() => {
    if (route.length > 1 && !fitDone.current) {
      fitDone.current = true
      map.fitBounds(route.map(point => [point.latitude, point.longitude]), { padding: [70, 70], animate: false })
    }
  }, [map, route])
  useEffect(() => {
    if (current) map.panTo([current.latitude, current.longitude], { animate: false })
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
  const totalDistance = useMemo(() => route.slice(1).reduce((sum, point, index) => sum + haversine(route[index], point), 0), [route])
  const maxSpeed = useMemo(() => route.reduce((max, point) => Math.max(max, point.speed), 0), [route])
  const averageSpeed = useMemo(() => route.length ? route.reduce((sum, point) => sum + point.speed, 0) / route.length : 0, [route])
  const currentBearing = current && route.length > 1 ? bearing(route[currentIndex], route[Math.min(route.length - 1, currentIndex + 1)]) : 0

  useEffect(() => {
    if (!route.length || route.length < 2) return undefined
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      return undefined
    }
    if (virtualTimeRef.current === null) virtualTimeRef.current = new Date(route[0].fixTime).getTime() + (progress / (route.length - 1)) * durationMs
    const step = frameTime => {
      if (lastFrameRef.current === null) lastFrameRef.current = frameTime
      const delta = Math.min(100, frameTime - lastFrameRef.current)
      lastFrameRef.current = frameTime
      virtualTimeRef.current += delta * multiplier
      const nextProgress = Math.min(route.length - 1, ((virtualTimeRef.current - new Date(route[0].fixTime).getTime()) / durationMs) * (route.length - 1))
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

  return (
    <div className="fixed inset-0 z-[1000] bg-[#07111f] text-[#edf4f2]" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0">
        <MapContainer center={[routeBounds[0].latitude, routeBounds[0].longitude]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl>
          <GeoapifyTileLayer />
          <Viewport route={route} current={current} />
          {route.length > 1 && <Polyline positions={route.map(point => [point.latitude, point.longitude])} pathOptions={{ color: '#38d39f', weight: 5, opacity: .86 }} />}
          {speedingSegments.map((segment, index) => <Polyline key={`speed-${index}`} positions={segment} pathOptions={{ color: '#ef6860', weight: 7, opacity: .92 }} />)}
          {route.length > 0 && <Marker position={[route[0].latitude, route[0].longitude]} icon={labelIcon('S', '#2dbb79')} />}
          {route.length > 1 && <Marker position={[route.at(-1).latitude, route.at(-1).longitude]} icon={labelIcon('E', '#e46b68')} />}
          {showStops && stops.map((stop, index) => <Marker key={`stop-${index}`} position={[stop.latitude, stop.longitude]} icon={labelIcon('P', '#d9a24f')} />)}
          {current && <Marker position={[current.latitude, current.longitude]} icon={carIcon(currentBearing)} />}
        </MapContainer>
      </div>

      <div className={`absolute top-0 ${panelDirection}-0 z-[1001] w-full max-w-[390px] p-4 sm:p-6`}>
        <div className="rounded-3xl border border-white/10 bg-[#0b1b33]/92 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#38d39f]/15 text-[#38d39f]"><RouteIcon size={20} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#38d39f]">ATHAR GPS · {t(lang, 'replay')}</p>
              <h1 className="mt-1 truncate text-lg font-extrabold">{deviceName || t(lang, 'device')}</h1>
              <p className="mt-1 text-[11px] text-white/45">{route.length ? `${formatTime(route[0].fixTime, lang, false)} — ${formatTime(route.at(-1).fixTime, lang, false)}` : '—'}</p>
            </div>
            <button onClick={onClose} aria-label={t(lang, 'close')} className="rounded-xl p-2 text-white/55 transition hover:bg-white/10 hover:text-white"><X size={18} /></button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/[.06] p-3"><p className="text-[10px] text-white/45">{t(lang, 'speed')}</p><p className="mt-1 text-2xl font-black text-[#38d39f]">{current ? Math.round(current.speed) : 0}<span className="ml-1 text-xs font-normal text-white/45">km/h</span></p></div>
            <div className="rounded-2xl bg-white/[.06] p-3"><p className="text-[10px] text-white/45">{t(lang, 'timestamp')}</p><p className="mt-2 text-xs font-bold">{current ? formatTime(current.fixTime, lang) : '—'}</p></div>
          </div>
          <div className="mt-2 rounded-2xl bg-white/[.04] p-3">
            <div className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0 text-[#d9ad62]" /><p className="line-clamp-2 text-xs text-white/65">{current?.address || `${current?.latitude?.toFixed(5) || '—'}, ${current?.longitude?.toFixed(5) || '—'}`}</p></div>
          </div>
          {error && <div className="mt-3 rounded-2xl border border-[#e46b68]/30 bg-[#e46b68]/10 p-3 text-xs text-[#ffaaa6]">{error}</div>}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-[1001] p-3 sm:p-6">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-[#0b1b33]/94 p-4 shadow-2xl backdrop-blur-xl">
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => { if (progress >= route.length - 1) reset(); setPlaying(true) }} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#38d39f] text-[#07111f] shadow-lg shadow-[#38d39f]/20 transition hover:brightness-110" aria-label={t(lang, 'play')}>{playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}</button>
                  <button onClick={() => setPlaying(false)} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[.08] text-white/80 transition hover:bg-white/[.14]" aria-label={t(lang, 'pause')}><Pause size={17} /></button>
                  <button onClick={reset} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[.08] text-white/80 transition hover:bg-white/[.14]" aria-label={t(lang, 'stop')}><Square size={16} fill="currentColor" /></button>
                  <div className="mx-1 h-7 w-px bg-white/10" />
                  {[1, 2, 4, 8].map(value => <button key={value} onClick={() => setMultiplier(value)} className={`rounded-xl px-3 py-2 text-xs font-black transition ${multiplier === value ? 'bg-[#d9ad62] text-[#07111f]' : 'bg-white/[.07] text-white/55 hover:bg-white/[.12]'}`}>{value}x</button>)}
                </div>
                <div className="flex items-center gap-4 text-[11px] text-white/55">
                  <span className="flex items-center gap-1.5"><Gauge size={14} className="text-[#38d39f]" />{Math.round(maxSpeed)} km/h</span>
                  <span className="flex items-center gap-1.5"><Activity size={14} className="text-[#d9ad62]" />{Math.round(averageSpeed)} km/h</span>
                  <span className="flex items-center gap-1.5"><RouteIcon size={14} className="text-[#6fc8ff]" />{totalDistance.toFixed(1)} km</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={`absolute bottom-28 ${panelDirection}-4 z-[1002] w-[min(320px,calc(100vw-2rem))] sm:bottom-32`}>
        <div className="rounded-3xl border border-white/10 bg-[#0b1b33]/92 p-3 shadow-xl backdrop-blur-xl">
          <button onClick={() => setShowStops(value => !value)} className="flex w-full items-center justify-between text-xs font-bold text-white/75"><span className="flex items-center gap-2"><Target size={14} className="text-[#d9ad62]" />{t(lang, 'stops')} <span className="rounded-full bg-[#d9ad62]/15 px-2 py-0.5 text-[#e9c47d]">{stops.length}</span></span>{showStops ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
          {showStops && <div className="mt-2 space-y-1.5">{stops.length ? stops.map((stop, index) => <div key={index} className="flex items-center justify-between rounded-xl bg-white/[.05] px-3 py-2 text-[10px]"><span className="text-white/60">{formatTime(stop.fixTime, lang, false)}</span><span className="font-bold text-[#e9c47d]">{formatDuration(stop.duration, lang)}</span></div>) : <p className="px-1 py-2 text-[10px] text-white/40">{t(lang, 'noStops')}</p>}</div>}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[10px]"><span className="text-white/45">{t(lang, 'speeding')}</span><span className="text-end font-bold text-[#ff8c86]">{speedingSegments.length ? t(lang, 'detected') : t(lang, 'none')}</span></div>
        </div>
      </div>
    </div>
  )
}
