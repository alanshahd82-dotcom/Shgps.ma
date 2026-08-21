import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Bell, ChevronLeft, Car, Truck, Bus, MapPin,
  Navigation, Zap, Clock, CheckCircle2, Shield, Activity
} from 'lucide-react'
import { useApp } from '../../context/AppContext'

function useLang() {
  const { lang } = useApp()
  return lang === 'fr' ? 'fr' : 'ar'
}

const t = (key, lang) => ({
  ar: {
    greeting: 'مرحباً', subtitle: 'إليك حالة مركباتك اليوم',
    heroTitle: 'أسطولك تحت السيطرة', heroSub: 'تابع مركباتك لحظة بلحظة بكل أمان وراحة بال',
    heroCta: 'عرض المركبات', fleet: 'حالة الأسطول',
    connected: 'متصلة', stopped: 'متوقفة', attention: 'تحتاج انتباه',
    myVehicles: 'مركباتي', viewAll: 'عرض الكل', latestAlert: 'آخر تنبيه',
    noAlerts: 'لا توجد تنبيهات', noVehicles: 'لا توجد مركبات',
    quick: 'الوصول السريع', vehicles: 'المركبات', alerts: 'التنبيهات', trips: 'الرحلات',
    kmh: 'كم/س', ago: 'منذ', now: 'الآن',
  },
  fr: {
    greeting: 'Bonjour', subtitle: 'Voici l\'état de votre flotte',
    heroTitle: 'Votre flotte sous contrôle', heroSub: 'Suivez vos véhicules en temps réel',
    heroCta: 'Voir les véhicules', fleet: 'État de la flotte',
    connected: 'Connectés', stopped: 'Arrêtés', attention: 'Attention',
    myVehicles: 'Mes véhicules', viewAll: 'Voir tout', latestAlert: 'Dernière alerte',
    noAlerts: 'Aucune alerte', noVehicles: 'Aucun véhicule',
    quick: 'Accès rapide', vehicles: 'Véhicules', alerts: 'Alertes', trips: 'Trajets',
    kmh: 'km/h', ago: 'il y a', now: 'maintenant',
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

function VehicleIcon({ type, className }) {
  if (type === 'truck') return <Truck className={className} />
  if (type === 'van' || type === 'bus') return <Bus className={className} />
  return <Car className={className} />
}

function statusInfo(vehicle) {
  const last = vehicle?.lastUpdate ? Date.now() - new Date(vehicle.lastUpdate).getTime() : Infinity
  const online = last < 15 * 60 * 1000
  const attention = vehicle?.status === 'alarm' || vehicle?.alertType
  if (attention) return { color: 'orange', label: 'attention', dot: 'bg-orange-500' }
  if (online && (vehicle?.speed || 0) > 0) return { color: 'green', label: 'connected', dot: 'bg-green-500' }
  if (online) return { color: 'slate', label: 'stopped', dot: 'bg-slate-400' }
  return { color: 'slate', label: 'stopped', dot: 'bg-slate-400' }
}

function BottomNav({ active, lang, navigate }) {
  const tabs = [
    { id: 'home', icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg>, route: '/client/home' },
    { id: 'vehicles', icon: Car, route: '/client/vehicles' },
    { id: 'alerts', icon: Bell, route: '/client/alerts' },
    { id: 'trips', icon: Activity, route: '/client/trips' },
    { id: 'more', icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>, route: '/client/more' },
  ]
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
        {tabs.map(tb => {
          const Icon = tb.icon; const isActive = active === tb.id
          return (
            <button key={tb.id} onClick={() => navigate(tb.route)}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-500'}`}>
              <Icon className="h-5 w-5" />
              <span>{t(tb.id, lang)}</span>
              {isActive && <span className="absolute top-0 h-[3px] w-10 bg-indigo-600 rounded-b" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default function Home() {
  const { clientAuth, devices = [], positions = {}, alerts = [] } = useApp()
  const navigate = useNavigate()
  const lang = useLang()
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const vehiclesRef = useRef(null)

  const user = clientAuth || JSON.parse(localStorage.getItem('athargps_client') || '{}')
  const name = user?.name || user?.email?.split('@')[0] || (lang === 'ar' ? 'ضيف' : 'Invité')
  const initials = (name || 'U').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()

  const vehicles = useMemo(() => (devices || []).map(d => {
    const p = positions?.[d.id] || positions?.[d.uniqueId] || {}
    const speed = p.speed ?? d.speed ?? 0
    const lastUpdate = p.fixTime || p.serverTime || p.deviceTime || d.lastUpdate
    return { ...d, speed: Math.round(speed), lastUpdate, lat: p.latitude, lng: p.longitude }
  }), [devices, positions])

  const fleet = useMemo(() => {
    const counts = { connected: 0, stopped: 0, attention: 0 }
    vehicles.forEach(v => { const s = statusInfo(v); counts[s.label]++ })
    return counts
  }, [vehicles])

  const latestAlert = useMemo(() => {
    const arr = Array.isArray(alerts) ? alerts : Object.values(alerts || {})
    if (!arr.length) return null
    return arr.sort((a,b) => new Date(b.time || b.eventTime || 0) - new Date(a.time || a.eventTime || 0))[0]
  }, [alerts])

  const unreadAlerts = Array.isArray(alerts) ? alerts.filter(a => !a.read).length : 0

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-20" dir={dir}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="flex items-center justify-between px-5 py-4 max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200">{initials}</div>
            <div>
              <p className="text-[13px] text-slate-500">{t('greeting', lang)}</p>
              <h1 className="text-base font-bold text-slate-900 truncate max-w-[180px]">{name}</h1>
            </div>
          </div>
          <button onClick={() => navigate('/client/alerts')} className="relative h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <Bell className="h-5 w-5 text-slate-700" />
            {unreadAlerts > 0 && <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unreadAlerts > 9 ? '9+' : unreadAlerts}</span>}
          </button>
        </div>
      </header>

      <main className="px-5 py-6 space-y-6 max-w-3xl mx-auto">
        {/* Hero */}
        <section className="relative rounded-3xl overflow-hidden h-52 shadow-lg shadow-indigo-200/50">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900" />
          <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(circle at 80% 20%, white 0.5px, transparent 1px), radial-gradient(circle at 30% 70%, white 0.5px, transparent 1px)', backgroundSize: '40px 40px'}} />
          <div className="relative h-full flex flex-col justify-between p-6 text-white">
            <div>
              <h2 className="text-2xl font-bold mb-1.5">{t('heroTitle', lang)}</h2>
              <p className="text-sm text-white/85 leading-relaxed">{t('heroSub', lang)}</p>
            </div>
            <button onClick={() => vehiclesRef.current?.scrollIntoView({behavior:'smooth'})}
              className="self-start bg-white text-indigo-700 font-semibold px-5 py-2.5 rounded-full text-sm shadow-md hover:shadow-lg transition flex items-center gap-2">
              {t('heroCta', lang)} <ChevronLeft className={`h-4 w-4 ${dir === 'rtl' ? '' : 'rotate-180'}`} />
            </button>
          </div>
        </section>

        {/* Fleet Overview */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('fleet', lang)}</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center py-3 px-2 rounded-xl bg-green-50">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-2xl font-bold text-green-600">{fleet.connected}</span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium">{t('connected', lang)}</p>
            </div>
            <div className="text-center py-3 px-2 rounded-xl bg-slate-50">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span className="text-2xl font-bold text-slate-700">{fleet.stopped}</span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium">{t('stopped', lang)}</p>
            </div>
            <div className="text-center py-3 px-2 rounded-xl bg-orange-50">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-2xl font-bold text-orange-600">{fleet.attention}</span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium">{t('attention', lang)}</p>
            </div>
          </div>
        </section>

        {/* Vehicles */}
        <section ref={vehiclesRef}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-900">{t('myVehicles', lang)}</h3>
            <button onClick={() => navigate('/client/devices')} className="text-sm font-medium text-indigo-600">{t('viewAll', lang)}</button>
          </div>
          {vehicles.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-500">{t('noVehicles', lang)}</div>
          ) : (
            <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-2 scrollbar-hide">
              {vehicles.map(v => {
                const s = statusInfo(v)
                const dotColor = s.color === 'green' ? 'bg-green-500' : s.color === 'orange' ? 'bg-orange-500' : 'bg-slate-400'
                return (
                  <button key={v.id || v.uniqueId} onClick={() => navigate(`/client/vehicle/${v.id || v.uniqueId}`)}
                    className="flex-shrink-0 w-56 bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 text-start hover:shadow-md transition">
                    <div className="h-28 bg-gradient-to-br from-slate-100 to-slate-200 relative flex items-center justify-center">
                      <VehicleIcon type={v.type || v.category} className="h-14 w-14 text-slate-400" />
                      <span className={`absolute top-2 ${dir === 'rtl' ? 'left-2' : 'right-2'} h-3 w-3 rounded-full ${dotColor} ring-2 ring-white`} />
                    </div>
                    <div className="p-3">
                      <p className="font-bold text-slate-900 text-sm truncate">{v.name || v.uniqueId}</p>
                      <p className="text-xs text-slate-500 mb-2">{v.plate || v.uniqueId}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600 flex items-center gap-1"><Gauge className="h-3.5 w-3.5" />{v.speed} {t('kmh', lang)}</span>
                        <span className="text-[10px] text-slate-400">{timeAgo(v.lastUpdate, lang)}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* Latest Alert */}
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

        {/* Quick Access */}
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">{t('quick', lang)}</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Car, label: 'vehicles', route: '/client/vehicles', bg: 'bg-blue-50', fg: 'text-blue-600' },
              { icon: Bell, label: 'alerts', route: '/client/alerts', bg: 'bg-orange-50', fg: 'text-orange-600' },
              { icon: Activity, label: 'trips', route: '/client/trips', bg: 'bg-purple-50', fg: 'text-purple-600' },
            ].map(q => {
              const Icon = q.icon
              return (
                <button key={q.label} onClick={() => navigate(q.route)}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center gap-2 hover:shadow-md transition">
                  <div className={`h-11 w-11 rounded-full ${q.bg} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${q.fg}`} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">{t(q.label, lang)}</span>
                </button>
              )
            })}
          </div>
        </section>
      </main>

      <BottomNav active="home" lang={lang} navigate={navigate} />
    </div>
  )
}
