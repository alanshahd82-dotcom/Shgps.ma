import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Circle, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import {
  ChevronLeft, Shield, Plus, Trash2, MapPin, Loader2,
  CheckCircle, AlertCircle, X, Sliders
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'

// ── Map click handler ─────────────────────────────────────────────────────────
function ClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick([e.latlng.lat, e.latlng.lng]) })
  return null
}

// ── Mini map for each existing geofence ──────────────────────────────────────
function GeoMiniMap({ center, radius }) {
  const validCenter = center && center[0] && center[1] ? center : [33.5731, -7.5898]
  return (
    <div className="h-28 rounded-xl overflow-hidden border border-slate-700/40">
      <MapContainer center={validCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} scrollWheelZoom={false} dragging={false} attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Circle center={validCenter} radius={radius || 500}
          pathOptions={{ color: '#00D97E', fillColor: '#00D97E', fillOpacity: 0.15, weight: 2 }} />
        <Marker position={validCenter} icon={L.divIcon({
          html: `<div style="width:10px;height:10px;border-radius:50%;background:#00D97E;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
          className: '', iconSize: [10, 10], iconAnchor: [5, 5],
        })} />
      </MapContainer>
    </div>
  )
}

// ── Add Geofence Sheet ────────────────────────────────────────────────────────
function AddSheet({ open, onClose, devices, lang, onSaved }) {
  const isAr = lang === 'ar'
  const [step, setStep]               = useState(1) // 1=device+name, 2=map
  const [selectedDevice, setSelectedDevice] = useState(devices[0]?.id || '')
  const [name, setName]               = useState('')
  const [center, setCenter]           = useState(null)
  const [radius, setRadius]           = useState(500)
  const [loading, setLoading]         = useState(false)
  const [err, setErr]                 = useState(null)

  const device = devices.find(d => String(d.id) === String(selectedDevice))
  const mapCenter = center || (device?.lat && device?.lng ? [device.lat, device.lng] : [33.5731, -7.5898])

  const handleSave = async () => {
    if (!center) return setErr(isAr ? 'حدد النقطة على الخريطة' : 'Sélectionnez un point sur la carte')
    if (!name.trim()) return setErr(isAr ? 'أدخل اسم السياج' : 'Entrez un nom')
    setLoading(true); setErr(null)
    try {
      await api.devices.setGeofence(selectedDevice, { name: name.trim(), latitude: center[0], longitude: center[1], radius })
      onSaved()
      onClose()
      setStep(1); setCenter(null); setName('')
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  if (!open) return null
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-end justify-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div className="relative w-full max-w-lg bg-slate-900 rounded-t-3xl"
          style={{ maxHeight: '90dvh', overflowY: 'auto' }}
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <div>
              <h2 className="text-white font-bold text-base">
                {isAr ? 'إضافة سياج جغرافي' : 'Ajouter une géofence'}
              </h2>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {step === 1
                  ? (isAr ? 'الخطوة 1: اختر الجهاز والاسم' : 'Étape 1 : Appareil et nom')
                  : (isAr ? 'الخطوة 2: حدد المنطقة على الخريطة' : 'Étape 2 : Définir la zone')}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
              <X size={14} className="text-slate-300" />
            </button>
          </div>

          {/* Step indicators */}
          <div className="flex gap-2 px-5 mb-4">
            {[1, 2].map(s => (
              <div key={s} className={`flex-1 h-1 rounded-full transition-all ${s <= step ? 'bg-accent' : 'bg-slate-700'}`} />
            ))}
          </div>

          <div className="px-5 pb-8 space-y-3">
            {step === 1 ? (
              <>
                <select value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-accent">
                  {devices.map(d => <option key={d.id} value={d.id}>{d.name} {d.plate ? `(${d.plate})` : ''}</option>)}
                </select>
                <input
                  type="text"
                  placeholder={isAr ? 'اسم السياج (مثال: منطقة العمل)' : 'Nom (ex: Zone de travail)'}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-accent placeholder:text-slate-600"
                />
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-slate-400">{isAr ? 'نصف القطر' : 'Rayon'}</span>
                    <span className="text-xs font-bold text-accent">{radius} م</span>
                  </div>
                  <input type="range" min={100} max={5000} step={100} value={radius}
                    onChange={e => setRadius(Number(e.target.value))} className="w-full accent-accent" />
                </div>
                <button
                  onClick={() => { if (!name.trim()) return setErr(isAr ? 'أدخل الاسم أولاً' : 'Entrez le nom'); setErr(null); setStep(2) }}
                  className="w-full py-3 bg-accent text-slate-900 rounded-xl font-bold text-sm">
                  {isAr ? 'التالي: تحديد الموقع' : 'Suivant : Choisir la position'} →
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-400 text-center">
                  {isAr ? 'اضغط على الخريطة لتحديد مركز السياج' : 'Tapez sur la carte pour placer le centre'}
                </p>
                <div className="h-56 rounded-2xl overflow-hidden border border-slate-700">
                  <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attributionControl={false} />
                    <ClickHandler onMapClick={setCenter} />
                    {center && (
                      <Circle center={center} radius={radius}
                        pathOptions={{ color: '#00D97E', fillColor: '#00D97E', fillOpacity: 0.15, weight: 2, dashArray: '6,4' }} />
                    )}
                  </MapContainer>
                </div>
                {center && (
                  <p className="text-xs text-accent text-center">
                    ✓ {center[0].toFixed(5)}, {center[1].toFixed(5)}
                  </p>
                )}
                {err && <p className="text-red-400 text-xs text-center">{err}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setStep(1)} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm">
                    {isAr ? 'رجوع' : 'Retour'}
                  </button>
                  <button onClick={handleSave} disabled={!center || loading}
                    className="flex-1 py-3 bg-accent text-slate-900 rounded-xl font-bold text-sm disabled:opacity-50">
                    {loading ? (isAr ? 'جاري الحفظ...' : 'Enregistrement...') : (isAr ? 'حفظ' : 'Enregistrer')}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Geofences() {
  const navigate = useNavigate()
  const { devices, lang } = useApp()
  const isAr = lang === 'ar'
  const [geofences, setGeofences]    = useState([])
  const [loading, setLoading]        = useState(true)
  const [showAdd, setShowAdd]        = useState(false)
  const [deleteId, setDeleteId]      = useState(null)
  const [deleteDeviceId, setDeleteDeviceId] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [toast, setToast]            = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadGeofences = async () => {
    setLoading(true)
    try {
      // Fetch geofences for each device
      const results = await Promise.allSettled(
        devices.map(async d => {
          // Geofence is stored on the device record
          if (d.geofence) {
            return {
              id: d.geofence.id || d.geofence.geofence?.id,
              deviceId: d.id,
              deviceName: d.name,
              devicePlate: d.plate,
              deviceType: d.type,
              name: d.geofence.name || d.geofence.geofence?.name || (isAr ? 'سياج جغرافي' : 'Géofence'),
              lat: d.geofence.latitude || d.geofence.geofence?.latitude || d.lat,
              lng: d.geofence.longitude || d.geofence.geofence?.longitude || d.lng,
              radius: d.geofence.radius || d.geofence.geofence?.radius || 500,
              active: true,
            }
          }
          return null
        })
      )
      setGeofences(results.map(r => r.value).filter(Boolean))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadGeofences() }, [devices.length]) // eslint-disable-line

  const handleDelete = async () => {
    if (!deleteId && !deleteDeviceId) return
    setDeleteLoading(true)
    try {
      await api.devices.removeGeofence(deleteDeviceId, deleteId)
      setGeofences(prev => prev.filter(g => g.id !== deleteId || g.deviceId !== deleteDeviceId))
      showToast(isAr ? 'تم حذف السياج بنجاح' : 'Géofence supprimée avec succès')
    } catch (e) {
      showToast(e.message || (isAr ? 'فشل الحذف' : 'Échec de la suppression'), 'error')
    } finally {
      setDeleteLoading(false); setDeleteId(null); setDeleteDeviceId(null)
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: 'linear-gradient(180deg,#0d1b33 0%,#0a1225 100%)' }}>
      {/* Header */}
      <div className="pt-14 px-4 pb-4" style={{ background: 'linear-gradient(160deg,#0F2044 0%,#162d5e 100%)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <ChevronLeft size={18} className="text-white" />
            </button>
            <div>
              <h1 className="text-white text-lg font-bold leading-tight">
                {isAr ? 'السياجات الجغرافية' : 'Géofences'}
              </h1>
              <p className="text-blue-200/60 text-xs">
                {geofences.length} {isAr ? 'منطقة نشطة' : 'zones actives'}
              </p>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/25 active:scale-95 transition-transform">
            <Plus size={18} className="text-slate-900" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500">
            <Loader2 size={28} className="animate-spin mb-2" />
            <p className="text-sm">{isAr ? 'جاري التحميل...' : 'Chargement...'}</p>
          </div>
        ) : geofences.length === 0 ? (
          <motion.div className="flex flex-col items-center justify-center py-20 text-slate-500"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-3">
              <Shield size={28} className="text-slate-600" />
            </div>
            <p className="text-slate-400 text-sm text-center mb-1">
              {isAr ? 'لا توجد سياجات جغرافية بعد' : 'Aucune géofence configurée'}
            </p>
            <p className="text-slate-600 text-xs text-center max-w-xs">
              {isAr
                ? 'أضف منطقة جغرافية لتلقي تنبيه فور خروج مركبتك منها'
                : 'Ajoutez une zone pour recevoir une alerte dès que le véhicule en sort'}
            </p>
            <button onClick={() => setShowAdd(true)}
              className="mt-5 px-5 py-2.5 bg-accent text-slate-900 rounded-xl text-sm font-bold active:scale-95 transition-transform">
              {isAr ? 'إضافة أول سياج' : 'Ajouter ma première géofence'}
            </button>
          </motion.div>
        ) : (
          geofences.map((geo, i) => (
            <motion.div key={`${geo.deviceId}-${geo.id}-${i}`}
              className="bg-slate-800/70 rounded-2xl border border-slate-700/40 overflow-hidden"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              {/* Mini map */}
              <GeoMiniMap center={[geo.lat, geo.lng]} radius={geo.radius} />

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                      <MapPin size={16} className="text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight truncate">{geo.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {geo.deviceName}
                        {geo.devicePlate ? ` · ${geo.devicePlate}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setDeleteId(geo.id); setDeleteDeviceId(geo.deviceId) }}
                    className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 active:scale-90 transition-transform">
                    <Trash2 size={13} className="text-red-400" />
                  </button>
                </div>

                <div className="flex gap-2 mt-3 flex-wrap">
                  <span className="text-[11px] bg-slate-700/60 text-slate-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sliders size={9} /> {geo.radius} {isAr ? 'متر' : 'm'}
                  </span>
                  <span className="text-[11px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle size={9} /> {isAr ? 'نشط' : 'Actif'}
                  </span>
                  <span className="text-[11px] bg-slate-700/60 text-slate-400 px-2 py-0.5 rounded-full">
                    {geo.lat.toFixed(4)}, {geo.lng.toFixed(4)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))
        )}

        {/* Info card */}
        <div className="flex gap-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
          <AlertCircle size={16} className="text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300/80 leading-relaxed">
            {isAr
              ? 'ستتلقى تنبيهاً فور خروج أي مركبة من منطقتها الجغرافية. يمكنك إضافة سياج واحد لكل جهاز.'
              : 'Vous recevrez une alerte dès qu\'un véhicule quitte sa zone. Un géofence par appareil.'}
          </p>
        </div>
      </div>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteId !== null && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setDeleteId(null); setDeleteDeviceId(null) }} />
            <motion.div className="relative bg-slate-900 rounded-3xl p-6 w-full max-w-xs text-center border border-slate-700/60"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-3">
                <Trash2 size={22} className="text-red-400" />
              </div>
              <h3 className="text-white font-bold text-base mb-1">
                {isAr ? 'حذف السياج' : 'Supprimer la géofence'}
              </h3>
              <p className="text-slate-400 text-xs mb-5">
                {isAr ? 'هل تريد حذف هذه المنطقة الجغرافية؟' : 'Voulez-vous supprimer cette zone ?'}
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setDeleteId(null); setDeleteDeviceId(null) }}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-bold">
                  {isAr ? 'إلغاء' : 'Annuler'}
                </button>
                <button onClick={handleDelete} disabled={deleteLoading}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold disabled:opacity-60">
                  {deleteLoading ? '...' : (isAr ? 'حذف' : 'Supprimer')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`fixed bottom-24 inset-x-4 py-3 px-4 rounded-2xl text-center text-sm font-semibold shadow-xl z-50 ${
              toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-accent text-slate-900'
            }`}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <AddSheet open={showAdd} onClose={() => setShowAdd(false)} devices={devices} lang={lang}
        onSaved={() => { loadGeofences(); showToast(isAr ? 'تم إضافة السياج بنجاح ✓' : 'Géofence ajoutée ✓') }} />

      <ClientNav />
    </div>
  )
}
