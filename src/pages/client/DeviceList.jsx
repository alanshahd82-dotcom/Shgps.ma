import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ChevronRight, Car, Clock, RefreshCw } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'
import { VehicleIcon, getDeviceStatusKey, timeAgo } from '../../components/ui'
import SubscriptionBadge from '../../components/SubscriptionBadge'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import { getSubscriptionSnapshot } from '../../utils/subscriptions'

const FILTERS = [
  { key: 'all',     ar: 'الكل',     fr: 'Tous'      },
  { key: 'moving',  ar: 'يتحرك',    fr: 'En mvt'    },
  { key: 'stopped', ar: 'متوقف',    fr: 'Arrêté'    },
  { key: 'offline', ar: 'غير متصل', fr: 'Hors ligne' },
]

const ST_COLOR = { moving:'#00D97E', idle:'#FF9500', stopped:'#FF3B30', offline:'#6b7280' }
const ST_BG    = { moving:'rgba(0,217,126,0.1)', idle:'rgba(255,149,0,0.1)', stopped:'rgba(255,59,48,0.1)', offline:'rgba(107,114,128,0.1)' }
const ST_LABEL_AR = { moving:'يتحرك', idle:'خمول', stopped:'متوقف', offline:'غير متصل' }
const ST_LABEL_FR = { moving:'En mvt', idle:'Ralenti', stopped:'Arrêté', offline:'Hors ligne' }

function DeviceCard({ device, lang, onClick, onRenew, index }) {
  const st   = getDeviceStatusKey(device)
  const isAr = lang === 'ar'
  const c    = ST_COLOR[st] || '#6b7280'
  const stLabel = isAr ? (ST_LABEL_AR[st] || st) : (ST_LABEL_FR[st] || st)
  const sub  = getSubscriptionSnapshot(device)
  const needsRenewal = sub.status === 'expiring_soon' || sub.status === 'expired'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.22) }}
      className="w-full rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Top status bar */}
      <div className="h-0.5" style={{ background: c }}/>
      <motion.button whileTap={{ scale: 0.97 }} onClick={onClick}
        className="w-full text-left p-4 flex items-center gap-3">
        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: ST_BG[st] || 'rgba(255,255,255,0.06)' }}>
          <VehicleIcon type={device.type} iconSize={22}/>
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate mb-0.5">{device.name}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {device.plate && (
              <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{device.plate}</span>
            )}
            {device.driver && (
              <span className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.28)' }}>{device.driver}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }}/>
            <span className="text-xs font-semibold" style={{ color: c }}>{stLabel}</span>
            {device.last_update && (
              <>
                <span className="text-xs mx-0.5" style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                <Clock size={10} style={{ color: 'rgba(255,255,255,0.2)' }}/>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>{timeAgo(device.last_update)}</span>
              </>
            )}
          </div>
          <div className="mt-2">
            <SubscriptionBadge device={device} lang={lang} dark />
          </div>
        </div>
        {/* Speed + arrow */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          {device.speed != null && device.speed > 0 ? (
            <div>
              <span className="font-bold text-base" style={{ color: '#00D97E' }}>{Math.round(device.speed)}</span>
              <span className="text-xs ml-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>km/h</span>
            </div>
          ) : (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
          )}
          <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.2)', transform: isAr ? 'rotate(180deg)' : 'none' }}/>
        </div>
      </motion.button>

      {/* Inline renewal row — shown only when subscription needs attention */}
      {needsRenewal && (
        <div className="px-4 pb-3 flex items-center justify-between gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs" style={{ color: sub.status === 'expired' ? '#ff6b60' : '#ffb347' }}>
            {sub.status === 'expired'
              ? (isAr ? 'انتهى الاشتراك — التتبع موقوف' : 'Abonnement expiré — suivi arrêté')
              : (isAr ? `ينتهي خلال ${sub.daysRemaining} يوم` : `Expire dans ${sub.daysRemaining} jours`)}
          </p>
          <motion.button whileTap={{ scale: 0.94 }} onClick={onRenew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0"
            style={{
              background: sub.status === 'expired' ? 'rgba(255,59,48,0.15)' : 'rgba(255,149,0,0.15)',
              border: `1px solid ${sub.status === 'expired' ? 'rgba(255,59,48,0.3)' : 'rgba(255,149,0,0.3)'}`,
              color: sub.status === 'expired' ? '#ff6b60' : '#ffb347',
            }}>
            <RefreshCw size={12}/>
            {isAr ? 'تجديد' : 'Renouveler'}
          </motion.button>
        </div>
      )}
    </motion.div>
  )
}

