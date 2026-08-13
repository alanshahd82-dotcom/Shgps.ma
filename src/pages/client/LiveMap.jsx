import React, { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, X, Navigation, MapPin, Gauge, Loader2, Route as RouteIcon, Wifi, Zap } from 'lucide-react'
import { MapContainer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import MapLayers from '../../components/MapLayers'
import LiveVehicleMarker from '../../components/LiveVehicleMarker'
import { useApp } from '../../context/AppContext'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import { VehicleIcon, timeAgo, formatVoltage, getDeviceStatusKey } from '../../components/ui'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import { downsample, simplifyPath } from '../../utils/simplify'

// ── Map icons ──────────────────────────────────────────────────────────────────
const userLocIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:22px;height:22px">
    <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(59,130,246,0.18);animation:ping 2s ease-out infinite"></div>
    <div style="position:absolute;inset:0;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 2px 12px rgba(59,130,246,0.6)"></div>
  </div>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
})

const ST_CLR = { moving: '#00D97E', idle: '#FF9500', stopped: '#FF3B30', awaiting_gps: '#F59E0B', offline: '#6b7280' }

function makeVehicleIcon(device, isSelected) {
  const st  = getDeviceStatusKey(device)
  const c   = ST_CLR[st] || '#6b7280'
  const sz  = isSelected ? 24 : 18
  const glow = isSelected ? `0 0 0 4px ${c}44,` : ''
  const pulse = st === 'moving'
    ? `<div style="position:absolute;inset:-7px;border-radius:50%;background:${c}22;animation:ping 2s ease-out infinite"></div>`
    : ''
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${sz}px;height:${sz}px">
      ${pulse}
      <div style="position:absolute;inset:0;border-radius:50%;background:${c};border:${isSelected ? 3 : 2}px solid white;box-shadow:${glow}0 2px 12px rgba(0,0,0,0.5)"></div>
    </div>`,
    iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
  })
}

// ── Map helpers ────────────────────────────────────────────────────────────────
function FlyToUser({ target }) {
  const map  = useMap()
  const prev = useRef(null)
  useEffect(() => {
    if (!target) return
    if (prev.current === target.ts) return
    prev.current = target.ts
    map.flyTo([target.lat, target.lng], 16, { duration: 1.2 })
  }, [target])
  return null
}

function FlyTo({ lat, lng, zoom = 15 }) {
  const map  = useMap()
  const prev = useRef(null)
  useEffect(() => {
    const la = Number(lat), ln = Number(lng)
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return
    if (la < -90 || la > 90 || ln < -180 || ln > 180) return
    const key = la + ',' + ln
    if (prev.current === key) return
    prev.current = key
    map.flyTo([la, ln], zoom, { duration: 1.2 })
  }, [lat, lng, zoom])
  return null
}

function FitTodayRoute({ route }) {
  const map = useMap()
  useEffect(() => {
    if (route.length < 2) return
    try {
      const bounds = L.latLngBounds(route)
      if (bounds.isValid()) {
        map.invalidateSize({ pan: false })
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: false })
      }
    } catch {
      // Keep the current map view if a malformed upstream route slips through.
    }
  }, [map, route])
  return null
}

// ── Constants ──────────────────────────────────────────────────────────────────
const DEVICE_PANEL_MAX_HEIGHT = '45vh'

const ST_LABEL = {
  moving:  { ar: 'يتحرك',    fr: 'En mouvement' },
  idle:    { ar: 'خامل',     fr: 'Ralenti'       },
  stopped: { ar: 'متوقف',    fr: 'Arrêté'        },
  awaiting_gps: { ar: 'في انتظار تحديد الموقع', fr: 'En attente de localisation' },
  offline: { ar: 'غير متصل', fr: 'Hors ligne'    },
}

function formatLiveAge(iso, lang, now) {
  if (!iso) return lang === 'ar' ? 'غير متاح' : 'Indisponible'
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return lang === 'ar' ? `${seconds} ث` : `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  return lang === 'ar' ? `${minutes} د` : `${minutes} min`
}

function getFixTime(device) {
  return device?.fixTime || device?.lastUpdate || device?.last_update
}

