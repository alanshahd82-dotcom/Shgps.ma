import React, { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart2, Users, Cpu, Wifi, WifiOff, Bell, Gauge, Clock, Route as RouteIcon,
  AlertCircle, Loader2, Calendar
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'
import { APP_TZ } from '../../utils/datetime.js'

const MAX_RANGE_DAYS = 31

function formatDate(value, lang) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { timeZone: APP_TZ, day: '2-digit', month: 'short' })
}

function formatTime(value, lang) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { timeZone: APP_TZ, hour: '2-digit', minute: '2-digit' })
}

function formatDuration(min) {
  const m = Math.round(Number(min) || 0)
  if (m < 60) return m + 'min'
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem === 0 ? h + 'h' : h + 'h ' + rem + 'min'
}

function KpiCard({ icon: Icon, label, value, color, delay }) {
  const colors = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-emerald-600 bg-emerald-50',
    orange: 'text-orange-600 bg-orange-50',
    purple: 'text-purple-600 bg-purple-50',
    slate: 'text-slate-600 bg-slate-50',
  }
  return (
    <motion.div
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.06, type: 'spring', damping: 20 }}
    >
      <div className={'w-10 h-10 rounded-xl flex items-center justify-center mb-3 ' + (colors[color] || colors.blue)}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-black text-slate-800 tabular-nums">{value}</p>
      <p className="text-slate-400 text-xs font-medium mt-1">{label}</p>
    </motion.div>
  )
}

