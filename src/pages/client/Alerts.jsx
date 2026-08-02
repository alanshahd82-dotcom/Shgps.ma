import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gauge, MapPin, BatteryLow, Zap, Power, Activity, Wifi, WifiOff,
  Moon, AlertTriangle, ShieldAlert, CheckCheck, Bell
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'

const ALERT_CFG = {
  speeding:       { Icon: Gauge,        color: '#FF3B30' },
  geofence_enter: { Icon: MapPin,       color: '#3B82F6' },
  geofence_exit:  { Icon: MapPin,       color: '#FF9500' },
  low_battery:    { Icon: BatteryLow,   color: '#F59E0B' },
  battery_alert:  { Icon: BatteryLow,   color: '#F59E0B' },
  power_cut:      { Icon: Zap,          color: '#a855f7' },
  engine_on:      { Icon: Activity,     color: '#00D97E' },
  engine_off:     { Icon: Activity,     color: '#6b7280' },
  signal_lost:    { Icon: WifiOff,      color: '#FF3B30' },
  signal_back:    { Icon: Wifi,         color: '#00D97E' },
  idle:           { Icon: Moon,         color: '#F59E0B' },
  harsh_brake:    { Icon: AlertTriangle,color: '#FF9500' },
  intrusion:      { Icon: ShieldAlert,  color: '#a855f7' },
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

export default function Alerts() {
  const { alertsList, lang, markAlertRead, markAllRead } = useApp()
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
    <div className="min-h-screen pb-28" dir={isAr ? 'rtl' : 'ltr'}
      style={{ background: 'linear-gradient(160deg,#080f1f 0%,#0F2044 100%)' }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-white font-bold text-xl">{t(lang, 'alerts')}</h1>
          {unread > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ background: '#FF3B30' }}>{unread}</span>
          )}
        </div>
        {unread > 0 && (
          <motion.button whileTap={{ scale: 0.94 }}
            onClick={() => markAllRead && markAllRead()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(0,217,126,0.12)', color: '#00D97E', border: '1px solid rgba(0,217,126,0.25)' }}>
            <CheckCheck size={13}/>
            {isAr ? 'قراءة الكل' : 'Tout lire'}
          </motion.button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-5 pb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map(f => {
          const active = filter === f.key
          return (
            <motion.button key={f.key} whileTap={{ scale: 0.94 }}
              onClick={() => setFilter(f.key)}
              className="flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold transition-all"
              style={active
                ? { background: '#00D97E', color: '#0F2044' }
                : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)', border: '1px solid rgba(255,255,255,0.1)' }
              }>
              {f[lang === 'ar' ? 'ar' : 'fr']}
            </motion.button>
          )
        })}
      </div>

      {/* List */}
      <div className="px-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              <Bell size={26} style={{ color: 'rgba(255,255,255,0.2)' }}/>
            </div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>
              {isAr ? 'لا توجد تنبيهات' : 'Aucune alerte'}
            </p>
          </div>
        ) : (
          filtered.map((alert, i) => {
            const cfg = ALERT_CFG[alert.type] || { Icon: Bell, color: '#6b7280' }
            const Icon = cfg.Icon
            return (
              <motion.div key={alert.id || i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.035, 0.2) }}
                onClick={() => markAlertRead && markAlertRead(alert.id)}
                className="flex items-start gap-3 p-4 rounded-2xl cursor-pointer"
                style={{
                  background: alert.read ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
                  border: '1px solid ' + (alert.read ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.14)'),
                }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.color + '1a' }}>
                  <Icon size={19} style={{ color: cfg.color }}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight"
                      style={{ color: alert.read ? 'rgba(255,255,255,0.6)' : 'white' }}>
                      {alert.device_name || alert.deviceName || '—'}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!alert.read && (
                        <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }}/>
                      )}
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                        {timeAgoShort(alert.created_at || alert.ts)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {alert.message || alert.type}
                  </p>
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      <ClientNav/>
    </div>
  )
}
