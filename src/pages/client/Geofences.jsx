import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, MapPin, Bell, BellOff, X, ChevronDown, Car, Loader2 } from 'lucide-react'
import { MapContainer, Circle as LeafletCircle, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import MapLayers from '../../components/MapLayers'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'

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
      const data = await api.geofences.list()
      const all  = Array.isArray(data) ? data : data.geofences || []
      // filter client-side to show only zones for the selected device
      setGeofences(deviceId ? all.filter(g => !g.device_id || String(g.device_id) === String(deviceId)) : all)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [deviceId])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!center || !name.trim()) return
    setSaving(true)
    try {
      await api.geofences.create({ name, center: { lat: center.lat, lng: center.lng }, radius, deviceId, notifyEnter: alertEnter, notifyExit: alertExit })
      setShowMap(false); setCenter(null); setName(''); setRadius(500)
      load()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(geofenceId) {
    if (!window.confirm(isAr ? 'حذف السياج؟' : 'Supprimer la zone ?')) return
    try { await api.geofences.remove(geofenceId); load() } catch (e) { alert(e.message) }
  }

  const cardStyle = { background:'#ffffff', border:'1px solid #e2e8f0', boxShadow:'0 4px 16px rgba(23,50,77,.04)' }

  return (
    <div className="client-app min-h-dvh bg-[#F5F6F8] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <h1 className="text-primary-500 font-extrabold text-xl">{isAr ? 'المناطق الجغرافية' : 'Géofences'}</h1>
        <motion.button whileTap={{ scale:0.9 }} onClick={() => setShowMap(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700">
          <Plus size={20} color="white"/>
        </motion.button>
      </div>

      {/* Device picker */}
      <div className="px-5 mb-4">
        <button onClick={() => setShowDevices(s => !s)}
          className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Car size={15} className="text-primary-500"/>
            <span className="text-slate-800 text-sm font-bold">
              {selectedDevice?.name || (isAr ? 'اختر جهازاً' : 'Choisir appareil')}
            </span>
          </div>
           <ChevronDown size={15} className="text-slate-500" style={{ transform: showDevices ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}/>
        </button>
        <AnimatePresence>
          {showDevices && (
            <motion.div initial={{ height:0,opacity:0 }} animate={{ height:'auto',opacity:1 }} exit={{ height:0,opacity:0 }}
              className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {devices.map(d => (
                <button key={d.id} onClick={() => { setDeviceId(String(d.id)); setShowDevices(false) }}
                  className={`w-full border-b border-slate-100 px-4 py-3 text-left text-sm ${String(d.id)===deviceId ? 'text-indigo-600' : 'text-slate-600'}`}>
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
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor:'#e4b56b', borderTopColor:'transparent' }}/>
          </div>
        ) : geofences.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white border border-slate-200">
              <MapPin size={26} className="text-slate-300"/>
            </div>
            <p className="text-sm text-slate-500">{isAr ? 'لا توجد مناطق جغرافية' : 'Aucune zone'}</p>
            <button onClick={() => setShowMap(true)}
               className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-600">
              {isAr ? '+ إضافة منطقة' : '+ Ajouter zone'}
            </button>
          </div>
        ) : geofences.map((geo, i) => (
          <motion.div key={geo.id || i} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.04 }}
            className="p-4 rounded-2xl" style={cardStyle}>
            <div className="flex items-center gap-3">
               <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                 <MapPin size={20} className="text-indigo-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-800 font-bold text-sm">{geo.name}</p>
                <p className="text-xs mt-0.5 text-slate-500">{geo.radius} m</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-[10px]"
                    style={{ color: geo.alert_enter ? '#4f46e5' : '#94a3b8' }}>
                    <Bell size={10}/>{isAr ? 'دخول' : 'Entrée'}
                  </span>
                  <span className="flex items-center gap-1 text-[10px]"
                    style={{ color: geo.alert_exit ? '#d97706' : '#94a3b8' }}>
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
          <motion.div className="fixed inset-0 z-50 bg-slate-50" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            <div className="flex items-center justify-between px-5 pt-12 pb-3">
               <h2 className="text-slate-900 font-bold text-base">{isAr ? 'رسم منطقة جديدة' : 'Nouvelle zone'}</h2>
              <button onClick={() => { setShowMap(false); setCenter(null) }}>
                 <X size={22} className="text-slate-500"/>
              </button>
            </div>

            {/* Map */}
             <div style={{ height:280, margin:'0 16px', borderRadius:16, overflow:'hidden', border:'1px solid #e2e8f0' }}>
              <MapContainer center={[31.7917,-7.0926]} zoom={5} style={{ height:'100%',width:'100%' }} zoomControl={false} preferCanvas>
                <MapLayers />
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

             <p className="text-center text-xs mt-2 mb-3 text-slate-500">
              {isAr ? 'اضغط على الخريطة لتحديد المركز' : 'Appuyez sur la carte pour centrer'}
            </p>

            <div className="px-5 space-y-3">
              <div>
                 <label className="block text-xs mb-1.5 text-slate-600">{isAr ? 'اسم المنطقة' : 'Nom de la zone'}</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={isAr ? 'مثال: المنزل، المكتب...' : 'Ex: Maison, Bureau...'}
                   className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 text-sm outline-none focus:border-indigo-600"/>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                 <label className="text-xs text-slate-600">{isAr ? 'نصف القطر' : 'Rayon'}</label>
                 <span className="text-xs font-bold text-indigo-600">{radius} m</span>
                </div>
                <input type="range" min="100" max="5000" step="50" value={radius} onChange={e => setRadius(Number(e.target.value))}
                   className="w-full" style={{ accentColor:'#4f46e5' }}/>
              </div>

              <div className="flex items-center gap-4 py-2">
                {[
                  { key:'enter', label: isAr?'تنبيه دخول':'Alerte entrée', val:alertEnter, set:setAlertEnter },
                  { key:'exit',  label: isAr?'تنبيه خروج':'Alerte sortie', val:alertExit,  set:setAlertExit  },
                ].map(({ key, label, val, set }) => (
                   <button key={key} onClick={() => set(v => !v)}
                     className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${val ? 'border-indigo-200 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-500'}`}>
                    {val ? <Bell size={11}/> : <BellOff size={11}/>}
                    {label}
                  </button>
                ))}
              </div>

              <motion.button disabled={!center || !name.trim() || saving} onClick={handleSave} whileTap={{ scale:0.97 }}
                 className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-40">
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
