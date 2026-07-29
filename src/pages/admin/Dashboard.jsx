import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Cpu, Wifi, Bell, TrendingUp, Activity, Clock, AlertTriangle } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import AdminLayout from './AdminLayout'

function StatCard({ icon: Icon, label, value, sub, color, delay }) {
  const colors = {
    blue:   { bg: 'from-blue-600 to-primary-500' },
    green:  { bg: 'from-emerald-500 to-teal-600' },
    orange: { bg: 'from-orange-400 to-orange-500' },
    red:    { bg: 'from-red-400 to-red-500' },
    purple: { bg: 'from-purple-500 to-purple-600' },
    teal:   { bg: 'from-teal-500 to-teal-600' },
  }
  const c = colors[color] || colors.blue
  return (
    <motion.div className={`rounded-2xl p-5 bg-gradient-to-br ${c.bg} shadow-lg`}
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay * 0.08 }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
          <Icon size={20} className="text-white" />
        </div>
        {sub && <span className="text-white/70 text-xs font-medium bg-white/10 px-2 py-1 rounded-lg">{sub}</span>}
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
  const [stats,   setStats]   = useState(null)
  const [revenue, setRevenue] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.admin.stats(), api.admin.revenue()])
      .then(([s, r]) => { setStats(s); setRevenue(r) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const online  = devices.filter(d => d.status === 'online').length
  const offline = devices.filter(d => d.status !== 'online').length

  const deviceStatusData = [
    { name: lang === 'ar' ? 'متصل' : 'En ligne',    value: online,  color: '#1DBF73' },
    { name: lang === 'ar' ? 'غير متصل' : 'Hors ligne', value: offline, color: '#94A3B8' },
  ]

  const s = stats || {}

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-primary-500">{t(lang, 'adminDashboard')}</h1>
            <p className="text-slate-400 text-sm mt-0.5">Athar GPS</p>
          </div>
          {(s.expiringIn7Days > 0 || s.unactivatedDevices > 0) && (
            <div className="flex gap-2">
              {s.expiringIn7Days > 0 && (
                <button onClick={() => navigate('/admin/subscriptions?status=expiring')}
                  className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-xs font-semibold text-orange-600">
                  <Clock size={12} />
                  {s.expiringIn7Days} {t(lang, 'expiringIn7Days')}
                </button>
              )}
              {s.unactivatedDevices > 0 && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs font-semibold text-red-600">
                  <AlertTriangle size={12} />
                  {s.unactivatedDevices} {t(lang, 'unactivatedDevices')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={Users}      label={t(lang, 'totalClients')}  value={s.totalClients      ?? clientList.length} color="blue"   delay={0} />
          <StatCard icon={Cpu}        label={t(lang, 'totalDevices')}  value={s.totalDevices      ?? devices.length}    color="purple" delay={1} />
          <StatCard icon={Wifi}       label={t(lang, 'onlineDevices')} value={s.onlineDevices     ?? online}            color="green"  delay={2} sub="live" />
          <StatCard icon={Bell}       label={t(lang, 'todayAlerts')}   value={s.todayAlerts       ?? alertsList.length} color="orange" delay={3} />
          <StatCard icon={TrendingUp} label={t(lang, 'monthlyRevenue')} value={`${s.monthlyRevenue ?? 0} DH`}           color="teal"   delay={4} />
          <StatCard icon={Activity}   label={t(lang, 'offlineDevices')} value={s.offlineDevices   ?? offline}           color="red"    delay={5} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Revenue chart */}
          <div className="md:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-primary-500 mb-4">{t(lang, 'monthlyRevenue')}</h3>
            {revenue.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
                {loading ? t(lang, 'loading') : (lang === 'ar' ? 'لا توجد بيانات إيرادات بعد' : 'Aucune donnée de revenus')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={revenue}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#1DBF73" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1DBF73" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="revenue" stroke="#1DBF73" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Device status pie */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-primary-500 mb-4">{t(lang, 'devices')}</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={deviceStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value">
                  {deviceStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {deviceStatusData.map((d, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-xs text-gray-500">{d.name}</span>
                  </div>
                  <span className="text-xs font-bold text-primary-500">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
