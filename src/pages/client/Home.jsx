import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, ChevronRight, Zap } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import Carousel from '../../components/Carousel'
import MapView from '../../components/MapView'
import Logo from '../../components/Logo'

// ── SVG Circular gauge ────────────────────────────────────────────────────────
function CircularGauge({ value, max, label, unit, color = '#00D97E' }) {
  const r  = 38
  const cx = 50
  const cy = 50
  const circumference = 2 * Math.PI * r
  const safeMax  = max > 0 ? max : 1
  const ratio    = Math.min(value / safeMax, 1)
  const dashOffset = circumference * (1 - ratio)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" className="dark:opacity-20" />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50px 50px', transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="15" fontWeight="bold" fill={color}>{value}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#94a3b8">{unit}</text>
      </svg>
      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 text-center">{label}</p>
    </div>
  )
}

// ── Device status badge ────────────────────────────────────────────────────────
function getDeviceStatus(device) {
  if (device.status !== 'online') return 'noSignal'
  const speed = device.speed || 0
  if (speed > 2) return 'running'
  if (device.engineOn) return 'idle'
  return 'stopped'
}

// ── Status card ───────────────────────────────────────────────────────────────
function StatusCard({ emoji, label, count, color }) {
  return (
    <div className={`flex-1 rounded-2xl px-2 py-2.5 text-center ${color}`}>
      <p className="text-base leading-none mb-1">{emoji}</p>
      <p className="text-lg font-black text-white leading-none">{count}</p>
      <p className="text-[9px] font-semibold text-white/80 mt-0.5 leading-tight">{label}</p>
    </div>
  )
}

