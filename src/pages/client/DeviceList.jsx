import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Search, X, ChevronRight, Satellite, Zap, Clock, RefreshCw } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import { formatVoltage, getVoltageColor, VehicleIcon, getDeviceStatusKey, timeAgo } from '../../components/ui'
import SubscriptionBadge from '../../components/SubscriptionBadge'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import SubscriptionRenewalModal from '../../components/SubscriptionRenewalModal'
import { getSubscriptionSnapshot } from '../../utils/subscriptions'

const FILTERS = [
  { key: 'all', ar: 'الكل', fr: 'Tous' },
  { key: 'moving', ar: 'تتحرك', fr: 'En mouvement' },
  { key: 'idle', ar: 'خاملة', fr: 'Au ralenti' },
  { key: 'stopped', ar: 'متوقفة', fr: 'À l’arrêt' },
  { key: 'offline', ar: 'غير متصلة', fr: 'Hors ligne' },
]

const STATUS = {
  moving: { ar: 'تتحرك', fr: 'En mouvement', color: '#38d39f', soft: 'rgba(56,211,159,.12)' },
  idle: { ar: 'خاملة', fr: 'Au ralenti', color: '#d9ad62', soft: 'rgba(217,173,98,.12)' },
  stopped: { ar: 'متوقفة', fr: 'À l’arrêt', color: '#e46b68', soft: 'rgba(228,107,104,.12)' },
  awaiting_gps: { ar: 'في انتظار تحديد الموقع', fr: 'En attente de localisation', color: '#f59e0b', soft: 'rgba(245,158,11,.12)' },
  offline: { ar: 'غير متصلة', fr: 'Hors ligne', color: '#8da2b5', soft: 'rgba(141,162,181,.12)' },
}

