import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, MapPin, Circle, Bell, BellOff, Check,
  X, Loader2, TriangleAlert, AlertCircle, ChevronDown
} from 'lucide-react'
import { MapContainer, TileLayer, Circle as LeafletCircle, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import {
  VehicleIcon, PageHeader, Card, Section, SectionTitle,
  EmptyState, ErrorState, Spinner
} from '../../components/ui'

// ── Leaflet marker icon ───────────────────────────────────────────────────────
const centerIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#0F2044;border:3px solid #00D97E;box-shadow:0 0 0 4px rgba(0,217,126,0.25)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

// ── Click handler inside map ──────────────────────────────────────────────────
function MapClickHandler({ onMapClick, enabled }) {
  useMapEvents({
    click: (e) => { if (enabled) onMapClick(e.latlng) },
  })
  return null
}

// ── Auto-fit bounds ───────────────────────────────────────────────────────────
function FitBounds({ center, radius }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.fitBounds(
        L.latLng(center).toBounds(radius * 2.5),
        { padding: [40, 40], maxZoom: 16, animate: true }
      )
    }
  }, [center, radius]) // eslint-disable-line
  return null
}

// ── Geofence map drawer ───────────────────────────────────────────────────────
function GeofenceMap({ center, radius, drawing, onMapClick }) {
  return (
    <MapContainer
      center={center || [33.5731, -7.5898]}
      zoom={center ? 14 : 11}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution=""
      />
      <MapClickHandler onMapClick={onMapClick} enabled={drawing} />
      {center && (
        <>
          <FitBounds center={center} radius={radius} />
          <LeafletCircle
            center={center}
            radius={radius}
            pathOptions={{
              color: '#0F2044',
              fillColor: '#0F2044',
              fillOpacity: 0.12,
              weight: 2.5,
              dashArray: drawing ? '6 4' : undefined,
            }}
          />
          <Marker position={center} icon={centerIcon} />
        </>
      )}
    </MapContainer>
  )
}

// ── Geofence list card ────────────────────────────────────────────────────────
function GeofenceCard({ geofence, lang, onDelete, deleting }) {
  const isAr = lang === 'ar'
  const coords = (() => {
    try {
      if (typeof geofence.coords === 'string') return JSON.parse(geofence.coords)
      return geofence.coords
    } catch { return null }
  })()
  const radius = geofence.radius || (geofence.area?.replace(/[^0-9.]/g, '') ?? '—')

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-accent to-emerald-400" />
      <div className="p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center flex-shrink-0">
          <Circle size={18} className="text-accent" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-primary-500 dark:text-white text-sm truncate">
            {geofence.name || (isAr ? 'منطقة بلا اسم' : 'Zone sans nom')}
          </p>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {radius && (
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-full px-2 py-0.5">
                {isAr ? `نصف القطر: ${radius} م` : `Rayon: ${radius} m`}
              </span>
            )}
            {geofence.notify_enter && (
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-full px-2 py-0.5 flex items-center gap-1">
                <Bell size={8} />{isAr ? 'دخول' : 'Entrée'}
              </span>
            )}
            {geofence.notify_exit && (
              <span className="text-[10px] font-medium text-orange-600 bg-orange-50 dark:bg-orange-900/20 rounded-full px-2 py-0.5 flex items-center gap-1">
                <Bell size={8} />{isAr ? 'خروج' : 'Sortie'}
              </span>
            )}
          </div>
        </div>
        <button type="button" onClick={onDelete} disabled={deleting}
          className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50">
          {deleting ? <Loader2 size={13} className="text-red-500 animate-spin" /> : <Trash2 size={13} className="text-red-500" />}
        </button>
      </div>
    </Card>
  )
}

