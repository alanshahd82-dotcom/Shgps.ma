import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Battery, Signal, Clock, Plus, Car } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'
import {
  VehicleIcon, StatusBadge, getDeviceStatusKey, timeAgo,
  EmptyState, PageHeader
} from '../../components/ui'

// ── Filter config ─────────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'all',     ar: 'الكل',       fr: 'Tous'       },
  { key: 'moving',  ar: 'يتحرك',      fr: 'En mvt'     },
  { key: 'stopped', ar: 'متوقف',      fr: 'Arrêté'     },
  { key: 'offline', ar: 'غير متصل',   fr: 'Hors ligne' },
]

// ── Device card ───────────────────────────────────────────────────────────────
function DeviceCard({ device, lang, onClick, index }) {
  const st     = getDeviceStatusKey(device)
  const isAr   = lang === 'ar'
  const batLow = device.battery != null && device.battery < 30

  const barColor = {
    moving:  'linear-gradient(90deg,#22c55e,#00D97E)',
    idle:    'linear-gradient(90deg,#f59e0b,#fbbf24)',
    stopped: 'linear-gradient(90deg,#ef4444,#f97316)',
    offline: '#e2e8f0',
  }[st] || '#e2e8f0'

  return (
    <motion.div
      className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden cursor-pointer"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.045, 0.25) }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Color bar */}
      <div className="h-1" style={{ background: barColor }} />

      <div className="p-4">
        {/* Name + status */}
        <div className="flex items-start gap-3 mb-3">
          <VehicleIcon type={device.type} iconSize={20} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-primary-500 dark:text-white text-sm truncate">{device.name}</p>
            {device.plate && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono tracking-wide">{device.plate}</p>
            )}
          </div>
          <StatusBadge status={st} lang={lang} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center gap-1.5">
            <Battery size={12} className={batLow ? 'text-red-500' : 'text-slate-400'} strokeWidth={1.8} />
            <span className={`text-xs font-semibold ${batLow ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>
              {device.battery != null ? `${device.battery}%` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Signal size={12} className="text-slate-400" strokeWidth={1.8} />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {device.signal != null ? `${device.signal}/4` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-slate-400" strokeWidth={1.8} />
            <span className="text-xs text-slate-400 dark:text-slate-500">{timeAgo(device.lastUpdate, lang)}</span>
          </div>
        </div>

        {/* Speed (moving only) */}
        {st === 'moving' && (
          <div
            className="mt-3 rounded-xl px-3 py-2 flex items-center justify-between"
            style={{ background: 'rgba(0,217,126,0.08)', border: '1px solid rgba(0,217,126,0.15)' }}
          >
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{t(lang, 'speed')}</span>
            <span className="text-sm font-bold text-accent">{device.speed} {t(lang, 'kmh')}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DeviceList() {
  const navigate = useNavigate()
  const { devices, lang } = useApp()
  const isAr = lang === 'ar'

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const counts = useMemo(() => ({
    all:     devices.length,
    moving:  devices.filter(d => getDeviceStatusKey(d) === 'moving').length,
    stopped: devices.filter(d => ['stopped', 'idle'].includes(getDeviceStatusKey(d))).length,
    offline: devices.filter(d => getDeviceStatusKey(d) === 'offline').length,
  }), [devices])

  const filtered = useMemo(() => {
    let list = devices
    if (filter === 'stopped') {
      list = list.filter(d => ['stopped', 'idle'].includes(getDeviceStatusKey(d)))
    } else if (filter !== 'all') {
      list = list.filter(d => getDeviceStatusKey(d) === filter)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(d =>
        (d.name  || '').toLowerCase().includes(q) ||
        (d.plate || '').toLowerCase().includes(q) ||
        (d.imei  || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [devices, filter, search])

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50 dark:bg-slate-900">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PageHeader>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-xl">{t(lang, 'myDevices')}</h1>
            <p className="text-white/50 text-xs mt-0.5">
              {devices.length} {isAr ? 'مركبة مسجلة' : 'véhicules enregistrés'}
            </p>
          </div>
          <button
            onClick={() => navigate('/client/device-wizard')}
            className="w-9 h-9 rounded-full bg-accent flex items-center justify-center active:scale-90 transition-transform"
            aria-label={isAr ? 'إضافة جهاز' : 'Ajouter un appareil'}
          >
            <Plus size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
        </div>
      </PageHeader>

      {/* ── Sticky search + filter ──────────────────────────────────────── */}
      <div className="sticky top-0 z-10 px-4 pt-3 pb-2 space-y-2.5 border-b border-gray-100 dark:border-slate-800"
           style={{ background: 'rgba(249,250,251,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        {/* Search bar */}
        <div className="flex items-center gap-2.5 bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 border border-gray-100 dark:border-slate-700 shadow-sm">
          <Search size={15} className="text-slate-400 flex-shrink-0" strokeWidth={2} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث باسم أو لوحة...' : 'Chercher par nom ou plaque...'}
            className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none"
            dir={isAr ? 'rtl' : 'ltr'}
          />
          <AnimatePresence>
            {search && (
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                onClick={() => setSearch('')}
                className="text-slate-400"
              >
                <X size={14} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map(f => {
            const active = filter === f.key
            const cnt    = counts[f.key]
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold flex-shrink-0 transition-all"
                style={{
                  background: active ? '#0F2044'       : 'rgba(255,255,255,0.9)',
                  color:      active ? 'white'         : '#64748b',
                  border:     active ? '1px solid transparent' : '1px solid #e2e8f0',
                }}
              >
                {isAr ? f.ar : f.fr}
                {cnt > 0 && (
                  <span
                    className="rounded-full text-[9px] px-1.5 font-bold"
                    style={{
                      background: active ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                      color:      active ? 'white' : '#475569',
                    }}
                  >
                    {cnt}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── List ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-3 space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={Car}
                title={
                  search
                    ? (isAr ? 'لا توجد نتائج للبحث' : 'Aucun résultat')
                    : (isAr ? 'لا توجد مركبات' : 'Aucun véhicule')
                }
                subtitle={
                  search
                    ? (isAr ? 'جرّب كلمة بحث مختلفة' : 'Essayez un autre terme')
                    : (isAr ? 'ابدأ بإضافة جهاز تتبع GPS' : 'Ajoutez votre premier tracker GPS')
                }
                action={!search && (
                  <button
                    onClick={() => navigate('/client/device-wizard')}
                    className="px-5 py-2.5 bg-accent text-slate-900 rounded-xl text-sm font-bold active:scale-95 transition-transform"
                  >
                    {isAr ? 'إضافة جهاز' : 'Ajouter un appareil'}
                  </button>
                )}
              />
            </motion.div>
          ) : (
            filtered.map((device, i) => (
              <DeviceCard
                key={device.id}
                device={device}
                lang={lang}
                index={i}
                onClick={() => navigate(`/client/device/${device.id}`)}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      <ClientNav />
    </div>
  )
}