function Spinner({ label }) {
  return (
    <div className="flex items-center justify-center h-[200px] text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

function ErrorBlock({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-[200px] text-red-500">
      <AlertCircle className="w-7 h-7 mb-2" />
      <span className="text-sm">{message}</span>
    </div>
  )
}

function EmptyBlock({ message }) {
  return (
    <div className="flex items-center justify-center h-[200px] text-slate-400">
      <span className="text-sm">{message}</span>
    </div>
  )
}

export default function AdminReports() {
  const { devices: ctxDevices, lang } = useApp()
  const isAr = lang === 'ar'
  const safeCtxDevices = Array.isArray(ctxDevices) ? ctxDevices : []

  const [liveStats, setLiveStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState(null)

  const [summaryDays, setSummaryDays] = useState(7)
  const [summaryData, setSummaryData] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [deviceList, setDeviceList] = useState(safeCtxDevices)
  useEffect(() => {
    if (safeCtxDevices.length) { setDeviceList(safeCtxDevices); return }
    api.devices.list().then(list => setDeviceList(Array.isArray(list) ? list : [])).catch(() => {})
  }, [safeCtxDevices.length])

  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState(null)

  useEffect(() => {
    setStatsLoading(true)
    api.admin.stats()
      .then(s => { setLiveStats(s); setStatsError(null) })
      .catch(e => setStatsError(e?.message || (isAr ? 'خطأ' : 'Erreur')))
      .finally(() => setStatsLoading(false))
  }, [])

  useEffect(() => {
    setSummaryLoading(true)
    api.reports.summary(summaryDays)
      .then(d => setSummaryData(d))
      .catch(() => setSummaryData(null))
      .finally(() => setSummaryLoading(false))
  }, [summaryDays])

  useEffect(() => {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - 6)
    setDateTo(to.toISOString().slice(0, 10))
    setDateFrom(from.toISOString().slice(0, 10))
  }, [])

  useEffect(() => {
    if (deviceList.length && !selectedDeviceId) {
      setSelectedDeviceId(String(deviceList[0].id))
    }
  }, [deviceList, selectedDeviceId])

  const rangeError = useMemo(() => {
    if (!dateFrom || !dateTo) return null
    const from = new Date(dateFrom)
    const to = new Date(dateTo)
    const diffDays = (to - from) / (1000 * 60 * 60 * 24)
    if (diffDays < 0) return isAr ? 'تاريخ البداية بعد النهاية' : 'Date début > fin'
    if (diffDays > MAX_RANGE_DAYS - 1) return isAr ? 'الحد الأقصى ' + MAX_RANGE_DAYS + ' يوماً' : 'Max ' + MAX_RANGE_DAYS + ' jours'
    return null
  }, [dateFrom, dateTo, isAr])

  useEffect(() => {
    if (!selectedDeviceId || !dateFrom || !dateTo || rangeError) return
    let cancelled = false
    setReportLoading(true)
    setReportError(null)
    const fromISO = new Date(dateFrom + 'T00:00:00').toISOString()
    const toISO = new Date(dateTo + 'T23:59:59').toISOString()
    api.reports.get(selectedDeviceId, fromISO, toISO)
      .then(res => { if (!cancelled) setReportData(res) })
      .catch(e => { if (!cancelled) setReportError(e?.message || (isAr ? 'تعذّر تحميل التقرير' : 'Impossible de charger')) })
      .finally(() => { if (!cancelled) setReportLoading(false) })
    return () => { cancelled = true }
  }, [selectedDeviceId, dateFrom, dateTo, rangeError])

  const dailyChartData = useMemo(() => {
    if (!summaryData?.dailyData) return []
    return summaryData.dailyData.map(d => ({
      date: formatDate(d.date, lang),
      km: Number(d.km) || 0,
    }))
  }, [summaryData, lang])

  const speedChartData = useMemo(() => {
    if (!reportData?.speedSeries) return []
    return reportData.speedSeries.map(p => {
      const date = new Date(p.time)
      return {
        ...p,
        label: Number.isNaN(date.getTime()) ? p.time : date.toLocaleTimeString(isAr ? 'ar-MA' : 'fr-FR', { timeZone: APP_TZ, hour: '2-digit', minute: '2-digit' }),
      }
    })
  }, [reportData, lang])

  const trips = useMemo(() => Array.isArray(reportData?.trips) ? reportData.trips : [], [reportData])
  const totalDistance = Number(reportData?.totalDistanceKm ?? reportData?.total_km ?? 0)
  const movingDuration = Number(reportData?.movingDurationMin ?? reportData?.moving_duration_min ?? 0)
  const stoppedDuration = Number(reportData?.stoppedDurationMin ?? reportData?.stopped_duration_min ?? 0)
  const avgSpeed = Number(reportData?.avgSpeed ?? reportData?.avg_speed ?? 0)
  const maxSpeed = Number(reportData?.maxSpeed ?? reportData?.max_speed ?? 0)

  const totalClients = liveStats?.totalClients ?? 0
  const totalDevices = liveStats?.totalDevices ?? 0
  const onlineDevices = liveStats?.onlineDevices ?? 0
  const offlineStale = (liveStats?.offlineDevices ?? 0) + (liveStats?.staleDevices ?? 0)
  const todayAlerts = liveStats?.todayAlerts ?? 0

  const tr = (ar, fr) => isAr ? ar : fr

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-primary-500">{tr('التقارير', 'Rapports')}</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-MA', { timeZone: APP_TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {statsLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-gray-100 mb-3" />
                <div className="h-7 w-16 bg-gray-100 rounded mb-2" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
            ))
          ) : statsError ? (
            <div className="col-span-2 lg:col-span-5"><ErrorBlock message={statsError} /></div>
          ) : (
            <>
              <KpiCard icon={Users} label={t(lang, 'totalClients')} value={totalClients} color="blue" delay={0} />
              <KpiCard icon={Cpu} label={t(lang, 'totalDevices')} value={totalDevices} color="purple" delay={1} />
              <KpiCard icon={Wifi} label={t(lang, 'onlineDevices')} value={onlineDevices} color="green" delay={2} />
              <KpiCard icon={WifiOff} label={tr('غير متصل/صامت', 'Hors ligne/Silencieux')} value={offlineStale} color="slate" delay={3} />
              <KpiCard icon={Bell} label={tr('تنبيهات اليوم', 'Alertes aujourd\'hui')} value={todayAlerts} color="orange" delay={4} />
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-bold text-primary-500">{tr('الكيلومترات اليومية', 'Kilométrage quotidien')}</h3>
            <div className="flex gap-2">
              {[7, 14, 30].map(d => (
                <button key={d} onClick={() => setSummaryDays(d)}
                  className={'px-3 py-1.5 rounded-lg text-xs font-semibold transition ' + (summaryDays === d ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                  {d} {tr('ي', 'j')}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            {summaryLoading ? (
              <Spinner label={tr('جاري التحميل...', 'Chargement...')} />
            ) : !dailyChartData.length ? (
              <EmptyBlock message={tr('لا توجد بيانات', 'Aucune donnée')} />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={dailyChartData}>
                  <defs>
                    <linearGradient id="dailyKm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    formatter={v => [Number(v).toFixed(1) + ' km', tr('المسافة', 'Distance')]} />
                  <Area type="monotone" dataKey="km" stroke="#1d4ed8" strokeWidth={2} fill="url(#dailyKm)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-primary-500">{tr('تقرير جهاز', 'Rapport appareil')}</h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">{tr('الجهاز', 'Appareil')}</label>
                <select value={selectedDeviceId} onChange={e => setSelectedDeviceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400"
                  disabled={!deviceList.length}>
                  {!deviceList.length && <option>{tr('لا توجد أجهزة', 'Aucun appareil')}</option>}
                  {deviceList.map(d => (
                    <option key={d.id} value={String(d.id)}>{d.name || d.imei || '—'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                  <Calendar size={12} /> {tr('من', 'Du')}
                </label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={dateTo || undefined}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                  <Calendar size={12} /> {tr('إلى', 'Au')}
                </label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom || undefined}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400" />
              </div>
            </div>

            {rangeError && (
              <div className="flex items-center gap-2 text-red-500 text-sm mb-4">
                <AlertCircle size={16} /><span>{rangeError}</span>
              </div>
            )}

            {!selectedDeviceId && deviceList.length > 0 && (
              <EmptyBlock message={tr('اختر جهازاً لعرض التقرير', 'Sélectionnez un appareil')} />
            )}

            {selectedDeviceId && !rangeError && (
              <>
                {reportLoading ? (
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-4 animate-pulse">
                        <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
                        <div className="h-6 w-20 bg-gray-200 rounded" />
                      </div>
                    ))}
                  </div>
                ) : reportError ? (
                  <ErrorBlock message={reportError} />
                ) : !reportData ? (
                  <EmptyBlock message={tr('لا توجد بيانات', 'Aucune donnée')} />
                ) : (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
                      <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1"><RouteIcon size={14} /> {tr('المسافة', 'Distance')}</div>
                        <p className="text-xl font-black text-slate-800 tabular-nums">{totalDistance.toFixed(1)} <span className="text-sm font-normal text-slate-400">km</span></p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1"><Clock size={14} /> {tr('حركة', 'En mouvement')}</div>
                        <p className="text-xl font-black text-slate-800 tabular-nums">{formatDuration(movingDuration)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1"><Clock size={14} /> {tr('توقف', 'Arrêt')}</div>
                        <p className="text-xl font-black text-slate-800 tabular-nums">{formatDuration(stoppedDuration)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1"><Gauge size={14} /> {tr('متوسط السرعة', 'Vitesse moy.')}</div>
                        <p className="text-xl font-black text-slate-800 tabular-nums">{avgSpeed.toFixed(0)} <span className="text-sm font-normal text-slate-400">km/h</span></p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1"><Gauge size={14} /> {tr('أعلى سرعة', 'Vitesse max')}</div>
                        <p className="text-xl font-black text-slate-800 tabular-nums">{maxSpeed.toFixed(0)} <span className="text-sm font-normal text-slate-400">km/h</span></p>
                      </div>
                    </div>

                    {speedChartData.length > 0 && (
                      <div className="mb-5">
                        <h4 className="text-sm font-bold text-slate-600 mb-3">{tr('منحنى السرعة', 'Courbe de vitesse')}</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={speedChartData}>
                            <defs>
                              <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                              formatter={v => [Number(v).toFixed(0) + ' km/h', tr('السرعة', 'Vitesse')]} />
                            <Area type="monotone" dataKey="speed" stroke="#7c3aed" strokeWidth={2} fill="url(#speedGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                )}

                {!reportLoading && !reportError && reportData && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-600 mb-3">{tr('الرحلات', 'Trajets')} ({trips.length})</h4>
                    {trips.length === 0 ? (
                      <EmptyBlock message={tr('لا توجد رحلات في هذه الفترة', 'Aucun trajet sur cette période')} />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 text-slate-500 text-xs">
                              <th className="text-left py-2 px-3 font-semibold">{tr('البداية', 'Début')}</th>
                              <th className="text-left py-2 px-3 font-semibold">{tr('النهاية', 'Fin')}</th>
                              <th className="text-right py-2 px-3 font-semibold">{tr('المدة', 'Durée')}</th>
                              <th className="text-right py-2 px-3 font-semibold">{tr('المسافة', 'Distance')}</th>
                              <th className="text-right py-2 px-3 font-semibold">{tr('متوسط السرعة', 'V. moy.')}</th>
                              <th className="text-right py-2 px-3 font-semibold">{tr('أعلى سرعة', 'V. max')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trips.map((trip, i) => {
                              const start = trip.startTime || trip.start_time || trip.start
                              const end = trip.endTime || trip.end_time || trip.end
                              const duration = trip.durationMin || trip.duration_min || trip.duration
                              const distance = Number(trip.distanceKm ?? trip.distance_km ?? trip.distance ?? 0)
                              const tAvg = Number(trip.avgSpeed ?? trip.avg_speed ?? 0)
                              const tMax = Number(trip.maxSpeed ?? trip.max_speed ?? 0)
                              return (
                                <tr key={i} className="border-b border-gray-50 hover:bg-slate-50">
                                  <td className="py-2 px-3 text-slate-600">{start ? formatTime(start, lang) : '—'}</td>
                                  <td className="py-2 px-3 text-slate-600">{end ? formatTime(end, lang) : '—'}</td>
                                  <td className="py-2 px-3 text-right text-slate-600 tabular-nums">{formatDuration(duration)}</td>
                                  <td className="py-2 px-3 text-right text-slate-600 tabular-nums">{distance.toFixed(1)} km</td>
                                  <td className="py-2 px-3 text-right text-slate-600 tabular-nums">{tAvg.toFixed(0)} km/h</td>
                                  <td className="py-2 px-3 text-right text-slate-600 tabular-nums">{tMax.toFixed(0)} km/h</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
