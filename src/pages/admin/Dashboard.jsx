import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Cpu, Wifi, Bell, WifiOff, AlertTriangle } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'
import MapView from '../../components/MapView'

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

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-3 border border-gray-100">
        <p className="text-xs font-bold text-primary-500 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-xs" style={{ color: p.color }}>
            {p.name}: {p.value}{p.name === 'revenue' ? ' DH' : ''}
          </p>
        ))}
      </div>
    )
  }
  return null
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
  const offline = liveStats?.offlineDevices ?? devices.filter(d => d.status !== 'online').length
  const totalDevices  = liveStats?.totalDevices  ?? devices.length
  const totalClients  = liveStats?.totalClients  ?? clientList.length
  const todayAlerts   = liveStats?.todayAlerts   ?? alertsList.filter(a => !a.read).length
  const noSignal      = liveStats?.noSignalDevices ?? 0
  const unread        = alertsList.filter(a => !a.read).length

  const deviceStatusData = [
    { name: lang === 'ar' ? 'متصل' : 'En ligne',    value: online,  color: '#00D97E' },
    { name: lang === 'ar' ? 'غير متصل' : 'Hors ligne', value: offline, color: '#94A3B8' },
  ]

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-primary-500">{t(lang, 'adminDashboard')}</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {new Date().toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', {
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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard icon={Users}        label={t(lang, 'totalClients')}  value={totalClients} color="blue"   delay={0} />
          <StatCard icon={Cpu}          label={t(lang, 'totalDevices')}  value={totalDevices} color="purple" delay={1} />
          <StatCard icon={Wifi}         label={t(lang, 'onlineDevices')} value={online}       color="green"  delay={2} />
          <StatCard icon={WifiOff}      label={t(lang, 'offlineDevices')}value={offline}      color="slate"  delay={3} onClick={() => navigate('/admin/devices')} />
          <StatCard icon={Bell}         label={t(lang, 'todayAlerts')}   value={todayAlerts}  color="orange" delay={4} />
          <StatCard icon={AlertTriangle} label={lang === 'ar' ? 'بدون إشارة > 24س' : 'Sans signal > 24h'} value={noSignal} color="red" delay={5} />
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
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="clientGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#0F2044" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#0F2044" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="devGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00D97E" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#00D97E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="clients" stroke="#0F2044" strokeWidth={2} fill="url(#clientGrad)" name="clients" dot={false} />
                    <Area type="monotone" dataKey="devices" stroke="#00D97E" strokeWidth={2} fill="url(#devGrad)" name="devices" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Device status pie */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-primary-500">{t(lang, 'deviceStatus')}</h3>
            </div>
            <div className="p-4 flex items-center gap-6">
              <PieChart width={140} height={140}>
                <Pie data={deviceStatusData} cx={65} cy={65} innerRadius={40} outerRadius={62}
                  dataKey="value" paddingAngle={3}>
                  {deviceStatusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
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
                    <p className="text-[10px] text-slate-400 leading-relaxed truncate">{alert.message}</p>
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
