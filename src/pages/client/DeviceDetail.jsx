import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  ChevronLeft, Zap, ZapOff, MapPin, Clock, Activity, Battery, Signal,
  Gauge, Navigation, Share2, Copy, CheckCheck, Loader2, Play, Pause,
  Square, FastForward, SkipBack, SkipForward, Route as RouteIcon
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip,
  ReferenceLine, CartesianGrid
} from 'recharts'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import MapView from '../../components/MapView'
import ConfirmModal from '../../components/ConfirmModal'

// ── Speed color helper ────────────────────────────────────────────────────────
function speedColor(speed) {
  if (speed > 120) return '#ef4444'  // red
  if (speed > 80)  return '#f97316'  // orange
  return '#22c55e'                    // green
}

// ── Build color-coded polyline segments ───────────────────────────────────────
function buildColorSegments(route, upToIndex) {
  if (!route.length || upToIndex < 1) return []
  const traveled = route.slice(0, upToIndex + 1)
  const result = []
  let groupColor = speedColor(traveled[0].speed || 0)
  let groupCoords = [[Number(traveled[0].latitude), Number(traveled[0].longitude)]]

  for (let i = 1; i < traveled.length; i++) {
    const c = speedColor(traveled[i].speed || 0)
    groupCoords.push([Number(traveled[i].latitude), Number(traveled[i].longitude)])
    if (c !== groupColor || i === traveled.length - 1) {
      if (groupCoords.length >= 2) result.push({ coords: [...groupCoords], color: groupColor })
      groupColor = c
      groupCoords = [[Number(traveled[i].latitude), Number(traveled[i].longitude)]]
    }
  }
  return result
}

// ── Stop icon ────────────────────────────────────────────────────────────────
const stopIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:8px;color:white;font-weight:bold">P</div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

