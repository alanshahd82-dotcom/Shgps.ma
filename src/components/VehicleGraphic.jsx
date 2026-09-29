import React, { useId } from 'react'

// Realistic side-view vehicles (car / motorbike / truck) drawn in SVG:
// glossy paint with a character line and reflections, tinted glass, arches,
// alloy wheels that really turn (with motion blur), working lights (headlight
// beam, brake lights), exhaust puffs when idling, a rider on the bike.
// The body colour follows the vehicle's situation. Pure presentation.

const TIRE = '#070b14'

function shade(hex, amount) {
  // amount > 0 lightens, < 0 darkens (hex #rrggbb)
  const n = parseInt(hex.slice(1), 16)
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + (amount > 0 ? (255 - v) : v) * amount)))
  const r = c((n >> 16) & 255), g = c((n >> 8) & 255), b = c(n & 255)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

function Wheel({ cx, cy, r, spinning, duration, id, brake = false }) {
  const spokes = [0, 72, 144, 216, 288]
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={TIRE} />
      <circle cx={cx} cy={cy} r={r * 0.9} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={r * 0.06} />
      {brake && <circle cx={cx} cy={cy} r={r * 0.62} fill="none" stroke="#9aa6b8" strokeWidth={r * 0.1} opacity="0.85" />}
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: spinning ? `vg-spin ${duration}s linear infinite` : 'none' }}>
        <circle cx={cx} cy={cy} r={r * 0.66} fill={`url(#${id}-rim)`} />
        {spokes.map(a => (
          <path
            key={a}
            d={`M${cx} ${cy - r * 0.1} L${cx - r * 0.09} ${cy - r * 0.62} L${cx + r * 0.09} ${cy - r * 0.62} Z`}
            fill="#5b6678"
            transform={`rotate(${a} ${cx} ${cy})`}
          />
        ))}
        <circle cx={cx} cy={cy} r={r * 0.62} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth={r * 0.05} />
        <circle cx={cx} cy={cy} r={r * 0.15} fill="#39424f" />
      </g>
      {spinning && <circle cx={cx} cy={cy} r={r * 0.64} fill="rgba(210,220,235,.42)" />}
    </g>
  )
}

