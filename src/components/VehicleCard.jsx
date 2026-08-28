import React, { useEffect, useState } from 'react'
import { Clock, Gauge, Zap } from 'lucide-react'
import { normalizeVehicleType } from '../utils/vehicleAssets'
import { formatVoltage, timeAgo } from './ui'
import carArt from '../assets/vehicle-car.webp'
import bikeArt from '../assets/vehicle-bike.webp'
import truckArt from '../assets/vehicle-truck.webp'

// Unified vehicle/device card used everywhere a vehicle is listed.
// The artwork always matches the vehicle type: car / bike / truck,
// and it is "alive": it floats, gently tilts, and reacts to motion.
const CARD_ART = { car: carArt, bike: bikeArt, truck: truckArt }

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

// Smoothly animates a number towards its target (speed "feels real").
function useLiveNumber(target, duration = 700) {
  const [display, setDisplay] = useState(target || 0)
  useEffect(() => {
    const from = display
    const to = Number.isFinite(Number(target)) ? Number(target) : 0
    if (from === to) return undefined
    const start = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])
  return display
}

export function VehicleCard({ vehicle = {}, lang = 'ar', onClick, compact = false, className = '' }) {
  const l = L[lang === 'fr' ? 'fr' : 'ar']
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const type = normalizeVehicleType(vehicle.type)
  const art = CARD_ART[type] || carArt
  const online = vehicle.status === 'online'
  const rawSpeed = Number.isFinite(Number(vehicle.speed)) ? Number(vehicle.speed) : null
  const speed = useLiveNumber(rawSpeed)
  const moving = online && (rawSpeed || 0) > 0
  const fast = online && (rawSpeed || 0) > 40
  const power = formatVoltage(vehicle.voltage, lang, vehicle.lastUpdate, vehicle.powerDisconnected)
  const typeLabel = TYPE_LABEL[type][lang === 'fr' ? 'fr' : 'ar']

  // Animation timing reacts to real speed: faster = livelier.
  const floatDur = moving ? (fast ? '1.6s' : '2.4s') : '3.6s'

  return (
    <button
      type="button"
      onClick={onClick}
      dir={dir}
      aria-label={`${vehicle.name || vehicle.uniqueId || ''} — ${typeLabel}`}
      className={`group relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-start shadow-sm transition hover:shadow-lg hover:shadow-indigo-100 active:scale-[.99] ${className}`}
      style={{ perspective: '600px' }}
    >
      {/* subtle map backdrop behind the artwork */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 w-2/3 opacity-[.6]"
        style={{
          [dir === 'rtl' ? 'left' : 'right']: 0,
          background:
            'radial-gradient(circle at 65% 55%, rgba(79,70,229,.14), transparent 60%), linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(241,245,249,.9) 55%)',
        }}
      />

      <div className={`relative flex items-stretch gap-3 ${compact ? 'p-3' : 'p-3.5'}`}>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold shadow-sm ring-1 ring-slate-200">
            <span className={`relative flex h-1.5 w-1.5`}>
              {online && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </span>
            <span className={online ? 'text-emerald-600' : 'text-slate-400'}>
              {online ? (moving ? l.moving : l.online) : l.offline}
            </span>
          </span>

          <p className="mt-2 truncate text-[15px] font-extrabold leading-tight text-slate-900">
            {vehicle.name || vehicle.uniqueId || l.na}
          </p>
          <p className="truncate text-[11px] font-medium text-slate-400">{vehicle.plate || vehicle.uniqueId || l.na}</p>

          <div className="mt-2.5 flex items-center gap-2.5">
            <span className="flex items-center gap-1.5">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${moving ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'} transition-colors`}>
                <Gauge className={`h-3.5 w-3.5 ${moving ? 'animate-pulse' : ''}`} />
              </span>
              <span className="leading-tight">
                <span className={`block text-[12px] font-extrabold tabular-nums ${moving ? 'text-indigo-700' : 'text-slate-900'}`}>
                  {rawSpeed == null ? l.na : `${speed} ${l.kmh}`}
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

        {/* Live artwork: big, floats, tilts, casts a breathing shadow */}
        <div className="relative flex w-[46%] max-w-[190px] shrink-0 items-center justify-center">
          {/* glow ring */}
          <span
            aria-hidden="true"
            className={`absolute h-20 w-20 rounded-full blur-xl transition-opacity ${online ? 'bg-indigo-500/25' : 'bg-slate-400/10'}`}
            style={{ animation: `vc-breathe ${floatDur} ease-in-out infinite` }}
          />
          {/* speed streaks while moving */}
          {moving && (
            <span aria-hidden="true" className="absolute inset-0 overflow-hidden">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="absolute h-px w-10 rounded-full bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent"
                  style={{
                    top: `${30 + i * 22}%`,
                    [dir === 'rtl' ? 'right' : 'left']: 0,
                    animation: `vc-streak ${0.9 + i * 0.25}s linear infinite`,
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </span>
          )}
          <img
            src={art}
            alt={typeLabel}
            loading="lazy"
            width={1024}
            height={1024}
            className="relative w-full object-contain drop-shadow-xl transition-transform duration-300 group-hover:scale-105"
            style={{
              maxHeight: compact ? 92 : 110,
              animation: `vc-float ${floatDur} ease-in-out infinite`,
              transformStyle: 'preserve-3d',
            }}
          />
          {/* ground shadow */}
          <span
            aria-hidden="true"
            className="absolute bottom-1 h-2.5 w-3/5 rounded-[50%] bg-slate-900/15 blur-sm"
            style={{ animation: `vc-shadow ${floatDur} ease-in-out infinite` }}
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

      {/* keyframes scoped via emotion-free inline <style> */}
      <style>{`
        @keyframes vc-float {
          0%, 100% { transform: translateY(0) rotate(-1.2deg); }
          50% { transform: translateY(-6px) rotate(1.2deg); }
        }
        @keyframes vc-shadow {
          0%, 100% { transform: scaleX(1); opacity: .55; }
          50% { transform: scaleX(.82); opacity: .3; }
        }
        @keyframes vc-breathe {
          0%, 100% { transform: scale(1); opacity: .8; }
          50% { transform: scale(1.15); opacity: .45; }
        }
        @keyframes vc-streak {
          0% { transform: translateX(0); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateX(${dir === 'rtl' ? '' : '-'}140px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="vc-float"], [style*="vc-shadow"], [style*="vc-breathe"], [style*="vc-streak"] { animation: none !important; }
        }
      `}</style>
    </button>
  )
}

export default VehicleCard