// ── Device list card ──────────────────────────────────────────────────────────
function DeviceCard({ device, onClick, lang }) {
  const statusKey = getDeviceStatus(device)
  const statusConfig = {
    running:  { dot: 'bg-emerald-500', text: 'text-emerald-500', label: t(lang, 'running') },
    idle:     { dot: 'bg-yellow-400',  text: 'text-yellow-500',  label: t(lang, 'idle')    },
    stopped:  { dot: 'bg-red-500',     text: 'text-red-500',     label: t(lang, 'stopped') },
    noSignal: { dot: 'bg-slate-400',   text: 'text-slate-400',   label: t(lang, 'noSignal')},
  }
  const st = statusConfig[statusKey]

  return (
    <motion.div
      className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl p-3.5 shadow-sm border border-gray-100 dark:border-slate-700 cursor-pointer active:scale-98"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${statusKey !== 'noSignal' ? 'bg-primary-50 dark:bg-primary-900/30' : 'bg-gray-100 dark:bg-slate-700'}`}>
        {device.type === 'car' ? '🚗' : device.type === 'bike' ? '🏍️' : '🚚'}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-primary-500 dark:text-white text-sm truncate">{device.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs font-medium flex items-center gap-1 ${st.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            {st.label}
          </span>
          {statusKey === 'running' && (
            <span className="text-xs text-slate-400 dark:text-slate-500">{device.speed} {t(lang, 'kmh')}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        {device.battery != null && (
          <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusKey !== 'noSignal' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>
            🔋 {device.battery}%
          </div>
        )}
        <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
      </div>
    </motion.div>
  )
}

export default function ClientHome() {
  const navigate = useNavigate()
  const { clientAuth, devices, alertsList, unreadCount, lang } = useApp()

  const clientDevices = devices

  // Compute status breakdown
  const statusCounts = useMemo(() => {
    const running  = clientDevices.filter(d => getDeviceStatus(d) === 'running').length
    const idle     = clientDevices.filter(d => getDeviceStatus(d) === 'idle').length
    const stopped  = clientDevices.filter(d => getDeviceStatus(d) === 'stopped').length
    const noSignal = clientDevices.filter(d => getDeviceStatus(d) === 'noSignal').length
    return { running, idle, stopped, noSignal }
  }, [devices]) // eslint-disable-line

  // Daily km summary
  const [summaryData, setSummaryData] = useState(null)

  useEffect(() => {
    api.reports.summary(7)
      .then(data => setSummaryData(data))
      .catch(() => { /* non-critical */ })
  }, []) // eslint-disable-line

  // Last 5 events from alertsList
  const recentEvents = useMemo(() => alertsList.slice(0, 5), [alertsList])

  const todayKm  = summaryData?.todayKm  ?? 0
  const maxKm    = summaryData?.dailyData ? Math.max(...summaryData.dailyData.map(d => d.km), 1) : 1
  const chartData = summaryData?.dailyData?.map(d => ({
    name: new Date(d.date).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { weekday: 'short' }),
    km:   d.km,
  })) || []

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50 dark:bg-slate-900">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div
          className="flex-shrink-0 pt-14 pb-4 px-4"
          style={{ background: 'linear-gradient(160deg, #0F2044 0%, #162d5e 100%)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <Logo size="sm" white />
            <button
              onClick={() => navigate('/client/alerts')}
              className="relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
            >
              <Bell size={18} className="text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          <p className="text-white/60 text-xs">{t(lang, 'welcome')}،</p>
          <p className="text-white font-bold text-lg mt-0.5">{clientAuth?.name || ''} 👋</p>

          {/* 4 status cards */}
          <div className="flex gap-2 mt-3">
            <StatusCard emoji="🟢" label={t(lang, 'running')}  count={statusCounts.running}  color="bg-emerald-600/80" />
            <StatusCard emoji="🟡" label={t(lang, 'idle')}     count={statusCounts.idle}     color="bg-yellow-500/80" />
            <StatusCard emoji="🔴" label={t(lang, 'stopped')}  count={statusCounts.stopped}  color="bg-red-600/80" />
            <StatusCard emoji="⚫" label={t(lang, 'noSignal')} count={statusCounts.noSignal} color="bg-slate-600/80" />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto mobile-scroll pb-20">
          <Carousel />

          {/* Today KM gauge + 7-day chart */}
          <div className="mx-3 mb-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-4">
            <p className="font-bold text-primary-500 dark:text-white text-sm mb-3">{t(lang, 'kmToday')}</p>
            <div className="flex items-center gap-4">
              <CircularGauge value={todayKm} max={Math.max(maxKm * 7, 100)} label={t(lang, 'todayKm')} unit={t(lang, 'km')} />
              <div className="flex-1 h-[80px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, border: 'none', background: '#0F2044', color: '#fff' }}
                        formatter={(v) => [`${v} ${t(lang, 'km')}`, '']}
                        labelStyle={{ display: 'none' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="km"
                        stroke="#00D97E"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#00D97E', strokeWidth: 0 }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {lang === 'ar' ? 'جاري تحميل البيانات...' : 'Chargement...'}
                    </p>
                  </div>
                )}
              </div>
            </div>
            {chartData.length > 0 && (
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 text-center">
                {lang === 'ar' ? 'كيلومترات آخر 7 أيام' : 'Km des 7 derniers jours'}
              </p>
            )}
          </div>

          {/* Live Map */}
          <div className="mx-3 mb-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="font-bold text-primary-500 dark:text-white text-sm">{t(lang, 'liveMap')}</p>
              <span className="flex items-center gap-1 text-xs text-emerald-500 font-semibold">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-slate-700" style={{ height: 180 }}>
              <MapView height="100%" zoom={11} />
            </div>
          </div>

          {/* Recent events */}
          {recentEvents.length > 0 && (
            <div className="mx-3 mb-3">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="font-bold text-primary-500 dark:text-white text-sm">{t(lang, 'lastEvents')}</p>
                <button
                  onClick={() => navigate('/client/alerts')}
                  className="text-xs text-accent font-semibold flex items-center gap-0.5"
                >
                  {t(lang, 'viewAll')} <ChevronRight size={12} />
                </button>
              </div>
              <div className="space-y-2">
                {recentEvents.map((event, i) => (
                  <div key={event.id || i}
                    className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-gray-100 dark:border-slate-700">
                    <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-primary-500 dark:text-white truncate">
                        {t(lang, event.type) || event.type}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        {event.createdAt
                          ? new Date(event.createdAt).toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </p>
                    </div>
                    {!event.read && (
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Devices list */}
          <div className="mx-3 mb-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="font-bold text-primary-500 dark:text-white text-sm">{t(lang, 'myDevices')}</p>
              <button
                onClick={() => navigate('/client/devices')}
                className="text-xs text-accent font-semibold flex items-center gap-0.5"
              >
                {t(lang, 'viewAll')} <ChevronRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {clientDevices.slice(0, 3).map(device => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  lang={lang}
                  onClick={() => navigate(`/client/device/${device.id}`)}
                />
              ))}
              {clientDevices.length === 0 && (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
                  {lang === 'ar' ? 'لا توجد أجهزة مسجلة' : 'Aucun appareil enregistré'}
                </div>
              )}
            </div>
          </div>
        </div>

        <ClientNav />
      </div>
    </div>
  )
}
