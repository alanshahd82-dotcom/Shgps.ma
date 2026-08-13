import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Gauge, MapPin, BatteryLow, Zap, Activity, Wifi, WifiOff,
  Moon, AlertTriangle, ShieldAlert, CheckCheck, Bell
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'

const ALERT_CFG = {
  speeding:       { Icon: Gauge,         color: 'var(--ath-red)',   tone: 'danger' },
  geofence_enter: { Icon: MapPin,        color: '#55A7FF',          tone: 'ok' },
  geofence_exit:  { Icon: MapPin,        color: 'var(--ath-amber)', tone: 'warning' },
  low_battery:    { Icon: BatteryLow,   color: 'var(--ath-amber)', tone: 'warning' },
  battery_alert:  { Icon: BatteryLow,   color: 'var(--ath-amber)', tone: 'warning' },
  power_cut:      { Icon: Zap,          color: 'var(--ath-red)',   tone: 'danger' },
  engine_on:      { Icon: Activity,     color: 'var(--ath-green)', tone: 'ok' },
  engine_off:     { Icon: Activity,     color: 'var(--ath-amber)', tone: 'warning' },
  signal_lost:    { Icon: WifiOff,      color: 'var(--ath-red)',   tone: 'danger' },
  signal_back:    { Icon: Wifi,         color: 'var(--ath-green)', tone: 'ok' },
  idle:           { Icon: Moon,         color: 'var(--ath-amber)', tone: 'warning' },
  harsh_brake:    { Icon: AlertTriangle,color: 'var(--ath-amber)', tone: 'warning' },
  intrusion:      { Icon: ShieldAlert,  color: 'var(--ath-red)',   tone: 'danger' },
}

const FILTERS = [
  { key: 'all',     ar: 'الكل',    fr: 'Tous'     },
  { key: 'unread',  ar: 'غير مقروء', fr: 'Non lu' },
  { key: 'speeding',ar: 'سرعة',   fr: 'Vitesse'   },
  { key: 'geofence_enter', ar: 'دخول سياج', fr: 'Entrée zone' },
  { key: 'geofence_exit',  ar: 'خروج سياج', fr: 'Sortie zone' },
  { key: 'battery_alert',  ar: 'بطارية',   fr: 'Batterie'    },
]

function timeAgoShort(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return '< 1m'
  if (m < 60) return m + 'm'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'h'
  return Math.floor(h / 24) + 'j'
}

function alertCount(alerts, key) {
  if (key === 'all') return alerts?.length || 0
  if (key === 'unread') return alerts?.filter(alert => !alert.read).length || 0
  return alerts?.filter(alert => alert.type === key).length || 0
}

