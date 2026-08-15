import React, { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Gauge,
  Loader2,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Route as RouteIcon,
  Search,
  Settings2,
  UserRound,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react'
import { MapContainer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import MapLayers from '../../components/MapLayers'
import LiveVehicleMarker from '../../components/LiveVehicleMarker'
import { useApp } from '../../context/AppContext'
import ClientNav from '../../components/ClientNav'
import Logo from '../../components/Logo'
import { Button, Card, IconButton, OfflineState, Skeleton, StateMessage } from '../../design-system'
import { VehicleIcon, timeAgo, formatVoltage, getDeviceStatusKey } from '../../components/ui'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import { downsample, simplifyPath } from '../../utils/simplify'
import { isMapReadyAndSized, safelyUseMap, toValidLatLng } from '../../utils/mapSafety'

// ── Map icons ──────────────────────────────────────────────────────────────────
const userLocIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:22px;height:22px">
    <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(59,130,246,0.18);animation:ping 2s ease-out infinite"></div>
    <div style="position:absolute;inset:0;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 2px 12px rgba(59,130,246,0.6)"></div>
  </div>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
})

const ST_CLR = {
  moving: 'var(--ds-color-primary)',
  idle: 'var(--ds-color-warning)',
  stopped: 'var(--ds-color-cool-gray)',
  awaiting_gps: 'var(--ds-color-warning)',
  offline: 'var(--ds-color-danger)',
  power: 'var(--ds-color-danger)',
}

const DEFAULT_MAP_CENTER = [31.7917, -7.0926]

function useNonZeroElementSize(elementRef) {
  const [hasSize, setHasSize] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return undefined

    let frameId = null
    const measure = () => {
      const rect = element.getBoundingClientRect()
      const next = rect.width > 0 && rect.height > 0
      setHasSize(previous => previous === next ? previous : next)
    }
    const measureOnFrame = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(measure)
    }

    measure()
    measureOnFrame()
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(measureOnFrame)
    observer?.observe(element)

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      observer?.disconnect()
    }
  }, [elementRef])

  return hasSize
}

// ── Map helpers ────────────────────────────────────────────────────────────────
function FlyToUser({ target }) {
  const map  = useMap()
  const prev = useRef(null)
  useEffect(() => {
    const point = toValidLatLng(target)
    if (!point || !isMapReadyAndSized(map)) return
    if (prev.current === target.ts) return
    prev.current = target.ts
    safelyUseMap(map, currentMap => {
      currentMap.flyTo(point, 16, { duration: 1.2 })
    })
  }, [map, target])
  return null
}

function FlyTo({ lat, lng, zoom = 15 }) {
  const map  = useMap()
  const prev = useRef(null)
  useEffect(() => {
    const point = toValidLatLng([lat, lng])
    if (!point || !isMapReadyAndSized(map)) return
    const key = point.join(',')
    if (prev.current === key) return
    prev.current = key
    safelyUseMap(map, currentMap => {
      currentMap.flyTo(point, zoom, { duration: 1.2 })
    })
  }, [lat, lng, map, zoom])
  return null
}

function FitTodayRoute({ route }) {
  const map = useMap()
  useEffect(() => {
    if (!Array.isArray(route) || route.length < 2) return
    const validRoute = route
      .map(point => toValidLatLng(point))
      .filter(Boolean)
    if (validRoute.length < 2 || !isMapReadyAndSized(map)) return
    let bounds
    try {
      bounds = L.latLngBounds(validRoute)
      if (!bounds.isValid()) return
    } catch {
      return
    }

    let frameId = null
    const fit = () => {
      if (!isMapReadyAndSized(map)) return
      safelyUseMap(map, currentMap => {
        currentMap.invalidateSize({ pan: false })
        currentMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: false })
      })
    }
    frameId = window.requestAnimationFrame(fit)
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
    }
  }, [map, route])
  return null
}

