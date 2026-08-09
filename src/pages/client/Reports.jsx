import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2, Clock, Navigation, Gauge, Download, ChevronDown,
  Calendar, FileText, Car
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
      className="p-4 rounded-xl flex flex-col gap-2"
      style={{ background: 'rgba(14,32,53,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: color + '1a' }}>
        <Icon size={18} style={{ color }}/>
      </div>
      <div>
        <p className="text-white font-extrabold text-xl leading-none">
          {value ?? '—'}<span className="text-xs font-normal ml-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{unit}</span>
        </p>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</p>
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
    <div className="client-app min-h-screen bg-[#07111f] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />

      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-white font-extrabold text-xl mb-4">{t(lang, 'reports')}</h1>

        {/* Subscription summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl p-3.5" style={{ background: 'rgba(228,107,104,0.1)', border: '1px solid rgba(228,107,104,0.25)' }}>
            <p className="text-2xl font-black text-white">{subscriptionSummary.expired}</p>
            <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {isAr ? 'اشتراكات منتهية' : 'Abonnements expirés'}
            </p>
          </div>
          <div className="rounded-xl p-3.5" style={{ background: 'rgba(217,173,98,0.1)', border: '1px solid rgba(217,173,98,0.25)' }}>
            <p className="text-2xl font-black text-white">{subscriptionSummary.expiringSoon}</p>
            <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {isAr ? 'قريبة الانتهاء' : 'Bientôt expirés'}
            </p>
          </div>
        </div>

        {/* Device picker */}
        <button onClick={() => setShowDevices(s => !s)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl mb-3"
          style={{ background: 'rgba(14,32,53,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <Car size={15} style={{ color: '#38d39f' }}/>
            <span className="text-white text-sm font-bold">
              {selectedDevice?.name || (isAr ? 'اختر جهازاً' : 'Choisir appareil')}
            </span>
          </div>
          <ChevronDown size={15} style={{ color: 'rgba(255,255,255,0.4)', transform: showDevices ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
        </button>
        <AnimatePresence>
          {showDevices && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden rounded-xl mb-3"
              style={{ background: 'rgba(14,32,53,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {devices.map(d => (
                <button key={d.id} onClick={() => { setDeviceId(String(d.id)); setShowDevices(false) }}
                  className="w-full px-4 py-3 text-left flex items-center gap-2 text-sm transition-all"
                  style={{ color: String(d.id) === deviceId ? '#38d39f' : 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: String(d.id) === deviceId ? '#38d39f' : 'rgba(255,255,255,0.2)' }}/>
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
                ? { background: '#38d39f', color: '#07111f' }
                : { background: 'rgba(14,32,53,0.85)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {r[isAr ? 'ar' : 'fr']}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#d9ad62', borderTopColor: 'transparent' }}/>
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
            <div className="p-4 rounded-xl" style={{ background: 'rgba(14,32,53,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs font-bold tracking-wide uppercase mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {isAr ? 'منحنى السرعة' : 'Courbe de vitesse'}
              </p>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38d39f" stopOpacity={0.22}/>
                      <stop offset="95%" stopColor="#38d39f" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
                  <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ background: '#0e2035', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', fontSize: 12 }}/>
                  <Area type="monotone" dataKey="speed" stroke="#38d39f" strokeWidth={2} fill="url(#speedGrad)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Trips table */}
          {trips.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(14,32,53,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <FileText size={14} style={{ color: '#38d39f' }}/>
                <p className="text-xs font-bold tracking-wide uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {isAr ? 'سجل الرحلات' : 'Historique trajets'}
                </p>
              </div>
              {trips.slice(0, 8).map((trip, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3"
                  style={{ borderBottom: i < trips.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(56,211,159,0.1)' }}>
                    <span className="text-[10px] font-bold" style={{ color: '#38d39f' }}>{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold">{trip.start_time || trip.start}</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{trip.end_time || trip.end}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold" style={{ color: '#38d39f' }}>{trip.distance_km?.toFixed(1) || '—'} km</span>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{trip.max_speed || '—'} km/h</p>
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
