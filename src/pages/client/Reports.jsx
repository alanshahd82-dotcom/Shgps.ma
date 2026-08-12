import React, { lazy, Suspense, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2, Clock, Navigation, Gauge, ChevronDown,
  FileText, Car, Play, Loader2, Route as RouteIcon
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import { getSubscriptionSnapshot } from '../../utils/subscriptions'
import { bucketMax } from '../../utils/simplify'

const TripReplay = lazy(() => import('../../components/TripReplay'))

const RANGES = [
  { key: 'today', labelKey: 'today' },
  { key: 'week', labelKey: 'last7Days' },
  { key: 'month', labelKey: 'last30Days' },
]

const styles = `
  .ath-reports-page {
    --reports-surface: rgba(16, 27, 46, .92);
    --reports-surface-soft: rgba(12, 22, 38, .82);
    --reports-line: rgba(148, 180, 215, .11);
  }
  .ath-reports-page .ath-reports-chip-row {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    padding: 2px;
  }
  .ath-reports-page .ath-reports-chip-row::before,
  .ath-reports-page .ath-reports-chip-row::after {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 2;
    width: 18px;
    pointer-events: none;
    content: '';
  }
  .ath-reports-page .ath-reports-chip-row::before {
    inset-inline-start: 0;
    background: linear-gradient(90deg, #07111f, transparent);
  }
  .ath-reports-page .ath-reports-chip-row::after {
    inset-inline-end: 0;
    background: linear-gradient(270deg, #07111f, transparent);
  }
  .ath-reports-page .ath-reports-chip-track {
    position: relative;
    z-index: 1;
    display: flex;
    gap: 8px;
    width: 100%;
  }
  .ath-reports-page .ath-reports-kpi {
    position: relative;
    overflow: hidden;
  }
  .ath-reports-page .ath-reports-kpi::before {
    position: absolute;
    inset: 0 18% auto;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--kpi-color), transparent);
    box-shadow: 0 0 24px 4px var(--kpi-color);
    content: '';
    opacity: .55;
  }
  .ath-reports-page .ath-reports-skeleton {
    background: linear-gradient(110deg, rgba(255,255,255,.06) 25%, rgba(255,255,255,.14) 45%, rgba(255,255,255,.06) 65%);
    background-size: 220% 100%;
    animation: ath-sk 1.35s ease-in-out infinite;
  }
  .ath-reports-page .ath-reports-chart {
    animation: ath-reports-chart-in .7s ease-out both;
  }
  .ath-reports-page .ath-reports-trip {
    animation: ath-fadeUp .42s ease-out both;
  }
  @keyframes ath-reports-chart-in {
    from { opacity: 0; transform: translateY(8px) scaleY(.96); }
    to { opacity: 1; transform: translateY(0) scaleY(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ath-reports-page .ath-reports-skeleton,
    .ath-reports-page .ath-reports-chart,
    .ath-reports-page .ath-reports-trip {
      animation: none;
    }
  }
`

function useAnimatedNumber(value, duration = 650) {
  const [displayValue, setDisplayValue] = useState(value ?? null)

  useEffect(() => {
    const target = Number(value)
    if (!Number.isFinite(target)) {
      setDisplayValue(null)
      return undefined
    }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setDisplayValue(target)
      return undefined
    }

    const startedAt = performance.now()
    let frameId
    const animate = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(target * eased)
      if (progress < 1) frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [duration, value])

  return displayValue
}

function StatCard({ icon: Icon, label, value, unit, color, empty }) {
  const animatedValue = useAnimatedNumber(empty ? null : value)
  const displayValue = animatedValue == null
    ? '—'
    : Number.isInteger(value) ? Math.round(animatedValue) : animatedValue.toFixed(1)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="ath-reports-kpi flex min-h-[132px] flex-col justify-between rounded-[18px] p-4"
      style={{
        '--kpi-color': color,
        background: 'linear-gradient(180deg, rgba(16,27,46,.98), rgba(12,22,38,.92))',
        border: '1px solid rgba(148,180,215,.11)',
        boxShadow: '0 12px 30px rgba(0,0,0,.18)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${color}1a`, color }}
        >
          <Icon size={18} />
        </div>
        <span className="ath-num text-[10px] font-bold" style={{ color: `${color}b3` }}>
          {unit}
        </span>
      </div>
      <div>
        <p className="ath-num text-[25px] font-black leading-none text-white">
          {displayValue}
        </p>
        <p className="mt-2 text-[11px] font-semibold" style={{ color: 'var(--ath-mut)' }}>
          {label}
        </p>
      </div>
    </motion.div>
  )
}

function SkeletonBlock({ className = '' }) {
  return <div className={`ath-reports-skeleton rounded-xl ${className}`} aria-hidden="true" />
}

function ReportSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="min-h-[132px] rounded-[18px] border border-white/5 bg-[#101b2e] p-4">
            <SkeletonBlock className="h-10 w-10 rounded-xl" />
            <SkeletonBlock className="mt-6 h-6 w-20 rounded-lg" />
            <SkeletonBlock className="mt-2 h-3 w-24 rounded-md" />
          </div>
        ))}
      </div>
      <div className="rounded-[18px] border border-white/5 bg-[#101b2e] p-4">
        <SkeletonBlock className="mb-5 h-3 w-28 rounded-md" />
        <SkeletonBlock className="h-[142px] w-full rounded-xl" />
      </div>
      <div className="rounded-[18px] border border-white/5 bg-[#101b2e] p-4">
        <SkeletonBlock className="mb-4 h-3 w-32 rounded-md" />
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <SkeletonBlock className="h-9 w-9 shrink-0 rounded-xl" />
              <div className="flex-1">
                <SkeletonBlock className="h-3 w-32 rounded-md" />
                <SkeletonBlock className="mt-2 h-2.5 w-24 rounded-md" />
              </div>
              <SkeletonBlock className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function getTripStart(trip) {
  return trip?.startTime || trip?.start_time || trip?.start
}

