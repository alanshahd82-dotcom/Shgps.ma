import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, MapPin, Bell, BellOff, X, ChevronDown, Car, Loader2 } from 'lucide-react'
import { MapContainer, TileLayer, Circle as LeafletCircle, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'

const centerIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#0F2044;border:3px solid #00D97E;box-shadow:0 0 0 5px rgba(0,217,126,0.22)"></div>',
  iconSize: [18,18], iconAnchor: [9,9],
})

function MapClickHandler({ onMapClick, enabled }) {
  useMapEvents({ click: e => { if (enabled) onMapClick(e.latlng) } })
  return null
}

function FitBounds({ center, radius }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.fitBounds(L.latLng(center).toBounds(radius * 2.5), { padding:[40,40], maxZoom:16, animate:true })
  }, [center, radius])
  return null
}

export default function Geofences() {
  const { devices, lang } = useApp()
  const [geofences, setGeofences] = useState([])
  const [deviceId, setDeviceId]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [showMap, setShowMap]     = useState(false)
  const [drawing, setDrawing]     = useState(false)
  const [center, setCenter]       = useState(null)
  const [radius, setRadius]       = useState(500)
  const [name, setName]           = useState('')
  const [alertEnter, setAlertEnter] = useState(true)
  const [alertExit, setAlertExit]   = useState(true)
  const [saving, setSaving]         = useState(false)
  const [showDevices, setShowDevices] = useState(false)
  const isAr = lang === 'ar'

  const selectedDevice = devices.find(d => String(d.id) === String(deviceId))

  useEffect(() => {
    if (devices.length && !deviceId) setDeviceId(String(devices[0].id))
  }, [devices])

  const load = useCallback(async () => {
    if (!deviceId) return
    setLoading(true)
    try {
      const data = await api.geofences.list(deviceId)
      setGeofences(Array.isArray(data) ? data : data.geofences || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [deviceId])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!center || !name.trim()) return
    setSaving(true)
    try {
      await api.geofences.create(deviceId, { name, lat: center.lat, lng: center.lng, radius, alert_enter: alertEnter, alert_exit: alertExit })
      setShowMap(false); setCenter(null); setName(''); setRadius(500)
      load()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(geofenceId) {
    if (!window.confirm(isAr ? 'حذف السياج؟' : 'Supprimer la zone ?')) return
    try { await api.geofences.remove(deviceId, geofenceId); load() } catch (e) { alert(e.message) }
  }

  const cardStyle = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }

  return (
    <div className="min-h-screen pb-28" dir={isAr ? 'rtl' : 'ltr'}
      style={{ background:'linear-gradient(160deg,#080f1f 0%,#0F2044 100%)' }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <h1 className="text-white font-bold text-xl">{isAr ? 'المناطق الجغرافية' : 'Géofences'}</h1>
        <motion.button whileTap={{ scale:0.9 }} onClick={() => setShowMap(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background:'#00D97E', boxShadow:'0 4px 16px rgba(0,217,126,0.4)' }}>
          <Plus size={20} color="#0F2044"/>
        </motion.button>
      </div>

      {/* Device picker */}
      <div className="px-5 mb-4">
        <button onClick={() => setShowDevices(s => !s)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2">
            <Car size={15} style={{ color:'#00D97E' }}/>
            <span className="text-white text-sm font-medium">
              {selectedDevice?.name || (isAr ? 'اختر جهازاً' : 'Choisir appareil')}
            </span>
          </div>
          <ChevronDown size={15} style={{ color:'rgba(255,255,255,0.4)', transform: showDevices ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}/>
        </button>
        <AnimatePresence>
          {showDevices && (
            <motion.div initial={{ height:0,opacity:0 }} animate={{ height:'auto',opacity:1 }} exit={{ height:0,opacity:0 }}
              className="overflow-hidden rounded-xl mt-1"
              style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)' }}>
              {devices.map(d => (
                <button key={d.id} onClick={() => { setDeviceId(String(d.id)); setShowDevices(false) }}
                  className="w-full px-4 py-3 text-left text-sm"
                  style={{ color: String(d.id)===deviceId ? '#00D97E' : 'rgba(255,255,255,0.7)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {d.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* List */}
      <div className="px-4 space-y-2.5">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor:'#00D97E', borderTopColor:'transparent' }}/>
          </div>
        ) : geofences.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background:'rgba(255,255,255,0.05)' }}>
              <MapPin size={26} style={{ color:'rgba(255,255,255,0.2)' }}/>
            </div>
            <p className="text-sm" style={{ color:'rgba(255,255,255,0.28)' }}>{isAr ? 'لا توجد مناطق جغرافية' : 'Aucune zone'}</p>
            <button onClick={() => setShowMap(true)}
              className="px-4 py-2 rounded-full text-xs font-semibold"
              style={{ background:'rgba(0,217,126,0.12)', color:'#00D97E', border:'1px solid rgba(0,217,126,0.25)' }}>
              {isAr ? '+ إضافة منطقة' : '+ Ajouter zone'}
            </button>
          </div>
        ) : geofences.map((geo, i) => (
          <motion.div key={geo.id || i} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.04 }}
            className="p-4 rounded-2xl" style={cardStyle}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background:'rgba(0,217,126,0.1)' }}>
                <MapPin size={20} style={{ color:'#00D97E' }}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{geo.name}</p>
                <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.35)' }}>{geo.radius} m</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-[10px]"
                    style={{ color: geo.alert_enter ? '#00D97E' : 'rgba(255,255,255,0.25)' }}>
                    <Bell size={10}/>{isAr ? 'دخول' : 'Entrée'}
                  </span>
                  <span className="flex items-center gap-1 text-[10px]"
                    style={{ color: geo.alert_exit ? '#FF9500' : 'rgba(255,255,255,0.25)' }}>
                    <Bell size={10}/>{isAr ? 'خروج' : 'Sortie'}
                  </span>
                </div>
              </div>
              <button onClick={() => handleDelete(geo.id)} className="p-2">
                <Trash2 size={15} style={{ color:'rgba(255,59,48,0.6)' }}/>
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Draw modal */}
      <AnimatePresence>
        {showMap && (
          <motion.div className="fixed inset-0 z-50" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ background:'#080f1f' }}>
            <div className="flex items-center justify-between px-5 pt-12 pb-3">
              <h2 className="text-white font-bold text-base">{isAr ? 'رسم منطقة جديدة' : 'Nouvelle zone'}</h2>
              <button onClick={() => { setShowMap(false); setCenter(null) }}>
                <X size={22} style={{ color:'rgba(255,255,255,0.5)' }}/>
              </button>
            </div>

            {/* Map */}
            <div style={{ height:280, margin:'0 16px', borderRadius:16, overflow:'hidden', border:'1px solid rgba(255,255,255,0.1)' }}>
              <MapContainer center={[31.7917,-7.0926]} zoom={5} style={{ height:'100%',width:'100%' }} zoomControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                <MapClickHandler onMapClick={ll => setCenter(ll)} enabled={true}/>
                {center && (
                  <>
                    <Marker position={center} icon={centerIcon}/>
                    <LeafletCircle center={center} radius={radius} pathOptions={{ color:'#00D97E', fillColor:'#00D97E', fillOpacity:0.1, weight:2 }}/>
                    <FitBounds center={center} radius={radius}/>
                  </>
                )}
              </MapContainer>
            </div>

            <p className="text-center text-xs mt-2 mb-3" style={{ color:'rgba(255,255,255,0.35)' }}>
              {isAr ? 'اضغط على الخريطة لتحديد المركز' : 'Appuyez sur la carte pour centrer'}
            </p>

            <div className="px-5 space-y-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color:'rgba(255,255,255,0.38)' }}>{isAr ? 'اسم المنطقة' : 'Nom de la zone'}</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={isAr ? 'مثال: المنزل، المكتب...' : 'Ex: Maison, Bureau...'}
                  className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none"
                  style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)' }}/>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs" style={{ color:'rgba(255,255,255,0.38)' }}>{isAr ? 'نصف القطر' : 'Rayon'}</label>
                  <span className="text-xs font-bold" style={{ color:'#00D97E' }}>{radius} m</span>
                </div>
                <input type="range" min="100" max="5000" step="50" value={radius} onChange={e => setRadius(Number(e.target.value))}
                  className="w-full" style={{ accentColor:'#00D97E' }}/>
              </div>

              <div className="flex items-center gap-4 py-2">
                {[
                  { key:'enter', label: isAr?'تنبيه دخول':'Alerte entrée', val:alertEnter, set:setAlertEnter },
                  { key:'exit',  label: isAr?'تنبيه خروج':'Alerte sortie', val:alertExit,  set:setAlertExit  },
                ].map(({ key, label, val, set }) => (
                  <button key={key} onClick={() => set(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={val ? { background:'rgba(0,217,126,0.15)', color:'#00D97E', border:'1px solid rgba(0,217,126,0.3)' }
                              : { background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.1)' }}>
                    {val ? <Bell size={11}/> : <BellOff size={11}/>}
                    {label}
                  </button>
                ))}
              </div>

              <motion.button disabled={!center || !name.trim() || saving} onClick={handleSave} whileTap={{ scale:0.97 }}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm disabled:opacity-40"
                style={{ background:'linear-gradient(135deg,#00D97E,#00b86a)', boxShadow:'0 4px 16px rgba(0,217,126,0.3)' }}>
                {saving ? '...' : (isAr ? 'حفظ المنطقة' : 'Enregistrer la zone')}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ClientNav/>
    </div>
  )
}
