import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, X, ChevronUp, LocateFixed, Navigation } from 'lucide-react'
import { MapContainer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import GeoapifyTileLayer from '../../components/GeoapifyTileLayer'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import { VehicleIcon, StatusDot, timeAgo, getDeviceStatusKey } from '../../components/ui'

const PANEL_PEEK = 90
const PANEL_OPEN = 300

const userLocIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 0 0 6px rgba(59,130,246,0.22),0 2px 8px rgba(0,0,0,0.3)"></div>',
  iconSize: [16,16], iconAnchor: [8,8],
})

function getVehicleType(device) {
  const cat  = (device.category || device.type || '').toLowerCase()
  const name = (device.name || '').toLowerCase()
  if (
    cat === 'motorcycle' || cat === 'bike' || cat === 'moto' ||
    name.includes('\u062f\u0631\u0627\u062c\u0629') || name.includes('moto') || name.includes('bike') || name.includes('velo')
  ) return 'bike'
  if (
    cat === 'truck' || cat === 'van' || cat === 'bus' || cat === 'camion' ||
    name.includes('\u0634\u0627\u062d\u0646\u0629') || name.includes('truck') || name.includes('camion') || name.includes('van')
  ) return 'truck'
  return 'car'
}

const VEHICLE_SVGS = {
  car:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>',
  bike:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4C7.4 8.8 7 9.5 7 10c0 .6.2 1.2.8 1.6l3.2 2.4V18h2v-5l-3.2-2.5.8-.8-.8-.7zm8.2 1.5c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/></svg>',
  truck: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>',
}
const VEHICLE_BG   = { car: '#0F2044', bike: '#c2410c', truck: '#6B21A8' }
const STATUS_COLOR = { moving: '#00D97E', idle: '#FF9500', stopped: '#FF3B30', offline: '#6b7280' }

