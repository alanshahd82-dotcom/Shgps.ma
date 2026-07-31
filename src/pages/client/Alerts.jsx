import React from 'react'
import { motion } from 'framer-motion'
import { Bell, AlertTriangle, Zap, MapPin, Battery, CheckCheck } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'

const alertIcons = {
  speed: { icon: Zap, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' },
  geofence: { icon: MapPin, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' },
  battery: { icon: Battery, color: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-100' },
  power: { icon: Zap, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' },
  engine: { icon: AlertTriangle, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100' },
}

function timeAgo(iso, lang) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return t(lang, 'just_now')
  if (diff < 60) return `${diff} ${t(lang, 'minutes')} ${t(lang, 'ago')}`
  if (diff < 1440) return `${Math.floor(diff / 60)} ${t(lang, 'hours')} ${t(lang, 'ago')}`
  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA')
}

export default function Alerts() {
  const { alertsList, clientAuth, markAlertRead, markAllAlertsRead, lang } = useApp()
  // Show all alerts for the current user (was hardcoded to 'c1' which caused empty list for real users)
  const myAlerts = clientAuth
    ? alertsList.filter(a => !a.clientId || String(a.clientId) === String(clientAuth.id) || a.userId === clientAuth.id)
    : alertsList
  const unread = myAlerts.filter(a => !a.read).length

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div
          className="flex-shrink-0 pt-14 pb-5 px-5"
          style={{ background: 'linear-gradient(160deg, #0F2044 0%, #162d5e 100%)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white font-bold text-xl">{t(lang, 'alertsTitle')}</h1>
              {unread > 0 && (
                <p className="text-white/50 text-xs mt-0.5">
                  {unread} {lang === 'ar' ? 'تنبيه غير مقروء' : 'non lus'}
                </p>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={markAllAlertsRead}
                className="flex items-center gap-1.5 bg-white/10 text-white/80 text-xs font-semibold px-3 py-2 rounded-xl"
              >
                <CheckCheck size={13} />
                {t(lang, 'markAllRead')}
              </button>
            )}
          </div>
        </div>

        {/* Alerts list */}
        <div className="flex-1 overflow-y-auto mobile-scroll pb-24 pt-3 px-4 space-y-2">
          {myAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Bell size={36} className="mb-2 opacity-30" />
              <p className="text-sm">{t(lang, 'noAlerts')}</p>
            </div>
          ) : (
            myAlerts.map((alert, i) => {
              const cfg = alertIcons[alert.type] || alertIcons.speed
              const Icon = cfg.icon
              return (
                <motion.div
                  key={alert.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border cursor-pointer transition-all ${
                    !alert.read ? `${cfg.border} border-l-4` : 'border-gray-100'
                  }`}
                  onClick={() => markAlertRead(alert.id)}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${cfg.bg}`}>
                      <Icon size={18} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-bold text-primary-500 leading-tight">{alert.deviceName}</p>
                        {!alert.read && (
                          <span className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{alert.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1.5">{timeAgo(alert.timestamp, lang)}</p>
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>

        <ClientNav />
      </div>
    </div>
  )
}