function MapSizeSync() {
  const map = useMap()

  useEffect(() => {
    let frameId = null
    const sync = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(() => {
        safelyUseMap(map, currentMap => currentMap.invalidateSize({ pan: false }))
      })
    }

    sync()
    const container = map.getContainer?.()
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(sync)
    if (container) observer?.observe(container)
    map.whenReady?.(sync)

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      observer?.disconnect()
    }
  }, [map])

  return null
}

function MapErrorFallback({ lang, onRetry }) {
  const isAr = lang !== 'fr'
  return (
    <div className="athar-map-error-fallback" role="alert" dir={isAr ? 'rtl' : 'ltr'}>
      <MapPin size={22} aria-hidden="true" />
      <strong>{isAr ? 'تعذر عرض الخريطة' : 'La carte ne peut pas être affichée'}</strong>
      <span>
        {isAr
          ? 'يمكنك إعادة المحاولة دون مغادرة الصفحة.'
          : 'Vous pouvez réessayer sans quitter cette page.'}
      </span>
      <button type="button" onClick={onRetry}>
        {isAr ? 'إعادة المحاولة' : 'Réessayer'}
      </button>
    </div>
  )
}

class MapErrorBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Athar GPS map render error', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    return this.state.hasError
      ? <MapErrorFallback lang={this.props.lang} onRetry={this.handleRetry} />
      : this.props.children
  }
}

// ── Constants ──────────────────────────────────────────────────────────────────
const DEVICE_PANEL_MAX_HEIGHT = '45vh'

const ST_LABEL = {
  moving:  { ar: 'متصل',    fr: 'En ligne' },
  idle:    { ar: 'خامل',     fr: 'Ralenti' },
  stopped: { ar: 'متوقفة',  fr: 'À l’arrêt' },
  awaiting_gps: { ar: 'في انتظار GPS', fr: 'GPS en attente' },
  offline: { ar: 'مفصول', fr: 'Déconnecté' },
  power: { ar: 'مفصول', fr: 'Déconnecté' },
}

