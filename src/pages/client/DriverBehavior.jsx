import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gauge, Clock, Navigation, AlertTriangle, TrendingUp, TrendingDown,
  Info, ChevronDown, BarChart2, Car
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import {
  VehicleIcon, PageHeader, Card, Section, SectionTitle,
  EmptyState, ErrorState, Spinner
} from '../../components/ui'

// ── Score ring SVG ────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 140 }) {
  const radius      = (size - 20) / 2
  const circumference = 2 * Math.PI * radius
  const offset      = circumference - (score / 100) * circumference

  const color = score >= 80 ? '#22c55e'
               : score >= 60 ? '#f59e0b'
               : '#ef4444'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth={12}
      />
      {/* Progress */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.4s' }}
      />
      {/* Center text */}
      <text
        x={size / 2} y={size / 2 - 4}
        textAnchor="middle" dominantBaseline="middle"
        className="font-black"
        style={{ fontSize: 38, fontWeight: 900, fill: color }}
      >
        {score}
      </text>
      <text
        x={size / 2} y={size / 2 + 22}
        textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 11, fontWeight: 600, fill: 'rgba(148,163,184,0.8)' }}
      >
        / 100
      </text>
    </svg>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ icon: Icon, label, value, unit, color = '#0F2044' }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-white dark:bg-slate-800 rounded-2xl p-3 border border-gray-100 dark:border-slate-700 text-center">
      <Icon size={16} style={{ color }} strokeWidth={1.8} />
      <p className="font-black text-xl text-primary-500 dark:text-white leading-none">{value}</p>
      {unit && <p className="text-[9px] font-semibold text-slate-400 uppercase">{unit}</p>}
      <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">{label}</p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DriverBehavior() {
  const { devices, lang } = useApp()
  const isAr = lang === 'ar'

  const [selectedId, setSelectedId]     = useState('')
  const [days,       setDays]           = useState(7)
  const [scores,     setScores]         = useState([])
  const [summary,    setSummary]        = useState(null)
  const [loading,    setLoading]        = useState(false)
  const [error,      setError]          = useState(null)
  const [deviceOpen, setDeviceOpen]     = useState(false)

  const selectedDevice = devices.find(d => String(d.id) === String(selectedId))

  const loadData = useCallback(async () => {
    if (!selectedId) return
    setLoading(true); setError(null)
    try {
      const [sc, su] = await Promise.all([
        api.driverBehavior.getScores(selectedId, days),
        api.driverBehavior.getSummary(selectedId),
      ])
      setScores(Array.isArray(sc) ? sc : [])
      setSummary(su)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedId, days])

  useEffect(() => { loadData() }, [loadData])

  // Automatically select first device
  useEffect(() => {
    if (!selectedId && devices.length > 0) setSelectedId(String(devices[0].id))
  }, [devices]) // eslint-disable-line

  const latestScore = scores.length > 0
    ? scores.reduce((a, b) => new Date(a.recorded_date) > new Date(b.recorded_date) ? a : b).score
    : null

  const chartData = scores.map(s => ({
    name: new Date(s.recorded_date).toLocaleDateString(isAr ? 'ar-MA' : 'fr-MA', { day: '2-digit', month: '2-digit' }),
    score: s.score,
    speeding: s.speeding_events || 0,
  })).reverse()

  const scoreColor = latestScore != null
    ? (latestScore >= 80 ? '#22c55e' : latestScore >= 60 ? '#f59e0b' : '#ef4444')
    : '#94a3b8'

  const scoreLabel = latestScore == null ? (isAr ? 'لا بيانات' : 'Pas de données')
    : latestScore >= 80 ? (isAr ? 'قيادة ممتازة' : 'Excellente conduite')
    : latestScore >= 60 ? (isAr ? 'قيادة جيدة' : 'Bonne conduite')
    : (isAr ? 'يحتاج تحسين' : 'À améliorer')

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50 dark:bg-slate-900">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <PageHeader>
        <h1 className="text-white font-bold text-xl">{t(lang, 'driver_behavior')}</h1>
        <p className="text-white/50 text-xs mt-0.5">
          {isAr ? 'تحليل نمط القيادة من بيانات GPS' : 'Analyse du comportement de conduite GPS'}
        </p>
      </PageHeader>

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-24 pt-3">

        {/* Device selector */}
        <Section>
          <div className="relative">
            <button
              type="button"
              onClick={() => setDeviceOpen(v => !v)}
              className="w-full flex items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 border border-gray-100 dark:border-slate-700 shadow-sm"
            >
              {selectedDevice
                ? <VehicleIcon type={selectedDevice.type} iconSize={14} />
                : <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <Car size={14} className="text-slate-400" />
                  </div>
              }
              <span className="flex-1 text-start text-sm font-semibold text-primary-500 dark:text-white">
                {selectedDevice ? selectedDevice.name : (isAr ? 'اختر مركبة' : 'Choisir un véhicule')}
              </span>
              <ChevronDown size={14} className="text-slate-400 transition-transform duration-200"
                style={{ transform: deviceOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>
            <AnimatePresence>
              {deviceOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-xl overflow-hidden"
                >
                  {devices.length === 0
                    ? <p className="text-center text-xs text-slate-400 py-4">{t(lang, 'noDevices')}</p>
                    : devices.map(d => (
                      <button key={d.id} type="button"
                        onClick={() => { setSelectedId(String(d.id)); setDeviceOpen(false) }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-start transition-colors ${
                          String(d.id) === selectedId ? 'bg-accent/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <VehicleIcon type={d.type} iconSize={14} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-primary-500 dark:text-white truncate">{d.name}</p>
                          {d.plate && <p className="text-[10px] text-slate-400">{d.plate}</p>}
                        </div>
                      </button>
                    ))
                  }
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Section>

        {/* Days filter */}
        <Section>
          <div className="flex gap-2">
            {[7, 14, 30].map(d => (
              <button key={d} type="button"
                onClick={() => setDays(d)}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: days === d ? '#0F2044' : 'rgba(255,255,255,0.9)',
                  color:      days === d ? 'white'   : '#64748b',
                  border:     days === d ? '1px solid transparent' : '1px solid #e2e8f0',
                }}
              >
                {d} {isAr ? 'يوم' : 'j'}
              </button>
            ))}
          </div>
        </Section>

        {!selectedId ? (
          <EmptyState
            icon={BarChart2}
            title={isAr ? 'اختر مركبة للمتابعة' : 'Sélectionnez un véhicule'}
            subtitle={isAr ? 'سيظهر تحليل سلوك السائق هنا' : 'L\'analyse s\'affichera ici'}
          />
        ) : loading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : error ? (
          <ErrorState message={error} onRetry={loadData} lang={lang} />
        ) : (
          <>
            {/* Score card */}
            <Section>
              <Card className="text-center">
                <SectionTitle>{t(lang, 'driver_score')}</SectionTitle>
                <div className="flex flex-col items-center py-2">
                  <ScoreRing score={latestScore ?? 0} size={160} />
                  <p className="font-bold text-sm mt-2" style={{ color: scoreColor }}>{scoreLabel}</p>
                  {summary && (
                    <p className="text-xs text-slate-400 mt-1">
                      {isAr ? `${summary.tripCount || 0} رحلة — ${days} يوم` : `${summary.tripCount || 0} trajet${summary.tripCount !== 1 ? 's' : ''} — ${days} j`}
                    </p>
                  )}
                </div>

                {/* Disclaimer */}
                <div className="mt-3 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-start">
                  <Info size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                    {isAr
                      ? 'الدرجة تقديرية محسوبة من بيانات GPS (سرعة، توقفات) وليست تقييماً رسمياً.'
                      : 'Score estimatif basé sur les données GPS (vitesse, arrêts) — pas une évaluation officielle.'}
                  </p>
                </div>
              </Card>
            </Section>

            {/* Stats grid */}
            {summary && (
              <Section>
                <SectionTitle>{isAr ? 'إحصائيات المدة' : 'Statistiques'}</SectionTitle>
                <div className="grid grid-cols-3 gap-2">
                  <StatTile
                    icon={Gauge}
                    label={isAr ? 'مخالفة سرعة' : 'Excès vitesse'}
                    value={summary.speedingEvents ?? 0}
                    color="#ef4444"
                  />
                  <StatTile
                    icon={Navigation}
                    label={t(lang, 'trips')}
                    value={summary.tripCount ?? 0}
                    color="#0F2044"
                  />
                  <StatTile
                    icon={Clock}
                    label={isAr ? 'توقف (د)' : 'Arrêt (min)'}
                    value={Math.round(summary.idleMin ?? 0)}
                    color="#f59e0b"
                  />
                </div>
              </Section>
            )}

            {/* Score history chart */}
            {chartData.length > 1 && (
              <Section>
                <Card>
                  <SectionTitle>{t(lang, 'scoreHistory')}</SectionTitle>
                  <div className="h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                        <XAxis dataKey="name" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ fontSize: 10, padding: '3px 8px', borderRadius: 10, border: 'none', background: '#0F2044', color: '#fff' }}
                          formatter={v => [`${v}`, isAr ? 'الدرجة' : 'Score']}
                        />
                        <Bar dataKey="score" fill="#0F2044" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </Section>
            )}

            {/* Speeding events chart */}
            {chartData.some(d => d.speeding > 0) && (
              <Section>
                <Card>
                  <SectionTitle>
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={13} className="text-red-500" />
                      {isAr ? 'مخالفات السرعة' : 'Excès de vitesse'}
                    </span>
                  </SectionTitle>
                  <div className="h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                        <XAxis dataKey="name" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ fontSize: 10, padding: '3px 8px', borderRadius: 10, border: 'none', background: '#0F2044', color: '#fff' }}
                          formatter={v => [`${v}`, isAr ? 'مخالفات' : 'Infractions']}
                        />
                        <Bar dataKey="speeding" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </Section>
            )}

            {scores.length === 0 && !loading && (
              <EmptyState
                icon={TrendingUp}
                title={isAr ? 'لا توجد بيانات بعد' : 'Aucune donnée'}
                subtitle={isAr
                  ? 'ستظهر الدرجات بعد اكتمال أولى الرحلات المسجّلة'
                  : 'Les scores apparaîtront après les premiers trajets enregistrés'}
              />
            )}
          </>
        )}
      </div>

      <ClientNav />
    </div>
  )
}