function makeVehicleIcon(device, isSelected) {
  isSelected = isSelected || false
  const type        = getVehicleType(device)
  const st          = getDeviceStatusKey(device)
  const statusColor = STATUS_COLOR[st] || '#6b7280'
  const bg          = VEHICLE_BG[type] || '#0F2044'
  const size        = isSelected ? 44 : 36
  const svg         = VEHICLE_SVGS[type]
  const border      = isSelected ? '#00D97E' : 'rgba(255,255,255,0.22)'
  const pulse       = isSelected
    ? 'box-shadow:0 0 0 4px rgba(0,217,126,0.28),0 0 0 9px rgba(0,217,126,0.08),0 4px 16px rgba(0,0,0,0.5);'
    : 'box-shadow:0 2px 10px rgba(0,0,0,0.38);'
  const safeName = (device.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const label = safeName
    ? '<div style="position:absolute;top:' + (size + 4) + 'px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(8,15,31,0.88);color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;border:1px solid rgba(255,255,255,0.14);backdrop-filter:blur(6px);pointer-events:none;letter-spacing:0.3px;">' + safeName + '</div>'
    : ''
  const html =
    '<div style="position:relative;display:inline-block;">' +
      '<div style="background:' + bg + ';border:2.5px solid ' + border + ';border-radius:50%;width:' + size + 'px;height:' + size + 'px;display:flex;align-items:center;justify-content:center;' + pulse + 'transition:all 0.25s;position:relative;">' +
        svg +
        '<div style="position:absolute;bottom:0px;right:0px;width:11px;height:11px;border-radius:50%;background:' + statusColor + ';border:2px solid rgba(8,15,31,0.95);"></div>' +
      '</div>' +
      label +
    '</div>'
  const labelH = safeName ? 22 : 0
  return L.divIcon({ html, className: '', iconSize: [size, size + labelH], iconAnchor: [size / 2, size / 2] })
}

function FlyTo({ lat, lng, zoom }) {
  zoom = zoom || 14
  const map  = useMap()
  const prev = useRef(null)
  useEffect(() => {
    const nextLat = Number(lat)
    const nextLng = Number(lng)
    if (
      !Number.isFinite(nextLat) || !Number.isFinite(nextLng) ||
      nextLat < -90 || nextLat > 90 || nextLng < -180 || nextLng > 180
    ) return
    const key = nextLat + ',' + nextLng
    if (prev.current === key) return
    prev.current = key
    map.flyTo([nextLat, nextLng], zoom, { duration: 1.2 })
  }, [lat, lng, zoom])
  return null
}

export default function LiveMap() {
  const navigate  = useNavigate()
  const { devices, lang, wsConnected } = useApp()
  const [search, setSearch]           = useState('')
  const [selected, setSelected]       = useState(null)
  const [panelOpen, setPanelOpen]     = useState(false)
  const [userPos, setUserPos]         = useState(null)
  const [directions, setDirections]   = useState(false)
  const isAr = lang === 'ar'

  useEffect(() => {
    let watcher
    if (navigator.geolocation) {
      watcher = navigator.geolocation.watchPosition(
        p => {
          const lat = Number(p.coords.latitude)
          const lng = Number(p.coords.longitude)
          if (Number.isFinite(lat) && Number.isFinite(lng)) setUserPos({ lat, lng })
        },
        () => {}
      )
    }
    return () => { if (watcher) navigator.geolocation.clearWatch(watcher) }
  }, [])

  useEffect(() => { setDirections(false) }, [selected])

  function locateMe() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      p => {
        const lat = Number(p.coords.latitude)
        const lng = Number(p.coords.longitude)
        if (Number.isFinite(lat) && Number.isFinite(lng)) setUserPos({ lat, lng })
      },
      () => {}
    )
  }

  function openGoogleMapsDirections(dLat, dLng) {
    const origin = userPos ? userPos.lat + ',' + userPos.lng : ''
    const dest   = dLat + ',' + dLng
    const url    = origin
      ? 'https://www.google.com/maps/dir/' + origin + '/' + dest
      : 'https://www.google.com/maps/search/?api=1&query=' + dest
    window.open(url, '_blank')
  }

  const filtered = useMemo(() => {
    const trackable = devices.filter(d => d.trackingEnabled !== false)
    if (!search.trim()) return trackable
    const q = search.toLowerCase()
    return trackable.filter(d =>
      d.name?.toLowerCase().includes(q) || d.plate?.toLowerCase().includes(q)
    )
  }, [devices, search])

  const toCoordinate = value => value == null || value === '' ? null : Number(value)
  const positioned = filtered
    .map(d => ({ ...d, lat: toCoordinate(d.lat), lng: toCoordinate(d.lng) }))
    .filter(d =>
      Number.isFinite(d.lat) && Number.isFinite(d.lng) &&
      d.lat >= -90 && d.lat <= 90 && d.lng >= -180 && d.lng <= 180
    )
  const sel = selected ? devices.find(d => d.id === selected) : null

  const directionPoints = (directions && userPos && sel &&
    Number.isFinite(Number(sel.lat)) && Number.isFinite(Number(sel.lng)))
    ? [[userPos.lat, userPos.lng], [Number(sel.lat), Number(sel.lng)]]
    : null

  const ST_COLOR = { moving:'#00D97E', idle:'#FF9500', stopped:'#FF3B30', offline:'#6b7280' }

  return (
    <div className="relative w-full" style={{ height: '100dvh' }}>
      <MapContainer
        center={[31.7917, -7.0926]}
        zoom={6}
        style={{ width:'100%', height:'100%', position:'absolute', inset:0, zIndex:0 }}
        zoomControl={false}
      >
        <GeoapifyTileLayer />
        {userPos && <Marker position={[userPos.lat, userPos.lng]} icon={userLocIcon}/>}
        {positioned.map(d => (
          <Marker
            key={d.id}
            position={[d.lat, d.lng]}
            icon={makeVehicleIcon(d, selected === d.id)}
            eventHandlers={{ click: () => { setSelected(d.id); setPanelOpen(true) } }}
          />
        ))}
        {sel && <FlyTo lat={sel.lat} lng={sel.lng}/>}
        {directionPoints && (
          <Polyline
            positions={directionPoints}
            pathOptions={{ color: '#3B82F6', weight: 4, opacity: 0.85, dashArray: '10 6' }}
          />
        )}
      </MapContainer>
      <ClientHeader overlay />

      <div className="absolute top-20 left-4 z-20">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: wsConnected ? 'rgba(0,217,126,0.85)' : 'rgba(255,59,48,0.85)', color:'white', backdropFilter:'blur(10px)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-white"/>
          {wsConnected ? 'Live' : 'Offline'}
        </div>
      </div>

      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 w-64">
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
          style={{ background:'rgba(8,15,31,0.9)', border:'1px solid rgba(255,255,255,0.12)', backdropFilter:'blur(16px)' }}>
          <Search size={14} style={{ color:'rgba(255,255,255,0.4)' }} className="flex-shrink-0"/>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? '\u0628\u062d\u062b...' : 'Chercher...'}
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30"
            style={{ fontSize: 13 }}/>
          {search && <button onClick={() => setSearch('')}><X size={13} style={{ color:'rgba(255,255,255,0.35)' }}/></button>}
        </div>
      </div>

      <div className="absolute z-20" style={{ bottom: panelOpen ? (PANEL_OPEN + 16) : (PANEL_PEEK + 16), right: 16 }}>
        <motion.button
          onClick={locateMe}
          whileTap={{ scale: 0.9 }}
          style={{ width:42, height:42, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(8,15,31,0.9)', border:'1px solid rgba(255,255,255,0.12)', backdropFilter:'blur(16px)' }}>
          <LocateFixed size={18} style={{ color:'#00D97E' }}/>
        </motion.button>
      </div>

      <div
        className="absolute left-0 right-0 z-20 transition-all duration-300 ease-out"
        style={{
          bottom: 0,
          height: panelOpen ? PANEL_OPEN : PANEL_PEEK,
          background:'rgba(8,15,31,0.97)',
          borderTop:'1px solid rgba(255,255,255,0.1)',
          backdropFilter:'blur(24px)',
          borderRadius:'20px 20px 0 0',
        }}
      >
        <div className="flex justify-center pt-3 pb-2 cursor-pointer" onClick={() => setPanelOpen(p => !p)}>
          <div className="w-10 h-1 rounded-full" style={{ background:'rgba(255,255,255,0.25)' }}/>
        </div>

        <div className="flex items-center justify-between px-4 pb-3">
          <p className="text-white text-sm font-bold">
            {positioned.length} {isAr ? '\u062c\u0647\u0627\u0632' : 'appareils'}
          </p>
          <ChevronUp size={16} style={{ color:'rgba(255,255,255,0.35)', transform: panelOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.3s' }}/>
        </div>

        {panelOpen && (
          <div className="overflow-y-auto px-4 space-y-2.5" style={{ maxHeight: PANEL_OPEN - 90 }}>
            {filtered.map(d => {
              const st         = getDeviceStatusKey(d)
              const c          = ST_COLOR[st] || '#6b7280'
              const isSelected = selected === d.id
              const dLat       = toCoordinate(d.lat)
              const dLng       = toCoordinate(d.lng)
              const hasPos     = Number.isFinite(dLat) && Number.isFinite(dLng)
              return (
                <div key={d.id}>
                  <button onClick={() => { setSelected(d.id) }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left"
                    style={{
                      background: isSelected ? 'rgba(0,217,126,0.1)' : 'rgba(255,255,255,0.05)',
                      border: '1px solid ' + (isSelected ? 'rgba(0,217,126,0.35)' : 'rgba(255,255,255,0.07)'),
                    }}>
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: c, minHeight:30 }}/>
                    <VehicleIcon type={getVehicleType(d)} iconSize={16}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-xs truncate">{d.name}</p>
                      {d.plate && <p className="text-[10px] font-mono" style={{ color:'rgba(255,255,255,0.3)' }}>{d.plate}</p>}
                    </div>
                    {d.speed != null && d.speed > 0 && (
                      <span className="text-xs font-bold flex-shrink-0" style={{ color:'#00D97E' }}>
                        {Math.round(d.speed)} <span className="font-normal text-[10px]" style={{ color:'rgba(255,255,255,0.35)' }}>km/h</span>
                      </span>
                    )}
                  </button>

                  {isSelected && hasPos && (
                    <div className="flex gap-2 mt-1.5 px-1">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setDirections(v => !v)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold"
                        style={{
                          background: directions ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.12)',
                          border: '1px solid ' + (directions ? 'rgba(59,130,246,0.7)' : 'rgba(59,130,246,0.3)'),
                          color: '#60A5FA',
                        }}>
                        <Navigation size={13}/>
                        {isAr ? '\u0639\u0631\u0636 \u0627\u0644\u0627\u062a\u062c\u0627\u0647' : 'Itin\u00e9raire'}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => openGoogleMapsDirections(dLat, dLng)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: 'rgba(255,255,255,0.6)',
                        }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Maps
                      </motion.button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ height:65 }}/>
      </div>

      <ClientNav/>
    </div>
  )
}