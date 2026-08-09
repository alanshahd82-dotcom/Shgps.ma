import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ChevronRight, Car, Clock, RefreshCw, Wifi } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import { VehicleIcon, getDeviceStatusKey, timeAgo } from '../../components/ui'
import SubscriptionBadge from '../../components/SubscriptionBadge'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import SubscriptionRenewalModal from '../../components/SubscriptionRenewalModal'
import { getSubscriptionSnapshot } from '../../utils/subscriptions'

const FILTERS = [
  { key: 'all', ar: 'الكل', fr: 'Tous' },
  { key: 'moving', ar: 'تتحرك', fr: 'En mouvement' },
  { key: 'stopped', ar: 'متوقفة', fr: 'À l’arrêt' },
  { key: 'offline', ar: 'غير متصلة', fr: 'Hors ligne' },
]

const STATUS = {
  moving: { ar: 'تتحرك', fr: 'En mouvement', color: '#38d39f', soft: 'rgba(56,211,159,.12)' },
  idle: { ar: 'خاملة', fr: 'Au ralenti', color: '#d9ad62', soft: 'rgba(217,173,98,.12)' },
  stopped: { ar: 'متوقفة', fr: 'À l’arrêt', color: '#e46b68', soft: 'rgba(228,107,104,.12)' },
  offline: { ar: 'غير متصلة', fr: 'Hors ligne', color: '#8da2b5', soft: 'rgba(141,162,181,.12)' },
}

function DeviceCard({ device, lang, onClick, onRenew, index }) {
  const isAr = lang === 'ar'
  const status = STATUS[getDeviceStatusKey(device)] || STATUS.offline
  const subscription = getSubscriptionSnapshot(device)
  const needsRenewal = ['expiring_soon', 'expired'].includes(subscription.status)

  return (
    <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.055, 0.3) }}
      className="glass-card relative overflow-hidden">
      <span className="absolute inset-y-0 start-0 w-1" style={{ background: status.color }} />
      <button onClick={onClick} className="flex w-full items-center gap-3 p-4 text-start">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: status.soft }}>
          <VehicleIcon type={device.type} iconSize={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold text-slate-900">{device.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
            {device.plate && <span className="font-mono">{device.plate}</span>}
            {device.driver && <span>{device.driver}</span>}
          </span>
          <span className="mt-2 flex items-center gap-1.5 text-[10px] font-bold" style={{ color: status.color }}>
             <span className={`h-1.5 w-1.5 rounded-full ${getDeviceStatusKey(device) === 'moving' ? 'live-dot' : ''}`} style={{ background: status.color }} />
            {isAr ? status.ar : status.fr}
            {(device.lastUpdate || device.last_update) && <><Clock size={10} className="ms-1 text-slate-400" /> <span className="font-normal text-slate-400">{timeAgo(device.lastUpdate || device.last_update)}</span></>}
          </span>
          <span className="mt-2 block"><SubscriptionBadge device={device} lang={lang} /></span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 text-slate-400">
          {device.speed > 0 ? <span className="text-sm font-extrabold text-primary-500">{Math.round(device.speed)} <small className="text-[9px] font-normal text-slate-400">km/h</small></span> : <span className="text-sm">—</span>}
          <ChevronRight size={15} className={isAr ? 'rotate-180' : ''} />
        </span>
      </button>

      {needsRenewal && (
        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#0a192c] px-4 py-2.5">
          <p className={`text-[10px] font-semibold ${subscription.status === 'expired' ? 'text-danger' : 'text-warning'}`}>
            {subscription.status === 'expired'
              ? (isAr ? 'انتهى الاشتراك — التتبع موقوف' : 'Abonnement expiré — suivi arrêté')
              : (isAr ? `ينتهي خلال ${subscription.daysRemaining} يوم` : `Expire dans ${subscription.daysRemaining} jours`)}
          </p>
          <button onClick={onRenew} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-accent/50 bg-accent/10 px-2.5 py-1.5 text-[10px] font-bold text-[#8b622e]">
            <RefreshCw size={11} />{isAr ? 'تجديد' : 'Renouveler'}
          </button>
        </div>
      )}
    </motion.article>
  )
}

