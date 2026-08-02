import React from 'react'

export default function Logo({ size = 'md', white = false }) {
  const sizes = {
    sm: { img: 28, text: 'text-lg' },
    md: { img: 36, text: 'text-xl' },
    lg: { img: 48, text: 'text-2xl' },
    xl: { img: 64, text: 'text-3xl' },
  }
  const s = sizes[size] || sizes.md

  return (
    <div className="flex items-center gap-2 select-none" dir="ltr">
      <img
        src="/icon.png"
        alt="AtharGPS"
        width={s.img}
        height={s.img}
        draggable={false}
        style={{ borderRadius: 10, objectFit: 'cover', WebkitUserDrag: 'none', userSelect: 'none' }}
      />
      <div className="flex flex-col leading-none">
        <span className={`font-bold ${s.text} ${white ? 'text-white' : 'text-primary-500'} tracking-tight`}>
          Athar<span className={`${white ? 'text-accent-400' : 'text-accent'}`}>GPS</span>
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