export default function Alerts() {
  const { alertsList, lang, markAlertRead, markAllAlertsRead } = useApp()
  const [filter, setFilter] = useState('all')
  const isAr = lang === 'ar'

  const filtered = useMemo(() => {
    if (!alertsList) return []
    if (filter === 'unread') return alertsList.filter(a => !a.read)
    if (filter !== 'all') return alertsList.filter(a => a.type === filter)
    return alertsList
  }, [alertsList, filter])

  const unread = useMemo(() => alertsList?.filter(a => !a.read).length || 0, [alertsList])

  return (
      <div className="client-app min-h-screen bg-[#07111f] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--ath-green)' }}>
            {isAr ? 'مركز الأمان' : 'Centre de sécurité'}
          </p>
          <h1 className="text-white font-extrabold text-xl mt-1">
            {isAr ? `التنبيهات (${unread} جديد)` : `Alertes (${unread} nouvelles)`}
          </h1>
        </div>
        {unread > 0 && (
          <motion.button whileTap={{ scale: 0.94 }}
            onClick={() => markAllAlertsRead && markAllAlertsRead()}
            className="ath-btn-g flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap"
            style={{ padding: '9px 12px' }}>
            <CheckCheck size={13}/>
            {isAr ? 'تعليم الكل كمقروء' : 'Tout marquer lu'}
          </motion.button>
        )}
      </div>

      {/* Filter chips */}
      <div className="relative mb-4" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
        <div className="flex gap-2 px-5 overflow-x-auto" style={{ scrollbarWidth: 'none', paddingInline: 20, scrollPaddingInline: 20 }}>
          {FILTERS.map(f => {
            const active = filter === f.key
            return (
              <motion.button key={f.key} whileTap={{ scale: 0.94 }}
                onClick={() => setFilter(f.key)}
                className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  paddingInline: 13,
                  paddingBlock: 9,
                  background: active ? 'var(--ath-green)' : 'var(--ath-card)',
                  color: active ? '#04120B' : 'var(--ath-mut)',
                  border: active ? '1px solid var(--ath-green)' : '1px solid var(--ath-line)',
                }}>
                {f[lang === 'ar' ? 'ar' : 'fr']}
                <span style={{
                  minWidth: 18, height: 18, paddingInline: 5, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', borderRadius: 99,
                  background: active ? 'rgba(4,18,11,.16)' : 'rgba(148,180,215,.10)',
                  fontSize: 10,
                }}>{alertCount(alertsList, f.key)}</span>
              </motion.button>
            )
          })}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-7"
          style={{
            [isAr ? 'left' : 'right']: 0,
            background: isAr
              ? 'linear-gradient(to right, var(--ath-bg), transparent)'
              : 'linear-gradient(to left, var(--ath-bg), transparent)',
          }}/>
      </div>

      {/* List */}
      <div className="px-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="ath-card flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(0,217,126,.10)', border: '1px solid rgba(0,217,126,.18)' }}>
              <Bell size={27} style={{ color: 'var(--ath-green)' }}/>
            </div>
            <p className="text-sm font-bold" style={{ color: 'var(--ath-txt)' }}>
              {isAr ? '🔔 لا توجد تنبيهات حالياً' : '🔔 Aucune alerte pour le moment'}
            </p>
            <p className="text-xs" style={{ color: 'var(--ath-mut)' }}>
              {isAr ? 'سنخبرك هنا بأي نشاط مهم في مركباتك' : 'Nous vous informerons ici de toute activité importante.'}
            </p>
          </div>
        ) : (
          filtered.map((alert, i) => {
              const cfg = ALERT_CFG[alert.type] || { Icon: Bell, color: 'var(--ath-green)', tone: 'ok' }
            const Icon = cfg.Icon
              const title = alert.title || alert.device_name || alert.deviceName || (isAr ? 'تنبيه جديد' : 'Nouvelle alerte')
              const body = alert.message || alert.description || alert.type
            return (
              <motion.div key={alert.id || i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.035, 0.2) }}
                onClick={() => markAlertRead && markAlertRead(alert.id)}
                  className="ath-card relative flex items-start gap-3 cursor-pointer"
                style={{
                   padding: 14,
                   borderColor: alert.read ? 'var(--ath-line)' : 'rgba(0,217,126,.34)',
                   boxShadow: alert.read ? undefined : '0 8px 28px rgba(0,217,126,.08)',
                }}>
                 <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: cfg.tone === 'danger' ? 'rgba(255,90,95,.14)' : cfg.tone === 'warning' ? 'rgba(255,176,32,.14)' : 'rgba(0,217,126,.12)' }}>
                  <Icon size={19} style={{ color: cfg.color }}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                     <p className="text-sm font-extrabold leading-tight"
                       style={{ color: alert.read ? 'var(--ath-mut)' : 'var(--ath-txt)' }}>
                       {title}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                       <span className="text-[10px] font-semibold" style={{ color: 'var(--ath-mut)' }}>
                        {timeAgoShort(alert.created_at || alert.ts)}
                      </span>
                    </div>
                  </div>
                   <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ath-mut)' }}>
                     {body}
                  </p>
                </div>
                 {!alert.read && (
                   <span aria-label={isAr ? 'غير مقروء' : 'Non lu'} className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                     style={{ [isAr ? 'left' : 'right']: 8, background: 'var(--ath-green)', boxShadow: '0 0 0 4px rgba(0,217,126,.12)' }}/>
                 )}
              </motion.div>
            )
          })
        )}
      </div>

      <ClientNav/>
    </div>
  )
}