function DeviceCard({ device, lang, onClick, onRenew, index }) {
  const isAr = lang === 'ar'
  const statusKey = getDeviceStatusKey(device)
  const status = STATUS[statusKey] || STATUS.offline
  const subscription = getSubscriptionSnapshot(device)
  const needsRenewal = ['expiring_soon', 'expired'].includes(subscription.status)
  const reduceMotion = useReducedMotion()
  const voltageColor = getVoltageColor(device.voltage)
  const voltageLabel = formatVoltage(device.voltage, lang, device.lastUpdate ?? device.last_update, device.powerDisconnected)
  const speed = Number(device.speed ?? device.last_speed ?? 0)

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { delay: Math.min(index * 0.055, 0.3), duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="ath-card relative overflow-hidden p-0 transition-transform duration-200 hover:-translate-y-0.5"
    >
      <span className="absolute inset-y-0 start-0 w-1" style={{ background: status.color }} aria-hidden="true" />
      <button onClick={onClick} className="flex w-full items-start gap-3 p-4 text-start" aria-label={isAr ? `فتح تفاصيل ${device.name}` : `Ouvrir les détails de ${device.name}`}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: status.soft }}>
          <VehicleIcon type={device.type} iconSize={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-[var(--ath-txt)]" style={{ fontFamily: 'var(--ath-disp)' }}>{device.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--ath-mut)]">
            {device.plate && <span dir="ltr" className="rounded-md border border-[var(--ath-line)] bg-[var(--ath-bg2)] px-1.5 py-0.5 font-mono tracking-wide">{device.plate}</span>}
            {device.driver && <span className="truncate">{device.driver}</span>}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold" style={{ color: status.color }}>
            <span className={`h-1.5 w-1.5 rounded-full ${statusKey === 'moving' ? 'live-dot' : ''}`} style={{ background: status.color }} aria-hidden="true" />
            <span className="rounded-full px-2 py-0.5" style={{ background: status.soft }}>{isAr ? status.ar : status.fr}</span>
            {device.powerDisconnected && device.status === 'online' && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                {isAr ? 'على البطارية الداخلية' : 'Sur batterie interne'}
              </span>
            )}
            {(device.lastUpdate || device.last_update) && <><Clock size={10} className="ms-1 text-[var(--ath-mut)]" /> <span className="font-normal text-[var(--ath-mut)]">{timeAgo(device.lastUpdate || device.last_update, lang)}</span></>}
          </span>
          <span className="mt-2 block"><SubscriptionBadge device={device} lang={lang} /></span>
          <span className="mt-3 flex items-center gap-2" aria-label={isAr ? `فولطاج المركبة ${voltageLabel}` : `Tension du véhicule ${voltageLabel}`}>
              <Zap size={14} style={{ color: voltageColor }} aria-hidden="true" />
              <span className="text-[10px] font-bold tabular-nums" style={{ color: voltageColor }}>{voltageLabel}</span>
            </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-2 text-[var(--ath-mut)]">
          {statusKey === 'moving' && speed > 0 && (
            <span className="rounded-lg bg-[rgba(56,211,159,.12)] px-2 py-1 text-end">
              <span className="block text-lg font-extrabold leading-none tabular-nums text-[var(--ath-green2)]">{Math.round(speed)}</span>
              <small className="text-[9px] font-normal">km/h</small>
            </span>
          )}
          <ChevronRight size={15} className={isAr ? 'rotate-180' : ''} aria-hidden="true" />
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
    idle: devices.filter(d => getDeviceStatusKey(d) === 'idle').length,
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
    <div className="client-app min-h-screen bg-slate-50 pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />
      <header className="border-b border-white/10 bg-[var(--ath-bg)] px-5 pb-4 pt-7">
        <div className="mx-auto max-w-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ath-txt)]">{t(lang, 'myDevices')}</h1>
              <p className="mt-1 text-xs text-[var(--ath-mut)]">{devices.length} {isAr ? 'أجهزة مرتبطة بالحساب' : 'appareil(s) lié(s)'}</p>
            </div>
          </div>
           <div className="ath-card flex items-center gap-2 p-3">
            <Search size={16} className="shrink-0 text-[var(--ath-mut)]" aria-hidden="true" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder={isAr ? 'ابحث باسم المركبة أو اللوحة…' : 'Rechercher par nom ou plaque…'} aria-label={isAr ? 'البحث في المركبات' : 'Rechercher les véhicules'} className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ath-txt)] outline-none placeholder:text-[var(--ath-mut)]" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label={isAr ? 'مسح البحث' : 'Effacer la recherche'}><X size={15} className="text-[var(--ath-mut)]" /></button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-5 py-4">
        {attentionDevice && <SubscriptionBanner device={attentionDevice} lang={lang} onRenew={() => setRenewDevice(attentionDevice)} />}

        <div
          className="relative -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          style={{
            paddingInline: '4px 14px',
            maskImage: 'linear-gradient(to right, transparent 0, black 18px, black calc(100% - 18px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 18px, black calc(100% - 18px), transparent 100%)',
          }}
        >
          {FILTERS.map(item => (
             <button key={item.key} onClick={() => setFilter(item.key)}
               className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-bold transition-all active:scale-95 ${filter === item.key ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-[var(--ath-line)] bg-white text-[var(--ath-mut)]'}`}>
              {item[isAr ? 'ar' : 'fr']} <span className="ms-1 opacity-60">{counts[item.key]}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ath-card flex flex-col items-center px-5 py-12 text-center">
                <Satellite size={40} className="mb-3 text-[var(--ath-green2)]" strokeWidth={1.5} />
                <p className="text-sm font-bold text-[var(--ath-txt)]">{search || filter !== 'all' ? (isAr ? 'لا توجد نتائج' : 'Aucun résultat') : (isAr ? 'لا توجد أجهزة' : 'Aucun appareil')}</p>
                <p className="mt-1 text-xs text-[var(--ath-mut)]">{search || filter !== 'all' ? (isAr ? 'جرّب بحثاً أو فلتر مختلف' : 'Essayez une autre recherche ou un autre filtre') : (isAr ? 'ستظهر الأجهزة المرتبطة بحسابك هنا' : 'Les appareils liés à votre compte apparaîtront ici')}</p>
              </motion.div>
            ) : filtered.map((device, index) => (
              <DeviceCard key={device.id} device={device} lang={lang} index={index}
                onClick={() => navigate('/client/vehicle/' + device.id)}
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