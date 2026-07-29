import React from 'react'

export default function Logo({ size = 'md', showText = true }) {
  const sizes = {
    sm: { icon: 36, text: 'text-xl', sub: 'text-xs' },
    md: { icon: 52, text: 'text-2xl', sub: 'text-sm' },
    lg: { icon: 72, text: 'text-4xl', sub: 'text-base' },
  }
  const s = sizes[size] || sizes.md

  return (
    <div className="flex items-center gap-3">
      <svg width={s.icon} height={s.icon} viewBox="0 0 48 48" fill="none" className="flex-shrink-0">
        <rect width="48" height="48" rx="14" fill="rgba(255,255,255,0.10)" />
        <path d="M24 7C16.82 7 11 12.82 11 20C11 29.5 24 43 24 43C24 43 37 29.5 37 20C37 12.82 31.18 7 24 7Z" fill="#1DBF73" />
        <circle cx="24" cy="20" r="5" fill="#0B1F3A" />
        <circle cx="24" cy="20" r="2.5" fill="#1DBF73" />
      </svg>
      {showText && (
        <div>
          <h1 className={`${s.text} font-black text-white leading-none tracking-tight`}>
            Athar <span style={{ color: '#1DBF73' }}>GPS</span>
          </h1>
          <p className={`${s.sub} text-white/50 font-medium`}>تتبع GPS احترافي</p>
        </div>
      )}
    </div>
  )
}
