import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Cpu, Wifi, WifiOff, Bell, TrendingUp, DollarSign, Activity } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'
import MapView from '../../components/MapView'
import { adminStats, revenueData, deviceStatusData } from '../../data/mockData'

function StatCard({ icon: Icon, label, value, sub, color, delay }) {
  const colors = {
    blue: { bg: 'from-primary-500 to-primary-600', icon: 'bg-white/20', text: 'text-white' },
    green: { bg: 'from-emerald-500 to-accent', icon: 'bg-white/20', text: 'text-white' },
    orange: { bg: 'from-orange-400 to-orange-500', icon: 'bg-white/20', text: 'text-white' },
    red: { bg: 'from-red-400 to-red-500', icon: 'bg-white/20', text: 'text-white' },
    purple: { bg: 'from-purple-500 to-purple-600', icon: 'bg-white/20', text: 'text-white' },
    teal: { bg: 'from-teal-500 to-teal-600', icon: 'bg-white/20', text: 'text-white' },
  }
  const c = colors[color] || colors.blue

  return (
    <motion.div
      className={`rounded-2xl p-5 bg-gradient-to-br ${c.bg} shadow-lg`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.08 }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
        {sub && (
          <span className="text-white/70 text-xs font-medium bg-white/10 px-2 py-1 rounded-lg">{sub}</span>
        )}
      </div>
      <p className="text-3xl font-black text-white mb-1">{value}</p>
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
  const online = devices.filter(d => d.status === 'online').length
  const offline = devices.filter(d => d.status !== 'online').length
  const unread = alertsList.filter(a => !a.read).length

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-primary-500">{t(lang, 'adminDashboard')}</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {new Date().toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-xl">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold">
              {lang === 'ar' ? 'النظام يعمل بشكل طبيعي' : 'Système opérationnel'}
            </span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={Users} label={t(lang, 'totalClients')} value={clientList.length} color="blue" delay={0} />
          <StatCard icon={Cpu} label={t(lang, 'totalDevices')} value={devices.length} color="purple" delay={1} />
          <StatCard icon={Wifi} label={t(lang, 'onlineDevices')} value={online} sub="LIVE" color="green" delay={2} />
          <StatCard icon={Bell} label={t(lang, 'todayAlerts')} value={unread} color="orange" delay={3} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Revenue chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-primary-500">{t(lang, 'revenueChart')}</h3>
                <p className="text-2xl font-black text-primary-500 mt-1">
                  {adminStats.monthlyRevenue.toLocaleString()} <span className="text-sm font-normal text-slate-400">{t(lang, 'drh')}</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-xs font-bold px-3 py-1.5 rounded-xl">
                <TrendingUp size={13} />
                +15%
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F2044" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0F2044" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#0F2044" strokeWidth={2} fill="url(#revGrad)" name="revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Device status pie */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-primary-500 mb-4">{t(lang, 'deviceStatus')}</h3>
            <div className="flex justify-center">
              <PieChart width={160} height={160}>
                <Pie data={deviceStatusData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                  {deviceStatusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </div>
            <div className="space-y-2 mt-2">
              {deviceStatusData.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                    <span className="text-xs font-medium text-slate-500">{item.name}</span>
                  </div>
                  <span className="text-xs font-bold text-primary-500">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map + Recent alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Global map */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-primary-500">{t(lang, 'globalMap')}</h3>
              <button
                onClick={() => navigate('/admin/map')}
                className="text-xs text-accent font-semibold"
              >
                {lang === 'ar' ? 'عرض كامل' : 'Vue complète'} →
              </button>
            </div>
            <div style={{ height: 280 }}>
              <MapView showAllDevices zoom={5} height="100%" />
            </div>
          </div>

          {/* Recent alerts */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-primary-500">{t(lang, 'allAlerts')}</h3>
              <button onClick={() => navigate('/admin/alerts')} className="text-xs text-accent font-semibold">
                {lang === 'ar' ? 'الكل' : 'Tout'} →
              </button>
            </div>
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {alertsList.slice(0, 5).map(alert => (
                <div key={alert.id} className="px-4 py-3 flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    alert.severity === 'danger' ? 'bg-red-500' :
                    alert.severity === 'warning' ? 'bg-orange-400' : 'bg-blue-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-primary-500 truncate">{alert.deviceName}</p>
                    <p className="text-[10px] text-slate-400 leading-relaxed truncate">{alert.message}</p>
                  </div>
                  {!alert.read && (
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
