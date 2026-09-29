import React, { useId } from 'react'

// Side-view vehicle illustrations (car / bike / truck) drawn as SVG so the body
// colour can follow the vehicle's situation and the wheels can really turn.
// Pure presentation: no data, no side effects.

const TIRE = '#0b1020'
const RIM = '#d7dee9'

function shade(hex, amount) {
  // amount > 0 lightens, < 0 darkens (hex #rrggbb)
  const n = parseInt(hex.slice(1), 16)
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + (amount > 0 ? (255 - v) : v) * amount)))
  const r = c((n >> 16) & 255), g = c((n >> 8) & 255), b = c(n & 255)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

function Wheel({ cx, cy, r, spinning, duration }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={TIRE} />
      <g
        style={{
          transformBox: 'fill-box',
          transformOrigin: 'center',
          animation: spinning ? `vg-spin ${duration}s linear infinite` : 'none',
        }}
      >
        <circle cx={cx} cy={cy} r={r * 0.58} fill={RIM} />
        {[0, 45, 90, 135].map(a => (
          <line
            key={a}
            x1={cx} y1={cy - r * 0.55} x2={cx} y2={cy + r * 0.55}
            stroke="#7c8799" strokeWidth={r * 0.13} strokeLinecap="round"
            transform={`rotate(${a} ${cx} ${cy})`}
          />
        ))}
        <circle cx={cx} cy={cy} r={r * 0.16} fill="#475569" />
      </g>
    </g>
  )
}

function Car({ color, id, spinning, duration }) {
  const top = shade(color, 0.28)
  const low = shade(color, -0.28)
  return (
    <>
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="0.55" stopColor={color} />
          <stop offset="1" stopColor={low} />
        </linearGradient>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6f3ff" />
          <stop offset="1" stopColor="#7fb2e6" />
        </linearGradient>
      </defs>
      <path d="M6 46 L6 37 Q6 32 13 31 L33 28 Q42 15 61 14 L97 14 Q114 15 123 27 L141 31 Q150 33 150 40 L150 46 Z" fill={`url(#${id}-b)`} />
      <path d="M42 27 Q49 18 62 18 L77 18 L77 27 Z" fill={`url(#${id}-g)`} />
      <path d="M83 18 L97 18 Q107 19 115 27 L83 27 Z" fill={`url(#${id}-g)`} />
      <path d="M80 18 L80 44" stroke="rgba(0,0,0,.22)" strokeWidth="1" />
      <rect x="6" y="43" width="144" height="4" rx="2" fill="rgba(0,0,0,.28)" />
      <rect x="143" y="33" width="7" height="4.5" rx="1.5" fill="#fde68a" />
      <rect x="6" y="34" width="5" height="4" rx="1.5" fill="#fca5a5" />
      <rect x="94" y="31" width="9" height="2" rx="1" fill="rgba(0,0,0,.3)" />
      <Wheel cx={36} cy={47} r={9.5} spinning={spinning} duration={duration} />
      <Wheel cx={120} cy={47} r={9.5} spinning={spinning} duration={duration} />
    </>
  )
}

function Truck({ color, id, spinning, duration }) {
  const top = shade(color, 0.28)
  const low = shade(color, -0.28)
  return (
    <>
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="0.55" stopColor={color} />
          <stop offset="1" stopColor={low} />
        </linearGradient>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6f3ff" />
          <stop offset="1" stopColor="#7fb2e6" />
        </linearGradient>
        <linearGradient id={`${id}-c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="1" stopColor="#cbd5e1" />
        </linearGradient>
      </defs>
      <rect x="4" y="6" width="98" height="40" rx="3" fill={`url(#${id}-c)`} />
      <rect x="4" y="30" width="98" height="6" fill={color} opacity="0.95" />
      <rect x="4" y="38" width="98" height="8" rx="2" fill="rgba(0,0,0,.18)" />
      <path d="M104 46 L104 17 Q104 13 109 13 L128 13 Q133 13 137 19 L147 30 Q151 34 151 39 L151 46 Z" fill={`url(#${id}-b)`} />
      <path d="M110 17 L126 17 Q130 17 133 21 L138 28 L110 28 Z" fill={`url(#${id}-g)`} />
      <rect x="145" y="34" width="6" height="4.5" rx="1.5" fill="#fde68a" />
      <rect x="4" y="44" width="147" height="3" rx="1.5" fill="rgba(0,0,0,.35)" />
      <Wheel cx={24} cy={47} r={8.5} spinning={spinning} duration={duration} />
      <Wheel cx={45} cy={47} r={8.5} spinning={spinning} duration={duration} />
      <Wheel cx={126} cy={47} r={8.5} spinning={spinning} duration={duration} />
    </>
  )
}

function Bike({ color, id, spinning, duration }) {
  const top = shade(color, 0.3)
  const low = shade(color, -0.3)
  return (
    <>
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={low} />
        </linearGradient>
      </defs>
      {/* swingarm, fork, frame */}
      <path d="M34 47 L70 40" stroke="#1e293b" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M126 47 L110 20" stroke="#94a3b8" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M110 20 L120 17" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
      {/* engine block + exhaust */}
      <rect x="66" y="33" width="34" height="14" rx="4" fill="#334155" />
      <rect x="70" y="36" width="10" height="8" rx="2" fill="#475569" />
      <path d="M38 45 L70 47 L72 44 L40 42 Z" fill="#94a3b8" />
      {/* tank, seat, tail */}
      <path d="M62 24 Q78 12 100 19 L104 30 Q82 36 62 32 Z" fill={`url(#${id}-b)`} />
      <path d="M36 27 Q50 21 64 25 L64 32 L38 33 Z" fill="#111827" />
      <path d="M28 30 L40 27 L40 32 L30 35 Z" fill={color} />
      {/* windscreen + light */}
      <path d="M112 18 L119 12 L122 14 L117 21 Z" fill="rgba(186,230,253,.85)" />
      <circle cx="119" cy="24" r="4" fill="#fde68a" />
      <Wheel cx={34} cy={47} r={13} spinning={spinning} duration={duration} />
      <Wheel cx={126} cy={47} r={13} spinning={spinning} duration={duration} />
    </>
  )
}

/**
 * @param {'car'|'bike'|'truck'} type
 * @param {string} color body colour (#rrggbb)
 * @param {boolean} moving wheels turn and the body bobs
 * @param {number} speed km/h, only used to pick the wheel speed
 * @param {boolean} muted greyed-out (offline)
 */
export default function VehicleGraphic({ type = 'car', color = '#6366f1', moving = false, speed = 0, muted = false, className = '', style }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const duration = Math.max(0.28, 1.1 - Math.min(140, Math.max(0, speed)) / 140 * 0.8)
  const Shape = type === 'bike' ? Bike : type === 'truck' ? Truck : Car
  return (
    <svg
      viewBox="0 0 156 62"
      className={className}
      style={{
        overflow: 'visible',
        filter: muted ? 'grayscale(1) opacity(.55)' : undefined,
        ...style,
      }}
      role="img"
      aria-hidden="true"
    >
      <g style={{ animation: moving ? 'vg-bob .55s ease-in-out infinite' : 'none' }}>
        <Shape color={color} id={id} spinning={moving} duration={duration} />
      </g>
    </svg>
  )
}
