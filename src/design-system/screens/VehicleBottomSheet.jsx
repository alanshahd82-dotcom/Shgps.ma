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

const stages = {
  collapsed: 'h-[72px]',
  peek: 'h-[280px]',
  full: 'h-[75vh]',
}

const statusMap = {
  online: { variant: 'online', label: 'متصل' },
  offline: { variant: 'offline', label: 'غير متصل' },
  alert: { variant: 'alert', label: 'تنبيه' },
  danger: { variant: 'danger', label: 'خطر' },
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] bg-slate-50 p-2.5" dir="rtl">
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
  return statusMap[vehicle.status] || { variant: 'offline', label: 'غير معروف' }
}

export function VehicleBottomSheet({ vehicle, stage = 'peek', onStageChange, onClose }) {
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
        dir="rtl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        <div className="flex items-center justify-between px-4 pb-2 pt-2">
          <button
            type="button"
            aria-label={isCollapsed ? 'توسيع التفاصيل' : 'تغيير حجم التفاصيل'}
            onClick={() => onStageChange?.(nextStage)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {isCollapsed ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 text-right">
              <h2 id={`vehicle-sheet-${vehicle.id}`} className="truncate text-base font-semibold text-primary">{vehicle.name}</h2>
          {!isCollapsed && <p className="text-xs text-slate-500">آخر تحديث: {vehicle.lastUpdate || 'غير متوفر'}</p>}
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <button
            type="button"
            aria-label="إغلاق"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!isCollapsed && (
          <div className="space-y-3 overflow-y-auto px-4 pb-5">
            <div className="grid grid-cols-2 gap-2">
              <Metric icon={Gauge} label="السرعة" value={Number.isFinite(vehicle.speed) ? `${vehicle.speed} كم/س` : 'غير متوفر'} />
              <Metric icon={Battery} label="البطارية" value={Number.isFinite(vehicle.battery) ? `${vehicle.battery}%` : 'غير متوفر'} />
              <Metric icon={MapPin} label="الموقع" value={vehicle.location || (Number.isFinite(vehicle.lat) && Number.isFinite(vehicle.lng) && (vehicle.lat !== 0 || vehicle.lng !== 0) ? `${vehicle.lat.toFixed(4)}, ${vehicle.lng.toFixed(4)}` : 'غير متوفر')} />
              <Metric icon={vehicle.ignition == null ? Clock : vehicle.ignition ? Gauge : Clock} label="حالة المحرك" value={vehicle.ignition == null ? 'غير متوفر' : vehicle.ignition ? 'المحرك يعمل' : 'متوقف'} />
            </div>
            <Link to={`/client/vehicle/${vehicle.id}`} className="flex items-center justify-center gap-2 rounded-[10px] bg-accent px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              فتح تفاصيل المركبة
            </Link>
          </div>
        )}
      </motion.section>
    </AnimatePresence>
  )
}

export default VehicleBottomSheet