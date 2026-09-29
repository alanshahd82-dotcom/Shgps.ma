import React from 'react'
import { motion } from 'framer-motion'

// Shared bottom tab bar. Each tab: { id, label, Icon, badge? }.
export default function TabBar({ tabs, activeId, onSelect, position = 'fixed', ariaLabel, tablist = false }) {
  return (
    <nav
      aria-label={ariaLabel}
      className={`athar-bottom-nav ${position} inset-x-0 bottom-0 z-40 border-t border-slate-200/70 bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl`}
    >
      <div className="mx-auto grid h-[68px] max-w-xl grid-cols-5 px-1" role={tablist ? 'tablist' : undefined}>
        {tabs.map(({ id, label, Icon, badge }) => {
          const active = activeId === id
          return (
            <button
              key={id}
              type="button"
              role={tablist ? 'tab' : undefined}
              aria-selected={tablist ? active : undefined}
              aria-current={!tablist && active ? 'page' : undefined}
              aria-label={label}
              onClick={() => onSelect?.(id)}
              className="group relative flex min-w-0 flex-col items-center justify-center gap-0.5 pt-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
            >
              <span className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-transform duration-150 group-active:scale-90 ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'}`}>
                {active && (
                  <motion.span
                    layoutId="tabbar-pill"
                    className="absolute inset-0 rounded-full bg-indigo-100/80"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                )}
                <Icon className="relative h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
                {badge > 0 && (
                  <span className="absolute end-2 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
              <span className={`max-w-full truncate px-0.5 text-[10.5px] leading-tight ${active ? 'font-bold text-indigo-600' : 'font-medium text-slate-500'}`}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
