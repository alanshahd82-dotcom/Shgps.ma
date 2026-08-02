import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gauge, MapPin, BatteryLow, Zap, Power, Activity, Wifi, WifiOff,
  Moon, AlertTriangle, ShieldAlert, CheckCheck, Bell, ChevronRight
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'
import { Card, EmptyState, Section, SectionTitle, PageHeader } from '../../components/ui'

// ── Alert type config ─────────────────────────────────────────────────────────
const ALERT_CFG = {
  speeding:           { Icon: Gauge,       r: 239, g: 68,  b: 68  },
  geofence_enter:     { Icon: MapPin,      r: 59,  g: 130, b: 246 },
  geofence_exit:      { Icon: MapPin,      r: 249, g: 115, b: 22  },
  low_battery:        { Icon: BatteryLow,  r: 245, g: 158, b: 11  },
  battery_alert:      { Icon: BatteryLow,  r: 245, g: 158, b: 11  },
  power_cut:          { Icon: Zap,         r: 168, g: 85,  b: 247 },
  engine_on:          { Icon: Activity,    r: 34,  g: 197, b: 94  },
  engine_off:         { Icon: Activity,    r: 148, g: 163, b: 184 },
  engine_alert:       { Icon: Power,       r: 34,  g: 197, b: 94  },
  long_stop:          { Icon: Moon,        r: 100, g: 116, b: 139 },
  device_offline:     { Icon: WifiOff,     r: 148, g: 163, b: 184 },
  unusual_movement:   { Icon: ShieldAlert, r: 239, g: 68,  b: 68  },
  speed_alert:        { Icon: Gauge,       r: 239, g: 68,  b: 68  },
  geofence_alert:     { Icon: MapPin,      r: 59,  g: 130, b: 246 },
}

function alertCfg(type) {
  return ALERT_CFG[type] || { Icon: AlertTriangle, r: 100, g: 116, b: 139 }
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'all',      ar: 'الكل',        fr: 'Tous'        },
  { key: 'unread',   ar: 'غير مقروءة',  fr: 'Non lus'     },
  { key: 'speed',    ar: 'سرعة',        fr: 'Vitesse'     },
  { key: 'geofence', ar: 'منطقة',       fr: 'Zone'        },
  { key: 'engine',   ar: 'محرك',        fr: 'Moteur'      },
  { key: 'battery',  ar: 'بطارية',      fr: 'Batterie'    },
]

function matchFilter(alert, filter) {
  if (filter === 'all')      return true
  if (filter === 'unread')   return !alert.read
  if (filter === 'speed')    return ['speeding', 'speed_alert'].includes(alert.type)
  if (filter === 'geofence') return ['geofence_enter', 'geofence_exit', 'geofence_alert'].includes(alert.type)
  if (filter === 'engine')   return ['engine_on', 'engine_off', 'engine_alert', 'power_cut'].includes(alert.type)
  if (filter === 'battery')  return ['low_battery', 'battery_alert'].includes(alert.type)
  return true
}

// ── Single alert row ──────────────────────────────────────────────────────────
function AlertRow({ alert, lang, onRead, index }) {
  const { Icon, r, g, b } = alertCfg(alert.type)
  const isAr  = lang === 'ar'
  const time  = alert.time || alert.createdAt
    ? new Date(alert.time || alert.createdAt).toLocaleString(isAr ? 'ar-MA' : 'fr-MA', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      })
    : '—'

  const labelKey = alert.type
  const label = t(lang, labelKey) || alert.type

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.2) }}
      className={`flex items-start gap-3 p-4 rounded-2xl border transition-colors ${
        alert.read
          ? 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700'
          : 'bg-white dark:bg-slate-800 border-l-4 border-gray-100 dark:border-slate-700'
      }`}
      style={!alert.read ? { borderLeftColor: `rgb(${r},${g},${b})` } : {}}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center"
        style={{ background: `rgba(${r},${g},${b},0.12)` }}
      >
        <Icon size={18} style={{ color: `rgb(${r},${g},${b})` }} strokeWidth={1.8} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0" onClick={!alert.read ? onRead : undefined}
        style={!alert.read ? { cursor: 'pointer' } : {}}>
        <div className="flex items-center gap-2">
          <p className="font-semibold text-primary-500 dark:text-white text-sm truncate flex-1">
            {label}
          </p>
          {!alert.read && (
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: `rgb(${r},${g},${b})` }} />
          )}
        </div>
        {alert.deviceName && (
          <p className="text-xs text-accent font-medium mt-0.5">{alert.deviceName}</p>
        )}
        {alert.message && alert.message !== alert.type && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{alert.message}</p>
        )}
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{time}</p>
      </div>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Alerts() {
  const { alertsList, markAlertRead, markAllAlertsRead, lang, unreadCount } = useApp()
  const isAr = lang === 'ar'

  const [filter,    setFilter]    = useState('all')
  const [readingAll, setReadingAll] = useState(false)
  const [toast,     setToast]     = useState('')

  const filteredAlerts = useMemo(() =>
    alertsList.filter(a => matchFilter(a, filter)),
    [alertsList, filter]
  )

  const filterCounts = useMemo(() => ({
    all:      alertsList.length,
    unread:   alertsList.filter(a => !a.read).length,
    speed:    alertsList.filter(a => matchFilter(a, 'speed')).length,
    geofence: alertsList.filter(a => matchFilter(a, 'geofence')).length,
    engine:   alertsList.filter(a => matchFilter(a, 'engine')).length,
    battery:  alertsList.filter(a => matchFilter(a, 'battery')).length,
  }), [alertsList])

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || readingAll) return
    setReadingAll(true)
    try {
      await markAllAlertsRead()
      setToast(isAr ? 'تم تحديد الكل كمقروء' : 'Tous marqués comme lus')
      setTimeout(() => setToast(''), 2500)
    } catch { /* ignore */ }
    finally { setReadingAll(false) }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50 dark:bg-slate-900">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <PageHeader>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-xl">{t(lang, 'alertsTitle')}</h1>
            <p className="text-white/50 text-xs mt-0.5">
              {unreadCount > 0
                ? `${unreadCount} ${isAr ? 'غير مقروءة' : 'non lus'}`
                : (isAr ? 'جميعها مقروءة' : 'Tout est lu')}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={readingAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-white/90 disabled:opacity-50 transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              <CheckCheck size={13} />
              {t(lang, 'markAllRead')}
            </button>
          )}
        </div>
      </PageHeader>

      {/* ── Filter tabs ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-900 px-4 pt-3 pb-2 border-b border-gray-100 dark:border-slate-800">
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map(f => {
            const active = filter === f.key
            const cnt    = filterCounts[f.key]
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold flex-shrink-0 transition-all"
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

      {/* ── List ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-3 space-y-2.5">
        <AnimatePresence mode="popLayout">
          {filteredAlerts.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Bell}
                title={isAr ? 'لا توجد تنبيهات' : 'Aucune alerte'}
                subtitle={isAr ? 'ستظهر هنا تنبيهات المركبات فور وصولها' : 'Les alertes apparaîtront ici'}
              />
            </motion.div>
          ) : (
            filteredAlerts.map((alert, i) => (
              <AlertRow
                key={alert.id ?? i}
                alert={alert}
                lang={lang}
                index={i}
                onRead={() => !alert.read && markAlertRead(alert.id)}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* ── Toast ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 inset-x-4 bg-primary-500 text-white rounded-2xl px-4 py-3 text-center text-sm font-semibold shadow-xl z-50"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <ClientNav />
    </div>
  )
}
