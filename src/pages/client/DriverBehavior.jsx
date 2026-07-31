import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ShieldCheck, Gauge, Clock, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'

/* ── Progress Circle SVG ─────────────────────────────────────── */
function ScoreCircle({ score }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const dash = circ * (score / 100)
  const color = score >= 80 ? '#00D97E' : score >= 60 ? '#FF9500' : '#FF3B30'

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
        <circle cx="72" cy="72" r={r} fill="none" stroke="#1e293b" strokeWidth="12" />
        <motion.circle
          cx="72" cy="72" r={r} fill="none"
          stroke={color} strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${dash} ${circ}` }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-extrabold"
          style={{ color }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] text-slate-400 font-medium">/100</span>
      </div>
    </div>
  )
}

/* ── Stat row ────────────────────────────────────────────────── */
function StatRow({ icon: Icon, label, value, sub, good }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-800/60 last:border-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${good ? 'bg-accent/10' : 'bg-orange-500/10'}`}>
        <Icon size={16} className={good ? 'text-accent' : 'text-orange-400'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-200 leading-tight">{label}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <span className={`text-sm font-bold ${good ? 'text-accent' : 'text-orange-400'}`}>{value}</span>
    </div>
  )
}

/* ── Tip Card ────────────────────────────────────────────────── */
function TipCard({ tip, lang }) {
  return (
    <div className="flex gap-2.5 bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/40">
      <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
        <CheckCircle size={13} className="text-accent" />
      </div>
      <p className="text-[13px] text-slate-300 leading-relaxed">{tip}</p>
    </div>
  )
}