function getTripEnd(trip) {
  return trip?.endTime || trip?.end_time || trip?.end
}

function getTripDistance(trip) {
  return Number(trip?.distanceKm ?? trip?.distance_km ?? trip?.distance ?? 0)
}

function getTripMaxSpeed(trip) {
  return Number(trip?.maxSpeed ?? trip?.max_speed ?? 0)
}

function formatTripDate(value, isAr) {
  if (!value) return isAr ? 'لا توجد بيانات' : 'Aucune donnée'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return isAr ? 'لا توجد بيانات' : 'Aucune donnée'
  return date.toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTripTime(value, isAr) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(isAr ? 'ar-MA' : 'fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Reports() {
  const { devices, lang } = useApp()
  const [deviceId, setDeviceId] = useState('')
  const [range, setRange] = useState('today')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDevices, setShowDevices] = useState(false)
  const [replayTrip, setReplayTrip] = useState(null)
  const [replayLoading, setReplayLoading] = useState('')
  const isAr = lang === 'ar'

  const selectedDevice = devices.find(d => String(d.id) === String(deviceId))

  useEffect(() => {
    if (devices.length && !deviceId) setDeviceId(String(devices[0].id))
  }, [devices, deviceId])

  async function load() {
    if (!deviceId) return
    setLoading(true)
    setError('')
    try {
      const now = new Date()
      const from = new Date(now)
      if (range === 'today')      { from.setHours(0,0,0,0) }
      else if (range === 'week')  { from.setDate(now.getDate() - 7) }
      else if (range === 'month') { from.setDate(now.getDate() - 30) }
      const res = await api.reports.get(deviceId, from.toISOString(), now.toISOString())
      setData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [deviceId, range])

  const rawChartData = bucketMax(data?.speedSeries || [], 300)
  const chartData = rawChartData.map((point) => {
    const date = new Date(point.time)
    return {
      ...point,
      label: Number.isNaN(date.getTime())
        ? point.time
        : date.toLocaleTimeString(isAr ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }),
    }
  })
  const trips = Array.isArray(data?.trips) ? data.trips : []
  const totalDistance = Number(data?.total_km ?? data?.totalDistanceKm ?? 0)
  const durationHours = Number(
    data?.total_duration_h
      ?? (data?.movingDurationMin ?? data?.moving_duration_min ?? 0) / 60,
  )
  const maxSpeed = Number(data?.max_speed ?? data?.maxSpeed ?? 0)
  const hasReportData = chartData.length > 0 || trips.length > 0
  const subscriptionSummary = devices.reduce((summary, device) => {
    const status = getSubscriptionSnapshot(device).status
    if (status === 'expired') summary.expired += 1
    if (status === 'expiring_soon') summary.expiringSoon += 1
    return summary
  }, { expired: 0, expiringSoon: 0 })

  async function replaySingleTrip(trip, index) {
    const startTime = getTripStart(trip)
    const endTime = getTripEnd(trip)
    if (!startTime || !endTime || replayLoading) return
    setReplayLoading(String(index))
    try {
      const points = await api.stats.getPositions(deviceId, startTime, endTime, 900)
      if (Array.isArray(points) && points.length > 1) {
        setReplayTrip({
          startTime,
          endTime,
          route: points,
        })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setReplayLoading('')
    }
  }

  return (
    <div className="ath-reports-page client-app min-h-screen bg-[#07111f] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <style>{styles}</style>
      <ClientHeader />

      <div className="px-5 pb-4 pt-5">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: 'var(--ath-gold)' }}>
              {isAr ? 'تحليلات الأسطول' : 'Analytique flotte'}
            </p>
            <h1 className="text-xl font-black text-white">{t(lang, 'reports')}</h1>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#ff5a5f]/20 bg-[#ff5a5f]/[.08] p-3.5">
            <p className="ath-num text-2xl font-black text-white">{subscriptionSummary.expired}</p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--ath-mut)' }}>
              {isAr ? 'اشتراكات منتهية' : 'Abonnements expirés'}
            </p>
          </div>
          <div className="rounded-2xl border border-[#ffb020]/20 bg-[#ffb020]/[.08] p-3.5">
            <p className="ath-num text-2xl font-black text-white">{subscriptionSummary.expiringSoon}</p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--ath-mut)' }}>
              {isAr ? 'قريبة الانتهاء' : 'Bientôt expirés'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowDevices(s => !s)}
          className="mb-3 flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-start transition-all"
          style={{ background: 'var(--reports-surface)', border: '1px solid var(--reports-line)' }}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Car size={15} className="shrink-0 text-[#3EE6A0]" />
            <span className="truncate text-sm font-bold text-white">
              {selectedDevice?.name || (isAr ? 'اختر جهازاً' : 'Choisir appareil')}
            </span>
          </span>
          <ChevronDown
            size={15}
            className="shrink-0 text-slate-500 transition-transform"
            style={{ transform: showDevices ? 'rotate(180deg)' : 'none' }}
          />
        </button>
        <AnimatePresence>
          {showDevices && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-3 overflow-hidden rounded-2xl"
              style={{ background: 'var(--reports-surface)', border: '1px solid var(--reports-line)' }}
            >
              {devices.map(d => (
                <button
                  key={d.id}
                  onClick={() => { setDeviceId(String(d.id)); setShowDevices(false) }}
                  className="flex w-full items-center gap-2 border-b border-white/5 px-4 py-3 text-start text-sm transition-all last:border-0"
                  style={{ color: String(d.id) === deviceId ? '#3EE6A0' : 'rgba(255,255,255,.62)' }}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: String(d.id) === deviceId ? '#1DBF73' : 'rgba(255,255,255,.2)' }} />
                  {d.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="ath-period-control" role="tablist" aria-label={isAr ? 'الفترة' : 'Période'}>
          {RANGES.map(r => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={`ath-period-control-button ${range === r.key ? 'is-active' : ''}`}
            >
              {t(lang, r.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5">
        {loading ? (
          <ReportSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-[#ff5a5f]/20 bg-[#ff5a5f]/[.08] p-4 text-center text-sm text-[#ff8c90]">{error}</div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Navigation} label={isAr ? 'المسافة' : 'Distance'} value={totalDistance} unit="km" color="#1DBF73" empty={!hasReportData} />
              <StatCard icon={Clock} label={isAr ? 'المدة' : 'Durée'} value={durationHours} unit="h" color="#6FC8FF" empty={!hasReportData} />
              <StatCard icon={BarChart2} label={isAr ? 'الرحلات' : 'Trajets'} value={trips.length} unit="" color="#E0B36F" empty={!hasReportData} />
              <StatCard icon={Gauge} label={isAr ? 'أقصى سرعة' : 'Vitesse max'} value={maxSpeed} unit="km/h" color="#FF5A5F" empty={!hasReportData} />
            </div>

            {chartData.length > 0 && (
              <div
                className="ath-reports-chart rounded-[18px] p-4"
                style={{ background: 'var(--reports-surface-soft)', border: '1px solid var(--reports-line)' }}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-xs font-extrabold tracking-wide text-[#8CA3B8]">
                    {isAr ? 'منحنى السرعة' : 'Courbe de vitesse'}
                  </p>
                  <span className="ath-num text-[10px] text-slate-500">{chartData.length} {isAr ? 'نقطة' : 'points'}</span>
                </div>
                <ResponsiveContainer width="100%" height={148}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 10, left: -14, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ath-reports-speed-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1DBF73" stopOpacity={0.42} />
                        <stop offset="100%" stopColor="#1DBF73" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(148,180,215,.10)" strokeDasharray="3 4" />
                    <XAxis dataKey="label" tick={{ fill: '#8CA3B8', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis tick={{ fill: '#8CA3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip
                      formatter={(value) => [`${value} km/h`, isAr ? 'السرعة' : 'Vitesse']}
                      contentStyle={{ background: '#0C1626', border: '1px solid rgba(148,180,215,.16)', borderRadius: 12, color: '#EDF4F2', fontSize: 11 }}
                      labelStyle={{ color: '#8CA3B8', marginBottom: 4 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="speed"
                      stroke="#1DBF73"
                      strokeWidth={2.5}
                      fill="url(#ath-reports-speed-gradient)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#1DBF73', stroke: '#07111f', strokeWidth: 2 }}
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {trips.length > 0 ? (
              <div className="overflow-hidden rounded-[18px]" style={{ background: 'var(--reports-surface-soft)', border: '1px solid var(--reports-line)' }}>
                <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3.5">
                  <FileText size={14} className="text-[#3EE6A0]" />
                  <p className="text-xs font-extrabold tracking-wide text-[#8CA3B8]">
                    {isAr ? 'سجل الرحلات' : 'Historique des trajets'}
                  </p>
                </div>
                {trips.slice(0, 8).map((trip, index) => {
                  const start = getTripStart(trip)
                  const end = getTripEnd(trip)
                  return (
                    <div
                      key={`${start || index}-${index}`}
                      className="ath-reports-trip flex items-center gap-3 border-b border-white/5 px-4 py-3.5 last:border-0"
                      style={{ animationDelay: `${index * 45}ms` }}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1DBF73]/[.10]">
                        <RouteIcon size={15} className="text-[#3EE6A0]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white" style={{ fontFamily: 'var(--ath-disp)' }}>
                          {formatTripDate(start, isAr)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {formatTripTime(start, isAr)}{end ? ` — ${formatTripTime(end, isAr)}` : ''}
                        </p>
                        <p className="ath-num mt-1 truncate text-[10px] font-semibold text-[#8CA3B8]" dir="ltr">
                          {getTripDistance(trip).toFixed(1)} km · {Math.round(getTripMaxSpeed(trip))} km/h
                        </p>
                      </div>
                      <button
                        onClick={() => replaySingleTrip(trip, index)}
                        disabled={replayLoading === String(index)}
                        className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#1DBF73]/60 px-2.5 py-2 text-[10px] font-extrabold text-[#6ee7b7] transition-all hover:bg-[#1DBF73]/[.12] disabled:opacity-50"
                      >
                        {replayLoading === String(index)
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Play size={12} fill="currentColor" />}
                        {isAr ? 'إعادة العرض' : 'Rejouer'}
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-[18px] border border-[#1DBF73]/15 bg-[#1DBF73]/[.06] p-7 text-center">
                <p className="text-sm font-extrabold text-[#EDF4F2]">
                  {isAr ? '📊 لا توجد رحلات في هذه الفترة' : '📊 Aucun trajet pour cette période'}
                </p>
                <p className="mt-2 text-[11px] text-[#8CA3B8]">
                  {isAr ? 'جرّب اختيار فترة أخرى لمراجعة نشاط المركبة.' : 'Essayez une autre période pour consulter l’activité du véhicule.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {replayTrip && (
        <Suspense fallback={<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#0B1220]"><div className="h-9 w-9 animate-spin rounded-full border-2 border-[#35d39a] border-t-transparent" /></div>}>
          <TripReplay
            deviceId={deviceId}
            deviceName={selectedDevice?.name}
            deviceType={selectedDevice?.type}
            startTime={replayTrip.startTime}
            endTime={replayTrip.endTime}
            positions={replayTrip.route}
            allowSatellite={false}
            onClose={() => setReplayTrip(null)}
          />
        </Suspense>
      )}
      <ClientNav />
    </div>
  )
}