import React, { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, LocateFixed, Navigation, MapPin, Gauge, ChevronUp, Loader2, Route as RouteIcon } from 'lucide-react'
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import MapLayers from '../../components/MapLayers'
import LiveVehicleMarker from '../../components/LiveVehicleMarker'
import { useApp } from '../../context/AppContext'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import { VehicleIcon, timeAgo, getDeviceStatusKey } from '../../components/ui'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'

// ── Map icons ──────────────────────────────────────────────────────────────────
const userLocIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:22px;height:22px">
    <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(59,130,246,0.18);animation:ping 2s ease-out infinite"></div>
    <div style="position:absolute;inset:0;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 2px 12px rgba(59,130,246,0.6)"></div>
  </div>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
})

const ST_CLR = { moving: '#00D97E', idle: '#FF9500', stopped: '#FF3B30', offline: '#6b7280' }

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
const PANEL_PEEK = 132
const PANEL_OPEN = 480

const ST_LABEL = {
  moving:  { ar: 'يتحرك',    fr: 'En mouvement' },
  idle:    { ar: 'خامل',     fr: 'Ralenti'       },
  stopped: { ar: 'متوقف',    fr: 'Arrêté'        },
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
  const { devices, lang, wsConnected } = useApp()
  const [search,       setSearch]       = useState('')
  const [selected,     setSelected]     = useState(null)
  const [panelOpen,    setPanelOpen]    = useState(false)
  const [userPos,      setUserPos]      = useState(null)
  const [locateTarget, setLocateTarget] = useState(null)
  const [autoFollow, setAutoFollow] = useState(() => localStorage.getItem('athargps_auto_follow') !== 'false')
  const [clock, setClock] = useState(() => Date.now())
  const [todayRoute, setTodayRoute] = useState([])
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState('')
  const isAr = lang === 'ar'
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
    setTodayRoute([])
    setRouteError('')
  }, [selected])

  async function showTodayRoute(device) {
    if (routeLoading) return
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    setRouteLoading(true)
    setRouteError('')
    try {
      const points = await api.stats.getPositions(device.id, from.toISOString(), new Date().toISOString(), 1500)
      const route = points
        .map(point => [toCoord(point?.latitude ?? point?.lat), toCoord(point?.longitude ?? point?.lng)])
        .filter(([lat, lng]) =>
          Number.isFinite(lat) && Number.isFinite(lng)
          && lat >= -90 && lat <= 90
          && lng >= -180 && lng <= 180
          && !(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)
        )
      if (route.length < 2) {
        setRouteError(isAr ? 'لا توجد نقاط كافية لمسار اليوم.' : 'Pas assez de points pour le trajet du jour.')
        setTodayRoute([])
      } else {
        setTodayRoute(route)
      }
    } catch {
      setRouteError(isAr ? 'تعذّر تحميل مسار اليوم.' : 'Impossible de charger le trajet du jour.')
    } finally {
      setRouteLoading(false)
    }
  }

  // Status summary counts
  const counts = useMemo(() => {
    const all = devices.filter(d => d.trackingEnabled !== false)
    return {
      moving:  all.filter(d => getDeviceStatusKey(d) === 'moving').length,
      idle:    all.filter(d => getDeviceStatusKey(d) === 'idle').length,
      stopped: all.filter(d => getDeviceStatusKey(d) === 'stopped').length,
      offline: all.filter(d => getDeviceStatusKey(d) === 'offline').length,
    }
  }, [devices])

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

  const panelH = panelOpen ? PANEL_OPEN : PANEL_PEEK

  return (
    <div className="relative w-full overflow-hidden" style={{ height: '100dvh' }}>

      {/* ── Map ── */}
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
            device={d}
            isSelected={selected === d.id}
            autoFollow={autoFollow && selected === d.id}
            onClick={() => { setSelected(d.id); setPanelOpen(true) }}
          />
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

      <ClientHeader overlay />

      <button
        type="button"
        onClick={() => setAutoFollow(value => !value)}
        aria-pressed={autoFollow}
        aria-label={isAr ? 'التتبع التلقائي' : 'Suivi automatique'}
        title={isAr ? 'التتبع التلقائي' : 'Suivi automatique'}
        className="absolute z-[500] flex items-center gap-1.5 rounded-2xl p-2.5 text-[11px] font-bold"
        style={{
          top: 116,
          left: 14,
          background: 'rgba(6,12,26,0.92)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
          color: autoFollow ? '#7ff3bf' : 'rgba(255,255,255,0.62)',
        }}
      >
        <LocateFixed size={14} />
        <span>{t(lang, 'autoFollow')}</span>
      </button>

      {/* ── Live indicator ── */}
      <div className="absolute z-20" style={{ top: 72, left: 14 }}>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
          style={{
            background: wsConnected ? 'rgba(0,217,126,0.92)' : 'rgba(239,68,68,0.92)',
            color: 'white',
            backdropFilter: 'blur(16px)',
            boxShadow: wsConnected
              ? '0 2px 16px rgba(0,217,126,0.5)'
              : '0 2px 16px rgba(239,68,68,0.5)',
          }}
        >
          <span
            className="rounded-full"
            style={{ width: 6, height: 6, display: 'inline-block',
              background: wsConnected ? '#38d39f' : '#e46b68',
              animation: wsConnected ? 'ping 2s ease-out infinite' : 'none' }}
          />
           {wsConnected ? t(lang, 'live') : t(lang, 'reconnecting')}
        </div>
      </div>

      {/* ── Search bar ── */}
      <div
        className="absolute z-20"
        style={{
          top: 68,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(300px, calc(100% - 110px))',
        }}
      >
        <div
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
          style={{
            background: 'rgba(6,12,26,0.94)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 6px 28px rgba(0,0,0,0.45)',
          }}
        >
          <Search size={13} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? 'اسم الجهاز أو اللوحة...' : 'Nom ou plaque...'}
            className="flex-1 bg-transparent outline-none text-white"
            style={{ fontSize: 13, minWidth: 0 }}
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label={isAr ? 'مسح البحث' : 'Effacer'}>
              <X size={13} style={{ color: 'rgba(255,255,255,0.35)' }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Locate button ── */}
      <motion.button
        onClick={locateMe}
        whileTap={{ scale: 0.88 }}
        aria-label={isAr ? 'تحديد موقعي' : 'Me localiser'}
        className="absolute z-20 flex items-center justify-center"
        style={{
          bottom: panelH + 14,
          right: 14,
          width: 46,
          height: 46,
          borderRadius: '50%',
          background: 'rgba(14,32,53,0.92)',
          border: '1px solid rgba(56,211,159,0.35)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,217,126,0.1)',
          transition: 'bottom 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <LocateFixed size={18} style={{ color: '#38d39f' }} />
      </motion.button>

      {/* ── Bottom Panel ── */}
      <div
        className="absolute left-0 right-0 z-20"
        style={{
          bottom: 0,
          height: panelH,
          transition: 'height 0.35s cubic-bezier(0.4,0,0.2,1)',
          borderRadius: '22px 22px 0 0',
          background: 'rgba(5,10,24,0.98)',
          backdropFilter: 'blur(32px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 -12px 48px rgba(0,0,0,0.7)',
        }}
      >
        {/* Drag handle */}
        <button
          className="w-full flex justify-center pt-3 pb-1"
          onClick={() => setPanelOpen(p => !p)}
        >
          <div
            className="rounded-full transition-all duration-300"
            style={{
              width: panelOpen ? 32 : 40,
              height: 4,
              background: 'rgba(255,255,255,0.15)',
            }}
          />
        </button>

        {/* Panel header */}
        <button
          className="w-full flex items-center justify-between px-4 py-2"
          onClick={() => setPanelOpen(p => !p)}
          aria-label={isAr ? (panelOpen ? 'إغلاق القائمة' : 'فتح القائمة') : (panelOpen ? 'Fermer' : 'Ouvrir')}
          aria-expanded={panelOpen}
        >
          {/* Status chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { key: 'moving',  color: '#00D97E', bg: 'rgba(0,217,126,0.12)',  border: 'rgba(0,217,126,0.25)',  label: { ar: 'يتحرك',    fr: 'Mvt'      } },
              { key: 'idle',    color: '#FF9500', bg: 'rgba(255,149,0,0.12)',  border: 'rgba(255,149,0,0.25)',  label: { ar: 'خامل',     fr: 'Ralenti'  } },
              { key: 'stopped', color: '#FF3B30', bg: 'rgba(255,59,48,0.12)',  border: 'rgba(255,59,48,0.25)',  label: { ar: 'متوقف',    fr: 'Arrêté'   } },
              { key: 'offline', color: '#9ca3af', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.22)', label: { ar: 'غير متصل', fr: 'Hors ligne' } },
            ].map(({ key, color, bg, border, label }) =>
              counts[key] > 0 ? (
                <span
                  key={key}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
                  style={{ background: bg, color, border: `1px solid ${border}` }}
                >
                  <span className="rounded-full" style={{ width: 6, height: 6, background: color, display: 'inline-block' }} />
                  {counts[key]} {label[lang] || label.fr}
                </span>
              ) : null
            )}
          </div>

          <motion.div animate={{ rotate: panelOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronUp size={16} style={{ color: 'rgba(255,255,255,0.25)' }} />
          </motion.div>
        </button>

        {/* Device list */}
        <AnimatePresence>
          {panelOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-y-auto px-3"
              style={{ maxHeight: PANEL_OPEN - 95, paddingBottom: 74 }}
            >
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
                                  {getFixTime(d) && (clock - new Date(getFixTime(d)).getTime()) < 30000 ? t(lang, 'live') : t(lang, 'notConnected')}
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
      </div>

      <ClientNav />
    </div>
  )
}