/* ── Main ─────────────────────────────────────────────────────── */
export default function DriverBehavior() {
  const navigate = useNavigate()
  const { devices, lang } = useApp()
  const [selectedDeviceId, setSelectedDeviceId] = useState(devices[0]?.id || null)
  const [stats, setStats] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const selectedDevice = devices.find(d => String(d.id) === String(selectedDeviceId))

  useEffect(() => {
    if (!selectedDevice) return
    setHistoryLoading(true)

    // Fetch last 7 days of trip history to compute a meaningful score
    const to   = new Date().toISOString()
    const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

    api.reports.get(selectedDevice.id, from, to)
      .then(res => {
        const trips = res?.trips ?? []
        let score = 100
        let speedingEvents = 0
        let idleTime = 0

        for (const trip of trips) {
          if ((trip.maxSpeed ?? 0) > 120) { score -= 8; speedingEvents++ }
          else if ((trip.maxSpeed ?? 0) > 100) { score -= 4; speedingEvents++ }
        }

        // Also factor in current live reading
        const speed = selectedDevice.speed ?? 0
        if (speed > 120) { score -= 10; speedingEvents++ }
        else if (speed > 100) { score -= 5; speedingEvents++ }

        if (selectedDevice.engineOn && speed === 0 && selectedDevice.status === 'online') {
          score -= 10; idleTime = 15
        }

        score = Math.max(0, Math.min(100, score))
        setStats({ score, speedingEvents, idleTime, currentSpeed: speed, tripCount: trips.length })
      })
      .catch(() => {
        // Fallback to live-only data if API fails
        const speed = selectedDevice.speed ?? 0
        let score = 100; let speedingEvents = 0; let idleTime = 0
        if (speed > 120) { score -= 25; speedingEvents++ }
        else if (speed > 100) { score -= 10; speedingEvents++ }
        if (selectedDevice.engineOn && speed === 0 && selectedDevice.status === 'online') { score -= 10; idleTime = 15 }
        if (selectedDevice.status === 'offline') score = Math.max(score, 70)
        score = Math.max(0, Math.min(100, score))
        setStats({ score, speedingEvents, idleTime, currentSpeed: speed, tripCount: 0 })
      })
      .finally(() => setHistoryLoading(false))
  }, [selectedDeviceId]) // eslint-disable-line

  const isAr = lang === 'ar'

  const tipsList = {
    ar: [
      'حافظ على سرعة ثابتة ومناسبة للطريق وتجنّب التجاوز المفاجئ.',
      'قلّل من فترات التوقف بالمحرك مشتغلاً — أوقفه عند انتظار أكثر من دقيقتين.',
      'تجنّب الكبح المفاجئ بالحفاظ على مسافة آمنة بينك وبين السيارة الأمامية.',
      'راجع ضغط الإطارات بانتظام للحفاظ على أداء الفرامل والاستهلاك الأمثل.',
    ],
    fr: [
      'Maintenez une vitesse stable et adaptée à la route, évitez les dépassements brusques.',
      'Réduisez les périodes de ralenti — éteignez le moteur après 2 minutes d\'arrêt.',
      'Évitez les freinages brusques en gardant une distance de sécurité suffisante.',
      'Vérifiez régulièrement la pression des pneus pour des freins et une consommation optimaux.',
    ],
  }

  const grade = !stats ? '—'
    : stats.score >= 80 ? (isAr ? 'ممتاز' : 'Excellent')
    : stats.score >= 60 ? (isAr ? 'جيد' : 'Bien')
    : (isAr ? 'يحتاج تحسين' : 'À améliorer')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg,#0d1b33 0%,#0a1225 100%)' }}>
      {/* Header */}
      <div className="pt-14 px-4 pb-4" style={{ background: 'linear-gradient(160deg,#0F2044 0%,#162d5e 100%)' }}>
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <ChevronLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="text-white text-lg font-bold leading-tight">
              {isAr ? 'سلوك السائق' : 'Comportement Conducteur'}
            </h1>
            <p className="text-blue-200/70 text-xs">{isAr ? 'تحليل الأداء وسلامة القيادة' : 'Analyse de performance et sécurité'}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-4 pt-4">
        {/* Device selector */}
        {devices.length > 1 && (
          <select
            value={selectedDeviceId || ''}
            onChange={e => setSelectedDeviceId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-accent"
          >
            {devices.map(d => (
              <option key={d.id} value={d.id}>{d.name} {d.plate ? `(${d.plate})` : ''}</option>
            ))}
          </select>
        )}

        {!selectedDevice ? (
          <div className="text-center text-slate-500 py-20">{t(lang, 'noData')}</div>
        ) : (
          <>
            {/* Score Card */}
            <motion.div
              className="bg-slate-800/70 rounded-2xl p-5 border border-slate-700/50 flex flex-col items-center gap-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={16} className="text-accent" />
                <span className="text-sm text-slate-300 font-medium">
                  {isAr ? 'درجة أمان السائق' : 'Score de sécurité conducteur'}
                </span>
              </div>
              {stats && <ScoreCircle score={stats.score} />}
              <div className="text-center">
                <p className="text-lg font-bold text-white">{grade}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAr ? 'بناءً على بيانات Traccar المتاحة' : 'Basé sur les données Traccar disponibles'}
                </p>
              </div>
            </motion.div>

            {/* Stats */}
            {stats && (
              <motion.div
                className="bg-slate-800/70 rounded-2xl p-4 border border-slate-700/50"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-accent" />
                  {isAr ? 'التفاصيل' : 'Détails'}
                </h3>
                <StatRow
                  icon={Gauge}
                  label={isAr ? 'السرعة الحالية' : 'Vitesse actuelle'}
                  value={`${stats.currentSpeed} km/h`}
                  good={stats.currentSpeed <= 100}
                />
                <StatRow
                  icon={AlertTriangle}
                  label={isAr ? 'أحداث التجاوز' : 'Excès de vitesse'}
                  value={stats.speedingEvents}
                  sub={isAr ? 'تجاوزات مرصودة' : 'infractions détectées'}
                  good={stats.speedingEvents === 0}
                />
                <StatRow
                  icon={Clock}
                  label={isAr ? 'وقت الخمول' : 'Temps de ralenti'}
                  value={stats.idleTime ? `${stats.idleTime} ${isAr ? 'دقيقة' : 'min'}` : isAr ? 'لا يوجد' : 'Aucun'}
                  sub={isAr ? 'محرك مشتغل بدون حركة' : 'moteur allumé sans mouvement'}
                  good={stats.idleTime === 0}
                />
              </motion.div>
            )}

            {/* Tips */}
            <motion.div
              className="space-y-2.5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <h3 className="text-sm font-semibold text-slate-300 px-1 flex items-center gap-2">
                <CheckCircle size={14} className="text-accent" />
                {isAr ? 'نصائح لتحسين درجتك' : 'Conseils d\'amélioration'}
              </h3>
              {(isAr ? tipsList.ar : tipsList.fr).map((tip, i) => (
                <TipCard key={i} tip={tip} lang={lang} />
              ))}
            </motion.div>
          </>
        )}
      </div>

      <ClientNav />
    </div>
  )
}
