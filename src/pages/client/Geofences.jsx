import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, MapPin, Bell, BellOff, X, ChevronDown, Car } from 'lucide-react'
import { MapContainer, Circle as LeafletCircle, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import GeoapifyTileLayer from '../../components/GeoapifyTileLayer'
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
  const [listErr, setListErr] = useState('')
  const showListErr = (msg) => { setListErr(msg); setTimeout(() => setListErr(''), 5000) }
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
    } catch (e) { showListErr(isAr ? 'تعذّر تحميل المناطق. تحقق من اتصالك.' : 'Impossible de charger les zones.') }
    finally { setLoading(false) }
  }, [deviceId, isAr])

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
    <div className="client-app min-h-screen bg-[#f5f7f8] dark:bg-[#0b1524] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <h1 className="text-primary-500 font-extrabold text-xl">{isAr ? 'المناطق الجغرافية' : 'Géofences'}</h1>
        <motion.button whileTap={{ scale:0.9 }} onClick={() => setShowMap(true)}
          aria-label={isAr ? 'إضافة منطقة جديدة' : 'Ajouter une zone'}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background:'#17324d' }}>
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
          <ChevronDown size={15} className="text-slate-400" style={{ transform: showDevices ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}/>
        </button>
        <AnimatePresence>
          {showDevices && (
            <motion.div initial={{ height:0,opacity:0 }} animate={{ height:'auto',opacity:1 }} exit={{ height:0,opacity:0 }}
              className="mt-1 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] shadow-sm">
              {devices.map(d => (
                <button key={d.id} onClick={() => { setDeviceId(String(d.id)); setShowDevices(false) }}
                  className="w-full px-4 py-3 text-start text-sm"
                  style={{ color: String(d.id)===deviceId ? '#17324d' : '#64748b', borderBottom:'1px solid #f1f5f9' }}>
                  {d.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* List */}
      <div className="px-4 space-y-2.5">
        {listErr && (
          <div className="mx-1 mb-3 p-3.5 rounded-xl text-sm text-center"
            style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.18)', color: '#ff6b60' }}>
            {listErr}
          </div>
        )}
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
              className="px-4 py-2 rounded-full text-xs font-semibold"
              style={{ background:'#e8f5f0', color:'#16866d', border:'1px solid #bfe4d7' }}>
              {isAr ? '+ إضافة منطقة' : '+ Ajouter zone'}
            </button>
          </div>
        ) : geofences.map((geo, i) => (
          <motion.div key={geo.id || i} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.04 }}
            className="p-4 rounded-2xl" style={cardStyle}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background:'#e8f5f0' }}>
                <MapPin size={20} className="text-[#16866d]"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-800 font-bold text-sm">{geo.name}</p>
                <p className="text-xs mt-0.5 text-slate-500">{geo.radius} m</p>
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
              <button onClick={() => handleDelete(geo.id)} className="p-2"
                aria-label={isAr ? 'حذف المنطقة' : 'Supprimer la zone'}>
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
              style={{ background:'#0d1b33' }}>
            <div className="flex items-center justify-between px-5 pt-12 pb-3">
              <h2 className="text-white font-bold text-base">{isAr ? 'رسم منطقة جديدة' : 'Nouvelle zone'}</h2>
              <button onClick={() => { setShowMap(false); setCenter(null) }}
                aria-label={isAr ? 'إغلاق' : 'Fermer'}>
                <X size={22} style={{ color:'rgba(255,255,255,0.5)' }}/>
              </button>
            </div>

            {/* Map */}
            <div style={{ height:280, margin:'0 16px', borderRadius:16, overflow:'hidden', border:'1px solid rgba(255,255,255,0.1)' }}>
              <MapContainer center={[31.7917,-7.0926]} zoom={5} style={{ height:'100%',width:'100%' }} zoomControl={false}>
                <GeoapifyTileLayer />
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
                  className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-white text-sm outline-none"/>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs" style={{ color:'rgba(255,255,255,0.38)' }}>{isAr ? 'نصف القطر' : 'Rayon'}</label>
                <span className="text-xs font-bold text-accent">{radius} m</span>
                </div>
                <input type="range" min="100" max="5000" step="50" value={radius} onChange={e => setRadius(Number(e.target.value))}
                  className="w-full" style={{ accentColor:'#e4b56b' }}/>
              </div>

              <div className="flex items-center gap-4 py-2">
                {[
                  { key:'enter', label: isAr?'تنبيه دخول':'Alerte entrée', val:alertEnter, set:setAlertEnter },
                  { key:'exit',  label: isAr?'تنبيه خروج':'Alerte sortie', val:alertExit,  set:setAlertExit  },
                ].map(({ key, label, val, set }) => (
                  <button key={key} onClick={() => set(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={val ? { background:'rgba(228,181,107,0.18)', color:'#e4b56b', border:'1px solid rgba(228,181,107,0.35)' }
                              : { background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.1)' }}>
                    {val ? <Bell size={11}/> : <BellOff size={11}/>}
                    {label}
                  </button>
                ))}
              </div>

              <motion.button disabled={!center || !name.trim() || saving} onClick={handleSave} whileTap={{ scale:0.97 }}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm disabled:opacity-40"
                style={{ background:'#e4b56b', color:'#17324d' }}>
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
