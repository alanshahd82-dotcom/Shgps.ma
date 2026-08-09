import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2, Clock, Navigation, Gauge, ChevronDown, FileText, Car
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import { getSubscriptionSnapshot } from '../../utils/subscriptions'

const RANGES = [
  { key: 'today',   ar: 'اليوم',      fr: "Aujourd'hui" },
  { key: 'week',    ar: 'الأسبوع',    fr: 'Semaine'     },
  { key: 'month',   ar: 'الشهر',      fr: 'Mois'        },
]

function StatCard({ icon: Icon, label, value, unit, color }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl flex flex-col gap-2 bg-white dark:bg-[#112240] border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: color + '1a' }}>
        <Icon size={18} style={{ color }}/>
      </div>
      <div>
        <p className="text-slate-900 dark:text-slate-100 font-extrabold text-xl leading-none">
          {value ?? '—'}<span className="text-xs font-normal ml-1 text-slate-400 dark:text-slate-500">{unit}</span>
        </p>
        <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </motion.div>
  )
}

export default function Reports() {
  const { devices, lang } = useApp()
  const [deviceId, setDeviceId] = useState('')
  const [range, setRange] = useState('today')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDevices, setShowDevices] = useState(false)
  const isAr = lang === 'ar'

  const selectedDevice = devices.find(d => String(d.id) === String(deviceId))

  useEffect(() => {
    if (devices.length && !deviceId) setDeviceId(String(devices[0].id))
  }, [devices])

  async function load() {
    if (!deviceId) return
    setLoading(true); setError('')
    try {
      // Convert range key to ISO from/to dates
      const now = new Date()
      const from = new Date(now)
      if (range === 'today')      { from.setHours(0,0,0,0) }
      else if (range === 'week')  { from.setDate(now.getDate() - 7) }
      else if (range === 'month') { from.setDate(now.getDate() - 30) }
      const res = await api.reports.get(deviceId, from.toISOString(), now.toISOString())
      setData(res)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [deviceId, range])

  const chartData = data?.speedSeries || []
  const trips = data?.trips || []
  const subscriptionSummary = devices.reduce((summary, device) => {
    const status = getSubscriptionSnapshot(device).status
    if (status === 'expired') summary.expired += 1
    if (status === 'expiring_soon') summary.expiringSoon += 1
    return summary
  }, { expired: 0, expiringSoon: 0 })

  return (
    <div className="client-app min-h-screen bg-[#f5f7f8] dark:bg-[#0b1524] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />

      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-primary-500 font-extrabold text-xl mb-4">{t(lang, 'reports')}</h1>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl p-3.5 bg-red-50 border border-red-100">
            <p className="text-2xl font-black text-slate-900">{subscriptionSummary.expired}</p>
            <p className="text-[11px] mt-1 text-slate-500">
              {isAr ? 'اشتراكات منتهية' : 'Abonnements expirés'}
            </p>
          </div>
          <div className="rounded-xl p-3.5 bg-orange-50 border border-orange-100">
            <p className="text-2xl font-black text-slate-900">{subscriptionSummary.expiringSoon}</p>
            <p className="text-[11px] mt-1 text-slate-500">
              {isAr ? 'قريبة الانتهاء' : 'Bientôt expirés'}
            </p>
          </div>
        </div>

        {/* Device picker */}
        <button onClick={() => setShowDevices(s => !s)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl mb-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] shadow-sm">
          <div className="flex items-center gap-2">
             <Car size={15} className="text-primary-500"/>
             <span className="text-slate-800 dark:text-slate-100 text-sm font-bold">
              {selectedDevice?.name || (isAr ? 'اختر جهازاً' : 'Choisir appareil')}
            </span>
          </div>
          <ChevronDown size={15} className="text-slate-400" style={{ transform: showDevices ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
        </button>
        <AnimatePresence>
          {showDevices && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
               className="overflow-hidden rounded-xl mb-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] shadow-sm">
              {devices.map(d => (
                <button key={d.id} onClick={() => { setDeviceId(String(d.id)); setShowDevices(false) }}
                   className="w-full px-4 py-3 text-start flex items-center gap-2 text-sm transition-all"
                   style={{ color: String(d.id) === deviceId ? '#17324d' : '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                   <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: String(d.id) === deviceId ? '#e4b56b' : '#cbd5e1' }}/>
                  {d.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Range tabs */}
        <div className="flex gap-2">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
              style={range === r.key
                 ? { background: '#17324d', color: 'white' }
                 : { background: 'white', color: '#64748b', border: '1px solid #e2e8f0' }}>
              {r[isAr ? 'ar' : 'fr']}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#e4b56b', borderTopColor: 'transparent' }}/>
        </div>
      ) : error ? (
        <div className="mx-5 p-4 rounded-2xl text-center text-sm" style={{ background: 'rgba(255,59,48,0.1)', color: '#ff6b60' }}>{error}</div>
      ) : (
        <div className="px-5 space-y-5">
          {/* Stat grid */}
           <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Navigation} label={isAr ? 'المسافة' : 'Distance'} value={data?.total_km?.toFixed(1)} unit="km" color="#16866d"/>
            <StatCard icon={Clock}      label={isAr ? 'المدة'   : 'Durée'}    value={data?.total_duration_h?.toFixed(1)} unit="h" color="#3B82F6"/>
        <StatCard icon={Gauge}      label={isAr ? 'أقصى سرعة' : 'Vit. max'} value={data?.max_speed} unit="km/h" color="#b64949"/>
        <StatCard icon={BarChart2}  label={isAr ? 'رحلات'  : 'Trajets'}   value={trips.length} unit="" color="#b06b1b"/>
          </div>

          {/* Speed chart */}
          {chartData.length > 0 && (
            <div className="p-4 rounded-xl bg-white dark:bg-[#112240] border border-slate-200 dark:border-slate-700 shadow-sm">
              <p className="text-xs font-bold tracking-wide uppercase mb-4 text-slate-500 dark:text-slate-400">
                {isAr ? 'منحنى السرعة' : 'Courbe de vitesse'}
              </p>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16866d" stopOpacity={0.22}/>
                      <stop offset="95%" stopColor="#16866d" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                  <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ background: '#17324d', border: '1px solid #31516e', borderRadius: 10, color: 'white', fontSize: 12 }}/>
                  <Area type="monotone" dataKey="speed" stroke="#16866d" strokeWidth={2} fill="url(#speedGrad)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Trips table */}
          {trips.length > 0 && (
            <div className="rounded-xl overflow-hidden bg-white dark:bg-[#112240] border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/50">
                <FileText size={14} className="text-primary-500"/>
                <p className="text-xs font-bold tracking-wide uppercase text-slate-500">
                  {isAr ? 'سجل الرحلات' : 'Historique trajets'}
                </p>
              </div>
              {trips.slice(0, 8).map((trip, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3"
                  style={{ borderBottom: i < trips.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: '#e8f5f0' }}>
                    <span className="text-[10px] font-bold text-[#16866d]">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700 text-xs font-semibold">{trip.start_time || trip.start}</p>
                    <p className="text-[10px] text-slate-400">{trip.end_time || trip.end}</p>
                  </div>
                  <div className="text-end">
                    <span className="text-xs font-bold text-[#16866d]">{trip.distance_km?.toFixed(1) || '—'} km</span>
                    <p className="text-[10px] text-slate-400">{trip.max_speed || '—'} km/h</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <ClientNav/>
    </div>
  )
}
