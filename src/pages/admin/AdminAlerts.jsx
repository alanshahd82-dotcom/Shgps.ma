import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, Zap, MapPin, Battery, AlertTriangle, CheckCheck, Filter } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'

const alertIcons = {
  speed: { icon: Zap, color: 'text-orange-500', bg: 'bg-orange-100' },
  geofence: { icon: MapPin, color: 'text-red-500', bg: 'bg-red-100' },
  battery: { icon: Battery, color: 'text-yellow-500', bg: 'bg-yellow-100' },
  power: { icon: Zap, color: 'text-red-600', bg: 'bg-red-100' },
  engine: { icon: AlertTriangle, color: 'text-purple-500', bg: 'bg-purple-100' },
}

const severityColors = {
  danger: 'border-red-400 bg-red-50',
  warning: 'border-orange-400 bg-orange-50',
  info: 'border-blue-400 bg-blue-50',
}

function timeAgo(iso, lang) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return t(lang, 'just_now')
  if (diff < 60) return `${diff} ${t(lang, 'minutes')} ${t(lang, 'ago')}`
  if (diff < 1440) return `${Math.floor(diff / 60)} ${t(lang, 'hours')} ${t(lang, 'ago')}`
  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA')
}

export default function AdminAlerts() {
  const { alertsList, clientList, markAlertRead, markAllAlertsRead, lang } = useApp()
  const [filter, setFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const filtered = alertsList.filter(a => {
    const matchRead = filter === 'all' || (filter === 'unread' && !a.read) || (filter === 'read' && a.read)
    const matchType = typeFilter === 'all' || a.type === typeFilter
    return matchRead && matchType
  })

  const unread = alertsList.filter(a => !a.read).length
  const getClient = (clientId) => clientList.find(c => c.id === clientId)

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-primary-500">{t(lang, 'allAlerts')}</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {unread} {lang === 'ar' ? 'تنبيه غير مقروء' : 'non lus'} · {alertsList.length} {lang === 'ar' ? 'إجمالاً' : 'au total'}
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={markAllAlertsRead}
              className="flex items-center gap-2 bg-primary-50 text-primary-500 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-primary-100 transition-colors"
            >
              <CheckCheck size={16} />
              {t(lang, 'markAllRead')}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            { val: 'all', label: lang === 'ar' ? 'الكل' : 'Tous' },
            { val: 'unread', label: lang === 'ar' ? 'غير مقروء' : 'Non lus' },
            { val: 'read', label: lang === 'ar' ? 'مقروء' : 'Lus' },
          ].map(f => (
            <button
              key={f.val}
              onClick={() => setFilter(f.val)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                filter === f.val
                  ? 'bg-primary-500 text-white shadow-md shadow-primary-200'
                  : 'bg-white border border-gray-200 text-slate-500 hover:bg-gray-50'
              }`}
            >
              {f.label}
              {f.val === 'unread' && unread > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>
              )}
            </button>
          ))}

          <div className="h-8 w-px bg-gray-200 self-center mx-1" />

          {[
            { val: 'all', label: lang === 'ar' ? 'نوع الكل' : 'Tout type' },
            { val: 'speed', label: lang === 'ar' ? 'سرعة' : 'Vitesse' },
            { val: 'geofence', label: 'Géofence' },
            { val: 'battery', label: lang === 'ar' ? 'بطارية' : 'Batterie' },
            { val: 'power', label: lang === 'ar' ? 'طاقة' : 'Alimentation' },
          ].map(f => (
            <button
              key={f.val}
              onClick={() => setTypeFilter(f.val)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                typeFilter === f.val
                  ? 'bg-slate-700 text-white'
                  : 'bg-white border border-gray-200 text-slate-500 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Alerts */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 text-slate-400">
              <Bell size={36} className="mb-2 opacity-30" />
              <p className="text-sm">{t(lang, 'noAlerts')}</p>
            </div>
          ) : (
            filtered.map((alert, i) => {
              const cfg = alertIcons[alert.type] || alertIcons.speed
              const Icon = cfg.icon
              const client = getClient(alert.clientId)
              return (
                <motion.div
                  key={alert.id}
                  className={`bg-white rounded-2xl border-l-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${
                    !alert.read ? severityColors[alert.severity] || 'border-gray-300' : 'border-gray-200'
                  }`}
                  onClick={() => markAlertRead(alert.id)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className="p-4 flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                      <Icon size={20} className={cfg.color} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div>
                          <p className="font-bold text-primary-500 text-sm">{alert.deviceName}</p>
                          {client && (
                            <p className="text-xs text-slate-400">{client.name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!alert.read && (
                            <span className="w-2 h-2 bg-red-500 rounded-full mt-1" />
                          )}
                          <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                            alert.severity === 'danger' ? 'bg-red-100 text-red-600' :
                            alert.severity === 'warning' ? 'bg-orange-100 text-orange-600' :
                            'bg-blue-100 text-blue-600'
                          }`}>
                            {alert.severity}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed mb-2">{alert.message}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-400">{timeAgo(alert.timestamp, lang)}</p>
                        {alert.read && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <CheckCheck size={10} />
                            {lang === 'ar' ? 'مقروء' : 'Lu'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
