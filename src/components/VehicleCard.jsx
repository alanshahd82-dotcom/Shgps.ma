import React, { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Clock, Gauge, MapPin, Navigation, Power,
} from 'lucide-react'
import { normalizeVehicleType } from '../utils/vehicleAssets'
import {
  formatVoltage, getBatteryPercent, getVoltageColor, timeAgo,
} from './ui'
import { useReverseGeocode } from '../utils/reverseGeocode'
import { useEngineControl } from '../hooks/useEngineControl'
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
  ar: {
    online: 'متصل', offline: 'غير متصل', moving: 'متحرك', stopped: 'متوقف',
    speed: 'السرعة', status: 'الحالة', kmh: 'كم/س', lastUpdate: 'آخر تحديث', na: '—',
    overspeed: 'تجاوز السرعة', battery: 'البطارية', signal: 'الإشارة',
    cutEngine: 'قطع', restoreEngine: 'تشغيل', confirm: 'تأكيد؟',
    address: 'العنوان', km: 'كم', loading: '...', failed: 'فشل',
  },
  fr: {
    online: 'En ligne', offline: 'Hors ligne', moving: 'En marche', stopped: 'Arrêté',
    speed: 'Vitesse', status: 'Statut', kmh: 'km/h', lastUpdate: 'Dernière maj', na: '—',
    overspeed: 'Excès de vitesse', battery: 'Batterie', signal: 'Signal',
    cutEngine: 'Couper', restoreEngine: 'Démarrer', confirm: 'Confirmer?',
    address: 'Adresse', km: 'km', loading: '...', failed: 'Échec',
  },
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

// ── Signal strength ──────────────────────────────────────────────────────────
function signalToBars(signal) {
  const s = Number(signal)
  if (!Number.isFinite(s)) return 0
  if (s < 0) {
    // dBm (negative, typical for GSM RSSI)
    if (s >= -60) return 4
    if (s >= -80) return 3
    if (s >= -100) return 2
    if (s >= -110) return 1
    return 0
  }
  // percentage or positive arbitrary value
  if (s >= 75) return 4
  if (s >= 50) return 3
  if (s >= 25) return 2
  if (s > 0) return 1
  return 0
}

function signalColor(bars) {
  if (bars >= 3) return '#22c55e'
  if (bars === 2) return '#f59e0b'
  if (bars === 1) return '#ef4444'
  return '#cbd5e1'
}

function SignalBars({ signal }) {
  const bars = signalToBars(signal)
  const color = signalColor(bars)
  return (
    <span className="flex items-end gap-px" aria-hidden="true" title={`Signal: ${signal ?? '—'}`}>
      {[1, 2, 3, 4].map(i => (
        <span
          key={i}
          className="rounded-[1px] transition-colors"
          style={{
            width: 2,
            height: 2 + i * 2,
            background: i <= bars ? color : '#e2e8f0',
          }}
        />
      ))}
    </span>
  )
}

// ── Visual battery indicator ──────────────────────────────────────────────────
function BatteryIcon({ voltage, powerDisconnected }) {
  const pct = powerDisconnected ? 0 : getBatteryPercent(voltage)
  const hasData = !powerDisconnected && getBatteryPercent(voltage) != null
  const color = powerDisconnected
    ? '#dc2626'
    : hasData
      ? getVoltageColor(voltage)
      : '#cbd5e1'
  return (
    <span className="relative flex items-center" aria-hidden="true">
      <span
        className="relative flex h-3.5 w-6 items-center rounded-[3px] border px-px"
        style={{ borderColor: color }}
      >
        <span
          className="h-1.5 rounded-[1px] transition-all"
          style={{
            width: `${pct ?? 0}%`,
            background: color,
            opacity: hasData ? 1 : 0.25,
          }}
        />
      </span>
      <span className="h-1.5 w-0.5 rounded-r" style={{ background: color }} />
    </span>
  )
}