export default function DeviceList() {
  const navigate = useNavigate()
  const { devices, lang } = useApp()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const isAr = lang === 'ar'
  const attentionDevice = devices.find(d => d.subscriptionStatus && d.subscriptionStatus !== 'active')

  const counts = useMemo(() => ({
    all:     devices.length,
    moving:  devices.filter(d => getDeviceStatusKey(d) === 'moving').length,
    stopped: devices.filter(d => getDeviceStatusKey(d) === 'stopped').length,
    offline: devices.filter(d => getDeviceStatusKey(d) === 'offline').length,
  }), [devices])

  const filtered = useMemo(() => {
    let list = devices
    if (filter !== 'all') list = list.filter(d => getDeviceStatusKey(d) === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.plate?.toLowerCase().includes(q) ||
        d.driver?.toLowerCase().includes(q)
      )
    }
    return list
  }, [devices, filter, search])

  return (
    <div className="min-h-screen pb-28" dir={isAr ? 'rtl' : 'ltr'}
      style={{ background: 'linear-gradient(160deg,#080f1f 0%,#0F2044 100%)' }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-3">
        <h1 className="text-white font-bold text-xl mb-4">{t(lang, 'myDevices')}</h1>
        {/* Search */}
        <div className="flex items-center gap-2.5 rounded-xl px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Search size={16} style={{ color: 'rgba(255,255,255,0.3)' }} className="flex-shrink-0"/>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم أو اللوحة...' : 'Chercher par nom ou plaque...'}
            className="flex-1 bg-transparent text-white text-sm outline-none"
            style={{ caretColor: '#00D97E' }}/>
          {search && (
            <button onClick={() => setSearch('')}>
              <X size={15} style={{ color: 'rgba(255,255,255,0.3)' }}/>
            </button>
          )}
        </div>
      </div>
      {attentionDevice && (
        <div className="px-5 pb-3">
          <SubscriptionBanner device={attentionDevice} lang={lang} dark onRenew={() => navigate('/client/device/' + attentionDevice.id)} />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 px-5 pb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map(f => {
          const active = filter === f.key
          return (
            <motion.button key={f.key} whileTap={{ scale: 0.94 }} onClick={() => setFilter(f.key)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all"
              style={active
                ? { background: '#00D97E', color: '#0F2044' }
                : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)', border: '1px solid rgba(255,255,255,0.1)' }
              }>
              {f[lang === 'ar' ? 'ar' : 'fr']}
              {counts[f.key] !== undefined && (
                <span className="ml-1.5" style={{ opacity: 0.65 }}>{counts[f.key]}</span>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* List */}
      <div className="px-4 space-y-2.5">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <Car size={28} style={{ color: 'rgba(255,255,255,0.2)' }}/>
              </div>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>
                {isAr ? 'لا توجد أجهزة' : 'Aucun appareil'}
              </p>
            </motion.div>
          ) : filtered.map((d, i) => (
            <DeviceCard key={d.id} device={d} lang={lang} index={i}
              onClick={() => navigate('/client/device/' + d.id)}
              onRenew={() => navigate('/client/device/' + d.id)}/>
          ))}
        </AnimatePresence>
      </div>

      <ClientNav/>
    </div>
  )
}
