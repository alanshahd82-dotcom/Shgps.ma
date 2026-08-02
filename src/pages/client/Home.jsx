import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bell, ChevronRight, Navigation, PauseCircle,
  WifiOff, Map, BarChart2, Wrench, Car, Cpu
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import MapView from '../../components/MapView'
import Logo from '../../components/Logo'
import {
  VehicleIcon, StatusBadge, getDeviceStatusKey, timeAgo,
  Card, Section, SectionTitle, EmptyState
} from '../../components/ui'

// ── Stat card (header) ────────────────────────────────────────────────────────
function StatCard({ Icon, label, count, r, g, b, dimmed }) {
  return (
    <div
      className="flex-1 rounded-2xl px-2 py-2.5 flex flex-col items-center gap-0.5"
      style={{
        background: dimmed ? 'rgba(255,255,255,0.07)' : `rgba(${r},${g},${b},0.18)`,
        border:     dimmed ? '1px solid rgba(255,255,255,0.08)' : `1px solid rgba(${r},${g},${b},0.28)`,
      }}
    >
      <Icon size={14} color={dimmed ? 'rgba(255,255,255,0.45)' : `rgb(${r},${g},${b})`} strokeWidth={2} />
      <p className="text-[22px] font-black text-white leading-none mt-0.5">{count}</p>
      <p className="text-[8px] font-semibold text-white/65 uppercase tracking-wide text-center leading-tight">{label}</p>
    </div>
  )
}

// ── Shortcut button ───────────────────────────────────────────────────────────
function Shortcut({ icon: Icon, label, to, color }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl active:scale-95 transition-transform"
      style={{ background: `${color}12`, border: `1px solid ${color}22` }}
    >
      <Icon size={18} style={{ color }} strokeWidth={1.8} />
      <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
    </button>
  )
}

// ── Alert row ─────────────────────────────────────────────────────────────────
const ALERT_DOT_COLORS = {
  speeding: '#ef4444', geofence_enter: '#3b82f6', geofence_exit: '#f97316',
  low_battery: '#f59e0b', power_cut: '#8b5cf6', engine_on: '#22c55e',
  engine_off: '#94a3b8', long_stop: '#64748b', unusual_movement: '#ef4444',
  device_offline: '#94a3b8', geofence_alert: '#3b82f6', battery_alert: '#f59e0b',
  engine_alert: '#22c55e',
}

function AlertRow({ alert, lang }) {
  const color = ALERT_DOT_COLORS[alert.type] || '#94a3b8'
  const time  = alert.createdAt
    ? new Date(alert.createdAt).toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-MA',
        { hour: '2-digit', minute: '2-digit' })
    : '—'
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl px-3.5 py-2.5 border border-gray-100 dark:border-slate-700">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-primary-500 dark:text-white truncate">
          {t(lang, alert.type) || alert.type}
        </p>
        <p className="text-[10px] text-slate-400">{time}</p>
      </div>
      {!alert.read && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
    </div>
  )
}