function Defs({ id, color }) {
  const c1 = shade(color, 0.42)
  const c2 = shade(color, 0.08)
  const c3 = shade(color, -0.3)
  return (
    <defs>
      <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c1} />
        <stop offset="0.38" stopColor={c2} />
        <stop offset="0.75" stopColor={color} />
        <stop offset="1" stopColor={c3} />
      </linearGradient>
      <linearGradient id={`${id}-dark`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={shade(color, -0.25)} />
        <stop offset="1" stopColor={shade(color, -0.6)} />
      </linearGradient>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7fa6cf" />
        <stop offset="0.5" stopColor="#1a2b44" />
        <stop offset="1" stopColor="#0b1524" />
      </linearGradient>
      <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff3c4" stopOpacity="0.6" />
        <stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#c9d2de" />
        <stop offset="0.5" stopColor="#7d8898" />
        <stop offset="1" stopColor="#3b4553" />
      </linearGradient>
      <linearGradient id={`${id}-cargo`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.7" stopColor="#dfe6ef" />
        <stop offset="1" stopColor="#aab6c6" />
      </linearGradient>
      <radialGradient id={`${id}-rim`} cx="0.4" cy="0.35" r="0.8">
        <stop offset="0" stopColor="#f1f5f9" />
        <stop offset="0.6" stopColor="#a5b0c0" />
        <stop offset="1" stopColor="#5d6879" />
      </radialGradient>
      <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffe9a8" stopOpacity="0.95" />
        <stop offset="1" stopColor="#ffe9a8" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-red`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ff5a4d" stopOpacity="0.95" />
        <stop offset="1" stopColor="#ff5a4d" stopOpacity="0" />
      </radialGradient>
      <filter id={`${id}-blur`} x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
    </defs>
  )
}

function Puff({ show }) {
  if (!show) return null
  return (
    <g aria-hidden="true">
      {[0, 0.55, 1.1].map(d => (
        <circle key={d} cx="6" cy="60" r="3.2" fill="rgba(205,214,228,.55)"
          style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `vg-puff 1.7s ease-out ${d}s infinite` }} />
      ))}
    </g>
  )
}

function Beam({ id, show, x, y, flicker }) {
  if (!show) return null
  return (
    <path d={`M${x} ${y} L${x + 82} ${y - 14} L${x + 82} ${y + 20} L${x} ${y + 7} Z`} fill={`url(#${id}-beam)`}
      style={{ animation: flicker ? 'vg-beam 2.4s ease-in-out infinite' : 'none' }} />
  )
}

function Car({ color, id, spinning, duration, lit, braking, idle }) {
  const dark = `url(#${id}-dark)`
  return (
    <>
      <Defs id={id} color={color} />
      <ellipse cx="100" cy="69" rx="92" ry="4.5" fill="rgba(0,0,0,.55)" filter={`url(#${id}-blur)`} />
      <Beam id={id} show={lit} x={190} y={46} flicker={!spinning} />
      <Puff show={idle} />
      {/* body */}
      <path d="M8 63 L8 45 Q8 39 16 37 L27 35 Q31 22 45 19 L112 19 Q129 20 141 33 L176 39 Q190 42 193 51 L193 63 Z" fill={`url(#${id}-body)`} />
      {/* roof rail + roof highlight */}
      <path d="M50 16.5 L108 16.5" stroke={shade(color, -0.5)} strokeWidth="2" strokeLinecap="round" />
      <path d="M52 21 Q80 18.5 108 21" stroke="rgba(255,255,255,.45)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* glass */}
      <path d="M33 34 Q36 24 47 22.5 L72 22.5 L72 34 Z" fill={`url(#${id}-glass)`} />
      <path d="M77 22.5 L110 22.5 Q123 25 132 34 L77 34 Z" fill={`url(#${id}-glass)`} />
      <path d="M40 33 L52 23 L58 23 L46 33 Z" fill="rgba(255,255,255,.22)" />
      <path d="M84 33 L97 23 L104 23 L91 33 Z" fill="rgba(255,255,255,.22)" />
      {/* door lines, handles, mirror */}
      <path d="M74.5 22.5 L74.5 59" stroke="rgba(0,0,0,.35)" strokeWidth="1" />
      <path d="M118 28 Q120 44 118 59" stroke="rgba(0,0,0,.22)" strokeWidth="1" fill="none" />
      <path d="M32 36 Q30 46 30 59" stroke="rgba(0,0,0,.22)" strokeWidth="1" fill="none" />
      <rect x="64" y="40" width="7" height="2.2" rx="1.1" fill="rgba(255,255,255,.75)" />
      <rect x="103" y="40" width="7" height="2.2" rx="1.1" fill="rgba(255,255,255,.75)" />
      <path d="M131 33 L139 33.5 Q141 36 137 38 L131 37 Z" fill={dark} />
      {/* character line + lower sill */}
      <path d="M14 43 Q100 40 188 45" stroke="rgba(255,255,255,.4)" strokeWidth="1.2" fill="none" />
      <path d="M8 60 L193 60 L193 63 L8 63 Z" fill="rgba(0,0,0,.45)" />
      {/* front: grille, headlight, fog, bumper */}
      <path d="M186 44 Q192 46 193 51 L193 56 L184 56 Z" fill="rgba(0,0,0,.4)" />
      <path d="M177 41 L190 44.5 L188 48 L176 45 Z" fill="#f4f7fb" />
      <path d="M178 42 L189 45" stroke="#fff" strokeWidth="1.2" />
      <ellipse cx="186" cy="46" rx="9" ry="7" fill={`url(#${id}-glow)`} opacity={lit ? 1 : 0.25} />
      <rect x="186" y="55" width="7" height="3" rx="1.5" fill="rgba(255,235,170,.9)" opacity={lit ? 1 : 0.4} />
      {/* rear light */}
      <rect x="8" y="40" width="5" height="10" rx="2" fill={braking ? '#ff4a3d' : '#a11d17'} />
      {braking && <ellipse cx="9" cy="45" rx="9" ry="9" fill={`url(#${id}-red)`} />}
      <rect x="9" y="56" width="3" height="3" rx="1" fill="#0b0f18" />
      {/* arches */}
      <circle cx="52" cy="58" r="16" fill="#060a12" />
      <circle cx="150" cy="58" r="16" fill="#060a12" />
      <path d="M36 58 A16 16 0 0 1 68 58" fill="none" stroke={shade(color, -0.55)} strokeWidth="1.5" />
      <path d="M134 58 A16 16 0 0 1 166 58" fill="none" stroke={shade(color, -0.55)} strokeWidth="1.5" />
      <Wheel cx={52} cy={58} r={12.5} spinning={spinning} duration={duration} id={id} brake />
      <Wheel cx={150} cy={58} r={12.5} spinning={spinning} duration={duration} id={id} brake />
    </>
  )
}

function Truck({ color, id, spinning, duration, lit, braking, idle }) {
  const dark = `url(#${id}-dark)`
  return (
    <>
      <Defs id={id} color={color} />
      <ellipse cx="100" cy="69" rx="92" ry="4.5" fill="rgba(0,0,0,.55)" filter={`url(#${id}-blur)`} />
      <Beam id={id} show={lit} x={190} y={52} flicker={!spinning} />
      <Puff show={idle} />
      {/* chassis */}
      <rect x="8" y="58" width="182" height="5" rx="2" fill="#0b1018" />
      <rect x="86" y="58" width="24" height="7" rx="2.5" fill={`url(#${id}-metal)`} />
      {/* cargo box */}
      <rect x="6" y="6" width="130" height="52" rx="4" fill={`url(#${id}-cargo)`} />
      {[22, 38, 54, 70, 86, 102, 118].map(x => <path key={x} d={`M${x} 8 L${x} 56`} stroke="rgba(120,135,155,.35)" strokeWidth="1" />)}
      <rect x="6" y="34" width="130" height="9" fill={color} />
      <rect x="6" y="34" width="130" height="2.5" fill="rgba(255,255,255,.35)" />
      <circle cx="30" cy="22" r="8" fill={color} opacity="0.92" />
      <path d="M26 22 L30 17 L34 22 L30 27 Z" fill="rgba(255,255,255,.9)" />
      <path d="M6 6 L136 6" stroke="rgba(255,255,255,.95)" strokeWidth="2" strokeLinecap="round" />
      <rect x="6" y="52" width="130" height="6" rx="2" fill="rgba(0,0,0,.28)" />
      {/* rear light */}
      <rect x="4" y="44" width="4" height="9" rx="1.5" fill={braking ? '#ff4a3d' : '#a11d17'} />
      {braking && <ellipse cx="6" cy="49" rx="9" ry="9" fill={`url(#${id}-red)`} />}
      {/* cab */}
      <path d="M138 63 L138 27 Q138 20 145 20 L166 20 Q172 20 176 26 L189 42 Q194 47 194 55 L194 63 Z" fill={`url(#${id}-body)`} />
      <path d="M146 25 L165 25 Q169 25 172 29 L181 41 L146 41 Z" fill={`url(#${id}-glass)`} />
      <path d="M150 40 L158 26 L164 26 L156 40 Z" fill="rgba(255,255,255,.22)" />
      <path d="M144 22 L165 22" stroke="rgba(255,255,255,.45)" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M146 26 L146 60" stroke="rgba(0,0,0,.32)" strokeWidth="1" />
      <rect x="152" y="47" width="8" height="2.2" rx="1.1" fill="rgba(255,255,255,.75)" />
      <path d="M139 30 L145 31 L144 40 L139 39 Z" fill={dark} />
      <path d="M186 45 Q193 48 194 55 L194 60 L184 60 Z" fill="rgba(0,0,0,.42)" />
      <path d="M178 44 L191 47 L189 51 L177 48 Z" fill="#f4f7fb" />
      <ellipse cx="187" cy="49" rx="9" ry="7" fill={`url(#${id}-glow)`} opacity={lit ? 1 : 0.25} />
      <rect x="186" y="58" width="8" height="4" rx="1.5" fill="#1a212c" />
      <rect x="150" y="56" width="26" height="6" rx="2" fill="rgba(0,0,0,.45)" />
      {/* arches and wheels (double rear axle) */}
      <circle cx="34" cy="58" r="15" fill="#060a12" />
      <circle cx="58" cy="58" r="15" fill="#060a12" />
      <circle cx="162" cy="58" r="15" fill="#060a12" />
      <Wheel cx={34} cy={58} r={11.5} spinning={spinning} duration={duration} id={id} />
      <Wheel cx={58} cy={58} r={11.5} spinning={spinning} duration={duration} id={id} />
      <Wheel cx={162} cy={58} r={11.5} spinning={spinning} duration={duration} id={id} brake />
    </>
  )
}

function Bike({ color, id, spinning, duration, lit, braking, idle, rider }) {
  const dark = `url(#${id}-dark)`
  return (
    <>
      <Defs id={id} color={color} />
      <ellipse cx="102" cy="70" rx="86" ry="4" fill="rgba(0,0,0,.55)" filter={`url(#${id}-blur)`} />
      <Beam id={id} show={lit} x={158} y={33} flicker={!spinning} />
      <Puff show={idle} />
      {/* rider (behind the tank) */}
      {rider && (
        <g>
          <path d="M62 38 Q78 22 104 17 L114 22 Q92 30 82 44 Z" fill="#101827" />
          <path d="M104 17 L132 20 L134 25 L108 25 Z" fill="#1a2436" />
          <path d="M72 40 Q98 44 100 50 L96 60 L88 60 Q88 52 70 48 Z" fill="#0d1421" />
          <circle cx="112" cy="9" r="8.2" fill={`url(#${id}-body)`} />
          <path d="M113 5 Q121 6 121 11 L112 12 Z" fill={`url(#${id}-glass)`} />
        </g>
      )}
      {/* rear wheel, swingarm, exhaust */}
      <path d="M44 58 L92 50" stroke="#0e141d" strokeWidth="4" strokeLinecap="round" />
      <path d="M96 60 L38 54 L34 55.5 L96 63 Z" fill={`url(#${id}-metal)`} />
      <rect x="30" y="53" width="8" height="3.4" rx="1.7" fill="#5a6474" />
      {/* engine */}
      <rect x="78" y="42" width="42" height="20" rx="5" fill={`url(#${id}-metal)`} />
      {[84, 90, 96, 102, 108].map(x => <path key={x} d={`M${x} 44 L${x} 52`} stroke="rgba(0,0,0,.35)" strokeWidth="1.3" />)}
      <rect x="86" y="53" width="24" height="7" rx="3" fill="#2b333f" />
      {/* frame + fork */}
      <path d="M104 36 L92 50" stroke="#0e141d" strokeWidth="3" />
      <path d="M158 58 L140 27" stroke="#aeb8c6" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M161 58 L143 28" stroke="#3c4553" strokeWidth="2" strokeLinecap="round" />
      {/* tank + fairing */}
      <path d="M84 32 Q102 17 128 23 L143 32 L139 41 Q112 43 88 41 Z" fill={`url(#${id}-body)`} />
      <path d="M92 30 Q112 24 132 27" stroke="rgba(255,255,255,.5)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M126 24 L148 23 Q156 28 150 39 L136 37 Z" fill={dark} />
      <path d="M138 21 L147 8 L152 10 L146 25 Z" fill="rgba(160,200,235,.55)" />
      {/* seat + tail */}
      <path d="M44 36 Q64 29 90 34 L90 41 L46 43 Z" fill="#0f1520" />
      <path d="M48 36.5 Q66 32 86 35.5" stroke="rgba(255,255,255,.28)" strokeWidth="1.2" fill="none" />
      <path d="M24 37 L48 34 L50 43 L30 48 Z" fill={`url(#${id}-body)`} />
      <rect x="22" y="38" width="5" height="7" rx="2" fill={braking ? '#ff4a3d' : '#a11d17'} />
      {braking && <ellipse cx="24" cy="42" rx="9" ry="9" fill={`url(#${id}-red)`} />}
      {/* handlebar + headlight */}
      <path d="M141 27 L132 17" stroke="#101827" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="153" cy="31" rx="4.6" ry="5.4" fill="#fff6d8" />
      <ellipse cx="155" cy="32" rx="12" ry="12" fill={`url(#${id}-glow)`} opacity={lit ? 1 : 0.2} />
      {/* fender */}
      <path d="M143 46 Q158 38 173 46 L170 49 Q158 43 146 49 Z" fill={dark} />
      <Wheel cx={44} cy={58} r={14.5} spinning={spinning} duration={duration} id={id} />
      <Wheel cx={158} cy={58} r={14.5} spinning={spinning} duration={duration} id={id} brake />
    </>
  )
}

/**
 * @param {'car'|'bike'|'truck'} type
 * @param {string} color body colour (#rrggbb)
 * @param {'move'|'idle'|'stopped'|'live'|'off'} mode drives lights and effects
 * @param {number} speed km/h (only picks the wheel speed)
 */
export default function VehicleGraphic({ type = 'car', color = '#6366f1', mode = 'live', speed = 0, className = '', style }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const moving = mode === 'move'
  const off = mode === 'off'
  const duration = Math.max(0.22, 0.95 - Math.min(140, Math.max(0, speed)) / 140 * 0.7)
  const Shape = type === 'bike' ? Bike : type === 'truck' ? Truck : Car
  const props = {
    color, id, spinning: moving, duration,
    lit: !off && (moving || mode === 'idle'),
    braking: mode === 'idle' || mode === 'stopped',
    idle: mode === 'idle',
    rider: !off,
  }
  return (
    <svg
      viewBox="0 0 200 80"
      className={className}
      style={{
        overflow: 'visible',
        filter: off ? 'grayscale(1) brightness(.85) opacity(.6)' : undefined,
        ...style,
      }}
      role="img"
      aria-hidden="true"
    >
      <g style={{ animation: moving ? 'vg-bob .5s ease-in-out infinite' : 'none' }}>
        <Shape {...props} />
      </g>
    </svg>
  )
}