// ── ReplayMap component ───────────────────────────────────────────────────────
function ReplayMap({ route, currentIndex, lang }) {
  const validRoute = route.filter(point => (
    Number.isFinite(Number(point.latitude)) &&
    Number.isFinite(Number(point.longitude))
  ))
  const currentPoint  = validRoute[Math.min(currentIndex, Math.max(validRoute.length - 1, 0))]
  const allCoords     = validRoute.map(p => [Number(p.latitude), Number(p.longitude)])
  const center        = allCoords[0] || [33.5731, -7.5898]
  const currentSpeed  = currentPoint?.speed ?? 0

  // Color-coded traveled segments (memoized by index)
  const colorSegments = useMemo(
    () => buildColorSegments(validRoute, currentIndex),
    [currentIndex, validRoute.length] // eslint-disable-line
  )

  // Stop points: first frame of each consecutive stop run
  const stopPoints = useMemo(() => {
    const pts = []
    for (let i = 1; i < validRoute.length; i++) {
      if ((validRoute[i].speed || 0) === 0 && (validRoute[i - 1].speed || 0) > 0) {
        pts.push(validRoute[i])
      }
    }
    return pts
  }, [validRoute.length]) // eslint-disable-line

  const vehicleIcon = useMemo(() => L.divIcon({
    className: 'athargps-replay-marker',
    html: `<div style="width:36px;height:36px;border-radius:50%;background:#0F2044;border:3px solid ${speedColor(currentSpeed)};box-shadow:0 0 0 6px ${speedColor(currentSpeed)}33,0 4px 12px rgba(15,32,68,.4);display:flex;align-items:center;justify-content:center;font-size:11px;color:white;font-weight:bold">${currentSpeed}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  }), [currentIndex]) // eslint-disable-line

  function FitReplayBounds() {
    const map = useMap()
    useEffect(() => {
      if (allCoords.length > 1) {
        map.fitBounds(allCoords, { padding: [28, 28], maxZoom: 16 })
      }
    }, [map, route.length]) // eslint-disable-line
    return null
  }

  if (!validRoute.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400">
        <RouteIcon size={30} className="mb-2 opacity-40" />
        <p className="text-sm">{lang === 'ar' ? 'لا توجد نقاط مسار لهذه الرحلة' : 'Aucun point pour ce trajet'}</p>
      </div>
    )
  }

  return (
    <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FitReplayBounds />
      {/* Full route — light gray dashed */}
      <Polyline positions={allCoords} pathOptions={{ color: '#94a3b8', weight: 3, opacity: 0.3, dashArray: '5 7' }} />
      {/* Color-coded traveled segments */}
      {colorSegments.map((seg, i) => (
        <Polyline key={i} positions={seg.coords} pathOptions={{ color: seg.color, weight: 5, opacity: 0.92 }} />
      ))}
      {/* Stop markers */}
      {stopPoints.map((pt, i) => (
        <Marker key={i} position={[Number(pt.latitude), Number(pt.longitude)]} icon={stopIcon}>
          <Popup>
            <div className="text-xs">
              <strong>{lang === 'ar' ? 'توقف' : 'Arrêt'}</strong><br />
              {pt.fixTime ? new Date(pt.fixTime).toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { hour: '2-digit', minute: '2-digit' }) : ''}
            </div>
          </Popup>
        </Marker>
      ))}
      {/* Current vehicle marker with speed badge */}
      {currentPoint && (
        <Marker position={[Number(currentPoint.latitude), Number(currentPoint.longitude)]} icon={vehicleIcon}>
          <Popup>
            <div className="text-xs">
              <strong>{currentPoint.speed} {lang === 'ar' ? 'كم/س' : 'km/h'}</strong><br />
              {currentPoint.fixTime && new Date(currentPoint.fixTime).toLocaleString(lang === 'ar' ? 'ar-MA' : 'fr-MA')}
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  )
}

// ── Speed chart component ─────────────────────────────────────────────────────
function SpeedChart({ route, currentIndex, lang }) {
  const data = useMemo(() => route.filter((_, i) => i % Math.max(1, Math.floor(route.length / 80)) === 0)
    .map((p, i) => ({
      i: Math.floor(i * route.length / Math.max(route.filter((_, j) => j % Math.max(1, Math.floor(route.length / 80)) === 0).length, 1)),
      speed: p.speed || 0,
      time: p.fixTime ? new Date(p.fixTime).toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { hour: '2-digit', minute: '2-digit' }) : '',
    })), [route.length]) // eslint-disable-line

  const currentI = Math.floor(currentIndex * data.length / Math.max(route.length, 1))

  return (
    <div className="h-[80px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="time" tick={{ fontSize: 7 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 7 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, border: 'none', background: '#0F2044', color: '#fff' }}
            formatter={(v) => [`${v} ${t(lang, 'kmh')}`, '']}
          />
          <Line type="monotone" dataKey="speed" stroke="#1677ff" strokeWidth={1.5} dot={false} />
          {data[currentI] && (
            <ReferenceLine x={data[currentI].time} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1.5} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main page component ───────────────────────────────────────────────────────
export default function DeviceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { devices, toggleEngine, saveGeofence, removeGeofence, lang } = useApp()

  const deviceFromCtx = devices.find(d => String(d.id) === String(id))

  const [activeTab, setActiveTab]           = useState('map')
  const [showEngineModal, setShowEngineModal] = useState(false)
  const [geofenceCenter, setGeofenceCenter]  = useState(null)
  const [geofenceRadius, setGeofenceRadius]  = useState(500)
  const [geofenceLoading, setGeofenceLoading] = useState(false)
  const [geofenceError, setGeofenceError]    = useState(null)
  const [geofenceSuccess, setGeofenceSuccess] = useState(null)
  const [engineSuccess, setEngineSuccess]    = useState(null)
  const [shareLoading, setShareLoading]      = useState(false)
  const [shareLink, setShareLink]            = useState(null)
  const [shareCopied, setShareCopied]        = useState(false)

  // Trips tab
  const [tripsData, setTripsData]            = useState(null)
  const [tripsLoading, setTripsLoading]      = useState(false)
  const [tripsError, setTripsError]          = useState(null)
  const [selectedTripIndex, setSelectedTripIndex] = useState(0)
  const [replayIndex, setReplayIndex]        = useState(0)
  const [replayState, setReplayState]        = useState('stopped') // 'playing' | 'paused' | 'stopped'
  const [replaySpeed, setReplaySpeed]        = useState(1)
  const [showSpeedChart, setShowSpeedChart]  = useState(false)

  // Fallback device fetch
  const [fetchedDevice, setFetchedDevice]    = useState(null)
  const [fetchError, setFetchError]          = useState(false)

  useEffect(() => {
    if (deviceFromCtx) return
    if (devices.length > 0) { setFetchError(true); return }
    api.devices.get(id)
      .then(d => setFetchedDevice(d))
      .catch(() => setFetchError(true))
  }, [id, deviceFromCtx, devices.length]) // eslint-disable-line

  const device = deviceFromCtx || fetchedDevice

  if (fetchError && !device) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 text-slate-400 dark:bg-slate-900">
        <p>{t(lang, 'noData')}</p>
        <button onClick={() => navigate(-1)} className="text-xs text-primary-400 underline">
          {lang === 'ar' ? 'رجوع' : 'Retour'}
        </button>
      </div>
    )
  }

  if (!device) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center text-slate-400 dark:bg-slate-900">
        <Loader2 size={28} className="animate-spin mb-2" />
        <p className="text-sm">{t(lang, 'loading')}</p>
      </div>
    )
  }

  const isOnline = device.status === 'online'
  const geofenceActive = !!(device.geofence || device.geofenceActive)

  const handleEngineToggle = async () => {
    const wasOn = device.engineOn
    setShowEngineModal(false)
    try {
      await toggleEngine(device.id, wasOn)
      setEngineSuccess(wasOn ? t(lang, 'engineCutSuccess') : t(lang, 'engineStartSuccess'))
    } catch {
      setEngineSuccess(lang === 'ar' ? 'فشل إرسال الأمر. حاول مجدداً.' : 'Échec de la commande. Réessayez.')
    }
    setTimeout(() => setEngineSuccess(null), 3500)
  }

  const handleMapClick = (e) => {
    if (activeTab === 'geofence') setGeofenceCenter([e.latlng.lat, e.latlng.lng])
  }

  const handleToggleGeofence = async () => {
    setGeofenceError(null); setGeofenceSuccess(null); setGeofenceLoading(true)
    try {
      if (geofenceActive) {
        const geoId = device.geofence?.geofence?.id ?? device.geofence?.id ?? device.activeGeofenceId
        await removeGeofence(device.id, geoId)
        setGeofenceSuccess(lang === 'ar' ? 'تم إلغاء السياج الجغرافي بنجاح' : 'Zone désactivée avec succès')
      } else {
        const center = geofenceCenter || [device.lat, device.lng]
        await saveGeofence(device.id, {
          name: `${device.name}-geofence`,
          latitude: center[0], longitude: center[1], radius: geofenceRadius,
        })
        setGeofenceSuccess(lang === 'ar' ? 'تم تفعيل السياج الجغرافي بنجاح ✓' : 'Zone géographique activée ✓')
      }
      setTimeout(() => setGeofenceSuccess(null), 3000)
    } catch (e) {
      setGeofenceError(e.message || 'حدث خطأ')
    } finally { setGeofenceLoading(false) }
  }

  const handleShareLocation = async () => {
    setShareLoading(true); setShareLink(null)
    try {
      const { token } = await api.sharing.create(device.id, 24)
      setShareLink(`${window.location.origin}/share/${token}`)
    } catch (e) {
      setEngineSuccess('❌ ' + (e.message || (lang === 'ar' ? 'فشل إنشاء الرابط' : 'Échec de la création du lien')))
      setTimeout(() => setEngineSuccess(null), 3000)
    } finally { setShareLoading(false) }
  }

  // Load trips
  useEffect(() => {
    if (activeTab !== 'trips' || !device) return
    if (tripsData !== null) return
    setTripsLoading(true); setTripsError(null)
    const to   = new Date().toISOString()
    const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    api.reports.get(device.id, from, to)
      .then(res => setTripsData(Array.isArray(res?.trips) ? res.trips : []))
      .catch(error => setTripsError(error.message || (lang === 'ar' ? 'تعذر تحميل الرحلات' : 'Impossible de charger les trajets')))
      .finally(() => setTripsLoading(false))
  }, [activeTab, device]) // eslint-disable-line

  const selectedTrip  = tripsData?.[selectedTripIndex] || null
  const selectedRoute = selectedTrip?.route || []

  useEffect(() => {
    setSelectedTripIndex(0); setReplayIndex(0); setReplayState('stopped')
  }, [tripsData])

  // Replay interval
  useEffect(() => {
    if (replayState !== 'playing' || selectedRoute.length < 2) return undefined
    const interval = window.setInterval(() => {
      setReplayIndex(current => {
        if (current >= selectedRoute.length - 1) {
          setReplayState('stopped')
          return selectedRoute.length - 1
        }
        return current + 1
      })
    }, Math.max(50, 500 / replaySpeed))
    return () => window.clearInterval(interval)
  }, [replayState, replaySpeed, selectedRoute.length])

  const selectTrip = (index) => {
    setSelectedTripIndex(index); setReplayIndex(0); setReplayState('stopped')
  }

  const toggleReplay = () => {
    if (selectedRoute.length < 2) return
    if (replayIndex >= selectedRoute.length - 1) setReplayIndex(0)
    setReplayState(current => current === 'playing' ? 'paused' : 'playing')
  }

  const stopReplay  = () => { setReplayState('stopped'); setReplayIndex(0) }
  const goToStart   = () => { setReplayState('paused');  setReplayIndex(0) }
  const goToEnd     = () => { setReplayState('stopped'); setReplayIndex(Math.max(0, selectedRoute.length - 1)) }

  const handleCopyLink = () => {
    if (!shareLink) return
    const copy = (text) => {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy')
      document.body.removeChild(ta)
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareLink).catch(() => copy(shareLink))
    } else { copy(shareLink) }
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2500)
  }

  return (
    <div className="h-screen flex flex-col dark:bg-slate-900" style={{ height: '100dvh' }}>
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 pt-14 px-4 pb-4" style={{ background: 'linear-gradient(160deg, #0F2044 0%, #162d5e 100%)' }}>
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <ChevronLeft size={18} className="text-white" />
            </button>
            <div className="flex-1">
              <h1 className="text-white font-bold text-base truncate">{device.name}</h1>
              <p className="text-white/50 text-xs">{device.plate}</p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isOnline ? 'bg-emerald-400/20 text-emerald-300' : 'bg-gray-400/20 text-gray-300'}`}>
              {isOnline ? '● ' + t(lang, 'online') : '● ' + t(lang, 'offline')}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: t(lang, 'speed'),   val: `${device.speed}`,   unit: t(lang, 'kmh'), icon: '⚡' },
              { label: t(lang, 'battery'), val: `${device.battery}`, unit: '%',             icon: '🔋' },
              { label: t(lang, 'signal'),  val: `${device.signal}`,  unit: '/4',            icon: '📶' },
              { label: t(lang, 'fuel'),    val: `${device.fuel}`,    unit: '%',             icon: '⛽' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-2 text-center">
                <div className="text-base">{s.icon}</div>
                <div className="text-white font-bold text-sm">{s.val}<span className="text-[10px] font-normal opacity-60">{s.unit}</span></div>
                <div className="text-white/40 text-[9px]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4">
          <div className="flex overflow-x-auto gap-1 py-2 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
            {[
              { key: 'map',      label: t(lang, 'liveTracking') },
              { key: 'trips',    label: t(lang, 'tripHistory') },
              { key: 'engine',   label: t(lang, 'engineControl') },
              { key: 'geofence', label: t(lang, 'geofence') },
              { key: 'share',    label: lang === 'ar' ? 'مشاركة' : 'Partager' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-xl transition-all ${
                  activeTab === tab.key
                    ? 'bg-primary-500 text-white'
                    : 'text-slate-400 dark:text-slate-500 hover:text-primary-500'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">

          {/* MAP TAB */}
          {activeTab === 'map' && (
            <div className="h-full relative">
              <MapView deviceId={device.id} height="100%" zoom={15} />
              <div className="absolute top-3 left-3 glass rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm z-20">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-primary-500">{t(lang, 'liveTracking')}</span>
              </div>
              {isOnline && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass rounded-2xl px-5 py-3 shadow-lg z-20 flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-black text-primary-500">{device.speed}</p>
                    <p className="text-[10px] text-slate-400">{t(lang, 'kmh')}</p>
                  </div>
                  <div className="w-px h-10 bg-gray-200" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-primary-500">{((device.totalDistance ?? 0) / 1000).toFixed(1)}</p>
                    <p className="text-[10px] text-slate-400">{lang === 'ar' ? 'ألف كم' : 'Mille km'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TRIPS TAB */}
          {activeTab === 'trips' && (
            <div className="h-full overflow-y-auto mobile-scroll pb-20 p-4 space-y-3">
              {tripsLoading ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                  <Loader2 size={28} className="animate-spin mb-2" />
                  <p className="text-sm">{t(lang, 'loading')}</p>
                </div>
              ) : tripsError ? (
                <div className="flex flex-col items-center justify-center h-40 text-red-400 text-center">
                  <RouteIcon size={32} className="mb-2 opacity-50" />
                  <p className="text-sm">{tripsError}</p>
                  <button onClick={() => { setTripsData(null); setTripsError(null) }}
                    className="mt-3 rounded-xl bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-500">
                    {lang === 'ar' ? 'إعادة المحاولة' : 'Réessayer'}
                  </button>
                </div>
              ) : !tripsData || tripsData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                  <Navigation size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">{lang === 'ar' ? 'لا توجد رحلات في آخر 7 أيام' : 'Aucun trajet sur les 7 derniers jours'}</p>
                </div>
              ) : (
                <>
                  {/* Trip selector */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {tripsData.map((trip, i) => {
                      const tripDate = trip.startTime
                        ? new Date(trip.startTime).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { day: '2-digit', month: 'short' })
                        : '—'
                      return (
                        <button key={trip.index || i} onClick={() => selectTrip(i)}
                          className={`min-w-[120px] rounded-2xl border px-3 py-3 text-left transition-all ${
                            selectedTripIndex === i
                              ? 'border-primary-500 bg-primary-500 text-white shadow-md'
                              : 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300'
                          }`}>
                          <span className="block text-[10px] font-bold uppercase opacity-70">
                            {lang === 'ar' ? `رحلة ${i + 1}` : `Trajet ${i + 1}`}
                          </span>
                          <span className="mt-1 block text-xs font-semibold">{tripDate}</span>
                          <span className="mt-1 block text-[10px] opacity-70">{trip.distanceKm ?? '—'} {t(lang, 'km')}</span>
                        </button>
                      )
                    })}
                  </div>

                  {selectedTrip && (
                    <>
                      {/* Map + controls */}
                      <div className="overflow-hidden rounded-3xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                        <div className="relative h-[240px]">
                          <ReplayMap route={selectedRoute} currentIndex={replayIndex} lang={lang} />

                          {/* Speed badge overlay */}
                          <div className="absolute left-3 top-3 z-[500] rounded-xl bg-white/90 dark:bg-slate-800/90 px-3 py-2 shadow-sm backdrop-blur">
                            <p className="text-[10px] font-semibold text-slate-400">
                              {lang === 'ar' ? 'إعادة تشغيل' : 'Replay'}
                            </p>
                            <p className="text-sm font-black" style={{ color: speedColor(selectedRoute[replayIndex]?.speed ?? 0) }}>
                              {selectedRoute[replayIndex]?.speed ?? 0} {t(lang, 'kmh')}
                            </p>
                          </div>

                          {/* Replay controls */}
                          <div className="absolute inset-x-3 bottom-3 z-[500] flex items-center gap-1.5 rounded-2xl bg-white/95 dark:bg-slate-800/95 p-2 shadow-lg backdrop-blur">
                            {/* Go to start */}
                            <button onClick={goToStart} aria-label="Go to start"
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                              <SkipBack size={14} />
                            </button>
                            {/* Play/Pause */}
                            <button onClick={toggleReplay} disabled={selectedRoute.length < 2} aria-label={replayState === 'playing' ? 'Pause' : 'Play'}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-white disabled:opacity-40">
                              {replayState === 'playing' ? <Pause size={15} /> : <Play size={15} />}
                            </button>
                            {/* Stop */}
                            <button onClick={stopReplay} aria-label="Stop"
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                              <Square size={13} />
                            </button>
                            {/* Go to end */}
                            <button onClick={goToEnd} aria-label="Go to end"
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                              <SkipForward size={14} />
                            </button>
                            <div className="h-7 w-px bg-slate-200 dark:bg-slate-600 mx-0.5" />
                            {/* Speed selector */}
                            <FastForward size={13} className="text-slate-400" />
                            {[1, 2, 4, 8].map(speed => (
                              <button key={speed} onClick={() => setReplaySpeed(speed)}
                                className={`rounded-lg px-1.5 py-1 text-[9px] font-bold transition-all ${
                                  replaySpeed === speed ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-500' : 'text-slate-400 dark:text-slate-500'
                                }`}>
                                {speed}x
                              </button>
                            ))}
                            <span className="ml-auto text-[9px] font-semibold text-slate-400 dark:text-slate-500 tabular-nums">
                              {Math.min(replayIndex + 1, selectedRoute.length)}/{selectedRoute.length}
                            </span>
                          </div>
                        </div>

                        {/* Speed chart toggle */}
                        <div className="border-t border-gray-100 dark:border-slate-700">
                          <button
                            onClick={() => setShowSpeedChart(p => !p)}
                            className="w-full px-4 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                          >
                            <span>{t(lang, 'speedChart')}</span>
                            <span className="text-[10px]">{showSpeedChart ? '▲' : '▼'}</span>
                          </button>
                          <AnimatePresence>
                            {showSpeedChart && selectedRoute.length > 1 && (
                              <motion.div
                                className="px-3 pb-3"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                              >
                                <SpeedChart route={selectedRoute} currentIndex={replayIndex} lang={lang} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Speed legend */}
                        <div className="flex gap-3 justify-center px-4 pb-2 pt-1">
                          {[
                            { color: '#22c55e', label: lang === 'ar' ? '< ٨٠ كم/س' : '< 80 km/h' },
                            { color: '#f97316', label: lang === 'ar' ? '٨٠-١٢٠' : '80-120' },
                            { color: '#ef4444', label: lang === 'ar' ? '> ١٢٠' : '> 120' },
                          ].map(l => (
                            <div key={l.color} className="flex items-center gap-1">
                              <span className="w-3 h-1.5 rounded-full" style={{ background: l.color }} />
                              <span className="text-[9px] text-slate-400 dark:text-slate-500">{l.label}</span>
                            </div>
                          ))}
                        </div>

                        {/* Trip summary */}
                        <div className="grid grid-cols-5 gap-1 border-t border-gray-100 dark:border-slate-700 p-3">
                          {[
                            { val: selectedTrip.distanceKm ?? '—',    unit: t(lang, 'km'),              label: t(lang, 'distance') },
                            { val: selectedTrip.durationMin ?? '—',   unit: lang === 'ar' ? 'د' : 'min', label: t(lang, 'duration') },
                            { val: selectedTrip.avgSpeed ?? '—',      unit: t(lang, 'kmh'),             label: t(lang, 'avgSpeed') },
                            { val: selectedTrip.maxSpeed ?? '—',      unit: t(lang, 'kmh'),             label: t(lang, 'maxSpeed') },
                            { val: selectedTrip.stopMin ?? '—',       unit: lang === 'ar' ? 'د' : 'min', label: t(lang, 'stopTime') },
                          ].map(s => (
                            <div key={s.label} className="text-center">
                              <p className="text-sm font-bold text-primary-500 dark:text-white">{s.val}<span className="text-[8px] font-normal text-slate-400 ml-0.5">{s.unit}</span></p>
                              <p className="text-[8px] text-slate-400 dark:text-slate-500">{s.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Timeline */}
                      <div className="rounded-3xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                        <h2 className="text-sm font-bold text-primary-500 dark:text-white mb-3">
                          {lang === 'ar' ? 'الخط الزمني' : 'Chronologie'}
                        </h2>
                        <div className="relative space-y-3">
                          <div className="absolute bottom-2 start-[7px] top-2 w-px bg-slate-100 dark:bg-slate-700" />
                          {selectedRoute.map((point, pointIndex) => {
                            const isDriving = Number(point.speed) > 0
                            const time = point.fixTime
                              ? new Date(point.fixTime).toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { hour: '2-digit', minute: '2-digit' })
                              : '—'
                            return (
                              <button key={`${point.fixTime}-${pointIndex}`}
                                onClick={() => { setReplayIndex(pointIndex); setReplayState('paused') }}
                                className="relative flex w-full items-start gap-3 text-left">
                                <span className={`relative z-10 mt-1 h-4 w-4 shrink-0 rounded-full border-4 border-white dark:border-slate-800 shadow-sm ${isDriving ? 'bg-emerald-500' : 'bg-red-400'}`} />
                                <span className="min-w-0 flex-1 rounded-xl bg-slate-50 dark:bg-slate-700 px-3 py-2">
                                  <span className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-slate-600 dark:text-white">{time}</span>
                                    <span className={`text-[10px] font-bold`} style={{ color: speedColor(point.speed || 0) }}>
                                      {point.speed ?? 0} {t(lang, 'kmh')}
                                    </span>
                                  </span>
                                  <span className="mt-1 block truncate text-[10px] text-slate-400 dark:text-slate-500">
                                    {point.address || (lang === 'ar' ? 'الموقع من Traccar' : 'Position Traccar')}
                                  </span>
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ENGINE TAB */}
          {activeTab === 'engine' && (
            <div className="h-full overflow-y-auto mobile-scroll pb-20 p-5">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 text-center">
                <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center mb-4 ${
                  device.engineOn
                    ? 'bg-gradient-to-br from-emerald-400 to-accent shadow-lg shadow-emerald-200'
                    : 'bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-600 dark:to-slate-700'
                }`}>
                  {device.engineOn
                    ? <Zap size={40} className="text-white" />
                    : <ZapOff size={40} className="text-gray-400 dark:text-slate-400" />
                  }
                </div>
                <h3 className="font-bold text-primary-500 dark:text-white text-lg mb-1">
                  {device.engineOn ? t(lang, 'engineOn') : t(lang, 'engineOff')}
                </h3>
                <p className="text-slate-400 text-xs mb-6 leading-relaxed">
                  {lang === 'ar'
                    ? 'يمكنك التحكم في محرك المركبة عن بعد. استخدم هذه الميزة بحذر.'
                    : 'Vous pouvez contrôler le moteur du véhicule à distance. Utilisez cette fonctionnalité avec précaution.'}
                </p>
                <div className="relative group">
                  <button
                    onClick={() => setShowEngineModal(true)}
                    disabled={device.status === 'offline'}
                    className={`w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                      device.engineOn
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-gradient-to-r from-accent to-emerald-500 text-primary-500'
                    }`}>
                    {device.engineOn ? t(lang, 'cutEngine') : t(lang, 'startEngine')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GEOFENCE TAB */}
          {activeTab === 'geofence' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 relative">
                <MapView
                  deviceId={device.id} height="100%" zoom={13}
                  showGeofence={geofenceActive}
                  geofenceCenter={geofenceCenter || [device.lat, device.lng]}
                  geofenceRadius={geofenceRadius}
                  onMapClick={handleMapClick}
                />
                {!geofenceCenter && !geofenceActive && (
                  <div className="absolute inset-x-4 top-3 glass rounded-2xl px-4 py-2.5 text-center z-20 shadow-sm">
                    <p className="text-xs font-semibold text-primary-500">📍 {t(lang, 'geofenceDesc')}</p>
                  </div>
                )}
                {geofenceActive && (
                  <div className="absolute inset-x-4 top-3 z-20 flex justify-center">
                    <div className="flex items-center gap-2 bg-primary-500/90 backdrop-blur-sm rounded-2xl px-4 py-2.5 shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                      <span className="text-xs font-bold text-white">{lang === 'ar' ? 'السياج الجغرافي مفعّل' : 'Zone géographique active'}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-800 px-4 py-3 shadow-t border-t border-gray-100 dark:border-slate-700 pb-20 space-y-3">
                {!geofenceActive && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-400">{lang === 'ar' ? 'نصف القطر' : 'Rayon'}</span>
                      <span className="text-xs font-bold text-primary-500">{geofenceRadius} م</span>
                    </div>
                    <input type="range" min={100} max={5000} step={100} value={geofenceRadius}
                      onChange={e => setGeofenceRadius(Number(e.target.value))} className="w-full accent-primary-500" />
                  </div>
                )}
                {geofenceError && <p className="text-xs text-red-500 text-center">{geofenceError}</p>}
                <button onClick={handleToggleGeofence} disabled={geofenceLoading}
                  className={`w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60 ${
                    geofenceActive ? 'bg-red-500 text-white' : 'bg-primary-500 text-white'
                  }`}>
                  {geofenceLoading
                    ? (lang === 'ar' ? 'جاري التنفيذ...' : 'En cours...')
                    : geofenceActive ? t(lang, 'deactivateGeofence') : t(lang, 'activateGeofence')}
                </button>
                <AnimatePresence>
                  {geofenceSuccess && (
                    <motion.div
                      className="flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-2.5 text-xs font-semibold"
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                      ✅ {geofenceSuccess}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* SHARE TAB */}
          {activeTab === 'share' && (
            <div className="h-full overflow-y-auto mobile-scroll pb-20 p-5 flex flex-col gap-4">
              <div className="bg-slate-800/60 dark:bg-slate-700/60 rounded-2xl p-5 border border-slate-700/40 text-center">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                  <Share2 size={24} className="text-accent" />
                </div>
                <h3 className="text-white font-bold text-base mb-1">
                  {lang === 'ar' ? 'مشاركة الموقع المباشر' : 'Partager la position en direct'}
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  {lang === 'ar'
                    ? 'يولّد رابطاً مؤقتاً صالحاً لمدة 24 ساعة يعرض موقع المركبة دون الحاجة لتسجيل الدخول.'
                    : 'Génère un lien temporaire valable 24h pour partager la position du véhicule sans connexion.'}
                </p>
                <button onClick={handleShareLocation} disabled={shareLoading}
                  className="w-full py-3 bg-accent text-slate-900 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-transform">
                  {shareLoading
                    ? <><Loader2 size={16} className="animate-spin" /> {lang === 'ar' ? 'جاري الإنشاء...' : 'Création...'}</>
                    : <><Share2 size={16} /> {lang === 'ar' ? 'إنشاء رابط المشاركة' : 'Créer un lien de partage'}</>}
                </button>
              </div>
              <AnimatePresence>
                {shareLink && (
                  <motion.div className="bg-slate-800/60 rounded-2xl p-4 border border-accent/30"
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <p className="text-xs text-slate-400 mb-2">
                      {lang === 'ar' ? '✅ الرابط جاهز — صالح لـ 24 ساعة:' : '✅ Lien prêt — valable 24h :'}
                    </p>
                    <div className="flex gap-2 items-center">
                      <p className="flex-1 text-[11px] text-accent break-all leading-relaxed">{shareLink}</p>
                      <button onClick={handleCopyLink}
                        className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 active:scale-90 transition-transform">
                        {shareCopied ? <CheckCheck size={15} className="text-accent" /> : <Copy size={15} className="text-accent" />}
                      </button>
                    </div>
                    {shareCopied && <p className="text-[10px] text-accent mt-1">{lang === 'ar' ? 'تم النسخ!' : 'Copié!'}</p>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Engine confirmation modal */}
        <ConfirmModal
          open={showEngineModal}
          title={device.engineOn ? t(lang, 'engineCutConfirmTitle') : t(lang, 'engineStartConfirmTitle')}
          message={device.engineOn ? t(lang, 'engineCutConfirmMsg') : t(lang, 'engineStartConfirmMsg')}
          confirmLabel={device.engineOn ? t(lang, 'cutEngine') : t(lang, 'startEngine')}
          cancelLabel={t(lang, 'cancel')}
          onConfirm={handleEngineToggle}
          onCancel={() => setShowEngineModal(false)}
          danger={device.engineOn}
        />

        {/* Success toast */}
        <AnimatePresence>
          {engineSuccess && (
            <motion.div
              className="absolute bottom-24 inset-x-4 bg-primary-500 text-white rounded-2xl px-4 py-3 text-center text-sm font-semibold shadow-xl z-50"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              ✅ {engineSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        <ClientNav />
      </div>
    </div>
  )
}
