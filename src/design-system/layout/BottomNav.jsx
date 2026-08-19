import React from 'react'
import { motion } from 'framer-motion'
import { Bell, Car, Map, MoreHorizontal, Route } from 'lucide-react'

const tabs = [
  { id: 'map', label: 'الخريطة', Icon: Map },
  { id: 'vehicles', label: 'المركبات', Icon: Car },
  { id: 'alerts', label: 'التنبيهات', Icon: Bell },
  { id: 'trips', label: 'الرحلات', Icon: Route },
  { id: 'more', label: 'المزيد', Icon: MoreHorizontal },
]

export function BottomNav({ activeTab = 'map', onTabChange, alertCount = 0 }) {
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="absolute inset-x-0 bottom-0 z-50 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      dir="rtl"
    >
      <div className="grid h-16 grid-cols-5" role="tablist">
        {tabs.map(({ id, label, Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={label}
              onClick={() => onTabChange?.(id)}
              className="relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              {active && (
                <motion.span
                  layoutId="nav-indicator"
                  className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                />
              )}
              <span className={`relative ${active ? 'text-accent' : 'text-slate-500'}`}>
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                {id === 'alerts' && alertCount > 0 && (
                  <span className="absolute -end-2 -top-2 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )}
              </span>
              <span className={active ? 'text-accent' : 'text-slate-500'}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav