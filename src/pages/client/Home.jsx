import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Bell, ChevronLeft, Car, Map as MapIcon,
  Zap, CheckCircle2, Activity, Gauge, PlugZap, WifiOff, Search, SatelliteDish, Route, Fence,
  Home as HomeIcon, MoreHorizontal,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import VehicleCard from '../../components/VehicleCard'
import { vehiclePoint } from '../../utils/location'
import { getDeviceStatusKey } from '../../components/ui'
import { fleetBucket } from '../../utils/fleetBucket'
import TabBar from '../../components/TabBar'
import FleetScene from '../../components/FleetScene'

function useLang() {
  const { lang } = useApp()
  return lang === 'fr' ? 'fr' : 'ar'
}

const t = (key, lang) => ({
  ar: {
    home: 'الرئيسية', more: 'المزيد',
    greeting: 'مرحباً', subtitle: 'إليك حالة مركباتك اليوم',
    heroTitle: 'أسطولك تحت السيطرة', heroSub: 'تابع مركباتك لحظة بلحظة بكل أمان وراحة بال',
    heroCta: 'عرض المركبات', fleet: 'حالة الأسطول',
    connected: 'في حركة', stopped: 'متوقفة', offline: 'غير متصلة', attention: 'تحتاج انتباه',
    myVehicles: 'مركباتي', viewAll: 'عرض الكل', latestAlert: 'آخر تنبيه',
    noAlerts: 'لا توجد تنبيهات', noVehicles: 'لا توجد مركبات',
    quick: 'الوصول السريع', vehicles: 'المركبات', alerts: 'التنبيهات', trips: 'الرحلات',
    kmh: 'كم/س', ago: 'منذ', now: 'الآن',
    total: 'مركبة', live: 'مباشر', reconnecting: 'إعادة اتصال…',
    needsAttention: 'تحتاج متابعة', allGood: 'كل المركبات بحالة جيدة',
    rPower: 'الطاقة مفصولة عن المركبة', rAlarm: 'إنذار من الجهاز', rOffline: 'غير متصلة', rNever: 'لم تتصل بعد', rNoGps: 'بدون إشارة GPS',
    search: 'ابحث عن مركبة…', showLess: 'عرض أقل', showMore: 'عرض كل المركبات', shortcuts: 'اختصارات',
    map: 'الخريطة', reports: 'التقارير', geofences: 'المناطق',
  },
  fr: {
    home: 'Accueil', more: 'Plus',
    greeting: 'Bonjour', subtitle: 'Voici l\'état de votre flotte',
    heroTitle: 'Votre flotte sous contrôle', heroSub: 'Suivez vos véhicules en temps réel',
    heroCta: 'Voir les véhicules', fleet: 'État de la flotte',
    connected: 'En mouvement', stopped: 'Arrêtés', offline: 'Hors ligne', attention: 'Attention',
    myVehicles: 'Mes véhicules', viewAll: 'Voir tout', latestAlert: 'Dernière alerte',
    noAlerts: 'Aucune alerte', noVehicles: 'Aucun véhicule',
    quick: 'Accès rapide', vehicles: 'Véhicules', alerts: 'Alertes', trips: 'Trajets',
    kmh: 'km/h', ago: 'il y a', now: 'maintenant',
    total: 'véhicules', live: 'En direct', reconnecting: 'Reconnexion…',
    needsAttention: 'À surveiller', allGood: 'Tous les véhicules vont bien',
    rPower: 'Alimentation débranchée', rAlarm: "Alarme de l'appareil", rOffline: 'Hors ligne', rNever: 'Jamais connecté', rNoGps: 'Pas de signal GPS',
    search: 'Rechercher un véhicule…', showLess: 'Voir moins', showMore: 'Voir tous les véhicules', shortcuts: 'Raccourcis',
    map: 'Carte', reports: 'Rapports', geofences: 'Zones',
  },
}[lang][key])

function timeAgo(ts, lang) {
  if (!ts) return ''
  const d = Date.now() - new Date(ts).getTime()
  const s = Math.floor(d/1000), m = Math.floor(s/60), h = Math.floor(m/60), day = Math.floor(h/24)
  if (lang === 'fr') {
    if (s < 60) return 'maintenant'; if (m < 60) return `il y a ${m}m`;
    if (h < 24) return `il y a ${h}h`; return `il y a ${day}j`
  }
  if (s < 60) return 'الآن'; if (m < 60) return `منذ ${m}د`;
  if (h < 24) return `منذ ${h}س`; return `منذ ${day}ي`
}

// Home shows the same four fleet tiles as before, but the underlying status
// now comes from the single shared `getDeviceStatusKey` helper so Home never
// disagrees with the vehicles list, the map or the admin panel.
function statusInfo(vehicle) {
  const attention = vehicle?.status === 'alarm' || vehicle?.alertType
  if (attention) return { color: 'orange', label: 'attention', dot: 'bg-orange-500' }
  const key = getDeviceStatusKey(vehicle)
  if (key === 'moving' || key === 'online') return { color: 'green', label: 'connected', dot: 'bg-green-500' }
  if (key === 'idle' || key === 'stopped' || key === 'awaiting_gps') return { color: 'slate', label: 'stopped', dot: 'bg-slate-400' }
  return { color: 'offline', label: 'offline', dot: 'bg-slate-300' }
}

function BottomNav({ active, lang, navigate }) {
  const tabs = [
    { id: 'home', Icon: HomeIcon, route: '/client/home' },
    { id: 'vehicles', Icon: Car, route: '/client/vehicles' },
    { id: 'alerts', Icon: Bell, route: '/client/alerts' },
    { id: 'trips', Icon: Route, route: '/client/trips' },
    { id: 'more', Icon: MoreHorizontal, route: '/client/more' },
  ]
  return (
    <TabBar
      activeId={active}
      onSelect={id => navigate(tabs.find(tb => tb.id === id).route)}
      tabs={tabs.map(tb => ({ id: tb.id, label: t(tb.id, lang), Icon: tb.Icon }))}
    />
  )
}

// Why a vehicle needs the fleet manager's attention (most serious first).
// Only real signals: nothing is inferred from a missing value.
const REASON_ORDER = ['rPower', 'rAlarm', 'rOffline', 'rNever', 'rNoGps']
const ALARM_WINDOW_MS = 24 * 60 * 60 * 1000
function attentionReason(vehicle, alarmIds) {
  if (vehicle.powerDisconnected) return 'rPower'
  if (vehicle.status === 'alarm' || vehicle.alertType || alarmIds?.has(String(vehicle.id)) || alarmIds?.has(String(vehicle.traccarId ?? vehicle.traccar_id))) return 'rAlarm'
  const key = getDeviceStatusKey(vehicle)
  if (key === 'offline') return vehicle.lastUpdate ? 'rOffline' : 'rNever'
  if (key === 'awaiting_gps') return 'rNoGps'
  return null
}

