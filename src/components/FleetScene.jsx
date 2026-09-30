import React, { useId, useMemo } from 'react'

// Decorative "live control room" scene behind the fleet summary: a night map with glowing routes,
// vehicles driving along them and radar pings. Pure SVG animation (no video file, a few KB, works
// offline). Visual only: it reads no data except how many vehicles are live (0 = calm, static scene).
const ROUTES = [
  'M-10 150 C 60 150, 90 100, 150 104 S 250 150, 310 96 S 380 70, 420 60',
  'M-10 60 C 50 70, 80 40, 140 46 S 220 96, 290 80 S 370 130, 420 122',
  'M110 -10 C 118 40, 170 60, 176 104 S 200 170, 232 210',
]

export default function FleetScene({ live = 0, rtl = false }) {
  const uid = useId().replace(/:/g, '')
  const still = useMemo(() => {
    try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { return false }
  }, [])
  const cars = Math.max(0, Math.min(3, live))
  const anim = !still

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full pointer-events-none"
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid slice"
      style={rtl ? { transform: 'scaleX(-1)' } : undefined}
    >
      <defs>
        <linearGradient id={`${uid}-route`} x1="0" x2="1">
          <stop offset="0" stopColor="#67e8f9" stopOpacity="0" />
          <stop offset=".5" stopColor="#a5b4fc" stopOpacity=".9" />
          <stop offset="1" stopColor="#67e8f9" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor="#34d399" stopOpacity=".9" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
        <pattern id={`${uid}-grid`} width="26" height="26" patternUnits="userSpaceOnUse">
          <path d="M26 0H0V26" fill="none" stroke="#fff" strokeOpacity=".07" strokeWidth=".6" />
        </pattern>
      </defs>

      <rect width="400" height="200" fill={`url(#${uid}-grid)`} />

      {/* city blocks */}
      <g fill="#fff" fillOpacity=".04">
        <rect x="18" y="14" width="46" height="30" rx="5" />
        <rect x="236" y="20" width="60" height="34" rx="5" />
        <rect x="318" y="140" width="56" height="36" rx="5" />
        <rect x="40" y="152" width="52" height="30" rx="5" />
        <rect x="196" y="140" width="40" height="28" rx="5" />
      </g>

      {/* routes: soft base + flowing light */}
      {ROUTES.map((d, i) => (
        <g key={i} fill="none" strokeLinecap="round">
          <path id={`${uid}-r${i}`} d={d} stroke="#fff" strokeOpacity=".16" strokeWidth="5" />
          <path d={d} stroke={`url(#${uid}-route)`} strokeWidth="2.4" strokeDasharray="18 22">
            {anim && <animate attributeName="stroke-dashoffset" from="0" to={-80} dur={`${5 + i * 1.6}s`} repeatCount="indefinite" />}
          </path>
        </g>
      ))}

      {/* vehicles driving along the routes (as many as there are live vehicles, max 3) */}
      {ROUTES.slice(0, cars).map((_, i) => (
        <g key={i}>
          <circle r="14" fill={`url(#${uid}-glow)`}>
            {anim && <animateMotion dur={`${9 + i * 2.5}s`} begin={`${-i * 3}s`} repeatCount="indefinite"><mpath href={`#${uid}-r${i}`} /></animateMotion>}
          </circle>
          <circle r="4.2" fill="#ecfdf5" stroke="#34d399" strokeWidth="2">
            {anim && <animateMotion dur={`${9 + i * 2.5}s`} begin={`${-i * 3}s`} repeatCount="indefinite"><mpath href={`#${uid}-r${i}`} /></animateMotion>}
          </circle>
        </g>
      ))}

      {/* radar pings on fixed points (calm heartbeat of the fleet) */}
      {[[92, 112], [268, 84], [352, 118]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r="3" fill="#a5b4fc" />
          {anim && (
            <circle r="3" fill="none" stroke="#a5b4fc" strokeWidth="1.2">
              <animate attributeName="r" from="3" to="18" dur="3.2s" begin={`${i * 1.05}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" from=".7" to="0" dur="3.2s" begin={`${i * 1.05}s`} repeatCount="indefinite" />
            </circle>
          )}
        </g>
      ))}
    </svg>
  )
}
