import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, ChevronRight, Map, Activity, Shield, Wrench } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'
import { VehicleIcon, getDeviceStatusKey, timeAgo } from '../../components/ui'
import SubscriptionBanner from '../../components/SubscriptionBanner'

// ── SVG Circular Fleet Gauge ─────────────────────────────────────────────────
function FleetGauge({ active, total, isAr }) {
  const pct = total > 0 ? active / total : 0
  const R = 78, stroke = 13
  const circ = 2 * Math.PI * R
  const arcLen = circ * 0.77
  const fill = arcLen * Math.min(pct, 1)
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg width="192" height="192" viewBox="0 0 192 192"
          className="absolute inset-0" style={{ transform: 'rotate(-228deg)' }}>
          <defs>
            <linearGradient id="gGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00D97E"/>
              <stop offset="100%" stopColor="#00ffaa"/>
            </linearGradient>
          </defs>
          {/* Track */}
          <circle cx="96" cy="96" r={R} fill="none"
            stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={arcLen + ' ' + circ}/>
          {/* Fill */}
          <circle cx="96" cy="96" r={R} fill="none"
            stroke="url(#gGrad)" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={fill + ' ' + circ}
            style={{ transition: 'stroke-dasharray 1.3s cubic-bezier(0.4,0,0.2,1)',
                     filter: 'drop-shadow(0 0 8px rgba(0,217,126,0.7))' }}/>
          {/* Tick marks */}
          {[0,0.25,0.5,0.75,1].map((p, i) => {
            const angle = (p * 0.77 * 2 * Math.PI) - (Math.PI * 1.14)
            const ox = 96 + (R + 22) * Math.cos(angle)
            const oy = 96 + (R + 22) * Math.sin(angle)
            return <circle key={i} cx={ox} cy={oy} r="2.5" fill="rgba(255,255,255,0.2)"/>
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-black text-white leading-none">{active}</span>
          <span className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {isAr ? ('من ' + total) : ('sur ' + total)}
          </span>
          <span className="text-[10px] font-bold tracking-widest uppercase mt-1" style={{ color: '#00D97E' }}>
            {isAr ? 'نشط' : 'Actif'}
          </span>
        </div>
      </div>
      <p className="text-xs font-semibold tracking-widest uppercase mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {isAr ? 'حالة الأسطول' : 'État de la flotte'}
      </p>
    </div>
  )
}

// ── Stat bubble ──────────────────────────────────────────────────────────────
function StatBubble({ count, label, color }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white"
        style={{ background: color + '1a', border: '1.5px solid ' + color + '55' }}>
        {count}
      </div>
      <span className="text-[10px] text-center leading-tight" style={{ color: 'rgba(255,255,255,0.38)' }}>{label}</span>
    </div>
  )
}

// ── Quick action tile ────────────────────────────────────────────────────────
function ActionTile({ icon: Icon, label, color, onClick }) {
  return (
    <motion.button whileTap={{ scale: 0.94 }} onClick={onClick}
      className="flex flex-col items-center gap-2.5 p-3.5 rounded-2xl"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ background: color + '1c' }}>
        <Icon size={22} color={color}/>
      </div>
      <span className="text-[11px] font-medium text-center leading-tight" style={{ color: 'rgba(255,255,255,0.65)' }}>{label}</span>
    </motion.button>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { devices, unreadCount, lang, clientAuth } = useApp()
  const isAr = lang === 'ar'

  const stats = useMemo(() => ({
    moving:  devices.filter(d => getDeviceStatusKey(d) === 'moving').length,
    stopped: devices.filter(d => getDeviceStatusKey(d) === 'stopped').length,
    idle:    devices.filter(d => getDeviceStatusKey(d) === 'idle').length,
    offline: devices.filter(d => getDeviceStatusKey(d) === 'offline').length,
  }), [devices])

  const recent = devices.slice(0, 3)
  const attentionDevice = devices.find(d => d.subscriptionStatus && d.subscriptionStatus !== 'active')
  const stColor = { moving:'#00D97E', stopped:'#FF3B30', idle:'#FF9500', offline:'#6b7280' }

  return (
    <div className="min-h-screen pb-28" dir={isAr ? 'rtl' : 'ltr'}
      style={{ background: 'linear-gradient(160deg,#080f1f 0%,#0F2044 100%)' }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-2 flex items-center justify-between">
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>{t(lang, 'welcome')}</p>
          <h1 className="text-white font-bold text-lg">{clientAuth?.name || 'AtharGPS'}</h1>
        </div>
        <motion.button whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/client/alerts')}
          className="relative w-11 h-11 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <Bell size={20} color="white"/>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </motion.button>
      </div>

      {/* Gauge */}
      <div className="flex flex-col items-center py-7">
        <FleetGauge active={stats.moving} total={devices.length} isAr={isAr}/>
        {/* Stat row */}
        <div className="flex items-center gap-7 mt-7">
          <StatBubble count={stats.moving}  label={isAr ? 'يتحرك'   : 'En mvt'}   color="#00D97E"/>
          <StatBubble count={stats.stopped} label={isAr ? 'متوقف'   : 'Arrêté'}   color="#FF3B30"/>
          <StatBubble count={stats.idle}    label={isAr ? 'خمول'    : 'Ralenti'}  color="#FF9500"/>
          <StatBubble count={stats.offline} label={isAr ? 'مقطوع'   : 'Hors lg'}  color="#6b7280"/>
        </div>
      </div>

      {/* Separator */}
      <div className="h-px mx-5 my-1" style={{ background: 'rgba(255,255,255,0.06)' }}/>

      {attentionDevice && (
        <div className="px-5 mt-4">
          <SubscriptionBanner
            device={attentionDevice}
            lang={lang}
            dark
            onRenew={() => navigate('/client/device/' + attentionDevice.id)}
          />
        </div>
      )}

      {/* Quick actions */}
      <div className="px-5 mt-5">
        <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: 'rgba(255,255,255,0.38)' }}>
          {isAr ? 'إجراءات سريعة' : 'Actions rapides'}
        </p>
        <div className="grid grid-cols-4 gap-2.5">
          <ActionTile icon={Map}      label={isAr ? 'الخريطة'  : 'Carte'}    color="#00D97E" onClick={() => navigate('/client/map')}/>
          <ActionTile icon={Activity} label={isAr ? 'السلوك'   : 'Conduite'} color="#3B82F6" onClick={() => navigate('/client/driver-behavior')}/>
          <ActionTile icon={Shield}   label={isAr ? 'السياج'   : 'Géofence'} color="#FF9500" onClick={() => navigate('/client/geofences')}/>
          <ActionTile icon={Wrench}   label={isAr ? 'الصيانة'  : 'Entretien'}color="#a855f7" onClick={() => navigate('/client/maintenance')}/>
        </div>
      </div>

      {/* Recent devices */}
      <div className="px-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.38)' }}>
            {isAr ? 'آخر الأجهزة' : 'Récents'}
          </p>
          <button onClick={() => navigate('/client/devices')}
            className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#00D97E' }}>
            {t(lang, 'viewAll')}
            <ChevronRight size={13} style={{ transform: isAr ? 'rotate(180deg)' : 'none' }}/>
          </button>
        </div>

        <div className="space-y-2.5">
          {recent.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {isAr ? 'لا توجد أجهزة' : 'Aucun appareil'}
            </p>
          ) : recent.map((d, i) => {
            const st = getDeviceStatusKey(d)
            const c = stColor[st] || '#6b7280'
            return (
              <motion.button key={d.id}
                initial={{ x: isAr ? 20 : -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.07 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/client/device/' + d.id)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: c, minHeight: 36 }}/>
                <VehicleIcon type={d.type} iconSize={18}/>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-white font-semibold text-sm truncate">{d.name}</p>
                  {d.plate && <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>{d.plate}</p>}
                </div>
                {d.speed != null && (
                  <div className="text-right flex-shrink-0">
                    <span className="font-bold text-sm" style={{ color: '#00D97E' }}>{Math.round(d.speed)}</span>
                    <span className="text-xs ml-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>km/h</span>
                  </div>
                )}
                <ChevronRight size={13} style={{ color: 'rgba(255,255,255,0.18)', transform: isAr ? 'rotate(180deg)' : 'none' }}/>
              </motion.button>
            )
          })}
        </div>
      </div>

      <ClientNav/>
    </div>
  )
}