const REASON_STYLE = {
  rPower: { Icon: PlugZap, box: 'bg-red-50 text-red-600', chip: 'bg-red-50 text-red-700 ring-red-200' },
  rAlarm: { Icon: AlertTriangle, box: 'bg-orange-50 text-orange-600', chip: 'bg-orange-50 text-orange-700 ring-orange-200' },
  rOffline: { Icon: WifiOff, box: 'bg-slate-100 text-slate-500', chip: 'bg-slate-100 text-slate-600 ring-slate-200' },
  rNever: { Icon: WifiOff, box: 'bg-slate-100 text-slate-500', chip: 'bg-slate-100 text-slate-600 ring-slate-200' },
  rNoGps: { Icon: SatelliteDish, box: 'bg-amber-50 text-amber-600', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
}

const VISIBLE_VEHICLES = 6

export default function Home() {
  // `devices` already carries the live merged position (AppContext merges the
  // websocket snapshot into it), and alerts live in `alertsList`.
  const { clientAuth, devices = [], alertsList = [], unreadCount = 0, wsConnected } = useApp()
  const navigate = useNavigate()
  const lang = useLang()
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const vehiclesRef = useRef(null)
  const attentionRef = useRef(null)
  const [query, setQuery] = useState('')
  const [showAllAttention, setShowAllAttention] = useState(false)

  const user = clientAuth || JSON.parse(localStorage.getItem('athargps_client') || '{}')
  const name = user?.name || user?.email?.split('@')[0] || (lang === 'ar' ? 'ضيف' : 'Invité')
  const initials = (name || 'U').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()

  const vehicles = useMemo(() => (devices || []).map(d => ({
    ...d,
    speed: Math.round(Number(d.speed) || 0),
    lastUpdate: d.lastUpdate,
    voltage: d.voltage ?? null,
    powerDisconnected: d.powerDisconnected ?? false,
    lat: vehiclePoint(d)?.[0] ?? null,
    lng: vehiclePoint(d)?.[1] ?? null,
  })), [devices])

  // Devices with a recent unread alarm event (events arrive in the alert stream, not on the vehicle).
  const alarmIds = useMemo(() => {
    const ids = new Set()
    const cutoff = Date.now() - ALARM_WINDOW_MS
    ;(Array.isArray(alertsList) ? alertsList : []).forEach(a => {
      if (a?.read || a?.deviceId == null) return
      if (!/alarm|sos/i.test(String(a.type || ''))) return
      const at = new Date(a.time || a.eventTime || 0).getTime()
      if (Number.isFinite(at) && at >= cutoff) ids.add(String(a.deviceId))
    })
    return ids
  }, [alertsList])

  const attention = useMemo(() => vehicles
    .map(v => ({ v, reason: attentionReason(v, alarmIds) }))
    .filter(x => x.reason)
    .sort((a, b) => REASON_ORDER.indexOf(a.reason) - REASON_ORDER.indexOf(b.reason)), [vehicles, alarmIds])

  // The three status tiles use the same buckets as the vehicles list, so a tile's
  // number always matches the list it opens. "Attention" is an overlay: it is the
  // length of the list right below it.
  const fleet = useMemo(() => {
    const counts = { connected: 0, stopped: 0, offline: 0, attention: attention.length }
    ;(devices || []).forEach(v => {
      const bucket = fleetBucket(v)
      counts[bucket === 'moving' ? 'connected' : bucket]++
    })
    return counts
  }, [devices, attention])

  const listed = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return vehicles
    return vehicles.filter(v => [v.name, v.plate, v.uniqueId].filter(Boolean).some(x => String(x).toLowerCase().includes(q)))
  }, [vehicles, query])

  const latestAlert = useMemo(() => {
    const arr = Array.isArray(alertsList) ? [...alertsList] : []
    if (!arr.length) return null
    return arr.sort((a, b) => new Date(b.time || b.eventTime || 0) - new Date(a.time || a.eventTime || 0))[0]
  }, [alertsList])

  const unreadAlerts = unreadCount
  const total = vehicles.length
  const segments = [
    { key: 'connected', n: fleet.connected, bar: 'bg-emerald-400' },
    { key: 'stopped', n: fleet.stopped, bar: 'bg-slate-400' },
    { key: 'offline', n: fleet.offline, bar: 'bg-slate-600' },
  ]
  const tiles = [
    { key: 'connected', n: fleet.connected, tone: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', go: () => navigate('/client/vehicles?filter=moving') },
    { key: 'stopped', n: fleet.stopped, tone: 'bg-slate-50 text-slate-700', dot: 'bg-slate-400', go: () => navigate('/client/vehicles?filter=stopped') },
    { key: 'offline', n: fleet.offline, tone: 'bg-slate-100 text-slate-600', dot: 'bg-slate-500', go: () => navigate('/client/vehicles?filter=offline') },
    { key: 'attention', n: fleet.attention, tone: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500', go: () => attentionRef.current?.scrollIntoView({ behavior: 'smooth' }) },
  ]
  const shortcuts = [
    { key: 'map', Icon: MapIcon, go: () => navigate('/client/map') },
    { key: 'trips', Icon: Route, go: () => navigate('/client/trips') },
    { key: 'reports', Icon: Gauge, go: () => navigate('/client/reports') },
    { key: 'geofences', Icon: Fence, go: () => navigate('/client/geofences') },
  ]

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-24" dir={dir}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="flex items-center justify-between px-5 py-3.5 max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200">{initials}</div>
            <div>
              <p className="text-[13px] text-slate-500">{t('greeting', lang)}</p>
              <h1 className="text-base font-bold text-slate-900 truncate max-w-[180px]">{name}</h1>
            </div>
          </div>
          <button onClick={() => navigate('/client/alerts')} aria-label={t('alerts', lang)} className="relative h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <Bell className="h-5 w-5 text-slate-700" />
            {unreadAlerts > 0 && <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unreadAlerts > 9 ? '9+' : unreadAlerts}</span>}
          </button>
        </div>
      </header>

      <main className="px-5 py-5 space-y-5 max-w-3xl mx-auto">
        {/* Fleet summary */}
        <section className="relative rounded-3xl overflow-hidden shadow-lg shadow-indigo-200/50 min-h-[168px]">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900" />
          <FleetScene live={fleet.connected} rtl={dir === 'rtl'} />
          {/* keeps the numbers readable on top of the animated scene */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/30" />
          <div className="relative p-5 text-white [text-shadow:0_1px_8px_rgba(2,6,23,.55)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold text-white/70">{t('fleet', lang)}</p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold tabular-nums leading-none">{total}</span>
                  <span className="text-sm font-semibold text-white/80">{t('total', lang)}</span>
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold ring-1 ring-white/20" role="status">
                <span className={`h-1.5 w-1.5 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-amber-300 animate-pulse'}`} />
                {wsConnected ? t('live', lang) : t('reconnecting', lang)}
              </span>
            </div>
            {/* proportions of the fleet */}
            <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
              {total > 0 && segments.filter(x => x.n > 0).map(x => (
                <span key={x.key} className={`${x.bar} transition-all duration-500`} style={{ width: `${(x.n / total) * 100}%` }} />
              ))}
            </div>
          </div>
        </section>

        {/* Status tiles (tap = open the matching list) */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" aria-label={t('fleet', lang)}>
          {tiles.map(x => (
            <button key={x.key} type="button" onClick={x.go} className={`rounded-2xl px-3 py-3 text-start ${x.tone} ring-1 ring-black/5 shadow-sm active:scale-[0.98] transition`}>
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${x.dot}`} />
                <span className="text-2xl font-extrabold tabular-nums">{x.n}</span>
              </span>
              <span className="mt-1 block text-[11px] font-semibold opacity-80">{t(x.key, lang)}</span>
            </button>
          ))}
        </section>

        {/* Shortcuts */}
        <section aria-label={t('shortcuts', lang)} className="grid grid-cols-4 gap-2.5">
          {shortcuts.map(x => (
            <button key={x.key} type="button" onClick={x.go} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white py-3 border border-slate-100 shadow-sm active:scale-[0.97] transition">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><x.Icon className="h-[18px] w-[18px]" /></span>
              <span className="text-[11px] font-semibold text-slate-700">{t(x.key, lang)}</span>
            </button>
          ))}
        </section>

        {/* Needs attention */}
        <section ref={attentionRef} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            {t('needsAttention', lang)}
            {attention.length > 0 && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">{attention.length}</span>}
          </h3>
          {attention.length === 0 ? (
            <div className="flex items-center gap-3 py-1">
              <span className="h-9 w-9 rounded-full bg-emerald-50 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-emerald-500" /></span>
              <p className="text-sm text-slate-600">{t('allGood', lang)}</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(showAllAttention ? attention : attention.slice(0, 5)).map(({ v, reason }) => {
                const st = REASON_STYLE[reason]
                return (
                  <li key={v.id || v.uniqueId}>
                    <button type="button" onClick={() => navigate(`/client/vehicle/${v.id || v.uniqueId}`)} className="flex w-full items-center gap-3 py-2.5 text-start">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${st.box}`}><st.Icon className="h-[18px] w-[18px]" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-900">{v.name || v.plate || '—'}</span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {t(reason, lang)}{v.lastUpdate && reason !== 'rNever' ? ` · ${timeAgo(v.lastUpdate, lang)}` : ''}
                        </span>
                      </span>
                      <ChevronLeft className={`h-4 w-4 text-slate-300 ${dir === 'rtl' ? '' : 'rotate-180'}`} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {attention.length > 5 && (
            <button type="button" onClick={() => setShowAllAttention(x => !x)} className="mt-2 w-full rounded-xl bg-orange-50 py-2 text-[12px] font-bold text-orange-700">
              {showAllAttention ? t('showLess', lang) : `${t('viewAll', lang)} (${attention.length})`}
            </button>
          )}
        </section>

        {/* Vehicles */}
        <section ref={vehiclesRef}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-900">{t('myVehicles', lang)}</h3>
            <button onClick={() => navigate('/client/vehicles')} className="text-sm font-medium text-indigo-600">{t('viewAll', lang)}</button>
          </div>
          {total > VISIBLE_VEHICLES && (
            <label className="mb-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search', lang)} className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" />
            </label>
          )}
          {total === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-500">{t('noVehicles', lang)}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(query ? listed : listed.slice(0, VISIBLE_VEHICLES)).map(v => (
                  <VehicleCard
                    key={v.id || v.uniqueId}
                    vehicle={v}
                    lang={lang}
                    compact
                    onClick={() => navigate(`/client/vehicle/${v.id || v.uniqueId}`)}
                  />
                ))}
              </div>
              {!query && total > VISIBLE_VEHICLES && (
                <button type="button" onClick={() => navigate('/client/vehicles')} className="mt-3 w-full rounded-2xl border border-indigo-100 bg-indigo-50 py-3 text-sm font-bold text-indigo-700 active:scale-[0.99] transition">
                  {t('showMore', lang)} ({total})
                </button>
              )}
            </>
          )}
        </section>

        {/* Latest alert */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">{t('latestAlert', lang)}</h3>
          {latestAlert ? (
            <button onClick={() => navigate('/client/alerts')} className="w-full flex items-start gap-3 text-start">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{latestAlert.type || latestAlert.message || 'Alert'}</p>
                <p className="text-xs text-slate-500 truncate">{latestAlert.vehicleName || latestAlert.deviceName || '—'} · {timeAgo(latestAlert.time || latestAlert.eventTime, lang)}</p>
              </div>
              <ChevronLeft className={`h-5 w-5 text-slate-400 mt-2 ${dir === 'rtl' ? '' : 'rotate-180'}`} />
            </button>
          ) : (
            <div className="flex items-center gap-3 py-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">{t('noAlerts', lang)}</p>
            </div>
          )}
        </section>
      </main>

      <BottomNav active="home" lang={lang} navigate={navigate} />
    </div>
  )
}