// ── Daily distance from total odometer ────────────────────────────────────────
function getDailyDistance(deviceId, totalDistance) {
  const td = Number(totalDistance)
  if (!deviceId || !Number.isFinite(td)) return null
  const today = new Date().toISOString().slice(0, 10)
  const key = `athar_daily_${deviceId}`
  try {
    const stored = JSON.parse(localStorage.getItem(key) || 'null')
    if (!stored || stored.date !== today) {
      localStorage.setItem(key, JSON.stringify({ date: today, start: td }))
      return 0
    }
    const km = (td - stored.start) / 1000
    return Math.max(0, Math.round(km * 10) / 10)
  } catch {
    return null
  }
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function VehicleCard({
  vehicle = {},
  lang = 'ar',
  onClick,
  onOpen,
  compact = false,
  overspeedThreshold = 120,
  className = '',
}) {
  const l = L[lang === 'fr' ? 'fr' : 'ar']
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const type = normalizeVehicleType(vehicle.type)
  const art = CARD_ART[type] || carArt
  const online = vehicle.status === 'online'
  const rawSpeed = Number.isFinite(Number(vehicle.speed)) ? Number(vehicle.speed) : null
  const speed = useLiveNumber(rawSpeed)
  const moving = online && (rawSpeed || 0) > 0
  const fast = online && (rawSpeed || 0) > 40
  const overspeed = online && rawSpeed != null && rawSpeed > overspeedThreshold
  const power = formatVoltage(vehicle.voltage, lang, vehicle.lastUpdate, vehicle.powerDisconnected)
  const typeLabel = TYPE_LABEL[type][lang === 'fr' ? 'fr' : 'ar']
  const floatDur = moving ? (fast ? '1.6s' : '2.4s') : '3.6s'

  // Engine control — shared logic with the vehicle detail page (single source
  // of truth). Two-click confirm stays local to the card UI.
  const engine = useEngineControl(vehicle, lang)
  const engineRunning = engine.engineRunning
  const canControlEngine = engine.canControl
  const engineLoading = engine.sending
  const engineErr = !!engine.error
  const [engineConfirm, setEngineConfirm] = useState(false)
  const engineTimerRef = useRef(null)

  function handleEngineClick(e) {
    e.stopPropagation()
    if (engineLoading || !canControlEngine) return
    if (!engineConfirm) {
      setEngineConfirm(true)
      engineTimerRef.current = setTimeout(() => setEngineConfirm(false), 3000)
      return
    }
    clearTimeout(engineTimerRef.current)
    setEngineConfirm(false)
    const turnOff = engineRunning
    Promise.resolve(engine.send(turnOff))
      .finally(() => { setTimeout(() => engine.clearFeedback(), 4000) })
  }

  useEffect(() => () => clearTimeout(engineTimerRef.current), [])

  // Address (lazy reverse geocoding with backend fallback)
  const address = useReverseGeocode(vehicle.lat, vehicle.lng, vehicle.address)

  // Daily distance from total odometer
  const dailyKm = getDailyDistance(vehicle.id || vehicle.uniqueId, vehicle.totalDistance)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick || onOpen}
      onKeyDown={e => { const open = onClick || onOpen; if (e.key === 'Enter' && open) open() }}
      dir={dir}
      aria-label={`${vehicle.name || vehicle.uniqueId || ''} — ${typeLabel}`}
      className={`group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-start shadow-sm transition hover:shadow-lg hover:shadow-indigo-100 active:scale-[.99] ${className}`}
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
          {/* status + overspeed badges */}
          <div className="flex items-center gap-1.5">
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
            {overspeed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 ring-1 ring-red-200">
                <AlertTriangle size={10} />
                {l.overspeed}
              </span>
            )}
          </div>

          <p className="mt-2 truncate text-[15px] font-extrabold leading-tight text-slate-900">
            {vehicle.name || vehicle.uniqueId || l.na}
          </p>
          <p className="truncate text-[11px] font-medium text-slate-400">{vehicle.plate || vehicle.uniqueId || l.na}</p>

          {/* metrics row: speed | battery | signal */}
          <div className="mt-2.5 flex items-center gap-2">
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
                <BatteryIcon voltage={vehicle.voltage} powerDisconnected={vehicle.powerDisconnected} />
              </span>
              <span className="leading-tight">
                <span className="block text-[12px] font-extrabold text-slate-900">{power}</span>
                <span className="block text-[9px] text-slate-400">{l.battery}</span>
              </span>
            </span>
            <span className="h-7 w-px bg-slate-200" />
            <span className="flex items-center gap-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
                <SignalBars signal={vehicle.signal} />
              </span>
              <span className="leading-tight">
                <span className="block text-[9px] text-slate-400">{l.signal}</span>
              </span>
            </span>
          </div>
        </div>

        {/* Live artwork: big, floats, tilts, casts a breathing shadow */}
        <div className="relative flex w-[42%] max-w-[170px] shrink-0 items-center justify-center">
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

      {/* bottom bar: address + heading/distance + last update + engine */}
      <div className="relative flex items-center gap-2 border-t border-slate-100 px-3 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <MapPin className="h-3 w-3" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-600">
          {address || (vehicle.lat != null ? `${Number(vehicle.lat).toFixed(3)}, ${Number(vehicle.lng).toFixed(3)}` : l.na)}
        </span>

        {/* heading arrow + daily distance */}
        {(vehicle.course != null || dailyKm != null) && (
          <span className="flex shrink-0 items-center gap-1">
            {vehicle.course != null && Number.isFinite(Number(vehicle.course)) && (
              <Navigation
                size={11}
                className="text-indigo-600"
                style={{ transform: `rotate(${vehicle.course}deg)` }}
              />
            )}
            {dailyKm != null && (
              <span className="text-[10px] font-bold tabular-nums text-slate-600">{dailyKm} {l.km}</span>
            )}
          </span>
        )}

        {/* last update */}
        <span className="shrink-0 truncate text-[10px] text-slate-400">
          · {vehicle.lastUpdate ? timeAgo(vehicle.lastUpdate, lang) : l.na}
        </span>

        {/* engine cut / restore button */}
        {canControlEngine && (
          <button
            type="button"
            onClick={handleEngineClick}
            disabled={engineLoading}
            className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors disabled:opacity-60 ${
              engineConfirm
                ? 'animate-pulse bg-red-500 text-white'
                : engineRunning
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
            aria-label={engineRunning ? l.cutEngine : l.restoreEngine}
          >
            <Power size={12} />
            {engineLoading ? l.loading : engineErr ? l.failed : engineConfirm ? l.confirm : engineRunning ? l.cutEngine : l.restoreEngine}
          </button>
        )}
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
    </div>
  )
}

export default VehicleCard
