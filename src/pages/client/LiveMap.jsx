import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, X, Navigation, Wifi, WifiOff, ChevronUp,
  LocateFixed, Route, Loader2
} from 'lucide-react'
import {
  MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents
} from 'react-leaflet'
import L from 'leaflet'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import MapView from '../../components/MapView'
import ClientNav from '../../components/ClientNav'
import { VehicleIcon, StatusDot, timeAgo, getDeviceStatusKey } from '../../components/ui'

const PANEL_PEEK = 88
const PANEL_OPEN = 270

// ── User location pulsing dot ─────────────────────────────────────────────────
const userLocIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:18px;height:18px;border-radius:50%;
    background:#3B82F6;border:3px solid white;
    box-shadow:0 0 0 6px rgba(59,130,246,0.22),0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

// ── Fly-to helper ─────────────────────────────────────────────────────────────
function FlyTo({ lat, lng, zoom = 14 }) {
  const map = useMap()
  const prevRef = useRef(null)
  useEffect(() => {
    if (!lat || !lng) return
    const key = `${lat},${lng}`
    if (prevRef.current === key) return
    prevRef.current = key
    map.flyTo([lat, lng], zoom, { duration: 1.2 })
  }, [lat, lng, zoom]) // eslint-disable-line
  return null
}

// ── Fit both user + vehicle in view ──────────────────────────────────────────
function FitBoth({ userPos, vehicle }) {
  const map = useMap()
  useEffect(() => {
    if (!userPos || !vehicle?.lat) return
    map.fitBounds(
      [[userPos.lat, userPos.lng], [vehicle.lat, vehicle.lng]],
      { padding: [80, 80], maxZoom: 15, animate: true }
    )
  }, [userPos?.lat, userPos?.lng, vehicle?.lat, vehicle?.lng]) // eslint-disable-line
  return null
}

