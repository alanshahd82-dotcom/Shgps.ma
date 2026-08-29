import React, { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Battery,
  ChevronDown,
  ChevronUp,
  Clock,
  Gauge,
  MapPin,
  ExternalLink,
  X,
} from 'lucide-react'
import { Badge } from '../index.ts'
import { Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'

const stages = {
  collapsed: 'h-[72px]',
  peek: 'h-[280px]',
  full: 'h-[75vh]',
}

const statusMap = {
  online: { variant: 'online', label: { ar: 'متصل', fr: 'En ligne' } },
  offline: { variant: 'offline', label: { ar: 'غير متصل', fr: 'Hors ligne' } },
  alert: { variant: 'alert', label: { ar: 'تنبيه', fr: 'Alerte' } },
  danger: { variant: 'danger', label: { ar: 'خطر', fr: 'Danger' } },
}

function Metric({ icon: Icon, label, value, dir = 'rtl' }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] bg-slate-50 p-2.5" dir={dir}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-accent shadow-sm">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] text-slate-500">{label}</span>
        <strong className="block truncate text-sm text-primary">{value}</strong>
      </span>
    </div>
  )
}

function getStatus(vehicle) {
  if (vehicle.charge === false && vehicle.status === 'offline') return statusMap.danger
  if (vehicle.alerts?.length > 0) return statusMap.alert
  return statusMap[vehicle.status] || { variant: 'offline', label: { ar: 'غير معروف', fr: 'Inconnu' } }
}

export function VehicleBottomSheet({ vehicle, stage = 'peek', onStageChange, onClose }) {
  const { lang } = useApp()
  const isAr = lang !== 'fr'
  const dir = isAr ? 'rtl' : 'ltr'
  const na = isAr ? 'غير متوفر' : 'Indisponible'
  const status = getStatus(vehicle)

  useEffect(() => {
    if (!vehicle) return undefined
    const onKeyDown = event => event.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [vehicle, onClose])

  if (!vehicle) return null

  const nextStage = stage === 'collapsed' ? 'peek' : stage === 'peek' ? 'full' : 'peek'
  const isCollapsed = stage === 'collapsed'
  const isFull = stage === 'full'

  return (
    <AnimatePresence>
      <motion.section
        role="dialog"
        aria-modal="false"
        aria-labelledby={`vehicle-sheet-${vehicle.id}`}
        className={`absolute inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 overflow-hidden rounded-t-[24px] bg-white shadow-2xl transition-[height] duration-300 ease-in-out ${stages[stage] || stages.peek}`}
        dir={dir}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        <div className="flex items-center justify-between px-4 pb-2 pt-2">
          <button
            type="button"
            aria-label={isCollapsed ? (isAr ? 'توسيع التفاصيل' : 'Agrandir les détails') : (isAr ? 'تغيير حجم التفاصيل' : 'Redimensionner les détails')}
            onClick={() => onStageChange?.(nextStage)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {isCollapsed ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 text-right">
              <h2 id={`vehicle-sheet-${vehicle.id}`} className="truncate text-base font-semibold text-primary">{vehicle.name}</h2>
          {!isCollapsed && <p className="text-xs text-slate-500">{isAr ? 'آخر تحديث: ' : 'Dernière mise à jour : '}{vehicle.lastUpdate || na}</p>}
            </div>
            <Badge variant={status.variant}>{isAr ? status.label.ar : status.label.fr}</Badge>
          </div>
          <button
            type="button"
            aria-label={isAr ? 'إغلاق' : 'Fermer'}
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!isCollapsed && (
          <div className="space-y-3 overflow-y-auto px-4 pb-5">
            <div className="grid grid-cols-2 gap-2">
              <Metric dir={dir} icon={Gauge} label={isAr ? 'السرعة' : 'Vitesse'} value={Number.isFinite(vehicle.speed) ? `${vehicle.speed} ${isAr ? 'كم/س' : 'km/h'}` : na} />
              <Metric dir={dir} icon={Battery} label={isAr ? 'البطارية' : 'Batterie'} value={Number.isFinite(vehicle.battery) ? `${vehicle.battery}%` : na} />
              <Metric dir={dir} icon={MapPin} label={isAr ? 'الموقع' : 'Position'} value={vehicle.location || (Number.isFinite(vehicle.lat) && Number.isFinite(vehicle.lng) && (vehicle.lat !== 0 || vehicle.lng !== 0) ? `${vehicle.lat.toFixed(4)}, ${vehicle.lng.toFixed(4)}` : na)} />
              <Metric dir={dir} icon={vehicle.ignition == null ? Clock : vehicle.ignition ? Gauge : Clock} label={isAr ? 'حالة المحرك' : 'État du moteur'} value={vehicle.ignition == null ? na : vehicle.ignition ? (isAr ? 'المحرك يعمل' : 'Moteur en marche') : (isAr ? 'متوقف' : 'À l’arrêt')} />
            </div>
            <Link to={`/client/vehicle/${vehicle.id}`} className="flex items-center justify-center gap-2 rounded-[10px] bg-accent px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {isAr ? 'فتح تفاصيل المركبة' : 'Ouvrir la fiche du véhicule'}
            </Link>
          </div>
        )}
      </motion.section>
    </AnimatePresence>
  )
}

export default VehicleBottomSheet