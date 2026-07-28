import React from 'react'

export default function Logo({ size = 'md', white = false }) {
  const sizes = {
    sm: { icon: 28, text: 'text-lg' },
    md: { icon: 36, text: 'text-xl' },
    lg: { icon: 48, text: 'text-2xl' },
    xl: { icon: 64, text: 'text-3xl' },
  }
  const s = sizes[size] || sizes.md

  return (
    <div className="flex items-center gap-2 select-none">
      <svg width={s.icon} height={s.icon} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="12" fill={white ? 'rgba(255,255,255,0.15)' : '#0F2044'} />
        {/* Pin */}
        <path
          d="M24 8C17.373 8 12 13.373 12 20C12 28.5 24 42 24 42C24 42 36 28.5 36 20C36 13.373 30.627 8 24 8Z"
          fill="#00D97E"
        />
        {/* Signal rings */}
        <circle cx="24" cy="20" r="4" fill={white ? 'white' : '#0F2044'} />
        {/* Signal waves */}
        <path d="M18 11C15.3 13.1 13.5 16.4 13.5 20" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
        <path d="M30 11C32.7 13.1 34.5 16.4 34.5 20" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      </svg>
      <div className="flex flex-col leading-none">
        <span className={`font-bold ${s.text} ${white ? 'text-white' : 'text-primary-500'} tracking-tight`}>
          Shgps<span className={`${white ? 'text-accent-400' : 'text-accent'}`}>.ma</span>
        </span>
        {size !== 'sm' && (
          <span className={`text-xs font-medium ${white ? 'text-white/60' : 'text-primary-300'}`}>
            GPS Tracking
          </span>
        )}
      </div>
    </div>
  )
}
