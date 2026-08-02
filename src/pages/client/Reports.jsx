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

const RANGES = [
  { key: 'today',   ar: 'اليوم',      fr: "Aujourd'hui" },
  { key: 'week',    ar: 'الأسبوع',    fr: 'Semaine'     },
  { key: 'month',   ar: 'الشهر',      fr: 'Mois'        },
]

function StatCard({ icon: Icon, label, value, unit, color }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl flex flex-col gap-2"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: color + '1a' }}>
        <Icon size={18} style={{ color }}/>
      </div>
      <div>
        <p className="text-white font-bold text-xl leading-none">
          {value ?? '—'}<span className="text-xs font-normal ml-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{unit}</span>
        </p>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>{label}</p>
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
      const res = await api.reports.get(deviceId, range)
      setData(res)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [deviceId, range])

  const chartData = data?.speedSeries || []
  const trips = data?.trips || []

  return (
    <div className="min-h-screen pb-28" dir={isAr ? 'rtl' : 'ltr'}
      style={{ background: 'linear-gradient(160deg,#080f1f 0%,#0F2044 100%)' }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-white font-bold text-xl mb-4">{t(lang, 'reports')}</h1>

        {/* Device picker */}
        <button onClick={() => setShowDevices(s => !s)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl mb-3"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2">
            <Car size={15} style={{ color: '#00D97E' }}/>
            <span className="text-white text-sm font-medium">
              {selectedDevice?.name || (isAr ? 'اختر جهازاً' : 'Choisir appareil')}
            </span>
          </div>
          <ChevronDown size={15} style={{ color: 'rgba(255,255,255,0.4)', transform: showDevices ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
        </button>
        <AnimatePresence>
          {showDevices && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden rounded-xl mb-3"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {devices.map(d => (
                <button key={d.id} onClick={() => { setDeviceId(String(d.id)); setShowDevices(false) }}
                  className="w-full px-4 py-3 text-left flex items-center gap-2 text-sm transition-all"
                  style={{ color: String(d.id) === deviceId ? '#00D97E' : 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: String(d.id) === deviceId ? '#00D97E' : 'rgba(255,255,255,0.2)' }}/>
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
                ? { background: '#00D97E', color: '#0F2044' }
                : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {r[isAr ? 'ar' : 'fr']}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#00D97E', borderTopColor: 'transparent' }}/>
        </div>
      ) : error ? (
        <div className="mx-5 p-4 rounded-2xl text-center text-sm" style={{ background: 'rgba(255,59,48,0.1)', color: '#ff6b60' }}>{error}</div>
      ) : (
        <div className="px-5 space-y-5">
          {/* Stat grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Navigation} label={isAr ? 'المسافة' : 'Distance'} value={data?.total_km?.toFixed(1)} unit="km" color="#00D97E"/>
            <StatCard icon={Clock}      label={isAr ? 'المدة'   : 'Durée'}    value={data?.total_duration_h?.toFixed(1)} unit="h" color="#3B82F6"/>
            <StatCard icon={Gauge}      label={isAr ? 'أقصى سرعة' : 'Vit. max'} value={data?.max_speed} unit="km/h" color="#FF3B30"/>
            <StatCard icon={BarChart2}  label={isAr ? 'رحلات'  : 'Trajets'}   value={trips.length} unit="" color="#FF9500"/>
          </div>

          {/* Speed chart */}
          {chartData.length > 0 && (
            <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'rgba(255,255,255,0.38)' }}>
                {isAr ? 'منحنى السرعة' : 'Courbe de vitesse'}
              </p>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D97E" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00D97E" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
                  <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ background: '#0F2044', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, color: 'white', fontSize: 12 }}/>
                  <Area type="monotone" dataKey="speed" stroke="#00D97E" strokeWidth={2} fill="url(#speedGrad)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Trips table */}
          {trips.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <FileText size={14} style={{ color: '#00D97E' }}/>
                <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  {isAr ? 'سجل الرحلات' : 'Historique trajets'}
                </p>
              </div>
              {trips.slice(0, 8).map((trip, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3"
                  style={{ borderBottom: i < trips.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(0,217,126,0.12)' }}>
                    <span className="text-[10px] font-bold" style={{ color: '#00D97E' }}>{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium">{trip.start_time || trip.start}</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{trip.end_time || trip.end}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold" style={{ color: '#00D97E' }}>{trip.distance_km?.toFixed(1) || '—'} km</span>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{trip.max_speed || '—'} km/h</p>
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
