import React, { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, Plus, Cpu, Battery, Wifi, WifiOff, X,
  CalendarDays, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle,
  Navigation, Gauge, Clock, Route, Zap, ZapOff, Info,
  ChevronRight, MapPin, Loader2, Calendar, Car, Bike, Truck,
} from 'lucide-react'
import { MapContainer, Polyline, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import GeoapifyTileLayer from '../../components/GeoapifyTileLayer'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'
import MapView from '../../components/MapView'
import SubscriptionPlans from '../../components/SubscriptionPlans'
import SubscriptionBadge from '../../components/SubscriptionBadge'
import SubscriptionRenewalModal from '../../components/SubscriptionRenewalModal'
import Button from '../../components/ui/Button'

/* ─── helpers ──────────────────────────────────────────────────────────────── */
function vehicleEmoji(type) {
  if (type === 'bike')  return '🏍️'
  if (type === 'truck') return '🚚'
  return '🚗'
}

function getRangeDates(preset, customFrom, customTo) {
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  switch (preset) {
    case 'today':
      return { from: todayStart.toISOString(), to: now.toISOString() }
    case 'yesterday': {
      const yd = new Date(todayStart); yd.setDate(yd.getDate() - 1)
      const ydEnd = new Date(todayStart); ydEnd.setMilliseconds(-1)
      return { from: yd.toISOString(), to: ydEnd.toISOString() }
    }
    case '3days': {
      const d = new Date(now); d.setDate(d.getDate() - 3); d.setHours(0, 0, 0, 0)
      return { from: d.toISOString(), to: now.toISOString() }
    }
    case '7days': {
      const d = new Date(now); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0)
      return { from: d.toISOString(), to: now.toISOString() }
    }
    case 'custom':
      return {
        from: customFrom ? new Date(customFrom).toISOString() : todayStart.toISOString(),
        to:   customTo   ? new Date(customTo + 'T23:59:59').toISOString() : now.toISOString(),
      }
    default:
      return { from: todayStart.toISOString(), to: now.toISOString() }
  }
}

function fmt(min, isAr) {
  if (min < 60) return `${min} ${isAr ? 'د' : 'min'}`
  return `${Math.floor(min / 60)}${isAr ? 'س' : 'h'} ${min % 60}${isAr ? 'د' : 'm'}`
}

/* ─── Route Polyline fitter ─────────────────────────────────────────────────── */
function FitBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions && positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [20, 20] })
    }
  }, [map, positions])
  return null
}

/* ─── Mini route map ────────────────────────────────────────────────────────── */
function RouteMapDisplay({ trip, mapKey }) {
  if (!trip || !trip.route || trip.route.length < 2) return null
  const positions = trip.route.map(p => [p.latitude, p.longitude])
  const start = positions[0]
  const end   = positions[positions.length - 1]

  const startIcon = L.divIcon({
    html: '<div style="width:12px;height:12px;border-radius:50%;background:#00D97E;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,.3)"></div>',
    iconSize: [12, 12], iconAnchor: [6, 6], className: '',
  })
  const endIcon = L.divIcon({
    html: '<div style="width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,.3)"></div>',
    iconSize: [12, 12], iconAnchor: [6, 6], className: '',
  })

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 mt-3" style={{ height: 200 }}>
      <MapContainer key={mapKey} center={start} zoom={12} style={{ height: '100%' }} scrollWheelZoom={false} zoomControl={false}>
        <GeoapifyTileLayer />
        <FitBounds positions={positions} />
        <Polyline positions={positions} color="#0F2044" weight={3} opacity={0.85} />
        <Marker position={start} icon={startIcon} />
        <Marker position={end}   icon={endIcon}   />
      </MapContainer>
    </div>
  )
}

