import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ChevronLeft, Zap, ZapOff, MapPin, Clock, Activity, Battery, Signal, Gauge, Navigation, Share2, Copy, CheckCheck, Loader2, Play, Pause, Square, FastForward, Route as RouteIcon } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import MapView from '../../components/MapView'
import ConfirmModal from '../../components/ConfirmModal'

function StatBadge({ label, value, icon: Icon, color = 'primary' }) {
  const colors = {
    primary: 'bg-primary-50 text-primary-500',
    green: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-500',
    red: 'bg-red-50 text-red-500',
  }
  return (
    <div className={`rounded-2xl p-3 ${colors[color]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={13} />
        <span className="text-[10px] font-medium opacity-70">{label}</span>
      </div>
      <p className="text-base font-bold">{value}</p>
    </div>
  )
}

function ReplayMap({ route, currentIndex, deviceType = 'car', lang }) {
  const validRoute = route.filter(point => (
    Number.isFinite(Number(point.latitude)) &&
    Number.isFinite(Number(point.longitude))
  ))
  const currentPoint = validRoute[Math.min(currentIndex, Math.max(validRoute.length - 1, 0))]
  const coordinates = validRoute.map(point => [Number(point.latitude), Number(point.longitude)])
  const replayCoordinates = coordinates.slice(0, Math.max(currentIndex + 1, 1))
  const center = coordinates[0] || [33.5731, -7.5898]

  const vehicleIcon = useMemo(() => L.divIcon({
    className: 'athargps-replay-marker',
    html: `<div style="width:38px;height:38px;border-radius:50%;background:#0F2044;border:3px solid #00D97E;box-shadow:0 0 0 7px rgba(0,217,126,.18),0 5px 14px rgba(15,32,68,.35);display:flex;align-items:center;justify-content:center;color:white;font-size:15px">●</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  }), [])

  function FitReplayBounds() {
    const map = useMap()
    useEffect(() => {
      if (coordinates.length > 1) {
        map.fitBounds(coordinates, { padding: [28, 28], maxZoom: 16 })
      }
    }, [map, route.length])
    return null
  }

  if (!validRoute.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
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
      <Polyline positions={coordinates} pathOptions={{ color: '#8aa0bd', weight: 4, opacity: 0.42, dashArray: '6 8' }} />
      <Polyline positions={replayCoordinates} pathOptions={{ color: '#1677ff', weight: 5, opacity: 0.94 }} />
      {currentPoint && (
        <Marker position={[Number(currentPoint.latitude), Number(currentPoint.longitude)]} icon={vehicleIcon}>
          <Popup>
            <div className="text-xs">
              <strong>{currentPoint.speed} {lang === 'ar' ? 'كم/س' : 'km/h'}</strong>
              <br />
              {new Date(currentPoint.fixTime).toLocaleString(lang === 'ar' ? 'ar-MA' : 'fr-MA')}
              {currentPoint.address && <><br />{currentPoint.address}</>}
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  )
}

export default function DeviceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { devices, toggleEngine, saveGeofence, removeGeofence, lang } = useApp()

  // id from useParams() is always a string; db ids may be numbers — coerce both sides
  const deviceFromCtx = devices.find(d => String(d.id) === String(id))

  const [activeTab, setActiveTab] = useState('map')
  const [showEngineModal, setShowEngineModal] = useState(false)
  const [geofenceCenter, setGeofenceCenter] = useState(null)
  const [geofenceRadius, setGeofenceRadius] = useState(500)
  const [geofenceLoading, setGeofenceLoading] = useState(false)
  const [geofenceError, setGeofenceError] = useState(null)
  const [geofenceSuccess, setGeofenceSuccess] = useState(null)
  const [engineSuccess, setEngineSuccess] = useState(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareLink, setShareLink] = useState(null)
  const [shareCopied, setShareCopied] = useState(false)

  // Trips tab — loaded from reports API on demand
  const [tripsData, setTripsData]       = useState(null)
  const [tripsLoading, setTripsLoading] = useState(false)
  const [tripsError, setTripsError]     = useState(null)
  const [selectedTripIndex, setSelectedTripIndex] = useState(0)
  const [replayIndex, setReplayIndex] = useState(0)
  const [replayState, setReplayState] = useState('stopped')
  const [replaySpeed, setReplaySpeed] = useState(1)

  // Fallback: if devices haven't loaded yet (e.g. page refresh), fetch this device directly
  const [fetchedDevice, setFetchedDevice] = useState(null)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    if (deviceFromCtx) return              // already in context — no need to fetch
    if (devices.length > 0) {             // context loaded but id not found → not found
      setFetchError(true)
      return
    }
    // context still loading (empty array on first render) → hit API directly
    api.devices.get(id)
      .then(d => setFetchedDevice(d))
      .catch(() => setFetchError(true))
  }, [id, deviceFromCtx, devices.length]) // eslint-disable-line

  const device = deviceFromCtx || fetchedDevice

  if (fetchError && !device) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 text-slate-400">
        <p>{t(lang, 'noData')}</p>
        <button onClick={() => navigate(-1)} className="text-xs text-primary-400 underline">
          {lang === 'ar' ? 'رجوع' : 'Retour'}
        </button>
      </div>
    )
  }

  if (!device) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center text-slate-400">
        <Loader2 size={28} className="animate-spin mb-2" />
        <p className="text-sm">{t(lang, 'loading')}</p>
      </div>
    )
  }

  const isOnline = device.status === 'online'
  // geofenceActive is tracked via device.geofence (set by AppContext.saveGeofence)
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
    if (activeTab === 'geofence') {
      setGeofenceCenter([e.latlng.lat, e.latlng.lng])
    }
  }

  const handleToggleGeofence = async () => {
    setGeofenceError(null)
    setGeofenceSuccess(null)
    setGeofenceLoading(true)
    try {
      if (geofenceActive) {
        // إلغاء السياج الجغرافي — استخدم ID المخزّن في geofence أو geofenceActive
        const geoId = device.geofence?.geofence?.id ?? device.geofence?.id ?? device.activeGeofenceId
        await removeGeofence(device.id, geoId)
        setGeofenceSuccess(lang === 'ar' ? 'تم إلغاء السياج الجغرافي بنجاح' : 'Zone désactivée avec succès')
      } else {
        // تفعيل السياج الجغرافي
        const center = geofenceCenter || [device.lat, device.lng]
        await saveGeofence(device.id, {
          name: `${device.name}-geofence`,
          latitude: center[0],
          longitude: center[1],
          radius: geofenceRadius,
        })
        setGeofenceSuccess(lang === 'ar' ? 'تم تفعيل السياج الجغرافي بنجاح ✓' : 'Zone géographique activée ✓')
      }
      setTimeout(() => setGeofenceSuccess(null), 3000)
    } catch (e) {
      setGeofenceError(e.message || 'حدث خطأ، يرجى المحاولة مجدداً')
    } finally {
      setGeofenceLoading(false)
    }
  }

  const handleShareLocation = async () => {
    setShareLoading(true)
    setShareLink(null)
    try {
      const { token } = await api.sharing.create(device.id)
      setShareLink(`${window.location.origin}/share/${token}`)
    } catch (e) {
      setEngineSuccess('❌ ' + (e.message || (lang === 'ar' ? 'فشل إنشاء الرابط' : 'Échec de la création du lien')))
      setTimeout(() => setEngineSuccess(null), 3000)
    } finally {
      setShareLoading(false)
    }
  }

  // Load trips from reports API when the trips tab is opened
  useEffect(() => {
    if (activeTab !== 'trips' || !device) return
    if (tripsData !== null) return   // already loaded
    setTripsLoading(true)
    setTripsError(null)
    const to   = new Date().toISOString()
    const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    api.reports.get(device.id, from, to)
      .then(res => setTripsData(Array.isArray(res?.trips) ? res.trips : []))
      .catch(error => setTripsError(error.message || (lang === 'ar' ? 'تعذر تحميل الرحلات' : 'Impossible de charger les trajets')))
      .finally(() => setTripsLoading(false))
  }, [activeTab, device]) // eslint-disable-line

  const selectedTrip = tripsData?.[selectedTripIndex] || null
  const selectedRoute = selectedTrip?.route || []

  useEffect(() => {
    setSelectedTripIndex(0)
    setReplayIndex(0)
    setReplayState('stopped')
  }, [tripsData])

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
    }, Math.max(90, 650 / replaySpeed))
    return () => window.clearInterval(interval)
  }, [replayState, replaySpeed, selectedRoute.length])

  const selectTrip = (index) => {
    setSelectedTripIndex(index)
    setReplayIndex(0)
    setReplayState('stopped')
  }

  const toggleReplay = () => {
    if (selectedRoute.length < 2) return
    if (replayIndex >= selectedRoute.length - 1) setReplayIndex(0)
    setReplayState(current => current === 'playing' ? 'paused' : 'playing')
  }

  const stopReplay = () => {
    setReplayState('stopped')
    setReplayIndex(0)
  }

  const handleCopyLink = () => {
    if (!shareLink) return
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareLink).then(() => {
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2500)
      }).catch(() => fallbackCopy(shareLink))
    } else {
      fallbackCopy(shareLink)
    }
  }

  const fallbackCopy = (text) => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2500)
  }

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="h-screen flex flex-col" style={{ height: '100dvh' }}>
      <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
        {/* Header */}
        <div
          className="flex-shrink-0 pt-14 px-4 pb-4"
          style={{ background: 'linear-gradient(160deg, #0F2044 0%, #162d5e 100%)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center"
            >
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

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: t(lang, 'speed'), val: `${device.speed}`, unit: t(lang, 'kmh'), icon: '⚡' },
              { label: t(lang, 'battery'), val: `${device.battery}`, unit: '%', icon: '🔋' },
              { label: t(lang, 'signal'), val: `${device.signal}`, unit: '/4', icon: '📶' },
              { label: t(lang, 'fuel'), val: `${device.fuel}`, unit: '%', icon: '⛽' },
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
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4">
          <div className="flex overflow-x-auto gap-1 py-2 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
            {[
              { key: 'map',      label: t(lang, 'liveTracking') },
              { key: 'trips',    label: t(lang, 'tripHistory') },
              { key: 'engine',   label: t(lang, 'engineControl') },
              { key: 'geofence', label: t(lang, 'geofence') },
              { key: 'share',    label: lang === 'ar' ? 'مشاركة' : 'Partager' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-xl transition-all ${
                  activeTab === tab.key
                    ? 'bg-primary-500 text-white'
                    : 'text-slate-400 hover:text-primary-500'
                }`}
              >
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
              {/* Live indicator */}
              <div className="absolute top-3 left-3 glass rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm z-20">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-primary-500">{t(lang, 'liveTracking')}</span>
              </div>
              {/* Speed HUD */}
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
                  <button
                    onClick={() => { setTripsData(null); setTripsError(null) }}
                    className="mt-3 rounded-xl bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-500"
                  >
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
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {tripsData.map((trip, i) => {
                      const tripDate = trip.startTime
                        ? new Date(trip.startTime).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { day: '2-digit', month: 'short' })
                        : '—'
                      return (
                        <button
                          key={trip.index || i}
                          onClick={() => selectTrip(i)}
                          className={`min-w-[126px] rounded-2xl border px-3 py-3 text-left transition-all ${
                            selectedTripIndex === i
                              ? 'border-primary-500 bg-primary-500 text-white shadow-md'
                              : 'border-gray-100 bg-white text-slate-500'
                          }`}
                        >
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
                      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                        <div className="relative h-[245px]">
                          <ReplayMap route={selectedRoute} currentIndex={replayIndex} deviceType={device.type} lang={lang} />
                          <div className="absolute left-3 top-3 z-[500] rounded-xl bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
                            <p className="text-[10px] font-semibold text-slate-400">
                              {lang === 'ar' ? 'إعادة تشغيل المسار' : 'Replay du trajet'}
                            </p>
                            <p className="text-sm font-black text-primary-500">
                              {selectedRoute[replayIndex]?.speed ?? 0} {t(lang, 'kmh')}
                            </p>
                          </div>
                          <div className="absolute inset-x-3 bottom-3 z-[500] flex items-center gap-2 rounded-2xl bg-white/95 p-2 shadow-lg backdrop-blur">
                            <button
                              onClick={toggleReplay}
                              disabled={selectedRoute.length < 2}
                              aria-label={replayState === 'playing' ? 'Pause' : 'Play'}
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500 text-white disabled:opacity-40"
                            >
                              {replayState === 'playing' ? <Pause size={17} /> : <Play size={17} />}
                            </button>
                            <button
                              onClick={stopReplay}
                              aria-label="Stop"
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
                            >
                              <Square size={15} />
                            </button>
                            <div className="h-7 w-px bg-slate-200" />
                            <FastForward size={15} className="text-slate-400" />
                            {[1, 2, 4].map(speed => (
                              <button
                                key={speed}
                                onClick={() => setReplaySpeed(speed)}
                                className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                                  replaySpeed === speed ? 'bg-primary-50 text-primary-500' : 'text-slate-400'
                                }`}
                              >
                                {speed}x
                              </button>
                            ))}
                            <span className="ml-auto text-[10px] font-semibold text-slate-400">
                              {Math.min(replayIndex + 1, selectedRoute.length)} / {selectedRoute.length}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 border-t border-gray-100 p-3">
                          <div className="text-center">
                            <p className="text-sm font-bold text-primary-500">{selectedTrip.distanceKm ?? '—'}</p>
                            <p className="text-[10px] text-slate-400">{t(lang, 'km')}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-slate-600">{selectedTrip.avgSpeed ?? '—'}</p>
                            <p className="text-[10px] text-slate-400">{lang === 'ar' ? 'المتوسط' : 'Moyenne'}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-orange-500">{selectedTrip.maxSpeed ?? '—'}</p>
                            <p className="text-[10px] text-slate-400">{lang === 'ar' ? 'الأقصى' : 'Maximum'}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-slate-600">{selectedTrip.durationMin ?? '—'}</p>
                            <p className="text-[10px] text-slate-400">{lang === 'ar' ? 'دقيقة' : 'min'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <h2 className="text-sm font-bold text-primary-500">
                              {lang === 'ar' ? 'الخط الزمني' : 'Chronologie'}
                            </h2>
                            <p className="mt-1 text-[10px] text-slate-400">
                              {lang === 'ar' ? 'كل نقطة تمثل تحديثاً حقيقياً من Traccar' : 'Chaque point vient de Traccar'}
                            </p>
                          </div>
                          <div className="flex gap-3 text-[10px] text-slate-400">
                            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />D</span>
                            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-400" />P</span>
                          </div>
                        </div>
                        <div className="relative space-y-3">
                          <div className="absolute bottom-2 left-[7px] top-2 w-px bg-slate-100" />
                          {selectedRoute.map((point, pointIndex) => {
                            const isDriving = Number(point.speed) > 0
                            const time = point.fixTime
                              ? new Date(point.fixTime).toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { hour: '2-digit', minute: '2-digit' })
                              : '—'
                            return (
                              <button
                                key={`${point.fixTime}-${pointIndex}`}
                                onClick={() => { setReplayIndex(pointIndex); setReplayState('paused') }}
                                className="relative flex w-full items-start gap-3 text-left"
                              >
                                <span className={`relative z-10 mt-1 h-4 w-4 shrink-0 rounded-full border-4 border-white shadow-sm ${isDriving ? 'bg-emerald-500' : 'bg-red-400'}`} />
                                <span className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2">
                                  <span className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-slate-600">{time}</span>
                                    <span className={`text-[10px] font-bold ${isDriving ? 'text-emerald-600' : 'text-red-500'}`}>
                                      {isDriving ? 'D' : 'P'} · {point.speed ?? 0} {t(lang, 'kmh')}
                                    </span>
                                  </span>
                                  <span className="mt-1 block truncate text-[10px] text-slate-400">
                                    {point.address || (lang === 'ar' ? 'العنوان غير متاح من Traccar' : 'Adresse indisponible dans Traccar')}
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
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 text-center">
                <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center mb-4 ${
                  device.engineOn
                    ? 'bg-gradient-to-br from-emerald-400 to-accent shadow-lg shadow-emerald-200'
                    : 'bg-gradient-to-br from-gray-200 to-gray-300'
                }`}>
                  {device.engineOn
                    ? <Zap size={40} className="text-white" />
                    : <ZapOff size={40} className="text-gray-400" />
                  }
                </div>
                <h3 className="font-bold text-primary-500 text-lg mb-1">
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
                    }`}
                  >
                    {device.engineOn ? t(lang, 'cutEngine') : t(lang, 'startEngine')}
                  </button>
                  {device.status === 'offline' && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-[11px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {lang === 'ar' ? 'الجهاز غير متصل' : 'Appareil hors ligne'}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                    </div>
                  )}
                </div>
              </div>

              {/* Status log */}
              <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-slate-400 mb-3">
                  {lang === 'ar' ? 'سجل التحكم' : 'Journal de contrôle'}
                </p>
                <p className="text-xs text-slate-400 text-center py-2">
                  {lang === 'ar' ? 'لا توجد سجلات حالياً' : 'Aucun enregistrement pour le moment'}
                </p>
              </div>
            </div>
          )}

          {/* GEOFENCE TAB */}
          {activeTab === 'geofence' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 relative">
                <MapView
                  deviceId={device.id}
                  height="100%"
                  zoom={13}
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
                      <span className="text-xs font-bold text-white tracking-wide">
                        {lang === 'ar' ? 'السياج الجغرافي مفعّل' : 'Zone géographique active'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white px-4 py-3 shadow-t border-t border-gray-100 pb-20 space-y-3">
                {/* Radius slider */}
                {!geofenceActive && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-400">
                        {lang === 'ar' ? 'نصف القطر' : 'Rayon'}
                      </span>
                      <span className="text-xs font-bold text-primary-500">{geofenceRadius} م</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={5000}
                      step={100}
                      value={geofenceRadius}
                      onChange={e => setGeofenceRadius(Number(e.target.value))}
                      className="w-full accent-primary-500"
                    />
                  </div>
                )}

                {/* Error message */}
                {geofenceError && (
                  <p className="text-xs text-red-500 text-center">{geofenceError}</p>
                )}

                {/* Action button */}
                <button
                  onClick={handleToggleGeofence}
                  disabled={geofenceLoading}
                  className={`w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                    geofenceActive
                      ? 'bg-red-500 text-white'
                      : 'bg-primary-500 text-white'
                  }`}
                >
                  {geofenceLoading
                    ? (lang === 'ar' ? 'جاري التنفيذ...' : 'En cours...')
                    : geofenceActive
                      ? t(lang, 'deactivateGeofence')
                      : t(lang, 'activateGeofence')
                  }
                </button>

                {/* Success message — shown right below the button */}
                <AnimatePresence>
                  {geofenceSuccess && (
                    <motion.div
                      className="flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-2.5 text-xs font-semibold"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      {geofenceSuccess}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* SHARE TAB */}
          {activeTab === 'share' && (
            <div className="h-full overflow-y-auto mobile-scroll pb-20 p-5 flex flex-col gap-4">
              <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/40 text-center">
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
                <button
                  onClick={handleShareLocation}
                  disabled={shareLoading}
                  className="w-full py-3 bg-accent text-slate-900 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-transform"
                >
                  {shareLoading
                    ? <><Loader2 size={16} className="animate-spin" /> {lang === 'ar' ? 'جاري الإنشاء...' : 'Création...'}</>
                    : <><Share2 size={16} /> {lang === 'ar' ? 'إنشاء رابط المشاركة' : 'Créer un lien de partage'}</>}
                </button>
              </div>

              <AnimatePresence>
                {shareLink && (
                  <motion.div
                    className="bg-slate-800/60 rounded-2xl p-4 border border-accent/30"
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  >
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              ✅ {engineSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        <ClientNav />
      </div>
    </div>
  )
}