function getLiveBearing(device) {
  const course = Number(device?.course ?? device?.attributes?.course)
  return Number.isFinite(course) ? Math.round(course) : null
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function LiveMap() {
  const { devices, lang } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [search,       setSearch]       = useState('')
  const [searchOpen,   setSearchOpen]   = useState(false)
  const [selected,     setSelected]     = useState(null)
  const [panelOpen,    setPanelOpen]    = useState(false)
  const [userPos,      setUserPos]      = useState(null)
  const [locateTarget, setLocateTarget] = useState(null)
  const [autoFollow, setAutoFollow] = useState(() => localStorage.getItem('athargps_auto_follow') !== 'false')
  const [clock, setClock] = useState(() => Date.now())
  const [todayRoute, setTodayRoute] = useState([])
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState('')
  const routeRequestRef = useRef(0)
  const isAr = lang === 'ar'
  const requestedDeviceId = searchParams.get('device')
  useEffect(() => {
    localStorage.setItem('athargps_auto_follow', String(autoFollow))
  }, [autoFollow])

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Continuous position watch (updates blue dot only)
  useEffect(() => {
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      p => {
        const lat = Number(p.coords.latitude)
        const lng = Number(p.coords.longitude)
        if (Number.isFinite(lat) && Number.isFinite(lng)) setUserPos({ lat, lng })
      },
      () => {}
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // One-shot locate + fly
  function locateMe() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(p => {
      const lat = Number(p.coords.latitude)
      const lng = Number(p.coords.longitude)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setUserPos({ lat, lng })
        setLocateTarget({ lat, lng, ts: Date.now() })
      }
    }, () => {})
  }

  const toCoord = v => {
    if (v == null || v === '') return null
    const number = Number(v)
    return Number.isFinite(number) ? number : null
  }

  const hasValidMapPoint = (lat, lng) =>
    lat !== null && lng !== null &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)

  const filtered = useMemo(() => {
    const trackable = devices.filter(d => d.trackingEnabled !== false)
    if (!search.trim()) return trackable
    const q = search.toLowerCase()
    return trackable.filter(d =>
      d.name?.toLowerCase().includes(q) || d.plate?.toLowerCase().includes(q)
    )
  }, [devices, search])

  const positioned = useMemo(() =>
    filtered
      .map(d => ({
        ...d,
        lat: toCoord(d.lat) ?? toCoord(d.last_lat),
        lng: toCoord(d.lng) ?? toCoord(d.last_lng),
      }))
      .filter(d => hasValidMapPoint(d.lat, d.lng)),
  [filtered])

  const sel = selected ? devices.find(d => d.id === selected) : null

  useEffect(() => {
    if (!requestedDeviceId) return
    const requested = devices.find(d => String(d.id) === String(requestedDeviceId))
    if (requested) {
      setSelected(requested.id)
    }
  }, [devices, requestedDeviceId])

  useEffect(() => {
    setTodayRoute([])
    setRouteError('')
  }, [selected])

  async function showTodayRoute(device) {
    if (routeLoading) return
    const requestId = ++routeRequestRef.current
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    setRouteLoading(true)
    setRouteError('')
    try {
      const points = await api.stats.getPositions(device.id, from.toISOString(), new Date().toISOString(), 1500)
      const rawRoute = (Array.isArray(points) ? points : [])
        .map(point => [toCoord(point?.latitude ?? point?.lat), toCoord(point?.longitude ?? point?.lng)])
        .filter(([lat, lng]) =>
          Number.isFinite(lat) && Number.isFinite(lng)
          && lat >= -90 && lat <= 90
          && lng >= -180 && lng <= 180
          && !(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)
        )
      const route = downsample(simplifyPath(rawRoute, 0.00005), 600)
      if (requestId !== routeRequestRef.current) return
      if (route.length < 2) {
        setRouteError(isAr ? 'لا توجد نقاط كافية لمسار اليوم.' : 'Pas assez de points pour le trajet du jour.')
        setTodayRoute([])
      } else {
        setTodayRoute(route)
      }
    } catch {
      if (requestId !== routeRequestRef.current) return
      setRouteError(isAr ? 'تعذّر تحميل مسار اليوم.' : 'Impossible de charger le trajet du jour.')
    } finally {
      if (requestId === routeRequestRef.current) setRouteLoading(false)
    }
  }

  function openMaps(type, device) {
    const lat = toCoord(device.lat) ?? toCoord(device.last_lat)
    const lng = toCoord(device.lng) ?? toCoord(device.last_lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    const origin = userPos ? `${userPos.lat},${userPos.lng}` : ''
    if (type === 'google') {
      window.open(
        origin
          ? `https://www.google.com/maps/dir/${origin}/${lat},${lng}`
          : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
        '_blank'
      )
    } else {
      window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank')
    }
  }

  const clientNavOffset = 'calc(5.6rem + env(safe-area-inset-bottom, 0px))'

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: '100dvh', '--athar-client-nav-offset': clientNavOffset }}
    >

      {/* ── Map ── */}
      <div
        className="athar-live-map-shell"
        aria-label={isAr ? 'الخريطة' : 'Carte'}
      >
        <MapContainer
          preferCanvas
          center={[31.7917, -7.0926]}
          zoom={6}
          minZoom={3}
          maxZoom={19}
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 0 }}
          zoomControl={false}
        >
           <MapLayers />
          {userPos && <Marker position={[userPos.lat, userPos.lng]} icon={userLocIcon} />}
          {positioned.map(d => (
            <LiveVehicleMarker
              key={d.id}
              device={{ ...d, lang }}
              isSelected={selected === d.id}
              autoFollow={autoFollow && selected === d.id}
              onClick={() => setSelected(d.id)}
            >
              <Popup>
                {(() => {
                  const popupStatus = getDeviceStatusKey(d)
                  const popupColor = ST_CLR[popupStatus] || ST_CLR.offline
                  const popupSignal = d.signal ?? d.signalStrength ?? d.signal_strength ?? d.rssi
                  return (
                    <div className="athar-device-popup" dir={isAr ? 'rtl' : 'ltr'}>
                      <div className="athar-device-popup-heading">
                        <div>
                          <strong>{d.name}</strong>
                          {d.plate && <span>{d.plate}</span>}
                        </div>
                        <span className="athar-device-popup-status" style={{ color: popupColor }}>
                          <i style={{ background: popupColor }} />
                          {ST_LABEL[popupStatus]?.[lang] || ST_LABEL[popupStatus]?.fr || popupStatus}
                        </span>
                      </div>
                      <div className="athar-device-popup-grid">
                        <span><Gauge size={13} />{Math.round(Number(d.speed) || 0)} {t(lang, 'kmh')}</span>
                        <span><Zap size={13} />{formatVoltage(d.voltage, lang)}</span>
                        <span><Wifi size={13} />{popupSignal == null ? '—' : popupSignal}</span>
                      </div>
                      <button
                        type="button"
                        className="athar-device-popup-link"
                        onClick={event => {
                          event.stopPropagation()
                          navigate('/client/device/' + d.id)
                        }}
                      >
                        {isAr ? 'عرض التفاصيل' : 'Voir les détails'}
                        <span aria-hidden="true">{isAr ? '←' : '→'}</span>
                      </button>
                    </div>
                  )
                })()}
              </Popup>
            </LiveVehicleMarker>
          ))}
           {todayRoute.length > 1 && (
             <Polyline
               positions={todayRoute}
               pathOptions={{ color: '#ffffff', weight: 7, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
             />
           )}
           <FitTodayRoute route={todayRoute} />
           {todayRoute.length > 1 && (
             <Polyline
               positions={todayRoute}
               pathOptions={{ color: '#1DBF73', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
             />
           )}
          {sel && <FlyTo lat={toCoord(sel.lat) ?? toCoord(sel.last_lat)} lng={toCoord(sel.lng) ?? toCoord(sel.last_lng)} />}
          <FlyToUser target={locateTarget} />
        </MapContainer>
        <div className="athar-map-vignette" aria-hidden="true" />
      </div>

      <ClientHeader overlay />


      {/* ── Devices launcher ── */}
      <button
        type="button"
        onClick={() => setPanelOpen(value => !value)}
        aria-expanded={panelOpen}
        aria-label={isAr ? 'فتح أجهزتي' : 'Ouvrir mes appareils'}
        className="absolute z-[500] rounded-2xl px-3.5 py-2.5 text-[11px] font-bold text-white"
        style={{
          top: 76,
          left: 14,
          background: 'rgba(6,12,26,0.92)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
        }}
      >
        {isAr ? 'أجهزتي' : 'Mes appareils'}
      </button>

      {/* ── Search icon first ── */}
      {!searchOpen && (
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label={isAr ? 'فتح البحث' : 'Ouvrir la recherche'}
          title={isAr ? 'بحث' : 'Rechercher'}
          className="absolute z-[500] flex h-10 w-10 items-center justify-center rounded-2xl text-white"
          style={{
            top: 76,
            right: 14,
            background: 'rgba(6,12,26,0.92)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(18px)',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
          }}
        >
          <Search size={17} />
        </button>
      )}

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="absolute z-[500] flex items-center gap-2.5 rounded-2xl px-4 py-2.5"
            style={{
              top: 68,
              right: 14,
              width: 'min(300px, calc(100% - 28px))',
              background: 'rgba(6,12,26,0.94)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 6px 28px rgba(0,0,0,0.45)',
            }}
          >
            <Search size={13} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isAr ? 'اسم الجهاز أو اللوحة...' : 'Nom ou plaque...'}
              className="min-w-0 flex-1 bg-transparent text-white outline-none"
              style={{ fontSize: 13 }}
            />
            <button
              type="button"
              onClick={() => { setSearch(''); setSearchOpen(false) }}
              aria-label={isAr ? 'إغلاق البحث' : 'Fermer la recherche'}
            >
              <X size={14} style={{ color: 'rgba(255,255,255,0.55)' }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Small bounded devices card ── */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute z-[500] overflow-y-auto rounded-3xl px-3 py-3"
            style={{
              top: 124,
              left: 14,
              width: 'min(360px, calc(100% - 28px))',
              maxHeight: DEVICE_PANEL_MAX_HEIGHT,
              background: 'rgba(5,10,24,0.96)',
              backdropFilter: 'blur(32px)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
            }}
          >
        {/* Device list */}
        {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <Search size={18} style={{ color: 'rgba(255,255,255,0.15)' }} />
                  </div>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {isAr ? 'لا توجد نتائج' : 'Aucun résultat'}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {filtered.map((d, idx) => {
                  const st         = getDeviceStatusKey(d)
                  const c          = ST_CLR[st] || '#6b7280'
                  const isSelected = selected === d.id
                  const hasPos     = (Number.isFinite(toCoord(d.lat)) || Number.isFinite(toCoord(d.last_lat))) &&
                                     (Number.isFinite(toCoord(d.lng)) || Number.isFinite(toCoord(d.last_lng)))

                  return (
                    <motion.div
                      key={d.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: idx * 0.03 }}
                    >
                      {/* ── Card ── */}
                      <button
                        onClick={() => { setSelected(isSelected ? null : d.id) }}
                        className="w-full text-left"
                        style={{
                          background: isSelected
                            ? 'linear-gradient(135deg, rgba(0,217,126,0.1) 0%, rgba(0,217,126,0.04) 100%)'
                            : 'rgba(255,255,255,0.04)',
                          border: `1.5px solid ${isSelected ? 'rgba(0,217,126,0.45)' : 'rgba(255,255,255,0.06)'}`,
                          borderRadius: isSelected && hasPos ? '16px 16px 0 0' : 16,
                          padding: '11px 14px',
                          transition: 'all 0.25s ease',
                          boxShadow: isSelected ? `0 0 24px rgba(0,217,126,0.12), inset 0 1px 0 rgba(0,217,126,0.15)` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-3">

                          {/* Vehicle icon + status dot */}
                          <div className="relative flex-shrink-0">
                            <VehicleIcon type={d.type} iconSize={15} />
                            <span
                              className="absolute -bottom-0.5 -right-0.5 rounded-full border-2"
                              style={{
                                width: 10, height: 10,
                                background: c,
                                borderColor: '#050a18',
                                boxShadow: st === 'moving' ? `0 0 6px ${c}` : 'none',
                              }}
                            />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-white leading-tight truncate">{d.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {d.plate && (
                                <span
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
                                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }}
                                >
                                  {d.plate}
                                </span>
                              )}
                              {(d.lastUpdate || d.last_update) && (
                                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                                  {timeAgo(d.lastUpdate || d.last_update, lang)}
                                </span>
                              )}
                              {isSelected && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold"
                                  style={{ color: getFixTime(d) && (clock - new Date(getFixTime(d)).getTime()) < 30000 ? '#38d39f' : '#9ca3af' }}
                                >
                                  <span
                                    className="rounded-full"
                                    style={{
                                      width: 6,
                                      height: 6,
                                      background: getFixTime(d) && (clock - new Date(getFixTime(d)).getTime()) < 30000 ? '#38d39f' : '#9ca3af',
                                      animation: getFixTime(d) && (clock - new Date(getFixTime(d)).getTime()) < 30000 ? 'ping 2s ease-out infinite' : 'none',
                                    }}
                                  />
                                  {getFixTime(d) && (clock - new Date(getFixTime(d)).getTime()) < 30000 ? t(lang, 'online') : t(lang, 'notConnected')}
                                </span>
                              )}
                              {!hasPos && (
                                <span className="text-[10px]" style={{ color: 'rgba(239,68,68,0.6)' }}>
                                  {isAr ? 'لا يوجد موقع GPS' : 'Pas de position GPS'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Status / speed badge */}
                          <div className="flex-shrink-0">
                            {st === 'moving' && d.speed > 0 ? (
                              <div className="flex items-end gap-0.5">
                                <span className="font-black text-base leading-none" style={{ color: '#00D97E' }}>
                                  {Math.round(d.speed)}
                                </span>
                                <span className="text-[9px] leading-none mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                  km/h
                                </span>
                              </div>
                            ) : (
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{
                                  background: `${c}1a`,
                                  color: c,
                                  border: `1px solid ${c}33`,
                                }}
                              >
                                {ST_LABEL[st]?.[lang] || ST_LABEL[st]?.fr || st}
                              </span>
                            )}
                          </div>

                        </div>
                        {isSelected && hasPos && (
                          <div
                            className="mt-2 flex items-center gap-3 border-t pt-2 text-[10px]"
                            style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.48)' }}
                          >
                            <span>{t(lang, 'lastUpdate')}: {t(lang, 'before')} {formatLiveAge(getFixTime(d), lang, clock)}</span>
                            <span>{t(lang, 'speed')}: {Math.round(Number(d.speed) || 0)} {t(lang, 'kmh')}</span>
                            {getLiveBearing(d) !== null && <span>{t(lang, 'bearing')}: {getLiveBearing(d)}°</span>}
                          </div>
                        )}
                      </button>

                      {/* ── Nav buttons (expanded) ── */}
                      <AnimatePresence>
                        {isSelected && hasPos && (
                          <motion.div
                            initial={{ opacity: 0, scaleY: 0.8 }}
                            animate={{ opacity: 1, scaleY: 1 }}
                            exit={{ opacity: 0, scaleY: 0.8 }}
                            transition={{ duration: 0.2 }}
                            style={{ originY: 0 }}
                          >
                            <div
                              className="flex gap-2.5 p-3"
                              style={{
                                background: 'rgba(0,217,126,0.05)',
                                border: '1.5px solid rgba(0,217,126,0.3)',
                                borderTop: '1px solid rgba(0,217,126,0.15)',
                                borderRadius: '0 0 16px 16px',
                              }}
                            >
                              <button
                                 onClick={(event) => {
                                   event.stopPropagation()
                                   showTodayRoute(d)
                                 }}
                                disabled={routeLoading}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs disabled:opacity-60"
                                style={{
                                  background: 'rgba(217,173,98,0.14)',
                                  border: '1px solid rgba(217,173,98,0.38)',
                                  color: '#e7c788',
                                }}
                              >
                                {routeLoading ? <Loader2 size={13} className="animate-spin" /> : <RouteIcon size={13} />}
                                {t(lang, 'showRoute')}
                              </button>
                              <button
                                onClick={() => openMaps('google', d)}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs"
                                style={{
                                  background: 'rgba(59,130,246,0.18)',
                                  border: '1px solid rgba(59,130,246,0.4)',
                                  color: '#93C5FD',
                                }}
                              >
                                <Navigation size={13} />
                                Google Maps
                              </button>
                              <button
                                onClick={() => openMaps('waze', d)}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs"
                                style={{
                                  background: 'rgba(0,217,126,0.12)',
                                  border: '1px solid rgba(0,217,126,0.38)',
                                  color: '#00D97E',
                                }}
                              >
                                <MapPin size={13} />
                                Waze
                              </button>
                            </div>
                            {routeError && (
                              <p className="px-3 pb-1 text-center text-[10px] font-semibold text-amber-300">{routeError}</p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      <ClientNav />
    </div>
  )
}
