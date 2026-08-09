import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gauge, MapPin, BatteryLow, Zap, Power, Activity, Wifi, WifiOff,
  Moon, AlertTriangle, ShieldAlert, CheckCheck, Bell
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'

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
    <div className="client-app min-h-screen bg-[#f5f7f8] dark:bg-[#0b1524] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />

      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-primary-500 font-extrabold text-xl">{t(lang, 'alerts')}</h1>
          {unread > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ background: '#FF3B30' }}>{unread}</span>
          )}
        </div>
        {unread > 0 && (
          <motion.button whileTap={{ scale: 0.94 }}
            onClick={() => markAllAlertsRead && markAllAlertsRead()}
            aria-label={isAr ? 'تعيين كل التنبيهات كمقروءة' : 'Tout marquer comme lu'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: '#e8f5f0', color: '#16866d', border: '1px solid #bfe4d7' }}>
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
              aria-pressed={active}
              className={`flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold transition-all ${
                active
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-[#112240] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}>
              {f[lang === 'ar' ? 'ar' : 'fr']}
            </motion.button>
          )
        })}
      </div>

      {/* List */}
      <div className="px-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-white dark:bg-[#112240] border border-slate-200 dark:border-slate-700">
              <Bell size={26} className="text-slate-300 dark:text-slate-600"/>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
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
                className={`flex items-start gap-3 p-4 rounded-2xl cursor-pointer border ${
                  alert.read
                    ? 'bg-white dark:bg-[#112240] border-slate-200 dark:border-slate-700'
                    : 'bg-[#fffaf0] dark:bg-[#1e2217] border-[#ead8b4] dark:border-[#4a3f1f]'
                }`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.color + '1a' }}>
                  <Icon size={19} style={{ color: cfg.color }}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100">
                      {alert.device_name || alert.deviceName || '—'}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!alert.read && (
                        <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }}/>
                      )}
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {timeAgoShort(alert.created_at || alert.ts)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs mt-0.5 text-slate-500 dark:text-slate-400">
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