/* ─── Add Device Modal ──────────────────────────────────────────────────────── */
function AddDeviceModal({ open, onClose, onAdd, clientId, client, lang }) {
  const [form, setForm]     = useState({ name: '', imei: '', type: 'car', plate: '', clientId, subscriptionPlanId: '3_months' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      await onAdd(form)
      setForm({ name: '', imei: '', type: 'car', plate: '', clientId, subscriptionPlanId: '3_months' })
      onClose()
    } catch (err) {
      setError(err.message || (lang === 'ar' ? 'تعذر إضافة الجهاز' : "Impossible d'ajouter l'appareil"))
    } finally { setLoading(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}>
          <motion.div className="w-full md:max-w-[440px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            onClick={e => e.stopPropagation()}>
            <div className="flex-shrink-0 bg-primary-500 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <h3 className="font-bold text-white text-lg">{t(lang, 'addDevice')}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center"><X size={16} className="text-white"/></button>
            </div>
            <form id="add-dev-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && <div className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{lang === 'ar' ? 'اسم الجهاز' : "Nom de l'appareil"}</label>
                <input className="input-field text-sm" placeholder={lang === 'ar' ? 'مثال: سيارة العميل' : 'Ex: Voiture client'} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t(lang, 'imei')}</label>
                <input className="input-field text-sm font-mono" placeholder="358900001234567" value={form.imei} onChange={e => setForm(p => ({ ...p, imei: e.target.value.replace(/\D/g, '').slice(0, 15) }))} maxLength={15} minLength={15} pattern="\d{15}" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{lang === 'ar' ? 'نوع المركبة' : 'Type de véhicule'}</label>
                  <select className="input-field text-sm" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="car">{lang === 'ar' ? '🚗 سيارة' : '🚗 Voiture'}</option>
                    <option value="bike">{lang === 'ar' ? '🏍️ دراجة' : '🏍️ Moto'}</option>
                    <option value="truck">{lang === 'ar' ? '🚚 شاحنة' : '🚚 Camion'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t(lang, 'plate')}</label>
                  <input className="input-field text-sm uppercase font-mono" placeholder="A 12345 XX" value={form.plate} onChange={e => setForm(p => ({ ...p, plate: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{lang === 'ar' ? 'خطة اشتراك الجهاز' : 'Forfait appareil'}</label>
                <SubscriptionPlans value={form.subscriptionPlanId} onChange={v => setForm(p => ({ ...p, subscriptionPlanId: v }))} lang={lang} compact includeTrial />
              </div>
            </form>
            <div className="flex-shrink-0 px-6 pb-6 pt-3 flex gap-3 border-t border-gray-100">
              <button type="button" onClick={onClose} className="flex-1 btn-secondary py-3">{t(lang, 'cancel')}</button>
              <Button type="submit" form="add-dev-form" disabled={loading} variant="primary" className="flex-1 py-3">{loading ? '...' : t(lang, 'add')}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ─── Device Detail Drawer ──────────────────────────────────────────────────── */
function DeviceDetailDrawer({ device, lang, onClose, onDeviceUpdated }) {
  const { toggleEngine, devices } = useApp()
  const isAr = lang === 'ar'
  const [tab, setTab]             = useState('info')   // 'info' | 'sub' | 'route'
  const [engineLoading, setEngineLoading] = useState(false)
  const [showRenew, setShowRenew] = useState(false)

  // Route state
  const [rangePreset, setRangePreset]   = useState('today')
  const [customFrom, setCustomFrom]     = useState('')
  const [customTo, setCustomTo]         = useState('')
  const [routeData, setRouteData]       = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError]     = useState('')
  const [selectedTrip, setSelectedTrip] = useState(null)

  // live device from context
  const live = devices.find(d => d.id === device.id) || device

  const handleEngine = async () => {
    setEngineLoading(true)
    try { await toggleEngine(live.id, live.engineOn) }
    catch {}
    finally { setEngineLoading(false) }
  }

  const fetchRoute = async () => {
    setRouteLoading(true); setRouteError(''); setRouteData(null); setSelectedTrip(null)
    try {
      const { from, to } = getRangeDates(rangePreset, customFrom, customTo)
      const data = await api.reports.trips(live.id, from, to)
      setRouteData(data)
      if (data.trips && data.trips.length > 0) setSelectedTrip(data.trips[0])
    } catch (e) {
      setRouteError(e.message || (isAr ? 'تعذر تحميل المسار' : 'Impossible de charger le parcours'))
    } finally { setRouteLoading(false) }
  }

  const RANGE_LABELS = [
    { val: 'today',     label: isAr ? 'اليوم'   : "Aujourd'hui" },
    { val: 'yesterday', label: isAr ? 'أمس'      : 'Hier'        },
    { val: '3days',     label: isAr ? '3 أيام'  : '3 jours'     },
    { val: '7days',     label: isAr ? '7 أيام'  : '7 jours'     },
    { val: 'custom',    label: isAr ? 'مخصص'    : 'Personnalisé' },
  ]

  // Subscription fields from live device
  const subEnd    = live.subscriptionEndDate || live.subscription_end_date
  const subStatus = live.subscriptionStatus  || live.subscription_status || 'active'
  const subPlan   = live.subscriptionPlan    || live.subscription_plan   || '—'
  const expiry    = subEnd ? new Date(subEnd) : null
  const daysLeft  = expiry ? Math.ceil((expiry - new Date()) / 86400000) : null
  const isExpired = daysLeft !== null && daysLeft <= 0
  const isSoon    = daysLeft !== null && daysLeft > 0 && daysLeft <= 30

  return (
    <>
      {/* Backdrop */}
      <motion.div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />

      {/* Panel */}
      <motion.div
        className="fixed inset-y-0 right-0 z-50 w-full md:w-[480px] bg-white shadow-2xl flex flex-col"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-primary-500 px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl">{vehicleEmoji(live.type)}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-base leading-tight truncate">{live.name}</p>
              <p className="text-white/70 text-xs font-mono">{live.imei}</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 flex-shrink-0">
              <X size={16} className="text-white" />
            </button>
          </div>

          {/* Status + engine row */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${live.status === 'online' ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-white/60'}`}>
              {live.status === 'online' ? <Wifi size={10}/> : <WifiOff size={10}/>}
              {live.status === 'online' ? (isAr ? 'متصل' : 'Connecté') : (isAr ? 'غير متصل' : 'Déconnecté')}
            </span>
            {live.plate && <span className="text-xs font-mono bg-white/10 text-white/80 px-2 py-0.5 rounded-lg">{live.plate}</span>}
            <div className="flex-1" />
            {/* Engine toggle */}
            <button
              onClick={handleEngine}
              disabled={engineLoading}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 ${
                live.engineOn
                  ? 'bg-red-500/80 text-white hover:bg-red-500'
                  : 'bg-emerald-500/80 text-white hover:bg-emerald-500'
              }`}
            >
              {engineLoading
                ? <Loader2 size={12} className="animate-spin"/>
                : live.engineOn ? <ZapOff size={12}/> : <Zap size={12}/>}
              {live.engineOn ? (isAr ? 'قطع المحرك' : 'Couper moteur') : (isAr ? 'تشغيل المحرك' : 'Démarrer')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex border-b border-gray-100 bg-white">
          {[
            { key: 'info',  icon: Info,         label: isAr ? 'معلومات' : 'Infos'         },
            { key: 'sub',   icon: CalendarDays,  label: isAr ? 'اشتراك'  : 'Abonnement'    },
            { key: 'route', icon: Route,         label: isAr ? 'المسار'  : 'Parcours'      },
          ].map(tab_ => (
            <button
              key={tab_.key}
              onClick={() => setTab(tab_.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-colors border-b-2 ${
                tab === tab_.key ? 'border-primary-500 text-primary-500' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <tab_.icon size={13}/>{tab_.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Info tab ───────────────────────────────────── */}
          {tab === 'info' && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Gauge, label: isAr ? 'السرعة' : 'Vitesse', val: live.status === 'online' ? `${live.speed || 0} km/h` : '—' },
                  { icon: Battery, label: isAr ? 'البطارية' : 'Batterie', val: `${live.battery ?? '—'}%` },
                  { icon: MapPin, label: 'IMEI', val: live.imei, mono: true },
                  { icon: Car, label: isAr ? 'النوع' : 'Type', val: live.type === 'car' ? (isAr ? 'سيارة' : 'Voiture') : live.type === 'bike' ? (isAr ? 'دراجة' : 'Moto') : (isAr ? 'شاحنة' : 'Camion') },
                  { icon: Clock, label: isAr ? 'آخر تحديث' : 'Dernier update', val: live.lastUpdate ? new Date(live.lastUpdate).toLocaleTimeString(isAr ? 'ar-MA' : 'fr-MA') : '—' },
                  { icon: Navigation, label: isAr ? 'اللوحة' : 'Plaque', val: live.plate || '—' },
                ].map((row, i) => (
                  <div key={i} className="bg-gray-50 rounded-2xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <row.icon size={11} className="text-slate-400"/>
                      <p className="text-[10px] text-slate-400">{row.label}</p>
                    </div>
                    <p className={`text-sm font-bold text-primary-500 truncate ${row.mono ? 'font-mono text-xs' : ''}`}>{row.val}</p>
                  </div>
                ))}
              </div>

              {/* Live coordinates */}
              {live.lat && live.lng && (
                <div className="bg-gray-50 rounded-2xl p-3 flex items-center gap-2">
                  <MapPin size={13} className="text-slate-400 flex-shrink-0"/>
                  <p className="text-xs font-mono text-slate-500 truncate">{Number(live.lat).toFixed(5)}, {Number(live.lng).toFixed(5)}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Subscription tab ───────────────────────────── */}
          {tab === 'sub' && (
            <div className="p-5">
              {/* Status badge */}
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays size={15} className="text-primary-500"/>
                <h3 className="font-bold text-primary-500 text-sm">{isAr ? 'اشتراك الجهاز' : 'Abonnement appareil'}</h3>
                {isExpired
                  ? <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-red-100 text-red-600">🔴 {isAr ? 'منتهي' : 'Expiré'}</span>
                  : isSoon
                    ? <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-orange-100 text-orange-600">{daysLeft} {isAr ? 'يوم' : 'j'}</span>
                    : <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-600">✓ {isAr ? 'نشط' : 'Actif'}</span>}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: isAr ? 'الخطة' : 'Forfait', val: subPlan },
                  { label: isAr ? 'الحالة' : 'Statut', val: subStatus === 'active' ? (isAr ? 'نشط' : 'Actif') : (isAr ? 'منتهي' : 'Expiré') },
                  { label: isAr ? 'الانتهاء' : 'Expiration', val: expiry ? expiry.toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR') : '—' },
                ].map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-sm font-black text-primary-500">{s.val}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              {daysLeft !== null && (
                <div className="mb-5">
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <motion.div className="h-full rounded-full"
                      style={{ backgroundColor: isExpired ? '#ef4444' : isSoon ? '#f97316' : '#00D97E' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${isExpired ? 0 : Math.min(100, Math.round((daysLeft / 365) * 100))}%` }}
                      transition={{ duration: 0.6 }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    {isExpired ? (isAr ? 'الاشتراك منتهي' : 'Abonnement expiré') : `${daysLeft} ${isAr ? 'يوم متبقي' : 'jours restants'}`}
                  </p>
                </div>
              )}

              <button
                onClick={() => setShowRenew(true)}
                className="w-full flex items-center justify-center gap-2 bg-primary-500 text-white font-bold text-sm py-3 rounded-2xl hover:bg-primary-600 transition-colors"
              >
                <RefreshCw size={15}/>
                {isAr ? 'تجديد الاشتراك' : "Renouveler l'abonnement"}
              </button>
            </div>
          )}

          {/* ── Route tab ──────────────────────────────────── */}
          {tab === 'route' && (
            <div className="p-5 space-y-4">
              {/* Range preset buttons */}
              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">{isAr ? 'الفترة الزمنية' : 'Période'}</p>
                <div className="flex flex-wrap gap-2">
                  {RANGE_LABELS.map(r => (
                    <button key={r.val} onClick={() => setRangePreset(r.val)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${rangePreset === r.val ? 'bg-primary-500 text-white' : 'bg-gray-100 text-slate-500 hover:bg-gray-200'}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom date inputs */}
              {rangePreset === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">{isAr ? 'من' : 'Du'}</label>
                    <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                      value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">{isAr ? 'إلى' : 'Au'}</label>
                    <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                      value={customTo} onChange={e => setCustomTo(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Fetch button */}
              <button onClick={fetchRoute} disabled={routeLoading}
                className="w-full flex items-center justify-center gap-2 bg-primary-500 text-white font-bold text-sm py-3 rounded-2xl hover:bg-primary-600 disabled:opacity-60 transition-colors">
                {routeLoading ? <Loader2 size={15} className="animate-spin"/> : <Route size={15}/>}
                {routeLoading ? (isAr ? 'جارٍ التحميل...' : 'Chargement...') : (isAr ? 'عرض المسار' : 'Afficher le parcours')}
              </button>

              {/* Error */}
              {routeError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-100">
                  <AlertCircle size={14}/>{routeError}
                </div>
              )}

              {/* Results */}
              {routeData && !routeLoading && (
                <>
                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: isAr ? 'المسافة' : 'Distance', val: `${routeData.totalDistanceKm} km` },
                      { label: isAr ? 'وقت الحركة' : 'En mouvement', val: fmt(routeData.movingDurationMin, isAr) },
                      { label: isAr ? 'أقصى سرعة' : 'Vit. max', val: `${routeData.maxSpeed} km/h` },
                    ].map((s, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-sm font-black text-primary-500">{s.val}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {routeData.trips.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Route size={32} className="mx-auto mb-2 opacity-30"/>
                      <p className="text-sm">{isAr ? 'لا توجد رحلات في هذه الفترة' : 'Aucun trajet sur cette période'}</p>
                    </div>
                  ) : (
                    <>
                      {/* Route map for selected trip */}
                      {selectedTrip && (
                        <RouteMapDisplay trip={selectedTrip} mapKey={`${live.id}-${selectedTrip.index}-${rangePreset}`} />
                      )}

                      {/* Trip list */}
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-500">
                          {routeData.trips.length} {isAr ? 'رحلة' : 'trajet(s)'}
                        </p>
                        {routeData.trips.map(trip => (
                          <button key={trip.index} onClick={() => setSelectedTrip(trip)}
                            className={`w-full text-right rounded-2xl border p-3 transition-all ${selectedTrip?.index === trip.index ? 'border-primary-300 bg-primary-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                            <div className="flex items-center justify-between mb-1" dir="ltr">
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Calendar size={11}/>
                                {new Date(trip.startTime).toLocaleTimeString(isAr ? 'ar-MA' : 'fr-MA', { hour: '2-digit', minute: '2-digit' })}
                                {' → '}
                                {new Date(trip.endTime).toLocaleTimeString(isAr ? 'ar-MA' : 'fr-MA', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <ChevronRight size={13} className={`text-primary-400 transition-transform ${selectedTrip?.index === trip.index ? 'rotate-90' : ''}`}/>
                            </div>
                            <div className="flex gap-4 text-xs">
                              <span className="font-bold text-primary-500">{trip.distanceKm} km</span>
                              <span className="text-slate-400">{fmt(trip.durationMin, isAr)}</span>
                              <span className="text-slate-400">{isAr ? 'أقصى' : 'max'} {trip.maxSpeed} km/h</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Renewal modal */}
      <SubscriptionRenewalModal
        open={showRenew}
        device={live}
        lang={lang}
        onClose={() => setShowRenew(false)}
        onSaved={async result => {
          setShowRenew(false)
          await onDeviceUpdated?.()
        }}
      />
    </>
  )
}

/* ─── Main ClientDetail page ────────────────────────────────────────────────── */
export default function ClientDetail() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { clientList, devices, addDevice, lang, refreshDevices } = useApp()

  const client        = clientList.find(c => String(c.id) === String(id))
  const clientDevices = devices.filter(d => String(d.clientId) === String(id) || String(d.user_id) === String(id))
  const isAr          = lang === 'ar'

  const [showAdd,      setShowAdd]      = useState(false)
  const [selectedDev,  setSelectedDev]  = useState(null)

  if (!client) {
    return (
      <AdminLayout>
        <div className="p-6 text-center text-slate-400">
          <p>{isAr ? 'العميل غير موجود' : 'Client introuvable'}</p>
        </div>
      </AdminLayout>
    )
  }

  const maxDevices = Math.max(1, Number(client.maxDevices) || 5)

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">

        {/* Back + header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/admin/clients')}
            className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:bg-gray-50">
            <ChevronLeft size={18} className="text-primary-500"/>
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-primary-500">{client.name}</h1>
            <p className="text-slate-400 text-sm">{client.email}{client.city ? ` · ${client.city}` : ''}</p>
          </div>
          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
            client.subscription === 'Enterprise' ? 'bg-purple-100 text-purple-600' :
            client.subscription === 'Pro'        ? 'bg-blue-100 text-blue-600'   : 'bg-gray-100 text-gray-500'
          }`}>{client.subscription || 'Basic'}</span>
        </div>

        {/* Client info card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-primary-200">
              {client.avatar}
            </div>
            <div>
              <p className="font-bold text-primary-500 text-lg">{client.name}</p>
              <p className="text-slate-400 text-sm">{client.email}</p>
              {client.phone && <p className="text-slate-400 text-sm">{client.phone}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: isAr ? 'الأجهزة' : 'Appareils', val: `${clientDevices.length}/${maxDevices}` },
              { label: isAr ? 'متصل'    : 'Connectés', val: clientDevices.filter(d => d.status === 'online').length },
              { label: isAr ? 'الانضمام' : 'Adhésion', val: client.joinDate },
            ].map((s, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-primary-500">{s.val}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Device map */}
        {clientDevices.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-primary-500">{isAr ? 'خريطة الأجهزة' : 'Carte des appareils'}</h3>
            </div>
            <div style={{ height: 240 }}>
              <MapView clientId={id} height="100%" zoom={10}/>
            </div>
          </div>
        )}

        {/* Devices list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-primary-500">
              {isAr ? 'الأجهزة المرتبطة' : 'Appareils associés'} ({clientDevices.length})
            </h3>
            <Button onClick={() => setShowAdd(true)} disabled={clientDevices.length >= maxDevices} variant="primary" size="sm">
              <Plus size={14}/>{t(lang, 'addDevice')}
            </Button>
          </div>

          {clientDevices.length >= maxDevices && (
            <div className="mx-5 mt-4 flex items-start gap-2 bg-orange-50 border border-orange-100 text-orange-700 rounded-xl px-4 py-3 text-sm">
              {isAr
                ? `تم الوصول إلى الحد الأقصى (${clientDevices.length}/${maxDevices}). أجدّد الاشتراك لزيادة الحد.`
                : `Limite atteinte (${clientDevices.length}/${maxDevices}). Renouvelez pour augmenter.`}
            </div>
          )}

          {clientDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Cpu size={32} className="mb-2 opacity-30"/>
              <p className="text-sm">{isAr ? 'لا توجد أجهزة' : 'Aucun appareil'}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {clientDevices.map((device, i) => (
                <motion.button
                  key={device.id}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-right"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedDev(device)}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${device.status === 'online' ? 'bg-primary-50' : 'bg-gray-100'}`}>
                    {vehicleEmoji(device.type)}
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="font-semibold text-primary-500 text-sm">{device.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{device.imei}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1 text-xs">
                      <Battery size={12} className={device.battery < 30 ? 'text-red-500' : 'text-slate-400'}/>
                      <span className={device.battery < 30 ? 'text-red-500 font-semibold' : 'text-slate-400'}>{device.battery}%</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${device.status === 'online' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                      {device.status === 'online'
                        ? <span className="flex items-center gap-1"><Wifi size={9}/>{t(lang, 'online')}</span>
                        : <span className="flex items-center gap-1"><WifiOff size={9}/>{t(lang, 'offline')}</span>}
                    </span>
                    <SubscriptionBadge device={device} lang={lang}/>
                    <ChevronRight size={14} className="text-slate-300"/>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add device modal */}
      <AddDeviceModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={addDevice} clientId={id} client={client} lang={lang}/>

      {/* Device detail drawer */}
      <AnimatePresence>
        {selectedDev && (
          <DeviceDetailDrawer
            device={selectedDev}
            lang={lang}
            onClose={() => setSelectedDev(null)}
            onDeviceUpdated={refreshDevices}
          />
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}
