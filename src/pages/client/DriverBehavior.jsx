import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gauge, Clock, AlertTriangle, ChevronDown, Car, ShieldCheck, Zap, CircleAlert } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'

const PERIODS = [
  { key: 7,  ar: '7 أيام',  fr: '7 jours'  },
  { key: 14, ar: '14 يوم',  fr: '14 jours' },
  { key: 30, ar: '30 يوم',  fr: '30 jours' },
]

function ScoreRing({ score, size = 148 }) {
  const R    = (size - 18) / 2
  const circ = 2 * Math.PI * R
  const offset = circ - (score / 100) * circ
  const color = '#00D97E'
  const label = score >= 80 ? 'ممتاز' : score >= 60 ? 'جيد' : 'يحتاج تحسين'
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={"0 0 " + size + " " + size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="rgba(148,180,215,.12)" strokeWidth="14" strokeLinecap="round"/>
          <circle cx={size/2} cy={size/2} r={R} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-black leading-none" style={{ fontSize: 38, color }}>{score}</span>
           <span className="text-xs mt-1" style={{ color: 'var(--ath-mut)' }}>/100</span>
        </div>
      </div>
      <p className="text-xs mt-2 font-bold" style={{ color }}>{label}</p>
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

  const latest = data?.summary?.latest
  const events = data?.scores || []
  const tips = data?.summary?.tips || []
  const hasData = Boolean(latest || events.length > 0)
  const score = Number(latest?.score)
  const scoreValue = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0
  const latestStats = latest || events[0] || {}
  const valueFor = (...keys) => {
    const value = keys.map(key => latestStats?.[key]).find(value => value !== undefined && value !== null)
    return value === undefined ? null : value
  }
  const behaviorStats = [
    { Icon: CircleAlert, ar: 'فرملة مفاجئة', fr: 'Freinage brusque', value: valueFor('harsh_brake_events', 'harsh_brakes', 'braking_events'), color: 'var(--ath-red)' },
    { Icon: Zap, ar: 'تسارع حاد', fr: 'Accélération brusque', value: valueFor('harsh_accel_events', 'harsh_accels', 'acceleration_events'), color: 'var(--ath-amber)' },
    { Icon: Gauge, ar: 'تجاوز سرعة', fr: 'Excès de vitesse', value: valueFor('speeding_events'), color: 'var(--ath-red)' },
  ]
  const eventRows = events.flatMap((event) => {
    const rows = []
    const date = event.recorded_date || event.date || ''
    const deviceName = selectedDevice?.name || (isAr ? 'المركبة' : 'Véhicule')
    const entries = [
      { key: 'speeding_events', Icon: Gauge, ar: 'تجاوز سرعة', fr: 'Excès de vitesse', color: 'var(--ath-red)' },
      { key: 'harsh_brake_events', Icon: CircleAlert, ar: 'فرملة مفاجئة', fr: 'Freinage brusque', color: 'var(--ath-amber)' },
      { key: 'harsh_accel_events', Icon: Zap, ar: 'تسارع حاد', fr: 'Accélération brusque', color: 'var(--ath-amber)' },
    ]
    entries.forEach(entry => {
      if (event[entry.key] > 0) rows.push({ ...entry, value: event[entry.key], date, deviceName })
    })
    return rows
  }).slice(0, 8)

  const EVENT_LABELS = {
    speeding:    { ar: 'تجاوز السرعة',  fr: 'Excès vitesse',  color: '#FF3B30' },
    harsh_brake: { ar: 'كبح مفاجئ',    fr: 'Freinage brusque', color: '#FF9500' },
    harsh_accel: { ar: 'تسارع مفاجئ',  fr: 'Accél. brusque',  color: '#F59E0B' },
    idle:        { ar: 'تشغيل خمول',   fr: 'Ralenti excessif', color: '#6b7280' },
    cornering:   { ar: 'منعطف حاد',    fr: 'Virage brusque',  color: '#a855f7' },
  }

  return (
    <div className="client-app min-h-screen bg-[#f5f7f8] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />

      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--ath-green)' }}>
          {isAr ? 'سلامة الأسطول' : 'Sécurité de la flotte'}
        </p>
        <h1 className="text-slate-900 font-extrabold text-xl mt-1 mb-4">{isAr ? 'سلوك السائق' : 'Comportement conducteur'}</h1>

        {/* Device picker */}
        <button onClick={() => setShowDevices(s => !s)}
          className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm w-full flex items-center justify-between mb-3"
          style={{ padding: '13px 14px' }}>
          <div className="flex items-center gap-2">
              <Car size={15} style={{ color: 'var(--ath-green)' }}/>
              <span className="text-sm font-bold" style={{ color: 'var(--ath-txt)' }}>
              {selectedDevice?.name || (isAr ? 'اختر جهازاً' : 'Choisir appareil')}
            </span>
          </div>
            <ChevronDown size={15} style={{ color: 'var(--ath-mut)', transform: showDevices ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
        </button>

        <AnimatePresence>
          {showDevices && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden ath-card" style={{ padding: 0 }}>
              {devices.map(d => (
                <button key={d.id} onClick={() => { setDeviceId(String(d.id)); setShowDevices(false) }}
                  className="w-full px-4 py-3 text-left text-sm"
                  style={{ color: String(d.id) === deviceId ? 'var(--ath-green)' : 'var(--ath-mut)', borderBottom: '1px solid var(--ath-line)' }}>
                  {d.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Period tabs */}
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all"
              style={period === p.key
                 ? { background: 'var(--ath-green)', color: '#04120B', border: '1px solid var(--ath-green)' }
                 : { background: 'var(--ath-card)', color: 'var(--ath-mut)', border: '1px solid var(--ath-line)' }}>
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
          <div className="mx-5 p-4 rounded-2xl text-sm text-center" style={{ background: 'rgba(255,90,95,.10)', color: '#ff8b8f', border: '1px solid rgba(255,90,95,.18)' }}>{error}</div>
      ) : (
        <div className="px-5 space-y-5">
          {!hasData ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col items-center text-center py-14 px-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(0,217,126,.10)', border: '1px solid rgba(0,217,126,.18)' }}>
                <ShieldCheck size={30} style={{ color: 'var(--ath-green)' }}/>
              </div>
              <p className="text-sm font-extrabold" style={{ color: 'var(--ath-txt)' }}>
                {isAr ? 'لا توجد بيانات كافية لتقييم القيادة بعد' : 'Pas assez de données pour évaluer la conduite'}
              </p>
              <p className="text-xs leading-relaxed mt-2" style={{ color: 'var(--ath-mut)' }}>
                {isAr ? 'ستظهر النتيجة بعد تسجيل رحلات وأحداث كافية.' : 'Le score apparaîtra après suffisamment de trajets et d’événements.'}
              </p>
            </div>
          ) : (
            <>
              {/* Score ring */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-extrabold" style={{ color: 'var(--ath-txt)' }}>
                      {isAr ? 'نقاط السلامة' : 'Score de sécurité'}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--ath-mut)' }}>
                      {isAr ? 'آخر تقييم مسجل' : 'Dernière évaluation'}
                    </p>
                  </div>
                  <span className="ath-badge" style={{ background: 'rgba(0,217,126,.10)', color: 'var(--ath-green2)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ath-green)' }}/>
                    {isAr ? 'محدث' : 'À jour'}
                  </span>
                </div>
                <ScoreRing score={scoreValue}/>
              </div>

              {/* Three behavior stats */}
              <div className="grid grid-cols-3 gap-2">
                {behaviorStats.map(({ Icon, ar, fr, value, color }) => (
                  <div key={ar} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm text-center" style={{ padding: '13px 7px' }}>
                    <Icon size={16} className="mx-auto mb-2" style={{ color }}/>
                    <p className="text-xl font-black ath-num" style={{ color }}>{value === null ? '—' : value}</p>
                    <p className="text-[9px] leading-tight mt-1" style={{ color: 'var(--ath-mut)' }}>{isAr ? ar : fr}</p>
                  </div>
                ))}
              </div>

              {/* Weekly events */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-extrabold" style={{ color: 'var(--ath-txt)' }}>{isAr ? 'أحداث الأسبوع' : 'Événements de la semaine'}</p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--ath-mut)' }}>{isAr ? 'النشاط المسجل حديثاً' : 'Activité récemment enregistrée'}</p>
                  </div>
                  <Clock size={17} style={{ color: 'var(--ath-green)' }}/>
                </div>
                {eventRows.length > 0 ? eventRows.map((row, index) => (
                  <div key={`${row.key}-${row.date}-${index}`} className="flex items-center gap-3 py-3"
                    style={{ borderTop: index ? '1px solid var(--ath-line)' : undefined }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: row.color === 'var(--ath-red)' ? 'rgba(255,90,95,.12)' : 'rgba(255,176,32,.12)' }}>
                      <row.Icon size={15} style={{ color: row.color }}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: 'var(--ath-txt)' }}>{isAr ? row.ar : row.fr}</p>
                      <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--ath-mut)' }}>{row.deviceName}</p>
                    </div>
                    <div className="text-end flex-shrink-0">
                      <p className="text-sm font-black ath-num" style={{ color: row.color }}>{row.value}</p>
                      <p className="text-[9px]" style={{ color: 'var(--ath-mut)' }}>{row.date}</p>
                    </div>
                  </div>
                )) : (
                  <div className="py-7 text-center">
                    <p className="text-xs" style={{ color: 'var(--ath-mut)' }}>{isAr ? 'لا توجد أحداث مسجلة هذا الأسبوع' : 'Aucun événement cette semaine'}</p>
                  </div>
                )}
              </div>
            </>
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
