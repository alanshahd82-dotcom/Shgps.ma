import React, { useState, useEffect, useRef } from 'react'
import { localizeAlertMessage } from '../../utils/alertMessage'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Cpu, Wifi, Bell } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'
import MapView from '../../components/MapView'
import NativeAreaChart from '../../components/NativeAreaChart'
import { APP_TZ } from '../../utils/datetime.js'

// Animated count-up hook
function useCountUp(target, duration = 1200) {
  const [count, setCount] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    if (target === 0) { setCount(0); return }
    let start = null
    const animate = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) raf.current = requestAnimationFrame(animate)
    }
    raf.current = requestAnimationFrame(animate)
    return () => raf.current && cancelAnimationFrame(raf.current)
  }, [target, duration])
  return count
}

function StatCard({ icon: Icon, label, value, sub, color, delay, onClick }) {
  const numValue    = typeof value === 'number' ? value : 0
  const countedVal  = useCountUp(numValue)
  const displayValue = typeof value === 'number' ? countedVal : value
  const colors = {
    blue:   'from-primary-500 to-primary-600',
    green:  'from-emerald-500 to-accent',
    orange: 'from-orange-400 to-orange-500',
    red:    'from-red-400 to-red-500',
    purple: 'from-purple-500 to-purple-600',
    teal:   'from-teal-500 to-teal-600',
    slate:  'from-slate-500 to-slate-600',
  }
  return (
    <motion.div
      className={`rounded-2xl p-5 bg-gradient-to-br ${colors[color] || colors.blue} shadow-lg relative overflow-hidden${onClick ? ' cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.08, type: 'spring', damping: 20 }}
      onClick={onClick}
    >
      {/* Ambient glow */}
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/5" />
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
          <Icon size={20} className="text-white" />
        </div>
        {sub && (
          <span className="text-white/70 text-xs font-medium bg-white/10 px-2 py-1 rounded-lg">{sub}</span>
        )}
      </div>
      <p className="text-3xl font-black text-white mb-1 tabular-nums">
        {typeof value === 'number' ? displayValue : value}
      </p>
      <p className="text-white/70 text-xs font-medium">{label}</p>
    </motion.div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { devices, clientList, alertsList, lang } = useApp()
  const [liveStats, setLiveStats]     = useState(null)
  const [loadingStats, setLoading]   = useState(false)
  const [monthlyData, setMonthlyData] = useState([])

  // Fetch live stats from backend
  useEffect(() => {
    setLoading(true)
    api.admin.stats()
      .then(s => setLiveStats(s))
      .catch(() => {})
      .finally(() => setLoading(false))
    api.admin.monthlyStats()
      .then(d => setMonthlyData(d))
      .catch(() => {})
    const id = setInterval(() => {
      api.admin.stats().then(s => setLiveStats(s)).catch(() => {})
    }, 30000)
    return () => clearInterval(id)
  }, [])

  const online  = liveStats?.onlineDevices  ?? devices.filter(d => d.status === 'online').length
  const stale   = liveStats?.staleDevices   ?? 0
  const offline = liveStats?.offlineDevices ?? devices.filter(d => d.status !== 'online').length
  const totalDevices  = liveStats?.totalDevices  ?? devices.length
  const totalClients  = liveStats?.totalClients  ?? clientList.length
  // Single source of truth for the 24h counter: the backend. The list widget
  // below only shows the latest few, so it must not advertise its own total.
  const todayAlerts   = liveStats?.todayAlerts   ?? alertsList.length
  const unread        = alertsList.filter(a => !a.read).length
  const onlineRate    = totalDevices > 0 ? Math.round((online / totalDevices) * 100) : 0

  const deviceStatusData = [
    { name: lang === 'ar' ? 'متصل' : 'En ligne',    value: online,  color: '#1d4ed8' },
    { name: lang === 'ar' ? 'صامت' : 'Silencieux',  value: stale,   color: '#F59E0B' },
    { name: lang === 'ar' ? 'غير متصل' : 'Hors ligne', value: offline, color: '#94A3B8' },
  ]
  const deviceStatusTotal = Math.max(1, online + stale + offline)
  const deviceStatusGradient = `conic-gradient(${deviceStatusData.map((item, index) => {
    const start = deviceStatusData.slice(0, index).reduce((sum, entry) => sum + entry.value, 0) / deviceStatusTotal * 100
    const end = (start + item.value / deviceStatusTotal * 100).toFixed(2)
    return `${item.color} ${start.toFixed(2)}% ${end}%`
  }).join(', ')})`

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-primary-500">{t(lang, 'adminDashboard')}</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {new Date().toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { timeZone: APP_TZ,
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-xl">
            <span className={`w-2 h-2 rounded-full ${loadingStats ? 'bg-yellow-400' : 'bg-emerald-500 animate-pulse'}`} />
            <span className="text-xs font-semibold">
              {loadingStats ? (lang === 'ar' ? 'يُحدَّث...' : 'Mise à jour...') : 'LIVE'}
            </span>
          </div>
        </div>

        {/* Stats grid */}
        {/* 4 cards only: the online/stale/offline split lives in the donut below,
            repeating it here was pure duplication. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={Users} label={t(lang, 'totalClients')} value={totalClients} color="blue" delay={0}
            onClick={() => navigate('/admin/clients')} />
          <StatCard icon={Cpu} label={t(lang, 'totalDevices')} value={totalDevices} color="purple" delay={1}
            onClick={() => navigate('/admin/devices')} />
          <StatCard icon={Wifi} label={t(lang, 'onlineDevices')} value={online} color="green" delay={2}
            sub={`${onlineRate}%`} onClick={() => navigate('/admin/devices')} />
          <StatCard icon={Bell} label={lang === 'ar' ? 'تنبيهات 24 ساعة' : 'Alertes 24h'} value={todayAlerts} color="orange" delay={3}
            sub={unread > 0 ? (lang === 'ar' ? `${unread} غير مقروء` : `${unread} non lues`) : null}
            onClick={() => navigate('/admin/alerts')} />
        </div>

        {/* Charts + map */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Monthly clients + devices chart (real data) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-primary-500">
                {lang === 'ar' ? 'نمو العملاء والأجهزة' : 'Croissance clients & appareils'}
              </h3>
            </div>
            <div className="p-4">
              {monthlyData.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-slate-400 text-xs">
                  {lang === 'ar' ? 'لا توجد بيانات كافية بعد' : 'Pas encore assez de données'}
                </div>
              ) : (
                <NativeAreaChart
                  data={monthlyData}
                  xKey="month"
                  series={[
                    { dataKey: 'clients', color: '#0F2044' },
                    { dataKey: 'devices', color: '#1d4ed8' },
                  ]}
                  height={200}
                />
              )}
            </div>
          </div>

          {/* Device status pie */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-primary-500">{t(lang, 'deviceStatus')}</h3>
            </div>
            <div className="p-4 flex items-center gap-6">
              <div
                className="relative h-[140px] w-[140px] shrink-0 rounded-full"
                style={{ background: deviceStatusGradient }}
                role="img"
                aria-label={lang === 'ar' ? 'نسبة الأجهزة المتصلة وغير المتصلة' : 'Répartition des appareils en ligne et hors ligne'}
              >
                <div className="absolute inset-[22px] rounded-full bg-white" />
              </div>
              <div className="flex-1 space-y-3">
                {deviceStatusData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                      <span className="text-xs text-slate-500 font-medium">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-primary-500 tabular-nums">{item.value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                      {lang === 'ar' ? 'المجموع' : 'Total'}
                    </span>
                    <span className="text-sm font-black text-primary-500">{totalDevices}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Map + recent alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-primary-500">{t(lang, 'globalMap')}</h3>
              <button onClick={() => navigate('/admin/map')}
                className="text-xs text-accent font-semibold hover:underline">
                {lang === 'ar' ? 'عرض كامل' : 'Vue complète'} →
              </button>
            </div>
            <div style={{ height: 280 }}>
              <MapView showAllDevices zoom={5} height="100%" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-primary-500">{t(lang, 'allAlerts')}</h3>
                {unread > 0 && (
                  <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{unread}</span>
                )}
              </div>
              <button onClick={() => navigate('/admin/alerts')} className="text-xs text-accent font-semibold hover:underline">
                {lang === 'ar' ? 'الكل' : 'Tout'} →
              </button>
            </div>
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {alertsList.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-400 text-xs">
                  {lang === 'ar' ? 'لا توجد تنبيهات' : 'Aucune alerte'}
                </div>
              )}
              {alertsList.slice(0, 6).map(alert => (
                <motion.div
                  key={alert.id}
                  className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    alert.type?.includes('speed')    ? 'bg-orange-400' :
                    alert.type?.includes('geofence') ? 'bg-purple-400' :
                    alert.type?.includes('power')    ? 'bg-red-500'    : 'bg-blue-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-primary-500 truncate">{alert.deviceName}</p>
                    <p className="text-[10px] text-slate-400 leading-relaxed truncate">{localizeAlertMessage(alert.message, lang)}</p>
                  </div>
                  {!alert.read && (
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