// ── Route layer (OSRM, free, no key) ─────────────────────────────────────────
function RouteLayer({ userPos, vehicle }) {
  const [route,    setRoute]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [distText, setDistText] = useState('')
  const [timeText, setTimeText] = useState('')

  useEffect(() => {
    if (!userPos || !vehicle?.lat || !vehicle?.lng) {
      setRoute(null); return
    }
    let cancelled = false
    setLoading(true)
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${userPos.lng},${userPos.lat};${vehicle.lng},${vehicle.lat}` +
      `?overview=full&geometries=geojson`

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const leg = data?.routes?.[0]
        if (!leg) return
        // GeoJSON coords are [lng, lat] — flip for Leaflet [lat, lng]
        const coords = leg.geometry.coordinates.map(([lng, lat]) => [lat, lng])
        setRoute(coords)
        const km  = (leg.distance / 1000).toFixed(1)
        const min = Math.round(leg.duration / 60)
        setDistText(`${km} km`)
        setTimeText(`${min} min`)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [userPos?.lat, userPos?.lng, vehicle?.lat, vehicle?.lng]) // eslint-disable-line

  return (
    <>
      {route && (
        <Polyline
          positions={route}
          pathOptions={{
            color: '#3B82F6',
            weight: 5,
            opacity: 0.75,
            dashArray: '1 0',
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}
      {/* info badge rendered outside map via portal-ish pattern — passed up via state */}
      {(distText || loading) && (
        <RouteBadge distText={distText} timeText={timeText} loading={loading} />
      )}
    </>
  )
}

// ── Route info badge (drawn as Leaflet control via custom hook) ───────────────
function RouteBadge({ distText, timeText, loading }) {
  const map = useMap()
  useEffect(() => {
    const ctrl = L.control({ position: 'topright' })
    ctrl.onAdd = () => {
      const div = L.DomUtil.create('div')
      div.style.cssText = `
        background:rgba(15,32,68,0.9);color:white;padding:6px 12px;
        border-radius:20px;font-size:11px;font-weight:700;
        box-shadow:0 2px 10px rgba(0,0,0,0.3);backdrop-filter:blur(8px);
        margin:8px;display:flex;align-items:center;gap:6px;
      `
      div.innerHTML = loading
        ? `<span style="opacity:.7">…</span>`
        : `<span style="color:#3B82F6">⬛</span><span>${distText}</span><span style="opacity:.6">|</span><span>${timeText}</span>`
      return div
    }
    ctrl.addTo(map)
    return () => ctrl.remove()
  }, [distText, timeText, loading]) // eslint-disable-line
  return null
}

// ── Inner map panel (needs access to map instance) ───────────────────────────
function InnerMap({ focusDevice, userPos, showRoute }) {
  return (
    <>
      {/* Fly to focused vehicle */}
      {focusDevice?.lat && !showRoute && (
        <FlyTo lat={focusDevice.lat} lng={focusDevice.lng} zoom={15} />
      )}

      {/* Fit both in view when routing */}
      {showRoute && userPos && focusDevice?.lat && (
        <FitBoth userPos={userPos} vehicle={focusDevice} />
      )}

      {/* User location dot */}
      {userPos && (
        <Marker position={[userPos.lat, userPos.lng]} icon={userLocIcon} />
      )}

      {/* Routing polyline */}
      {showRoute && userPos && focusDevice?.lat && (
        <RouteLayer userPos={userPos} vehicle={focusDevice} />
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LiveMap() {
  const { devices, lang, wsConnected } = useApp()
  const isAr = lang === 'ar'

  const [search,     setSearch]     = useState('')
  const [focusId,    setFocusId]    = useState(null)
  const [panelOpen,  setPanelOpen]  = useState(false)
  const [userPos,    setUserPos]    = useState(null)
  const [locError,   setLocError]   = useState(false)
  const [locLoading, setLocLoading] = useState(false)
  const [showRoute,  setShowRoute]  = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return devices
    return devices.filter(d =>
      (d.name  || '').toLowerCase().includes(q) ||
      (d.plate || '').toLowerCase().includes(q)
    )
  }, [devices, search])

  const onlineCount  = devices.filter(d => d.status === 'online').length
  const focusDevice  = focusId ? devices.find(d => d.id === focusId) : null

  // ── Get user GPS ────────────────────────────────────────────────────────
  const locateMe = useCallback(() => {
    if (!navigator.geolocation) { setLocError(true); return }
    setLocLoading(true); setLocError(false)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocLoading(false)
      },
      () => { setLocError(true); setLocLoading(false) },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }, [])

  // Auto-locate once on mount
  useEffect(() => { locateMe() }, []) // eslint-disable-line

  // ── Toggle routing ──────────────────────────────────────────────────────
  const toggleRoute = () => {
    if (!userPos) { locateMe(); return }
    setShowRoute(v => !v)
  }

  return (
    <div className="relative flex flex-col dark:bg-slate-900" style={{ height: '100dvh' }}>

      {/* ── Full-screen map ──────────────────────────────────────────────── */}
      <div className="absolute inset-0" style={{ bottom: 56 }}>
        <MapView
          showAllDevices
          deviceId={focusId}
          height="100%"
          zoom={focusId ? 15 : 11}
        >
          <InnerMap
            focusDevice={focusDevice}
            userPos={userPos}
            showRoute={showRoute && !!focusDevice}
          />
        </MapView>
      </div>

      {/* ── Floating top bar ─────────────────────────────────────────────── */}
      <div
        className="absolute left-0 right-0 z-20 flex flex-col gap-2 px-3"
        style={{ top: 'env(safe-area-inset-top, 0px)', paddingTop: 12 }}
      >
        {/* WS pill + Locate button row */}
        <div className="flex items-center justify-between">
          {/* Locate me button */}
          <button
            onClick={locateMe}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold text-white active:scale-90 transition-transform"
            style={{ background: 'rgba(59,130,246,0.90)', backdropFilter: 'blur(8px)' }}
            title={isAr ? 'موقعي' : 'Ma position'}
          >
            {locLoading
              ? <Loader2 size={9} className="animate-spin" />
              : <LocateFixed size={9} />
            }
            {isAr ? 'موقعي' : 'Ma position'}
          </button>

          {/* WS pill */}
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold"
            style={{
              background: wsConnected ? 'rgba(34,197,94,0.92)' : 'rgba(245,158,11,0.92)',
              color: 'white',
              backdropFilter: 'blur(8px)',
            }}
          >
            {wsConnected
              ? <><Wifi size={9} /> LIVE</>
              : <><WifiOff size={9} className="animate-pulse" /> {isAr ? 'إعادة الاتصال' : 'Reconnexion...'}</>
            }
          </div>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2.5 rounded-2xl px-4 py-3"
          style={{
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          <Search size={15} className="text-slate-400 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث عن مركبة...' : 'Rechercher un véhicule...'}
            className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
            dir={isAr ? 'rtl' : 'ltr'}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Stats chip */}
        <div
          className="self-start flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold"
          style={{ background: 'rgba(15,32,68,0.88)', color: 'white', backdropFilter: 'blur(8px)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          {onlineCount}/{devices.length} {isAr ? 'متصل' : 'en ligne'}
        </div>
      </div>

      {/* ── Focus chip + Route button ─────────────────────────────────────── */}
      {focusDevice && (() => {
        const hasCoords = focusDevice.lat && focusDevice.lng
        return (
          <div
            className="absolute z-20 flex items-center gap-2 px-3 py-2 rounded-2xl"
            style={{
              bottom: PANEL_PEEK + 70,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15,32,68,0.92)',
              backdropFilter: 'blur(8px)',
              whiteSpace: 'nowrap',
            }}
          >
            <Navigation size={11} className="text-accent" />
            <span className="text-white text-xs font-semibold">{focusDevice.name}</span>

            {/* Route toggle */}
            {hasCoords && userPos && (
              <button
                onClick={toggleRoute}
                className="flex items-center gap-1 ms-1 px-2 py-0.5 rounded-full text-[9px] font-bold transition-all active:scale-90"
                style={{
                  background: showRoute ? '#3B82F6' : 'rgba(255,255,255,0.15)',
                  color: 'white',
                }}
              >
                <Route size={9} />
                {isAr ? 'المسار' : 'Itinéraire'}
              </button>
            )}

            <button onClick={() => { setFocusId(null); setShowRoute(false) }} className="text-white/60 ms-1">
              <X size={11} />
            </button>
          </div>
        )
      })()}

      {/* ── Location error toast ──────────────────────────────────────────── */}
      {locError && (
        <div
          className="absolute z-20 left-4 right-4 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold"
          style={{ bottom: PANEL_PEEK + 12, background: 'rgba(239,68,68,0.90)', color: 'white', backdropFilter: 'blur(8px)' }}
        >
          <LocateFixed size={12} />
          {isAr ? 'تعذّر تحديد موقعك — تأكد من السماح بالوصول للموقع' : 'Position indisponible — vérifiez les permissions'}
          <button onClick={() => setLocError(false)} className="ms-auto"><X size={12} /></button>
        </div>
      )}

      {/* ── Bottom vehicle drawer ─────────────────────────────────────────── */}
      <div
        className="absolute left-0 right-0 z-20"
        style={{
          bottom: 56,
          height: panelOpen ? PANEL_OPEN : PANEL_PEEK,
          transition: 'height 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div
          className="mx-2 h-full flex flex-col rounded-t-3xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          }}
        >
          {/* Handle */}
          <button
            className="w-full flex flex-col items-center pt-2.5 pb-2 flex-shrink-0"
            onClick={() => setPanelOpen(v => !v)}
          >
            <div className="w-9 h-1 rounded-full bg-slate-300" />
            <div className="flex items-center gap-1.5 mt-1.5">
              <ChevronUp
                size={12}
                className="text-slate-400 transition-transform duration-300"
                style={{ transform: panelOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
              <span className="text-[11px] text-slate-500 font-medium">
                {filtered.length} {isAr ? 'مركبة' : 'véhicules'}
              </span>
            </div>
          </button>

          {/* Vehicle list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
            {filtered.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-4">
                {isAr ? 'لا توجد نتائج' : 'Aucun résultat'}
              </p>
            ) : filtered.map(device => {
              const st        = getDeviceStatusKey(device)
              const isFocused = focusId === device.id
              return (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => {
                    if (isFocused) { setFocusId(null); setShowRoute(false) }
                    else { setFocusId(device.id); setPanelOpen(false) }
                  }}
                  className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-start transition-all"
                  style={{
                    background: isFocused ? 'rgba(0,217,126,0.10)' : 'rgba(248,250,252,1)',
                    border: `1.5px solid ${isFocused ? 'rgba(0,217,126,0.40)' : 'rgba(226,232,240,1)'}`,
                  }}
                >
                  <VehicleIcon type={device.type} iconSize={14} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary-500 text-sm truncate">{device.name}</p>
                    <p className="text-slate-400 text-[10px]">{device.plate || '—'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <StatusDot status={st} size={7} />
                    {device.speed > 0 && (
                      <span className="text-[9px] font-bold text-slate-500">{device.speed} {t(lang, 'kmh')}</span>
                    )}
                    <span className="text-[9px] text-slate-400">{timeAgo(device.lastUpdate, lang)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom nav ───────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <ClientNav />
      </div>
    </div>
  )
}