function formatLiveAge(iso, lang, now) {
  if (!iso) return lang === 'ar' ? 'غير متاح' : 'Indisponible'
  const timestamp = new Date(iso).getTime()
  if (!Number.isFinite(timestamp)) return lang === 'ar' ? 'غير متاح' : 'Indisponible'
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return lang === 'ar' ? `${seconds} ث` : `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  return lang === 'ar' ? `${minutes} د` : `${minutes} min`
}

function getFixTime(device) {
  return device?.serverTime || device?.server_time ||
    device?.fixTime || device?.lastUpdate || device?.last_update
}

function getLiveBearing(device) {
  const course = Number(device?.course ?? device?.attributes?.course)
  return Number.isFinite(course) ? Math.round(course) : null
}

function getMapStatus(device) {
  const statusKey = getDeviceStatusKey(device)
  if (device?.powerDisconnected || statusKey === 'offline') return 'offline'
  return statusKey
}

function getDeviceMetric(device, keys) {
  for (const key of keys) {
    const value = key.split('.').reduce((current, segment) => current?.[segment], device)
    if (value == null || value === '' || typeof value === 'boolean') continue
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return null
}

function formatMetricNumber(value) {
  if (value == null) return null
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function getSheetMetrics(device, lang) {
  if (!device) return []
  const speed = Number(device.speedKmh ?? device.speed ?? device.last_speed)
  const metrics = [{
    key: 'speed',
    Icon: Gauge,
    value: Number.isFinite(speed) ? String(Math.round(speed)) : '—',
    label: lang === 'ar' ? 'السرعة' : 'Vitesse',
    suffix: 'km/h',
  }, {
    key: 'voltage',
    Icon: Zap,
    value: formatVoltage(device.voltage, lang, getFixTime(device), device.powerDisconnected),
    label: lang === 'ar' ? 'الجهد' : 'Tension',
  }]

  const satellites = getDeviceMetric(device, [
    'satellites',
    'satellite',
    'attributes.satellites',
    'attributes.satellite',
  ])
  if (satellites != null) {
    metrics.push({
      key: 'satellites',
      Icon: Wifi,
      value: formatMetricNumber(satellites),
      label: lang === 'ar' ? 'الأقمار' : 'Satellites',
    })
  }

  const temperature = getDeviceMetric(device, [
    'temperature',
    'temp',
    'attributes.temperature',
    'attributes.temp',
  ])
  if (temperature != null) {
    metrics.push({
      key: 'temperature',
      Icon: Gauge,
      value: `${formatMetricNumber(temperature)}°`,
      label: lang === 'ar' ? 'الحرارة' : 'Température',
    })
  } else {
    const odometer = getDeviceMetric(device, [
      'odometer',
      'attributes.odometer',
    ])
    const hours = getDeviceMetric(device, [
      'hours',
      'engineHours',
      'totalHours',
      'attributes.hours',
      'attributes.engineHours',
    ])
    if (odometer != null) {
      metrics.push({
        key: 'odometer',
        Icon: Navigation,
        value: formatMetricNumber(odometer),
        label: lang === 'ar' ? 'عداد المسافة' : 'Odomètre',
      })
    } else if (hours != null) {
      metrics.push({
        key: 'hours',
        Icon: Gauge,
        value: formatMetricNumber(hours),
        label: lang === 'ar' ? 'ساعات التشغيل' : 'Heures moteur',
      })
    }
  }

  return metrics
}

function MapZoomControls({ open, onToggle, onLocate, lang }) {
  const map = useMap()
  const isAr = lang === 'ar'
  return (
    <div className="athar-premium-map-controls" dir="ltr">
      <IconButton
        label={isAr ? 'إظهار أدوات الخريطة' : 'Afficher les outils de carte'}
        onClick={onToggle}
        className={open ? 'athar-premium-map-controls__toggle is-active' : 'athar-premium-map-controls__toggle'}
      >
        <Settings2 size={17} aria-hidden="true" />
      </IconButton>
      {open && (
        <>
           <IconButton label={isAr ? 'تكبير الخريطة' : 'Zoom avant'} onClick={() => safelyUseMap(map, currentMap => currentMap.zoomIn())}>
            <Plus size={17} aria-hidden="true" />
          </IconButton>
           <IconButton label={isAr ? 'تصغير الخريطة' : 'Zoom arrière'} onClick={() => safelyUseMap(map, currentMap => currentMap.zoomOut())}>
            <Minus size={17} aria-hidden="true" />
          </IconButton>
          <IconButton label={isAr ? 'تحديد موقعي' : 'Me localiser'} onClick={onLocate}>
            <Crosshair size={17} aria-hidden="true" />
          </IconButton>
        </>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function LiveMap() {
  const {
    devices,
    lang,
    authReady,
    networkError,
    unreadCount,
    refreshDevices,
  } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [search,       setSearch]       = useState('')
  const [searchOpen,   setSearchOpen]   = useState(false)
  const [selected,     setSelected]     = useState(null)
  const [panelOpen,    setPanelOpen]    = useState(false)
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [mapControlsOpen, setMapControlsOpen] = useState(false)
  const [userPos,      setUserPos]      = useState(null)
  const [locateTarget, setLocateTarget] = useState(null)
  const [autoFollow, setAutoFollow] = useState(() => localStorage.getItem('athargps_auto_follow') !== 'false')
  const [clock, setClock] = useState(() => Date.now())
  const [initialEmptyWindow, setInitialEmptyWindow] = useState(true)
  const [todayRoute, setTodayRoute] = useState([])
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState('')
  const routeRequestRef = useRef(0)
  const sheetPointerRef = useRef(null)
  const mapShellRef = useRef(null)
  const mapHasSize = useNonZeroElementSize(mapShellRef)
  const isAr = lang === 'ar'
  const requestedDeviceId = searchParams.get('device')
  const deviceList = useMemo(
    () => (Array.isArray(devices) ? devices.filter(Boolean) : []),
    [devices],
  )
  useEffect(() => {
    localStorage.setItem('athargps_auto_follow', String(autoFollow))
  }, [autoFollow])

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!authReady) return undefined
    const timeout = window.setTimeout(() => setInitialEmptyWindow(false), 900)
    return () => window.clearTimeout(timeout)
  }, [authReady])

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

  const filtered = useMemo(() => {
    const trackable = deviceList.filter(d => d.trackingEnabled !== false)
    if (!search.trim()) return trackable
    const q = search.toLowerCase()
    return trackable.filter(d =>
      d.name?.toLowerCase().includes(q) || d.plate?.toLowerCase().includes(q)
    )
  }, [deviceList, search])

  const positioned = useMemo(() =>
    filtered
      .map(d => ({
        ...d,
        point: toValidLatLng(d),
      }))
      .filter(d => d.point),
  [filtered])

  const sel = selected ? deviceList.find(d => d.id === selected) : null
  const positionedSelection = positioned.find(d => d.id === selected)
  const selectedDevice = sel || positionedSelection || positioned[0] || filtered[0] || null
  const selectedStatus = getMapStatus(selectedDevice)
  const selectedStatusColor = ST_CLR[selectedStatus] || ST_CLR.offline
  const selectedMetrics = getSheetMetrics(selectedDevice, lang)
  const selectedHasPosition = Boolean(
    selectedDevice &&
    toValidLatLng(selectedDevice)
  )

  useEffect(() => {
    if (selected && !deviceList.some(device => device.id === selected)) {
      setSelected(null)
    }
  }, [deviceList, selected])

  useEffect(() => {
    if (!requestedDeviceId) return
    const requested = deviceList.find(d => String(d.id) === String(requestedDeviceId))
    if (requested) {
      setSelected(requested.id)
    }
  }, [deviceList, requestedDeviceId])

  useEffect(() => {
    if (selected || requestedDeviceId || positioned.length === 0) return
    setSelected(positioned[0].id)
  }, [positioned, requestedDeviceId, selected])

  useEffect(() => {
    setTodayRoute([])
    setRouteError('')
  }, [selected])

  async function showTodayRoute(device) {
    if (routeLoading || !device?.id) return
    const requestId = ++routeRequestRef.current
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    setRouteLoading(true)
    setRouteError('')
    try {
      const points = await api.stats.getPositions(device.id, from.toISOString(), new Date().toISOString(), 1500)
      const rawRoute = (Array.isArray(points) ? points : [])
        .map(point => toValidLatLng(point))
        .filter(Boolean)
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
    if (!device) return
    const point = toValidLatLng(device)
    if (!point) return
    const [lat, lng] = point
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
  const userPoint = toValidLatLng(userPos)
  const selectedPoint = toValidLatLng(selectedDevice)

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: '100dvh', '--athar-client-nav-offset': clientNavOffset }}
    >

      {/* ── Map ── */}
      <div
        ref={mapShellRef}
        className="athar-live-map-shell"
        aria-label={isAr ? 'الخريطة' : 'Carte'}
      >
        {!mapHasSize && (
          <div className="athar-map-loading" role="status">
            <span className="athar-map-spinner" />
          </div>
        )}
        {mapHasSize && <MapErrorBoundary lang={lang}>
          <MapContainer
            preferCanvas
            center={DEFAULT_MAP_CENTER}
            zoom={5}
            minZoom={3}
            maxZoom={19}
            style={{ width: '100%', height: '100%', minHeight: '100%', position: 'absolute', inset: 0, zIndex: 0 }}
            zoomControl={false}
          >
           <MapSizeSync />
           <MapLayers />
          {userPoint && (
            <Marker position={userPoint} icon={userLocIcon} />
          )}
          {positioned.map(d => (
            <LiveVehicleMarker
              key={d.id}
              device={{ ...d, lang }}
               isSelected={selectedDevice?.id === d.id}
               now={clock}
               autoFollow={autoFollow && selectedDevice?.id === d.id}
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
                        <span><Zap size={13} />{formatVoltage(d.voltage, lang, d.lastUpdate ?? d.last_update, d.powerDisconnected)}</span>
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
           <FitTodayRoute route={todayRoute} />
           {todayRoute.length > 1 && (
             <Polyline
               positions={todayRoute}
               pathOptions={{
                 color: 'var(--ds-color-primary)',
                 weight: 3,
                 opacity: 0.7,
                 lineCap: 'round',
                 lineJoin: 'round',
               }}
             />
           )}
            {selectedDevice && <FlyTo
              lat={toValidLatLng(selectedDevice)?.[0]}
              lng={toValidLatLng(selectedDevice)?.[1]}
            />}
          <FlyToUser target={locateTarget} />
           <MapZoomControls
             open={mapControlsOpen}
             onToggle={() => setMapControlsOpen(value => !value)}
             onLocate={locateMe}
             lang={lang}
           />
          </MapContainer>
         </MapErrorBoundary>}
        <div className="athar-map-vignette" aria-hidden="true" />
      </div>

      {/* ── Devices launcher ── */}
      <button
        type="button"
        onClick={() => setPanelOpen(value => !value)}
        aria-expanded={panelOpen}
        aria-label={isAr ? 'فتح أجهزتي' : 'Ouvrir mes appareils'}
        className="absolute z-[500] rounded-2xl px-3.5 py-2.5 text-[11px] font-bold text-white"
        style={{
           display: 'none',
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
             display: 'none',
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
               display: searchOpen ? 'flex' : 'none',
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
         {false && panelOpen && (
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
                  const hasPos = Boolean(toValidLatLng(d))

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

        {/* ── Premium selected-device sheet ── */}
        {selectedDevice ? (
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className={sheetExpanded
              ? 'athar-premium-sheet athar-premium-sheet--expanded'
              : 'athar-premium-sheet'}
            aria-label={isAr ? 'تفاصيل المركبة' : 'Détails du véhicule'}
          >
            <div className="athar-premium-sheet__body">
              <button
                type="button"
                className="athar-premium-sheet__handle"
                aria-label={sheetExpanded ? (isAr ? 'طي التفاصيل' : 'Réduire les détails') : (isAr ? 'توسيع التفاصيل' : 'Développer les détails')}
                aria-expanded={sheetExpanded}
                onPointerDown={event => {
                  sheetPointerRef.current = { pointerId: event.pointerId, clientY: event.clientY }
                  event.currentTarget.setPointerCapture?.(event.pointerId)
                }}
                onPointerUp={toggleSheetDrag}
                onPointerCancel={() => { sheetPointerRef.current = null }}
              >
                <span />
              </button>

              {networkError && (
                <div className="athar-premium-sheet__offline" dir={isAr ? 'rtl' : 'ltr'}>
                  <WifiOff size={15} aria-hidden="true" />
                  <span>
                    {isAr ? 'تعذر تحديث البيانات' : 'Mise à jour indisponible'}
                    <small>
                      {isAr ? 'آخر تحديث' : 'Dernière mise à jour'}: {formatLiveAge(getFixTime(selectedDevice), lang, clock)}
                    </small>
                  </span>
                  <button type="button" onClick={() => refreshDevices?.()}>
                    {isAr ? 'إعادة المحاولة' : 'Réessayer'}
                  </button>
                </div>
              )}

              <div className="athar-premium-sheet__summary" dir={isAr ? 'rtl' : 'ltr'}>
                <div className="athar-premium-sheet__vehicle">
                  <div className="athar-premium-sheet__vehicle-thumb" aria-hidden="true">
                    <VehicleIcon type={selectedDevice.type} iconSize={22} />
                  </div>
                  <div className="min-w-0">
                    <h2>{selectedDevice.name || (isAr ? 'جهاز بدون اسم' : 'Appareil sans nom')}</h2>
                    <div className="athar-premium-sheet__status">
                      <i style={{ background: selectedStatusColor }} />
                      <span>{ST_LABEL[selectedStatus]?.[lang] || ST_LABEL.offline[lang]}</span>
                      <small>{formatLiveAge(getFixTime(selectedDevice), lang, clock)}</small>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="athar-premium-sheet__devices-button"
                  onClick={() => {
                    setPanelOpen(value => !value)
                    setSheetExpanded(true)
                  }}
                >
                  <span>{isAr ? 'أجهزتي' : 'Mes appareils'}</span>
                  {panelOpen ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}
                </button>
              </div>

              <div className="athar-premium-metrics" dir={isAr ? 'rtl' : 'ltr'}>
                {selectedMetrics.map((metric, index) => {
                  const MetricIcon = metric.Icon
                  return (
                    <div key={metric.key} className="athar-premium-metric" style={{ borderInlineStart: index === 0 ? '0' : undefined }}>
                      <MetricIcon size={15} aria-hidden="true" />
                      <strong>{metric.value}</strong>
                      <span>{metric.label}{metric.suffix ? ` · ${metric.suffix}` : ''}</span>
                    </div>
                  )
                })}
              </div>

              <AnimatePresence initial={false}>
                {sheetExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22 }}
                    className="athar-premium-sheet__expanded"
                  >
                    {panelOpen && (
                      <Card className="athar-premium-device-list" dir={isAr ? 'rtl' : 'ltr'}>
                        <div className="athar-premium-device-list__heading">
                          <strong>{isAr ? 'الأجهزة' : 'Appareils'}</strong>
                          <span>{filtered.length}</span>
                        </div>
                        {filtered.length === 0 ? (
                          <StateMessage
                            icon={<Search size={18} />}
                            title={isAr ? 'لا توجد نتائج' : 'Aucun résultat'}
                            description={isAr ? 'جرّب اسمًا أو لوحة مختلفة.' : 'Essayez un autre nom ou une autre plaque.'}
                          />
                        ) : (
                          <div className="athar-premium-device-list__items">
                            {filtered.map(d => {
                              const deviceStatus = getMapStatus(d)
                              const color = ST_CLR[deviceStatus] || ST_CLR.offline
                              const isSelected = selectedDevice?.id === d.id
                              return (
                                <button
                                  key={d.id}
                                  type="button"
                                  className={isSelected ? 'athar-premium-device-row is-selected' : 'athar-premium-device-row'}
                                  onClick={() => {
                                    setSelected(d.id)
                                    setPanelOpen(false)
                                  }}
                                >
                                  <span className="athar-premium-device-row__icon">
                                    <VehicleIcon type={d.type} iconSize={17} />
                                    <i style={{ background: color }} />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <strong>{d.name}</strong>
                                    <small>{d.plate || timeAgo(getFixTime(d), lang)}</small>
                                  </span>
                                  <span className="athar-premium-device-row__status">
                                    {deviceStatus === 'moving'
                                      ? `${Math.round(Number(d.speedKmh ?? d.speed) || 0)} km/h`
                                      : ST_LABEL[deviceStatus]?.[lang]}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </Card>
                    )}

                    <details className="athar-premium-device-details" dir={isAr ? 'rtl' : 'ltr'}>
                      <summary>
                        <span>{isAr ? 'معلومات الجهاز' : 'Informations de l’appareil'}</span>
                        <ChevronRight size={15} aria-hidden="true" />
                      </summary>
                      <div className="athar-premium-device-details__grid">
                        <span><small>IMEI</small><strong>{selectedDevice.imei || '—'}</strong></span>
                        <span>
                          <small>{isAr ? 'الإحداثيات' : 'Coordonnées'}</small>
                          <strong>
                            {selectedHasPosition
                              ? `${selectedPoint[0]}, ${selectedPoint[1]}`
                              : '—'}
                          </strong>
                        </span>
                        <span><small>{isAr ? 'البروتوكول' : 'Protocole'}</small><strong>{selectedDevice.protocol || '—'}</strong></span>
                      </div>
                    </details>

                    {selectedHasPosition && (
                      <div className="athar-premium-sheet__actions" dir={isAr ? 'rtl' : 'ltr'}>
                        <Button variant="secondary" size="sm" disabled={routeLoading} onClick={() => showTodayRoute(selectedDevice)}>
                          {routeLoading ? <Loader2 size={14} className="animate-spin" /> : <RouteIcon size={14} />}
                          {t(lang, 'showRoute')}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => openMaps('google', selectedDevice)}>
                          <Navigation size={14} /> Google
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => openMaps('waze', selectedDevice)}>
                          <MapPin size={14} /> Waze
                        </Button>
                      </div>
                    )}
                    {routeError && <p className="athar-premium-sheet__route-error">{routeError}</p>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>
        ) : (
          <section className="athar-premium-sheet athar-premium-sheet--empty" aria-label={isAr ? 'حالة المركبات' : 'État des véhicules'}>
            <div className="athar-premium-sheet__body">
              <span className="athar-premium-sheet__handle" aria-hidden="true"><span /></span>
              {(!authReady || (initialEmptyWindow && !networkError)) ? (
                <div className="athar-premium-sheet__skeleton">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div>
                </div>
              ) : networkError ? (
                <OfflineState>
                  <span>
                    <strong>{isAr ? 'تعذر تحميل المركبات' : 'Impossible de charger les véhicules'}</strong>
                    <small>{isAr ? 'تحقق من الاتصال ثم أعد المحاولة.' : 'Vérifiez la connexion puis réessayez.'}</small>
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => refreshDevices?.()}>
                    {isAr ? 'إعادة المحاولة' : 'Réessayer'}
                  </Button>
                </OfflineState>
              ) : (
                <StateMessage
                  icon={<MapPin size={20} />}
                  title={isAr ? 'لا توجد مركبات بعد' : 'Aucun véhicule pour le moment'}
                  description={isAr ? 'أضف جهازًا لبدء التتبع المباشر.' : 'Ajoutez un appareil pour commencer le suivi.'}
                  action={<Button size="sm" onClick={() => navigate('/client/device-wizard')}>{isAr ? 'إضافة جهاز' : 'Ajouter un appareil'}</Button>}
                />
              )}
            </div>
          </section>
        )}

        <header className="athar-premium-map-topbar" aria-label={isAr ? 'شريط الخريطة' : 'Barre de carte'}>
          <div className="athar-premium-map-topbar__actions">
            <IconButton label={isAr ? 'التنبيهات' : 'Alertes'} onClick={() => navigate('/client/alerts')} className="athar-premium-map-icon">
              <span className="relative inline-flex">
                <Bell size={18} aria-hidden="true" />
                {unreadCount > 0 && <span className="athar-premium-map-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </span>
            </IconButton>
            <IconButton label={isAr ? 'الحساب' : 'Compte'} onClick={() => navigate('/client/settings')} className="athar-premium-map-icon">
              <UserRound size={18} aria-hidden="true" />
            </IconButton>
          </div>
          <Logo size="sm" white />
          <span aria-hidden="true" />
        </header>

        {!searchOpen && (
          <IconButton
            label={isAr ? 'البحث في الأجهزة' : 'Rechercher un appareil'}
            onClick={() => {
              setSearchOpen(true)
              setPanelOpen(true)
              setSheetExpanded(true)
            }}
            className="athar-premium-map-search"
          >
            <Search size={17} aria-hidden="true" />
          </IconButton>
        )}

      <ClientNav />
    </div>
  )
}
