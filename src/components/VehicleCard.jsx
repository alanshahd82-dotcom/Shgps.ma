import React, { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Clock, Loader2, MapPin, Navigation, Power, PlugZap,
} from 'lucide-react'
import { normalizeVehicleType } from '../utils/vehicleAssets'
import {
  formatVoltage, getBatteryPercent, getDeviceStatusKey, getVoltageColor, isMeasuredNoSupply, timeAgo,
} from './ui'
import { useReverseGeocode } from '../utils/reverseGeocode'
import { useEngineControl } from '../hooks/useEngineControl'
import { agoLabel, locationState } from '../utils/location'
import VehicleGraphic from './VehicleGraphic'

// Unified vehicle/device card used everywhere a vehicle is listed.
// The artwork always matches the vehicle type: car / bike / truck,
// and it is "alive": it floats, gently tilts, and reacts to motion.

const TYPE_LABEL = {
  car: { ar: 'سيارة', fr: 'Voiture' },
  bike: { ar: 'دراجة نارية', fr: 'Moto' },
  truck: { ar: 'شاحنة', fr: 'Camion' },
}

const L = {
  ar: {
    online: 'متصل', offline: 'غير متصل', moving: 'متحرك', stopped: 'متوقف',
    speed: 'السرعة', status: 'الحالة', powerCut: 'الطاقة مفصولة', kmh: 'كم/س', lastUpdate: 'آخر تحديث', na: '—',
    idle: 'خاملة', overspeed: 'تجاوز السرعة', battery: 'البطارية', signal: 'الإشارة',
    cutEngine: 'قطع', restoreEngine: 'تشغيل', confirm: 'تأكيد؟',
    cutQueued: 'قطع عند عودة الإشارة', restoreQueued: 'تشغيل عند عودة الإشارة', confirmQueued: 'تأكيد: يُنفَّذ عند عودة الإشارة', cutPending: 'قطع بانتظار الإشارة · اضغط للإلغاء', cutSent: 'قطع أُرسل للجهاز · اضغط لإعادة التشغيل', confirmResume: 'تأكيد إعادة التشغيل؟', cancelConfirm: 'تأكيد إلغاء القطع؟', queuedHint: 'الأمر يُحفظ ويُنفَّذ تلقائياً عند عودة الإشارة',
    address: 'العنوان', km: 'كم', loading: '...', failed: 'فشل',
    lastKnown: 'آخر موقع معروف', noGps: 'لا توجد إشارة GPS', noLocation: 'الموقع غير متاح',
  },
  fr: {
    online: 'En ligne', offline: 'Hors ligne', moving: 'En marche', stopped: 'Arrêté',
    speed: 'Vitesse', status: 'Statut', powerCut: 'Alimentation coupée', kmh: 'km/h', lastUpdate: 'Dernière maj', na: '—',
    idle: 'Ralenti', overspeed: 'Excès de vitesse', battery: 'Batterie', signal: 'Signal',
    cutEngine: 'Couper', restoreEngine: 'Démarrer', confirm: 'Confirmer?',
    cutQueued: 'Couper dès le retour du signal', restoreQueued: 'Démarrer dès le retour du signal', confirmQueued: 'Confirmer : exécuté au retour du signal', cutPending: 'Coupure en attente du signal · appuyer pour annuler', cutSent: 'Coupure envoyée · appuyer pour rétablir', confirmResume: 'Confirmer le rétablissement ?', cancelConfirm: 'Confirmer l’annulation ?', queuedHint: 'La commande est gardée et exécutée automatiquement au retour du signal',
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

// ── Stage behind the vehicle ─────────────────────────────────────────────────
// The vehicle's own body colour tells the situation; the scene stays calm.
const TONE = {
  move:    { body: '#22c55e', glow: 'rgba(34,197,94,.42)' },    // driving
  idle:    { body: '#f59e0b', glow: 'rgba(245,158,11,.40)' },   // engine on, not moving
  stopped: { body: '#3b82f6', glow: 'rgba(59,130,246,.40)' },   // engine off / parked
  live:    { body: '#818cf8', glow: 'rgba(129,140,248,.38)' },  // online, no ignition information
  off:     { body: '#94a3b8', glow: 'rgba(148,163,184,.16)' },
  power:   { body: '#ef4444', glow: 'rgba(239,68,68,.42)' },
  alarm:   { body: '#f97316', glow: 'rgba(249,115,22,.42)' },
}
const SKYLINE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='40'%3E%3Cpath fill='white' fill-opacity='.09' d='M0 40V22h14V12h12v10h10V6h16v16h12V16h14v24zm120 0V20h12V10h14v10h10V14h16v26zm100 0V24h20v16z'/%3E%3C/svg%3E\")"

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
    // A cut that is still waiting for the signal is cancelled with the cancel endpoint
    // (never with an opposite command, which could itself run later).
    // A cut already handed to the tracker cannot be recalled: the button then offers the restore.
    const action = engine.cutCancellable ? engine.cancelPending() : engine.send(engine.cutSent ? false : engineRunning)
    Promise.resolve(action)
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
      {/* Stage: the vehicle drives on a road; its colour follows the situation */}
      {(() => {
        const powerCut = vehicle.powerDisconnected === true
        const key = getDeviceStatusKey(vehicle)
        const mode = !online ? 'off' : moving ? 'move' : key === 'idle' ? 'idle' : key === 'stopped' ? 'stopped' : 'live'
        const tone = powerCut ? 'power' : overspeed ? 'alarm' : mode === 'off' ? 'off' : mode
        const tn = TONE[tone]
        const rtl = dir === 'rtl'
        const side = rtl ? 'left' : 'right'
        const start = rtl ? 'right' : 'left'
        const height = compact ? 128 : 140
        const carW = compact ? 168 : 184
        const spd = online && rawSpeed != null ? speed : null
        return (
          <div className="relative overflow-hidden" style={{ height, background: 'linear-gradient(135deg,#0a1020 0%,#111b33 60%,#16233f 130%)' }}>
            <span aria-hidden="true" className="pointer-events-none absolute h-28 w-28 rounded-full blur-2xl"
              style={{ [side]: 0, bottom: 4, background: tn.glow, animation: `vc-breathe ${floatDur} ease-in-out infinite` }} />
            {/* skyline slides slowly behind the vehicle */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[22px] h-10"
              style={{ backgroundImage: SKYLINE, backgroundRepeat: 'repeat-x', backgroundSize: '240px 40px', animation: moving ? `vc-city ${fast ? 3 : 6}s linear infinite` : 'none' }} />
            {/* road */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[22px] bg-black/35" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[9px] h-[3px] opacity-70"
              style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.85) 0 16px, transparent 16px 40px)', backgroundSize: '80px 3px', animation: moving ? `vc-road ${fast ? 0.45 : 0.8}s linear infinite` : 'none' }} />
            {moving && (
              <span aria-hidden="true" className="absolute inset-0 overflow-hidden">
                {[0, 1, 2].map(i => (
                  <span key={i} className="absolute h-px w-12 rounded-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
                    style={{ top: `${30 + i * 15}%`, [rtl ? 'right' : 'left']: 0, animation: `vc-streak ${0.7 + i * 0.2}s linear infinite`, animationDelay: `${i * 0.17}s` }} />
                ))}
              </span>
            )}

            {/* the vehicle */}
            <span className="pointer-events-none absolute" style={{ [side]: compact ? 8 : 12, bottom: 11, width: carW, animation: moving ? `vc-drive ${fast ? 1.2 : 2}s ease-in-out infinite` : 'none' }}>
              <VehicleGraphic type={type} color={tn.body} mode={mode} speed={Number(rawSpeed) || 0}
                className="block w-full" style={{ transform: rtl ? 'scaleX(-1)' : undefined }} />
            </span>

            {/* battery + signal (top corner opposite the text) */}
            <span className="absolute top-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white ring-1 ring-white/15 backdrop-blur-sm" style={{ [side]: 8 }}>
              <span className="inline-flex items-center gap-1"><BatteryIcon voltage={vehicle.voltage} powerDisconnected={vehicle.powerDisconnected} /><bdi className="tabular-nums">{power}</bdi></span>
              <SignalBars signal={vehicle.signal} />
            </span>

            {/* text */}
            <div className="absolute top-2 flex flex-col" style={{ [start]: 12, maxWidth: '54%' }}>
              <div className="flex flex-wrap items-center gap-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-bold text-white ring-1 ring-white/20">
                  <span className="relative flex h-1.5 w-1.5">
                    {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />}
                    <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                  </span>
                  {!online ? l.offline : moving ? l.moving : key === 'idle' ? l.idle : key === 'stopped' ? l.stopped : l.online}
                </span>
                {powerCut && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-red-700"><PlugZap size={9} /> {l.powerCut}</span>
                )}
                {overspeed && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-orange-600"><AlertTriangle size={9} /> {l.overspeed}</span>
                )}
              </div>
              <p className="mt-1.5 truncate text-[15px] font-extrabold leading-tight text-white">{vehicle.name || vehicle.uniqueId || l.na}</p>
              <p className="truncate text-[10.5px] font-semibold tracking-wide text-white/55">{vehicle.plate || vehicle.uniqueId || l.na}</p>
            </div>
            <div className="absolute flex items-baseline gap-1 text-white" style={{ [start]: 12, bottom: 28 }}>
              <span className="text-[24px] font-extrabold leading-none tabular-nums" style={{ textShadow: '0 0 14px ' + tn.glow }}>{spd ?? '—'}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-white/55">{l.kmh}</span>
            </div>
          </div>
        )
      })()}

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

      {/* Engine control — always available; without a signal the command is kept and runs when the tracker reconnects */}
      {canControlEngine && (() => {
        const offline = !engine.reachable
        const pending = engine.cutPending
        const sent = engine.cutSent
        const label = engineLoading ? l.loading
          : engineErr ? l.failed
            : engineConfirm ? (engine.cutCancellable ? l.cancelConfirm : sent ? l.confirmResume : (offline && engineRunning ? l.confirmQueued : l.confirm))
              : sent ? l.cutSent
                : pending ? l.cutPending
                : engineRunning ? (offline ? l.cutQueued : l.cutEngine)
                  : (offline ? l.restoreQueued : l.restoreEngine)
        const tone = engineConfirm
          ? 'animate-pulse bg-red-700 text-white ring-4 ring-red-200'
          : pending
            ? 'bg-amber-500 text-white shadow-md shadow-amber-200/70 hover:bg-amber-600 active:scale-[0.99]'
            : engineRunning
              ? 'bg-red-600 text-white shadow-md shadow-red-200/70 hover:bg-red-700 active:scale-[0.99]'
              : 'bg-emerald-600 text-white shadow-md shadow-emerald-200/70 hover:bg-emerald-700 active:scale-[0.99]'
        return (
          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              onClick={handleEngineClick}
              disabled={engineLoading}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-extrabold transition-colors disabled:opacity-70 ${tone}`}
              aria-label={label}
            >
              {engineLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : pending ? <Clock size={16} /> : <Power size={16} />}
              {label}
            </button>
            {offline && !pending && (
              <p className="mt-1 px-1 text-center text-[10px] font-semibold leading-4 text-slate-400">{l.queuedHint}</p>
            )}
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
        )
      })()}

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
        @keyframes vc-city {
          from { background-position-x: 0; }
          to { background-position-x: ${dir === 'rtl' ? '' : '-'}240px; }
        }
        @keyframes vc-drive {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(${dir === 'rtl' ? '-' : ''}5px); }
        }
        @keyframes vg-puff { 0% { transform: translate(0,0) scale(.6); opacity: .6; } 100% { transform: translate(-14px,-12px) scale(1.9); opacity: 0; } }
        @keyframes vg-beam { 0%, 100% { opacity: 1; } 50% { opacity: .78; } }
        @keyframes vg-spin { to { transform: rotate(360deg); } }
        @keyframes vg-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.2px); } }
        @keyframes vc-streak {
          0% { transform: translateX(0); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateX(${dir === 'rtl' ? '' : '-'}140px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="vc-float"], [style*="vc-shadow"], [style*="vc-breathe"], [style*="vc-streak"], [style*="vc-road"], [style*="vc-city"], [style*="vc-drive"], [style*="vg-spin"], [style*="vg-bob"], [style*="vg-puff"], [style*="vg-beam"] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

export default VehicleCard
