import React from 'react'
import VehicleGraphic from './VehicleGraphic'

// The "stage": a dark scene with a road, a sliding skyline and the vehicle
// driving on it. Used by big surfaces (vehicle page). Presentation only.

export const TONE = {
  move:    { body: '#22c55e', glow: 'rgba(34,197,94,.42)' },    // driving
  idle:    { body: '#f59e0b', glow: 'rgba(245,158,11,.40)' },   // engine on, not moving
  stopped: { body: '#3b82f6', glow: 'rgba(59,130,246,.40)' },   // engine off / parked
  live:    { body: '#818cf8', glow: 'rgba(129,140,248,.38)' },  // online, no ignition information
  off:     { body: '#94a3b8', glow: 'rgba(148,163,184,.16)' },
  power:   { body: '#ef4444', glow: 'rgba(239,68,68,.42)' },
  alarm:   { body: '#f97316', glow: 'rgba(249,115,22,.42)' },
}

const SKYLINE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='40'%3E%3Cpath fill='white' fill-opacity='.09' d='M0 40V22h14V12h12v10h10V6h16v16h12V16h14v24zm120 0V20h12V10h14v10h10V14h16v26zm100 0V24h20v16z'/%3E%3C/svg%3E\")"

export default function VehicleStage({ type, mode, tone, speed = 0, rtl = false, height = 170, vehicleWidth = 230, children }) {
  const tn = TONE[tone] || TONE.live
  const moving = mode === 'move'
  const fast = Number(speed) > 60
  const side = rtl ? 'left' : 'right'
  return (
    <div className="relative overflow-hidden" style={{ height, background: 'linear-gradient(135deg,#0a1020 0%,#111b33 60%,#16233f 130%)' }}>
      <span aria-hidden="true" className="pointer-events-none absolute h-36 w-36 rounded-full blur-2xl"
        style={{ [side]: 0, bottom: 4, background: tn.glow, animation: 'vc-breathe 3.6s ease-in-out infinite' }} />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[26px] h-12"
        style={{ backgroundImage: SKYLINE, backgroundRepeat: 'repeat-x', backgroundSize: '288px 48px', animation: moving ? `vc-city${rtl ? '-rtl' : ''} ${fast ? 3 : 6}s linear infinite` : 'none' }} />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[26px] bg-black/35" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[11px] h-[3px] opacity-70"
        style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.85) 0 16px, transparent 16px 40px)', backgroundSize: '80px 3px', animation: moving ? `vc-road${rtl ? '-rtl' : ''} ${fast ? 0.45 : 0.8}s linear infinite` : 'none' }} />
      {moving && (
        <span aria-hidden="true" className="absolute inset-0 overflow-hidden">
          {[0, 1, 2].map(i => (
            <span key={i} className="absolute h-px w-16 rounded-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
              style={{ top: `${30 + i * 15}%`, [rtl ? 'right' : 'left']: 0, animation: `vc-streak${rtl ? '-rtl' : ''} ${0.7 + i * 0.2}s linear infinite`, animationDelay: `${i * 0.17}s` }} />
          ))}
        </span>
      )}
      <span className="pointer-events-none absolute" style={{ [side]: 12, bottom: 13, width: vehicleWidth, animation: moving ? `vc-drive${rtl ? '-rtl' : ''} ${fast ? 1.2 : 2}s ease-in-out infinite` : 'none' }}>
        <VehicleGraphic type={type} color={tn.body} mode={mode} speed={Number(speed) || 0} className="block w-full" style={{ transform: rtl ? 'scaleX(-1)' : undefined }} />
      </span>
      {children}
    </div>
  )
}