export default function DeviceList() {
  const navigate = useNavigate()
  const { devices, lang, refreshDevices } = useApp()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [renewDevice, setRenewDevice] = useState(null)
  const isAr = lang === 'ar'

  const counts = useMemo(() => ({
    all: devices.length,
    moving: devices.filter(d => getDeviceStatusKey(d) === 'moving').length,
    stopped: devices.filter(d => getDeviceStatusKey(d) === 'stopped').length,
    offline: devices.filter(d => getDeviceStatusKey(d) === 'offline').length,
  }), [devices])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return devices.filter(device => {
      const matchesFilter = filter === 'all' || getDeviceStatusKey(device) === filter
      const matchesSearch = !query || [device.name, device.plate, device.driver].some(value => value?.toLowerCase().includes(query))
      return matchesFilter && matchesSearch
    })
  }, [devices, filter, search])

  const attentionDevice = devices.find(device => getSubscriptionSnapshot(device).status !== 'active')

  return (
    <div className="client-app min-h-screen bg-[#f5f7f8] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />
      <header className="border-b border-slate-200 bg-white px-5 pb-4 pt-5">
        <div className="mx-auto max-w-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
           <h1 className="text-2xl font-extrabold tracking-tight text-[#edf4f2]">{t(lang, 'myDevices')}</h1>
              <p className="mt-1 text-xs text-slate-500">{devices.length} {isAr ? 'أجهزة مرتبطة بالحساب' : 'appareil(s) lié(s)'}</p>
            </div>
          </div>
           <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0e2035] px-3.5 py-3 shadow-inner">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder={isAr ? 'ابحث باسم المركبة أو اللوحة' : 'Rechercher par nom ou plaque'} className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" />
            {search && <button onClick={() => setSearch('')}><X size={15} className="text-slate-400" /></button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-5 py-4">
        {attentionDevice && <SubscriptionBanner device={attentionDevice} lang={lang} onRenew={() => setRenewDevice(attentionDevice)} />}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map(item => (
             <button key={item.key} onClick={() => setFilter(item.key)}
               className={`shrink-0 rounded-lg border px-3 py-2 text-[11px] font-bold transition-all active:scale-95 ${filter === item.key ? 'border-[#38d39f] bg-[#38d39f] text-[#07111f]' : 'border-white/10 bg-[#0e2035] text-slate-400'}`}>
              {item[isAr ? 'ar' : 'fr']} <span className="ms-1 opacity-60">{counts[item.key]}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
                <Car size={40} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-bold text-slate-700">{search ? (isAr ? 'لا توجد نتائج' : 'Aucun résultat') : (isAr ? 'لا توجد أجهزة' : 'Aucun appareil')}</p>
                <p className="mt-1 text-xs text-slate-400">{search ? (isAr ? 'حاول كلمة بحث مختلفة' : 'Essayez un autre terme') : (isAr ? 'تواصل مع الدعم لإضافة جهاز' : 'Contactez le support pour ajouter un appareil')}</p>
                <p className="mt-1 text-xs text-slate-400">{isAr ? 'ستظهر الأجهزة المرتبطة بحسابك هنا' : 'Les appareils liés à votre compte apparaîtront ici'}</p>
              </motion.div>
            ) : filtered.map((device, index) => (
              <DeviceCard key={device.id} device={device} lang={lang} index={index}
                onClick={() => navigate('/client/device/' + device.id)}
                onRenew={() => setRenewDevice(device)} />
            ))}
          </AnimatePresence>
        </div>
      </main>

      <SubscriptionRenewalModal open={!!renewDevice} device={renewDevice} lang={lang}
        onClose={() => setRenewDevice(null)}
        onSaved={() => { setRenewDevice(null); refreshDevices?.() }} />
      <ClientNav />
    </div>
  )
}