// ── Device row ────────────────────────────────────────────────────────────────
function DeviceRow({ device, onClick, lang }) {
  const st = getDeviceStatusKey(device)
  return (
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl p-3.5 shadow-sm border border-gray-100 dark:border-slate-700 cursor-pointer"
    >
      <VehicleIcon type={device.type} iconSize={18} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-primary-500 dark:text-white text-sm truncate">{device.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <StatusBadge status={st} lang={lang} />
          {st === 'moving' && (
            <span className="text-[10px] text-slate-400 font-medium">{device.speed} {t(lang, 'kmh')}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {device.battery != null && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            device.battery < 30
              ? 'text-red-500 bg-red-50 dark:bg-red-900/30'
              : 'text-slate-500 bg-slate-100 dark:bg-slate-700'
          }`}>
            {device.battery}%
          </span>
        )}
        <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
      </div>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ClientHome() {
  const navigate = useNavigate()
  const { clientAuth, devices, alertsList, unreadCount, lang, networkError } = useApp()
  const isAr = lang === 'ar'

  const counts = useMemo(() => ({
    total:   devices.length,
    moving:  devices.filter(d => getDeviceStatusKey(d) === 'moving').length,
    stopped: devices.filter(d => getDeviceStatusKey(d) === 'stopped' || getDeviceStatusKey(d) === 'idle').length,
    offline: devices.filter(d => getDeviceStatusKey(d) === 'offline').length,
  }), [devices])

  const [summary, setSummary] = useState(null)

  useEffect(() => {
    api.reports.summary(7).then(setSummary).catch(() => {})
  }, []) // eslint-disable-line

  const todayKm   = summary?.todayKm ?? 0
  const chartData = summary?.dailyData?.map(d => ({
    name: new Date(d.date).toLocaleDateString(isAr ? 'ar-MA' : 'fr-MA', { weekday: 'short' }),
    km:   d.km,
  })) || []

  const recentAlerts  = alertsList.slice(0, 5)
  const recentDevices = devices.slice(0, 3)

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50 dark:bg-slate-900">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 pb-4 px-4"
        style={{
          paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
          background: 'linear-gradient(160deg, #071629 0%, #0F2044 55%, #162d5e 100%)',
        }}
      >
        {/* Top row */}
        <div className="flex items-center justify-between mb-4">
          <Logo size="sm" white />
          <button
            onClick={() => navigate('/client/alerts')}
            className="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <Bell size={18} className="text-white" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Greeting */}
        <p className="text-white/50 text-xs">{t(lang, 'welcome')}</p>
        <p className="text-white font-bold text-lg mb-4">{clientAuth?.name || ''}</p>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-2">
          <StatCard Icon={Cpu}         label={isAr ? 'الكل' : 'Total'}       count={counts.total}   r={148} g={163} b={184} dimmed />
          <StatCard Icon={Navigation}  label={isAr ? 'يتحرك' : 'En mouv.'}   count={counts.moving}  r={34}  g={197} b={94}  />
          <StatCard Icon={PauseCircle} label={isAr ? 'متوقف' : 'Arrêté'}     count={counts.stopped} r={239} g={68}  b={68}  />
          <StatCard Icon={WifiOff}     label={isAr ? 'غير متصل' : 'H. ligne'} count={counts.offline} r={148} g={163} b={184} dimmed />
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-24 pt-3">

        {/* Network error banner */}
        {networkError && (
          <div className="mx-3 mb-3 flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-4 py-3">
            <WifiOff size={14} className="text-amber-500 flex-shrink-0" />
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {isAr ? 'تعذّر الاتصال بالخادم' : 'Impossible de joindre le serveur'}
            </p>
          </div>
        )}

        {/* Quick shortcuts */}
        <Section>
          <div className="grid grid-cols-4 gap-2">
            <Shortcut icon={Map}      label={isAr ? 'الخريطة'  : 'Carte'}     to="/client/map"         color="#0F2044" />
            <Shortcut icon={BarChart2} label={isAr ? 'التقارير' : 'Rapports'}  to="/client/reports"     color="#3b82f6" />
            <Shortcut icon={Wrench}   label={isAr ? 'الصيانة'  : 'Entretien'} to="/client/maintenance" color="#f97316" />
            <Shortcut icon={Car}      label={isAr ? 'المركبات' : 'Appareils'} to="/client/devices"     color="#8b5cf6" />
          </div>
        </Section>

        {/* KM Today + 7-day chart */}
        <Section>
          <Card>
            <SectionTitle>{t(lang, 'kmToday')}</SectionTitle>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
                <p className="text-3xl font-black text-accent leading-none">{todayKm}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t(lang, 'km')}</p>
                <p className="text-[9px] text-slate-400">{isAr ? 'اليوم' : 'auj.'}</p>
              </div>
              <div className="flex-1 h-[72px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 10, padding: '3px 8px', borderRadius: 10, border: 'none', background: '#0F2044', color: '#fff' }}
                        formatter={v => [`${v} ${t(lang, 'km')}`, '']}
                        labelStyle={{ display: 'none' }}
                      />
                      <Line type="monotone" dataKey="km" stroke="#00D97E" strokeWidth={2.5}
                        dot={{ r: 3, fill: '#00D97E', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-[10px] text-slate-400">{isAr ? 'جاري التحميل...' : 'Chargement...'}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Section>

        {/* Live map mini */}
        <Section>
          <SectionTitle
            action={
              <button onClick={() => navigate('/client/map')} className="text-xs text-accent font-semibold flex items-center gap-0.5">
                {t(lang, 'viewAll')} <ChevronRight size={12} />
              </button>
            }
          >
            {t(lang, 'liveMap')}
          </SectionTitle>
          <div
            className="rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700 shadow-sm cursor-pointer"
            style={{ height: 175 }}
            onClick={() => navigate('/client/map')}
          >
            <MapView height="100%" zoom={10} showAllDevices />
          </div>
        </Section>

        {/* Recent alerts */}
        {recentAlerts.length > 0 && (
          <Section>
            <SectionTitle
              action={
                <button onClick={() => navigate('/client/alerts')} className="text-xs text-accent font-semibold flex items-center gap-0.5">
                  {t(lang, 'viewAll')} <ChevronRight size={12} />
                </button>
              }
            >
              {t(lang, 'lastEvents')}
            </SectionTitle>
            <div className="space-y-2">
              {recentAlerts.map((a, i) => <AlertRow key={a.id || i} alert={a} lang={lang} />)}
            </div>
          </Section>
        )}

        {/* Recent devices */}
        <Section>
          <SectionTitle
            action={
              <button onClick={() => navigate('/client/devices')} className="text-xs text-accent font-semibold flex items-center gap-0.5">
                {t(lang, 'viewAll')} <ChevronRight size={12} />
              </button>
            }
          >
            {t(lang, 'myDevices')}
          </SectionTitle>
          {recentDevices.length === 0 ? (
            <Card>
              <EmptyState
                icon={Cpu}
                title={isAr ? 'لا توجد مركبات' : 'Aucun véhicule'}
                subtitle={isAr ? 'ابدأ بإضافة جهاز تتبع' : 'Commencez par ajouter un tracker'}
                action={
                  <button
                    onClick={() => navigate('/client/device-wizard')}
                    className="px-5 py-2.5 bg-accent text-slate-900 rounded-xl text-sm font-bold active:scale-95 transition-transform"
                  >
                    {isAr ? 'إضافة جهاز' : 'Ajouter un appareil'}
                  </button>
                }
              />
            </Card>
          ) : (
            <div className="space-y-2">
              {recentDevices.map(d => (
                <DeviceRow key={d.id} device={d} lang={lang}
                  onClick={() => navigate(`/client/device/${d.id}`)} />
              ))}
            </div>
          )}
        </Section>
      </div>

      <ClientNav />
    </div>
  )
}
