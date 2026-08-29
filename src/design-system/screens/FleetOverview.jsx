import React, { useMemo } from 'react'
import { AlertTriangle, Car, ChevronLeft, Gauge, Radio, WifiOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useRealVehicles } from '../hooks/useRealVehicles'
import { isMoving } from '../../utils/motion'

function Metric({ icon: Icon, label, value, tone = 'neutral' }) {
  const toneClasses = {
    neutral: 'bg-white/95 text-primary',
    connected: 'bg-blue-50/95 text-blue-700',
    offline: 'bg-slate-100/95 text-slate-600',
    moving: 'bg-emerald-50/95 text-emerald-700',
    alert: 'bg-red-50/95 text-red-700',
  }

  return (
    <div className={`flex min-w-[92px] items-center gap-2 rounded-2xl border border-white/80 px-3 py-2 shadow-sm backdrop-blur ${toneClasses[tone]}`} aria-label={`${label}: ${value}`}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-black/[0.04]" aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 text-right">
        <span className="block text-[10px] font-medium opacity-70">{label}</span>
        <span className="block text-sm font-extrabold leading-4">{value}</span>
      </span>
    </div>
  )
}

function VehicleQuickLink({ vehicle, onClick, isAr = true }) {
  const moving = vehicle.status === 'online' && isMoving(vehicle)
  const hasAlert = Array.isArray(vehicle.alerts) && vehicle.alerts.length > 0

  return (
    <button
      type="button"
      onClick={() => onClick(vehicle.id)}
      className="flex min-w-0 items-center gap-2 rounded-xl border border-white/80 bg-white/95 px-3 py-2 text-right shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`${isAr ? 'فتح مركبة' : 'Ouvrir le véhicule'} ${vehicle.name}`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${hasAlert ? 'bg-red-50 text-red-600' : moving ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
        {hasAlert ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : moving ? <Gauge className="h-3.5 w-3.5" aria-hidden="true" /> : <Car className="h-3.5 w-3.5" aria-hidden="true" />}
      </span>
      <span className="min-w-0">
        <span className="block max-w-[112px] truncate text-[11px] font-bold text-primary">{vehicle.name}</span>
        <span className="block text-[10px] text-slate-500">{hasAlert ? (isAr ? 'تحتاج إلى مراجعة' : 'À vérifier') : moving ? (isAr ? 'متحركة الآن' : 'En mouvement') : (isAr ? 'عرض التفاصيل' : 'Voir les détails')}</span>
      </span>
      <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
    </button>
  )
}

export function FleetOverview() {
  const navigate = useNavigate()
  const { alertsList, unreadCount, lang } = useApp()
  const isAr = lang !== 'fr'
  const { vehicles } = useRealVehicles()

  const summary = useMemo(() => {
    const statusIsReliable = vehicles.length > 0 && vehicles.every(vehicle => vehicle.status === 'online' || vehicle.status === 'offline')
    const speedIsReliable = vehicles.length > 0 && vehicles.every(vehicle => vehicle.status !== 'online' || Number.isFinite(vehicle.speed))
    const moving = speedIsReliable ? vehicles.filter(vehicle => vehicle.status === 'online' && isMoving(vehicle)).length : null
    const importantVehicles = vehicles
      .filter(vehicle => (Array.isArray(vehicle.alerts) && vehicle.alerts.length > 0) || (vehicle.status === 'online' && isMoving(vehicle)))
      .slice(0, 2)

    return {
      total: vehicles.length,
      connected: statusIsReliable ? vehicles.filter(vehicle => vehicle.status === 'online').length : null,
      disconnected: statusIsReliable ? vehicles.filter(vehicle => vehicle.status === 'offline').length : null,
      moving,
      importantVehicles,
    }
  }, [vehicles])

  const hasAlerts = unreadCount > 0
  const alertVehicles = vehicles.filter(vehicle => Array.isArray(vehicle.alerts) && vehicle.alerts.length > 0)
  const hasAlertData = Array.isArray(alertsList)

  return (
    <section className="pointer-events-none absolute inset-x-3 top-3 z-[500] space-y-2 sm:inset-x-5 sm:top-4" dir={isAr ? 'rtl' : 'ltr'} aria-label={isAr ? 'ملخص الأسطول' : 'Résumé de la flotte'}>
      <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Metric icon={Car} label={isAr ? 'المركبات' : 'Véhicules'} value={summary.total} />
        {summary.connected !== null && <Metric icon={Radio} label={isAr ? 'متصلة' : 'Connectés'} value={summary.connected} tone="connected" />}
        {summary.disconnected !== null && <Metric icon={WifiOff} label={isAr ? 'غير متصلة' : 'Hors ligne'} value={summary.disconnected} tone="offline" />}
        {summary.moving !== null && <Metric icon={Gauge} label={isAr ? 'متحركة' : 'En mouvement'} value={summary.moving} tone="moving" />}
        {hasAlertData && <Metric icon={AlertTriangle} label={isAr ? 'تنبيهات' : 'Alertes'} value={unreadCount} tone={hasAlerts ? 'alert' : 'neutral'} />}
      </div>

      {hasAlerts && (
        <button
          type="button"
          onClick={() => navigate('/client/alerts')}
          className="pointer-events-auto flex min-h-10 w-fit max-w-full items-center gap-2 rounded-2xl border border-red-200/80 bg-white/95 px-3 py-2 text-right text-xs font-bold text-red-700 shadow-sm backdrop-blur transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={isAr ? `فتح ${unreadCount} تنبيهات غير مقروءة` : `Ouvrir ${unreadCount} alertes non lues`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{isAr ? `${unreadCount} تنبيهات غير مقروءة` : `${unreadCount} alertes non lues`}</span>
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      )}

      {summary.importantVehicles.length > 0 && (
        <div className="pointer-events-auto flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={isAr ? 'وصول سريع للمركبات المهمة' : 'Accès rapide aux véhicules importants'}>
          {summary.importantVehicles.map(vehicle => (
            <VehicleQuickLink key={vehicle.id} isAr={isAr} vehicle={vehicle} onClick={id => navigate(`/client/vehicle/${id}`)} />
          ))}
          {alertVehicles.length > 2 && (
            <button type="button" onClick={() => navigate('/client/map')} className="shrink-0 rounded-xl border border-white/80 bg-white/90 px-3 text-[11px] font-bold text-primary shadow-sm backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              {isAr ? 'عرض الكل' : 'Voir tout'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export default FleetOverview
