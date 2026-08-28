import React from 'react'
import { Clock, Gauge, Zap } from 'lucide-react'
import { markerFor, normalizeVehicleType } from '../utils/vehicleAssets'
import { formatVoltage, timeAgo } from './ui'

// Unified vehicle/device card used everywhere a vehicle is listed.
// The artwork always matches the vehicle type: car / bike / truck.
const TYPE_LABEL = {
  car: { ar: 'سيارة', fr: 'Voiture' },
  bike: { ar: 'دراجة نارية', fr: 'Moto' },
  truck: { ar: 'شاحنة', fr: 'Camion' },
}

const L = {
  ar: { online: 'متصل', offline: 'غير متصل', moving: 'متحرك', stopped: 'متوقف',
        speed: 'السرعة', status: 'الحالة', kmh: 'كم/س', lastUpdate: 'آخر تحديث', na: '—' },
  fr: { online: 'En ligne', offline: 'Hors ligne', moving: 'En marche', stopped: 'Arrêté',
        speed: 'Vitesse', status: 'Statut', kmh: 'km/h', lastUpdate: 'Dernière mise à jour', na: '—' },
}

export function VehicleCard({ vehicle = {}, lang = 'ar', onClick, compact = false, className = '' }) {
  const l = L[lang === 'fr' ? 'fr' : 'ar']
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const type = normalizeVehicleType(vehicle.type)
  const marker = markerFor(type)
  const online = vehicle.status === 'online'
  const speed = Number.isFinite(Number(vehicle.speed)) ? Math.round(Number(vehicle.speed)) : null
  const moving = online && (speed || 0) > 0
  const power = formatVoltage(vehicle.voltage, lang, vehicle.lastUpdate, vehicle.powerDisconnected)
  const typeLabel = TYPE_LABEL[type][lang === 'fr' ? 'fr' : 'ar']

  return (
    <button
      type="button"
      onClick={onClick}
      dir={dir}
      aria-label={`${vehicle.name || vehicle.uniqueId || ''} — ${typeLabel}`}
      className={`group relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-start shadow-sm transition hover:shadow-md active:scale-[.995] ${className}`}
    >
      {/* subtle map backdrop behind the artwork */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 w-1/2 opacity-[.55]"
        style={{
          [dir === 'rtl' ? 'left' : 'right']: 0,
          background:
            'radial-gradient(circle at 70% 50%, rgba(79,70,229,.10), transparent 62%), linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(241,245,249,.9) 45%)',
        }}
      />

      <div className={`relative flex items-stretch gap-3 ${compact ? 'p-3' : 'p-3.5'}`}>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold shadow-sm ring-1 ring-slate-200">
            <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className={online ? 'text-emerald-600' : 'text-slate-400'}>{online ? l.online : l.offline}</span>
          </span>

          <p className="mt-2 truncate text-[15px] font-extrabold leading-tight text-slate-900">
            {vehicle.name || vehicle.uniqueId || l.na}
          </p>
          <p className="truncate text-[11px] font-medium text-slate-400">{vehicle.plate || vehicle.uniqueId || l.na}</p>

          <div className="mt-2.5 flex items-center gap-2.5">
            <span className="flex items-center gap-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Gauge className="h-3.5 w-3.5" />
              </span>
              <span className="leading-tight">
                <span className="block text-[12px] font-extrabold text-slate-900">
                  {speed == null ? l.na : `${speed} ${l.kmh}`}
                </span>
                <span className="block text-[9px] text-slate-400">{l.speed}</span>
              </span>
            </span>
            <span className="h-7 w-px bg-slate-200" />
            <span className="flex items-center gap-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Zap className="h-3.5 w-3.5" />
              </span>
              <span className="leading-tight">
                <span className="block text-[12px] font-extrabold text-slate-900">{power}</span>
                <span className="block text-[9px] text-slate-400">{l.status}</span>
              </span>
            </span>
          </div>
        </div>

        <div className="relative flex w-[38%] max-w-[150px] shrink-0 items-center justify-center">
          <span
            aria-hidden="true"
            className={`absolute h-14 w-14 rounded-full ${moving ? 'bg-indigo-500/15' : 'bg-slate-400/10'}`}
          />
          <img
            src={marker.url}
            alt={typeLabel}
            loading="lazy"
            className="relative w-full max-w-[120px] object-contain drop-shadow"
            style={{ maxHeight: compact ? 56 : 68 }}
          />
        </div>
      </div>

      <div className="relative flex items-center gap-2 border-t border-slate-100 px-3.5 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Clock className="h-3 w-3" />
        </span>
        <span className="truncate text-[11px] font-semibold text-slate-600">
          {vehicle.lastUpdate ? timeAgo(vehicle.lastUpdate, lang) : l.na}
        </span>
        <span className="truncate text-[10px] text-slate-400">· {l.lastUpdate}</span>
      </div>
    </button>
  )
}

export default VehicleCard
