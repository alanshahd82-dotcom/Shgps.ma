import React, { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Clock, Loader2, MapPin, Navigation, Power, PlugZap,
} from 'lucide-react'
import { normalizeVehicleType } from '../utils/vehicleAssets'
import {
  formatVoltage, getBatteryPercent, getVoltageColor, isMeasuredNoSupply, timeAgo,
} from './ui'
import { useReverseGeocode } from '../utils/reverseGeocode'
import { useEngineControl } from '../hooks/useEngineControl'
import { agoLabel, locationState } from '../utils/location'
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
    speed: 'السرعة', status: 'الحالة', powerCut: 'الطاقة مفصولة', kmh: 'كم/س', lastUpdate: 'آخر تحديث', na: '—',
    overspeed: 'تجاوز السرعة', battery: 'البطارية', signal: 'الإشارة',
    cutEngine: 'قطع', restoreEngine: 'تشغيل', confirm: 'تأكيد؟',
    address: 'العنوان', km: 'كم', loading: '...', failed: 'فشل',
    lastKnown: 'آخر موقع معروف', noGps: 'لا توجد إشارة GPS', noLocation: 'الموقع غير متاح',
  },
  fr: {
    online: 'En ligne', offline: 'Hors ligne', moving: 'En marche', stopped: 'Arrêté',
    speed: 'Vitesse', status: 'Statut', powerCut: 'Alimentation coupée', kmh: 'km/h', lastUpdate: 'Dernière maj', na: '—',
    overspeed: 'Excès de vitesse', battery: 'Batterie', signal: 'Signal',
    cutEngine: 'Couper', restoreEngine: 'Démarrer', confirm: 'Confirmer?',
    address: 'Adresse', km: 'km', loading: '...', failed: 'Échec',
    lastKnown: 'Dernière position connue', noGps: 'Pas de signal GPS', noLocation: 'Position indisponible',
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
import { signalToBars, signalColor } from '../utils/signal'

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
  const noSupply = powerDisconnected || isMeasuredNoSupply(voltage)
  const pct = noSupply ? 0 : getBatteryPercent(voltage)
  const hasData = !noSupply && getBatteryPercent(voltage) != null
  const color = noSupply
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

// ── Cinematic "stage" behind the vehicle ─────────────────────────────────────
// One look per situation so the fleet can be read at a glance.
const STAGE = {
  move:  { bg: 'linear-gradient(135deg,#1e1b4b 0%,#4338ca 55%,#7c3aed 115%)', glow: 'rgba(167,139,250,.55)', dial: '#c7d2fe' },
  live:  { bg: 'linear-gradient(135deg,#0b1220 0%,#1e3a8a 62%,#2563eb 125%)', glow: 'rgba(96,165,250,.45)',  dial: '#bfdbfe' },
  off:   { bg: 'linear-gradient(135deg,#1e293b 0%,#475569 120%)',              glow: 'rgba(148,163,184,.22)', dial: '#cbd5e1' },
  power: { bg: 'linear-gradient(135deg,#450a0a 0%,#b91c1c 120%)',              glow: 'rgba(248,113,113,.5)',  dial: '#fecaca' },
  alarm: { bg: 'linear-gradient(135deg,#431407 0%,#ea580c 120%)',              glow: 'rgba(251,146,60,.5)',   dial: '#fed7aa' },
}

// Speed ring: 270° gauge, the number sits in the middle.
function SpeedDial({ value, active, color, unit, max = 140 }) {
  const r = 26
  const c = 2 * Math.PI * r
  const arc = c * 0.75
  const pct = active ? Math.min(1, Math.max(0, Number(value) || 0) / max) : 0
  return (
    <span className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full rotate-[135deg]">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${arc} ${c}`} />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${arc * pct} ${c}`}
          style={{ transition: 'stroke-dasharray .7s cubic-bezier(.22,1,.36,1)', filter: 'drop-shadow(0 0 4px rgba(255,255,255,.35))' }}
        />
      </svg>
      <span className="relative flex flex-col items-center leading-none text-white">
        <span className="text-[19px] font-extrabold tabular-nums">{active ? value : '—'}</span>
        <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-white/60">{unit}</span>
      </span>
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
  const power = formatVoltage(vehicle.voltage, lang, vehicle.lastUpdate, vehicle.powerDisconnected, vehicle.voltageStale)
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
  const loc = locationState(vehicle)
  const address = useReverseGeocode(loc.point?.[0], loc.point?.[1], loc.point ? vehicle.address : null)

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
      {/* Stage: gradient scene per situation, big vehicle, speed ring, moving road */}
      {(() => {
        const powerCut = vehicle.powerDisconnected === true
        const tone = powerCut ? 'power' : overspeed ? 'alarm' : !online ? 'off' : moving ? 'move' : 'live'
        const st = STAGE[tone]
        const side = dir === 'rtl' ? 'left' : 'right'
        const artH = compact ? 118 : 138
        return (
          <div className="relative overflow-hidden" style={{ background: st.bg, minHeight: compact ? 148 : 168 }}>
            {/* soft light behind the vehicle */}
            <span aria-hidden="true" className="pointer-events-none absolute h-40 w-40 rounded-full blur-2xl"
              style={{ [side]: -10, top: 6, background: st.glow, animation: `vc-breathe ${floatDur} ease-in-out infinite` }} />
            {/* grid + light rays for depth */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[.12]"
              style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)', backgroundSize: '26px 26px', maskImage: 'linear-gradient(to bottom, transparent, black 70%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 70%)' }} />
            {/* road: dashed line that runs while the vehicle moves */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-black/25" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[11px] h-[3px] opacity-70"
              style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.85) 0 18px, transparent 18px 44px)', backgroundSize: '88px 3px', animation: moving ? `vc-road ${fast ? 0.5 : 0.9}s linear infinite` : 'none' }} />
            {/* speed streaks while moving */}
            {moving && (
              <span aria-hidden="true" className="absolute inset-0 overflow-hidden">
                {[0, 1, 2, 3].map(i => (
                  <span key={i} className="absolute h-px w-14 rounded-full bg-gradient-to-r from-transparent via-white/70 to-transparent"
                    style={{ top: `${22 + i * 16}%`, [dir === 'rtl' ? 'right' : 'left']: 0, animation: `vc-streak ${0.8 + i * 0.22}s linear infinite`, animationDelay: `${i * 0.18}s` }} />
                ))}
              </span>
            )}

            {/* vehicle artwork */}
            <img
              src={art}
              alt={typeLabel}
              loading="lazy"
              width={1024}
              height={1024}
              className={`pointer-events-none absolute bottom-3 object-contain transition-all duration-500 group-hover:scale-105 ${online ? '' : 'grayscale opacity-60'}`}
              style={{
                [side]: compact ? 6 : 10,
                height: artH,
                width: artH,
                filter: online ? 'drop-shadow(0 14px 14px rgba(0,0,0,.45))' : undefined,
                animation: `vc-float ${floatDur} ease-in-out infinite`,
              }}
            />
            <span aria-hidden="true" className="absolute bottom-[7px] h-2.5 rounded-[50%] bg-black/45 blur-[3px]"
              style={{ [side]: compact ? 22 : 28, width: artH * 0.7, animation: `vc-shadow ${floatDur} ease-in-out infinite` }} />

            {/* content */}
            <div className={`relative flex h-full flex-col justify-between ${compact ? 'p-3' : 'p-3.5'}`} style={{ minHeight: compact ? 148 : 168 }}>
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white ring-1 ring-white/25 backdrop-blur-sm">
                    <span className="relative flex h-1.5 w-1.5">
                      {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />}
                      <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                    </span>
                    {online ? (moving ? l.moving : l.online) : l.offline}
                  </span>
                  {powerCut && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-red-700">
                      <PlugZap size={10} /> {l.powerCut}
                    </span>
                  )}
                  {overspeed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-red-600">
                      <AlertTriangle size={10} /> {l.overspeed}
                    </span>
                  )}
                </div>
                <p className="mt-2 max-w-[62%] truncate text-[16px] font-extrabold leading-tight text-white drop-shadow-sm">
                  {vehicle.name || vehicle.uniqueId || l.na}
                </p>
                <p className="max-w-[62%] truncate text-[11px] font-semibold tracking-wide text-white/65">{vehicle.plate || vehicle.uniqueId || l.na}</p>
              </div>
              <div className="mt-2 flex items-end">
                <SpeedDial value={speed} active={online && rawSpeed != null} color={overspeed ? '#fca5a5' : st.dial} unit={l.kmh} />
              </div>
            </div>
          </div>
        )
      })()}

      {/* battery | signal | distance */}
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-slate-100 bg-white px-3.5 py-2.5">
        <span className="flex items-center gap-1.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <BatteryIcon voltage={vehicle.voltage} powerDisconnected={vehicle.powerDisconnected} />
          </span>
          <span className="leading-tight">
            <span className="block whitespace-nowrap text-[12px] font-extrabold tabular-nums text-slate-900"><bdi>{power}</bdi></span>
            <span className="block text-[9px] text-slate-400">{l.battery}</span>
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
            <SignalBars signal={vehicle.signal} />
          </span>
          <span className="leading-tight">
            <span className="block text-[9px] text-slate-400">{l.signal}</span>
          </span>
        </span>
      </div>

      {/* bottom bar: address + heading/distance + last update + engine */}
      <div className="relative flex items-center gap-2 border-t border-slate-100 px-3 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <MapPin className="h-3 w-3" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[11px] font-semibold text-slate-600">
            {address || (loc.point ? <bdi>{`${loc.point[0].toFixed(4)}, ${loc.point[1].toFixed(4)}`}</bdi> : l.noLocation)}
          </span>
          {(loc.lastKnown || loc.noGps) && (
            <span className={`mt-0.5 flex items-center gap-1 truncate text-[10px] font-bold ${loc.noGps ? 'text-amber-600' : 'text-slate-400'}`}>
              <Clock size={10} aria-hidden="true" />
              <span className="truncate">{loc.noGps ? l.noGps : l.lastKnown}{agoLabel(loc.at, lang) ? ` · ${agoLabel(loc.at, lang)}` : ''}</span>
            </span>
          )}
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

      </div>

      {/* Engine control — the primary action */}
      {canControlEngine && (
        <div className="border-t border-slate-100 p-2.5">
          <button
            type="button"
            onClick={handleEngineClick}
            disabled={engineLoading}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-extrabold transition-colors disabled:opacity-70 ${
              engineConfirm
                ? 'animate-pulse bg-red-700 text-white ring-4 ring-red-200'
                : engineRunning
                  ? 'bg-red-600 text-white shadow-md shadow-red-200/70 hover:bg-red-700 active:scale-[0.99]'
                  : 'bg-emerald-600 text-white shadow-md shadow-emerald-200/70 hover:bg-emerald-700 active:scale-[0.99]'
            }`}
            aria-label={engineRunning ? l.cutEngine : l.restoreEngine}
          >
            {engineLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power size={16} />}
            {engineLoading ? l.loading : engineErr ? l.failed : engineConfirm ? l.confirm : engineRunning ? l.cutEngine : l.restoreEngine}
          </button>
          {engine.deviceReplyInfo && (
            <p
              role="status"
              data-tone={engine.deviceReplyInfo.tone}
              className={`mt-1.5 px-1 text-center text-[11px] font-bold leading-4 ${engine.deviceReplyInfo.tone === 'warn' ? 'text-red-600' : engine.deviceReplyInfo.tone === 'wait' ? 'text-amber-600' : 'text-emerald-600'}`}
            >
              {engine.deviceReplyInfo.text}
            </p>
          )}
        </div>
      )}

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
        @keyframes vc-road {
          from { background-position-x: 0; }
          to { background-position-x: ${dir === 'rtl' ? '' : '-'}88px; }
        }
        @keyframes vc-streak {
          0% { transform: translateX(0); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateX(${dir === 'rtl' ? '' : '-'}140px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="vc-float"], [style*="vc-shadow"], [style*="vc-breathe"], [style*="vc-streak"], [style*="vc-road"] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

export default VehicleCard