// ── Add geofence sheet ────────────────────────────────────────────────────────
function AddSheet({ lang, devices, onClose, onCreate }) {
  const isAr = lang === 'ar'
  const [step,          setStep]          = useState('draw')  // 'draw' | 'details'
  const [center,        setCenter]        = useState(null)
  const [radius,        setRadius]        = useState(500)
  const [name,          setName]          = useState('')
  const [deviceId,      setDeviceId]      = useState(devices[0]?.id ? String(devices[0].id) : '')
  const [notifyEnter,   setNotifyEnter]   = useState(true)
  const [notifyExit,    setNotifyExit]    = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [err,           setErr]           = useState('')

  const handleMapClick = (latlng) => {
    setCenter([latlng.lat, latlng.lng])
  }

  const handleSave = async () => {
    if (!center) { setErr(isAr ? 'انقر على الخريطة لتحديد مركز المنطقة' : 'Cliquez sur la carte pour placer le centre'); return }
    if (!name.trim()) { setErr(isAr ? 'اسم المنطقة مطلوب' : 'Nom requis'); return }
    if (!deviceId) { setErr(isAr ? 'اختر المركبة' : 'Choisissez le véhicule'); return }
    setSaving(true); setErr('')
    try {
      await onCreate({ name: name.trim(), center, radius, deviceId, notifyEnter, notifyExit })
    } catch (ex) { setErr(ex.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="flex-1 flex flex-col">
        {/* Map */}
        <div style={{ height: '52%', minHeight: 240, position: 'relative' }}>
          <GeofenceMap center={center} radius={radius} drawing onMapClick={handleMapClick} />
          {!center && (
            <div className="absolute inset-x-4 bottom-4 z-20 bg-primary-500/90 backdrop-blur-sm text-white text-xs font-semibold rounded-2xl px-4 py-2.5 text-center shadow-lg">
              {isAr ? 'انقر على الخريطة لتحديد مركز المنطقة' : 'Cliquez sur la carte pour placer le centre'}
            </div>
          )}
          {center && (
            <div className="absolute top-3 inset-x-4 z-20 flex items-center gap-2 bg-accent/90 backdrop-blur-sm text-slate-900 text-xs font-bold rounded-2xl px-4 py-2.5 shadow-lg">
              <Check size={12} />
              {isAr ? 'المركز محدد — اضبط نصف القطر أدناه' : 'Centre placé — ajustez le rayon ci-dessous'}
            </div>
          )}
          {/* Close */}
          <button type="button" onClick={onClose}
            className="absolute top-3 start-3 z-20 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow">
            <X size={14} className="text-primary-500" />
          </button>
        </div>

        {/* Bottom sheet */}
        <div className="flex-1 bg-white dark:bg-slate-900 overflow-y-auto px-4 pt-4 pb-8">
          {/* Radius slider */}
          {center && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isAr ? 'نصف القطر' : 'Rayon'}
                </span>
                <span className="text-xs font-bold text-accent">{radius} م</span>
              </div>
              <input type="range" min={100} max={10000} step={100} value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                className="w-full accent-accent" />
              <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                <span>100م</span><span>10كم</span>
              </div>
            </div>
          )}

          {/* Zone name */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              {isAr ? 'اسم المنطقة' : 'Nom de la zone'} *
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={isAr ? 'مثل: المنزل، المكتب...' : 'Ex: Maison, Bureau…'}
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm text-primary-500 dark:text-white placeholder-slate-400 outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Device */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              {t(lang, 'device')} *
            </label>
            <select value={deviceId} onChange={e => setDeviceId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm text-primary-500 dark:text-white outline-none focus:border-accent transition-colors">
              {devices.map(d => (
                <option key={d.id} value={String(d.id)}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Notifications */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              {isAr ? 'التنبيهات' : 'Notifications'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'enter', ar: 'دخول المنطقة', fr: 'Entrée',  checked: notifyEnter, toggle: () => setNotifyEnter(v => !v) },
                { key: 'exit',  ar: 'خروج المنطقة', fr: 'Sortie',  checked: notifyExit,  toggle: () => setNotifyExit(v => !v)  },
              ].map(item => (
                <button key={item.key} type="button" onClick={item.toggle}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all"
                  style={{
                    background: item.checked ? 'rgba(0,217,126,0.1)' : 'rgba(241,245,249,1)',
                    color:      item.checked ? '#059669'              : '#94a3b8',
                    border:     item.checked ? '1.5px solid rgba(0,217,126,0.3)' : '1.5px solid #e2e8f0',
                  }}
                >
                  {item.checked ? <Bell size={12} /> : <BellOff size={12} />}
                  {isAr ? item.ar : item.fr}
                </button>
              ))}
            </div>
          </div>

          {err && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 mb-4">
              <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
            </div>
          )}

          <button type="button" onClick={handleSave} disabled={saving || !center}
            className="w-full py-3.5 bg-accent text-slate-900 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
            {saving
              ? <><Loader2 size={16} className="animate-spin" />{isAr ? 'جاري الحفظ...' : 'Enregistrement...'}</>
              : <><Check size={16} />{isAr ? 'حفظ المنطقة' : 'Enregistrer la zone'}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Geofences() {
  const { devices, lang } = useApp()
  const isAr = lang === 'ar'

  const [geofences, setGeofences] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [showAdd,   setShowAdd]   = useState(false)
  const [deleting,  setDeleting]  = useState(null)
  const [toast,     setToast]     = useState('')
  const [syncWarn,  setSyncWarn]  = useState(false)

  const loadGeofences = useCallback(async () => {
    setLoading(true); setError(null)
    try { setGeofences(await api.geofences.list()) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadGeofences() }, [loadGeofences])

  const showToast = (msg) => {
    setToast(msg); setTimeout(() => setToast(''), 2500)
  }

  const handleCreate = async ({ name, center, radius, deviceId, notifyEnter, notifyExit }) => {
    const data = {
      name,
      deviceId,
      center: { lat: center[0], lng: center[1] },
      radius,
      notifyEnter,
      notifyExit,
    }
    const created = await api.geofences.create(data)
    if (created?.syncFailed) setSyncWarn(true)
    await loadGeofences()
    setShowAdd(false)
    showToast(isAr ? 'تم إنشاء المنطقة' : 'Zone créée')
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await api.geofences.remove(id)
      setGeofences(prev => prev.filter(g => String(g.id) !== String(id)))
      showToast(isAr ? 'تم الحذف' : 'Supprimé')
    } catch { /* ignore */ }
    finally { setDeleting(null) }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50 dark:bg-slate-900">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <PageHeader>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-xl">{t(lang, 'geofencesPage')}</h1>
            <p className="text-white/50 text-xs mt-0.5">
              {geofences.length} {isAr ? 'منطقة محددة' : 'zone(s)'}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="w-9 h-9 rounded-full bg-accent flex items-center justify-center active:scale-90 transition-transform"
            aria-label={t(lang, 'addGeofence')}
          >
            <Plus size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
        </div>
      </PageHeader>

      {/* ── Sync warning ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {syncWarn && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-4 mt-3 flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-4 py-3">
            <TriangleAlert size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400 flex-1 leading-relaxed">
              {isAr
                ? 'تم حفظ المنطقة محلياً. فشل المزامنة مع Traccar — ستعمل التنبيهات عند استعادة الاتصال.'
                : 'Zone enregistrée localement. Synchronisation Traccar échouée — les alertes fonctionneront dès que la connexion sera rétablie.'}
            </p>
            <button onClick={() => setSyncWarn(false)}><X size={12} className="text-amber-500" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── List ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : error ? (
          <ErrorState message={error} onRetry={loadGeofences} lang={lang} />
        ) : geofences.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title={t(lang, 'noGeofences')}
            subtitle={isAr
              ? 'أنشئ منطقة جغرافية لتلقّي تنبيهات الدخول والخروج'
              : 'Créez une zone pour recevoir des alertes d\'entrée/sortie'}
            action={
              <button
                onClick={() => setShowAdd(true)}
                className="px-5 py-2.5 bg-accent text-slate-900 rounded-xl text-sm font-bold active:scale-95 transition-transform"
              >
                {t(lang, 'addGeofence')}
              </button>
            }
          />
        ) : (
          <AnimatePresence>
            {geofences.map((g, i) => (
              <GeofenceCard
                key={g.id ?? i}
                geofence={g}
                lang={lang}
                deleting={deleting === g.id}
                onDelete={() => handleDelete(g.id)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── Add sheet ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AddSheet lang={lang} devices={devices} onClose={() => setShowAdd(false)} onCreate={handleCreate} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 inset-x-4 bg-primary-500 text-white rounded-2xl px-4 py-3 text-center text-sm font-semibold shadow-xl z-50"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <ClientNav />
    </div>
  )
}
