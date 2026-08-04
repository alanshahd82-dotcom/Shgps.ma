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
const PANEL_OPEN = 280

const userLocIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 0 0 6px rgba(59,130,246,0.22),0 2px 8px rgba(0,0,0,0.3)"></div>',
  iconSize: [16,16], iconAnchor: [8,8],
})

function makeVehicleIcon(device) {
  const st = getDeviceStatusKey(device)
  const c  = { moving:'#00D97E', idle:'#FF9500', stopped:'#FF3B30', offline:'#6b7280' }[st] || '#6b7280'
  return L.divIcon({
    className: '',
    html: '<div style="width:14px;height:14px;border-radius:50%;background:' + c + ';border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>',
    iconSize: [14,14], iconAnchor: [7,7],
  })
}

function FlyTo({ lat, lng, zoom = 14 }) {
  const map = useMap()
  const prev = useRef(null)
  useEffect(() => {
    const nextLat = Number(lat)
    const nextLng = Number(lng)
    if (
      !Number.isFinite(nextLat) ||
      !Number.isFinite(nextLng) ||
      nextLat < -90 ||
      nextLat > 90 ||
      nextLng < -180 ||
      nextLng > 180
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
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [userPos, setUserPos]   = useState(null)
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
      Number.isFinite(d.lat) &&
      Number.isFinite(d.lng) &&
      d.lat >= -90 &&
      d.lat <= 90 &&
      d.lng >= -180 &&
      d.lng <= 180
    )
  const sel = selected ? devices.find(d => d.id === selected) : null

  const ST_COLOR = { moving:'#00D97E', idle:'#FF9500', stopped:'#FF3B30', offline:'#6b7280' }

  return (
    <div className="relative w-full" style={{ height: '100dvh' }}>
      {/* Map */}
      <MapContainer
        center={[31.7917, -7.0926]}
        zoom={6}
        style={{ width:'100%', height:'100%', position:'absolute', inset:0, zIndex:0 }}
        zoomControl={false}
      >
        <GeoapifyTileLayer />
        {userPos && <Marker position={[userPos.lat, userPos.lng]} icon={userLocIcon}/>}
        {positioned.map(d => (
          <Marker key={d.id} position={[d.lat, d.lng]} icon={makeVehicleIcon(d)}
            eventHandlers={{ click: () => { setSelected(d.id); setPanelOpen(true) } }}/>
        ))}
        {sel && <FlyTo lat={sel.lat} lng={sel.lng}/>}
      </MapContainer>
      <ClientHeader overlay />

      {/* WS indicator */}
      <div className="absolute top-20 left-4 z-20">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: wsConnected ? 'rgba(0,217,126,0.85)' : 'rgba(255,59,48,0.85)', color:'white', backdropFilter:'blur(10px)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-white"/>
          {wsConnected ? 'Live' : 'Offline'}
        </div>
      </div>

      {/* Search bar */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 w-64">
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
          style={{ background:'rgba(8,15,31,0.9)', border:'1px solid rgba(255,255,255,0.12)', backdropFilter:'blur(16px)' }}>
          <Search size={14} style={{ color:'rgba(255,255,255,0.4)' }} className="flex-shrink-0"/>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث...' : 'Chercher...'}
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30"
            style={{ fontSize: 13 }}/>
          {search && <button onClick={() => setSearch('')}><X size={13} style={{ color:'rgba(255,255,255,0.35)' }}/></button>}
        </div>
      </div>

      {/* Locate me button */}
      <div className="absolute z-20" style={{ bottom: panelOpen ? (PANEL_OPEN + 16) : (PANEL_PEEK + 16), right: 16 }}>
        <motion.button
          onClick={locateMe}
          whileTap={{ scale: 0.9 }}
          style={{ width:42, height:42, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(8,15,31,0.9)', border:'1px solid rgba(255,255,255,0.12)', backdropFilter:'blur(16px)' }}>
          <LocateFixed size={18} style={{ color:'#00D97E' }}/>
        </motion.button>
      </div>

      {/* Sliding panel */}
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
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 cursor-pointer" onClick={() => setPanelOpen(p => !p)}>
          <div className="w-10 h-1 rounded-full" style={{ background:'rgba(255,255,255,0.25)' }}/>
        </div>

        {/* Count + toggle */}
        <div className="flex items-center justify-between px-4 pb-3">
          <p className="text-white text-sm font-bold">
            {positioned.length} {isAr ? 'جهاز' : 'appareils'}
          </p>
          <ChevronUp size={16} style={{ color:'rgba(255,255,255,0.35)', transform: panelOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.3s' }}/>
        </div>

        {/* Vehicle list */}
        {panelOpen && (
          <div className="overflow-y-auto px-4 space-y-2.5" style={{ maxHeight: PANEL_OPEN - 70 }}>
            {filtered.map(d => {
              const st = getDeviceStatusKey(d)
              const c  = ST_COLOR[st] || '#6b7280'
              const isSelected = selected === d.id
              return (
                <button key={d.id} onClick={() => { setSelected(d.id) }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left"
                  style={{
                    background: isSelected ? 'rgba(0,217,126,0.1)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid ' + (isSelected ? 'rgba(0,217,126,0.35)' : 'rgba(255,255,255,0.07)'),
                  }}>
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: c, minHeight:30 }}/>
                  <VehicleIcon type={d.type} iconSize={16}/>
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
              )
            })}
          </div>
        )}

        {/* Bottom nav space */}
        <div style={{ height:65 }}/>
      </div>

      <ClientNav/>
    </div>
  )
}
