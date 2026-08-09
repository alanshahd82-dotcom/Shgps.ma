import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ChevronDown, Car, BarChart2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import { VehicleIcon, getDeviceStatusKey } from '../../components/ui'

const PERIODS = [
  { key: 7,  ar: '7 أيام',  fr: '7 jours'  },
  { key: 14, ar: '14 يوم',  fr: '14 jours' },
  { key: 30, ar: '30 يوم',  fr: '30 jours' },
]

function ScoreRing({ score, size = 148 }) {
  const R    = (size - 18) / 2
  const circ = 2 * Math.PI * R
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? '#16866d' : score >= 60 ? '#b06b1b' : '#b64949'
  const label = score >= 80 ? (score >= 90 ? '🏆 ممتاز' : '✅ جيد جداً') : score >= 60 ? '⚠️ مقبول' : '❌ ضعيف'
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={"0 0 " + size + " " + size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round"/>
          <circle cx={size/2} cy={size/2} r={R} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-black leading-none" style={{ fontSize: 38, color }}>{score}</span>
          <span className="text-xs mt-1 text-slate-400">/100</span>
        </div>
      </div>
      <p className="text-xs mt-2 font-semibold" style={{ color }}>{label}</p>
    </div>
  )
}

export default function DriverBehavior() {
  const { devices, lang } = useApp()
  const [deviceId, setDeviceId] = useState('')
  const [period, setPeriod] = useState(7)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDevices, setShowDevices] = useState(false)
  const isAr = lang === 'ar'

  const selectedDevice = devices.find(d => String(d.id) === String(deviceId))

  useEffect(() => {
    if (devices.length && !deviceId) setDeviceId(String(devices[0].id))
  }, [devices])

  const load = useCallback(async () => {
    if (!deviceId) return
    setLoading(true); setError('')
    try {
      const [scores, summary] = await Promise.all([
        api.driverBehavior.getScores(deviceId, period),
        api.driverBehavior.getSummary(deviceId, period),
      ])
      setData({ scores, summary })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [deviceId, period])

  useEffect(() => { load() }, [load])

  const hasData = data?.summary?.latest !== null && data?.summary?.latest !== undefined
  const score   = data?.summary?.latest?.score ?? 0
  const events  = data?.scores || []
  const tips    = data?.summary?.tips || []

  return (
    <div className="client-app min-h-screen bg-[#f5f7f8] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />

      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-primary-500 font-extrabold text-xl mb-4">{isAr ? 'سلوك السائق' : 'Comportement conducteur'}</h1>

        {/* Device picker */}
        <button onClick={() => setShowDevices(s => !s)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl mb-3 border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2">
             <Car size={15} className="text-primary-500"/>
             <span className="text-slate-800 text-sm font-bold">
              {selectedDevice?.name || (isAr ? 'اختر جهازاً' : 'Choisir appareil')}
            </span>
          </div>
           <ChevronDown size={15} className="text-slate-400" style={{ transform: showDevices ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
        </button>

        <AnimatePresence>
          {showDevices && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {devices.map(d => (
                <button key={d.id} onClick={() => { setDeviceId(String(d.id)); setShowDevices(false) }}
                  className="w-full px-4 py-3 text-left text-sm"
                  style={{ color: String(d.id) === deviceId ? '#17324d' : '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                  {d.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Period tabs */}
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
              style={period === p.key
                 ? { background: '#17324d', color: 'white' }
                 : { background: 'white', color: '#64748b', border: '1px solid #e2e8f0' }}>
              {p[isAr ? 'ar' : 'fr']}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: '#e4b56b', borderTopColor: 'transparent' }}/>
        </div>
      ) : error ? (
        <div className="mx-5 p-4 rounded-2xl text-sm text-center" style={{ background: 'rgba(255,59,48,0.1)', color: '#ff6b60' }}>{error}</div>
      ) : !hasData ? (
        /* ── Empty state: no scores recorded in this period ── */
        <div className="mx-5 mt-4 p-8 rounded-2xl flex flex-col items-center gap-4 bg-white border border-slate-200 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <BarChart2 size={30} className="text-slate-400"/>
          </div>
          <div className="text-center">
            <p className="font-bold text-slate-700 text-sm mb-1">
              {isAr ? 'لا توجد بيانات بعد' : 'Aucune donnée disponible'}
            </p>
            <p className="text-slate-400 text-xs leading-relaxed">
              {isAr
                ? 'ستظهر بيانات السلوك بعد أول رحلة مسجّلة في هذه الفترة'
                : 'Les données apparaîtront après le premier trajet enregistré dans cette période'}
            </p>
          </div>
        </div>
      ) : (
        <div className="px-5 space-y-5">
          {/* Score ring */}
          <div className="p-6 rounded-xl flex flex-col items-center bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-bold tracking-wide uppercase mb-4 text-slate-500">
              {isAr ? 'نقاط السلامة' : 'Score de sécurité'}
            </p>
            <ScoreRing score={score}/>
          </div>

          {/* Event chart */}
          {events.length > 0 && (
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-bold tracking-wide uppercase mb-4 text-slate-500">
                {isAr ? 'الأحداث' : 'Événements'}
              </p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={events} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                  <XAxis dataKey="recorded_date" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v ? new Date(v).toLocaleDateString(isAr ? 'ar-MA' : 'fr-MA', { day: '2-digit', month: '2-digit' }) : v}/>
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ background: '#17324d', border: '1px solid #31516e', borderRadius: 10, color: 'white', fontSize: 11 }}/>
                  <Bar dataKey="speeding_events" name={isAr ? 'تجاوز السرعة' : 'Excès vitesse'} fill="#16866d" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tips */}
          {tips.length > 0 && (
            <div className="space-y-2">
              {tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-3 p-3.5 rounded-2xl"
                  style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.18)' }}>
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#FF9500' }}/>
                  <p className="text-xs leading-relaxed text-slate-700">{tip}</p>
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
