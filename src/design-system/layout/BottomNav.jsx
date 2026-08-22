import React from 'react'
import { motion } from 'framer-motion'
import { Bell, Car, Home, MoreHorizontal, Route } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'

const tabs = [
  { id: 'home', labelKey: 'home', Icon: Home },
  { id: 'vehicles', labelKey: 'vehicles', Icon: Car },
  { id: 'alerts', labelKey: 'alerts', Icon: Bell },
  { id: 'trips', labelKey: 'trips', Icon: Route },
  { id: 'more', labelKey: 'more', Icon: MoreHorizontal },
]

export function BottomNav({ activeTab = 'home', onTabChange, alertCount = 0 }) {
  const { lang } = useApp()
  return (
    <nav
      aria-label="التنقل الرئيسي"
       className="absolute inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      dir="rtl"
    >
      <div className="grid h-16 grid-cols-5" role="tablist">
        {tabs.map(({ id, labelKey, Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={t(lang, labelKey)}
              onClick={() => onTabChange?.(id)}
              className="relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              {active && (
                <motion.span
                  layoutId="nav-indicator"
                   className="absolute inset-x-3 top-0 h-[3px] rounded-full bg-indigo-600"
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                />
              )}
               <span className={`relative ${active ? 'text-indigo-600' : 'text-slate-500'}`}>
                 <Icon className={`h-5 w-5 ${active ? 'text-indigo-600' : 'text-slate-500'}`} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                {id === 'alerts' && alertCount > 0 && (
                  <span className="absolute -end-2 -top-2 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )}
              </span>
               <span className={active ? 'font-semibold text-indigo-600' : 'text-slate-500'}>{t(lang, labelKey)}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav