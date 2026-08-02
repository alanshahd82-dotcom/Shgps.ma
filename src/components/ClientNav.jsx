import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Car, Map, Bell, Settings, Wifi, WifiOff } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { t } from '../i18n/translations'

const NAV_ITEMS = [
  { path: '/client/home',     icon: Home,     labelKey: 'home'     },
  { path: '/client/devices',  icon: Car,      labelKey: 'devices'  },
  { path: '/client/map',      icon: Map,      labelKey: 'liveMap', exact: true },
  { path: '/client/alerts',   icon: Bell,     labelKey: 'alerts',  badge: true },
  { path: '/client/settings', icon: Settings, labelKey: 'settings' },
]

export default function ClientNav() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { unreadCount, lang, wsConnected } = useApp()

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-gray-200/80 dark:border-slate-700/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* WS status strip */}
      <div className={`flex items-center justify-center gap-1.5 py-[3px] text-[9px] font-semibold transition-colors ${
        wsConnected
          ? 'text-emerald-500 bg-emerald-50/70 dark:bg-emerald-900/20'
          : 'text-amber-500 bg-amber-50/70 dark:bg-amber-900/20'
      }`}>
        {wsConnected
          ? <><Wifi size={8} />{t(lang, 'wsConnected')}</>
          : <><WifiOff size={8} className="animate-pulse" />{t(lang, 'wsDisconnected')}</>
        }
      </div>

      {/* Nav items */}
      <div className="flex items-center justify-around px-1 py-1.5">
        {NAV_ITEMS.map(item => {
          const active = item.exact
            ? location.pathname === item.path
            : location.pathname === item.path ||
              location.pathname.startsWith(item.path + '/')
          const Icon  = item.icon
          const badge = item.badge ? unreadCount : 0

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center justify-center gap-0.5 min-w-[52px] min-h-[44px] rounded-2xl transition-all duration-200"
            >
              {/* Active highlight */}
              {active && (
                <span
                  className="absolute inset-x-1 inset-y-0.5 rounded-xl pointer-events-none"
                  style={{ background: 'rgba(0,217,126,0.10)' }}
                />
              )}

              {/* Icon */}
              <div className="relative z-10">
                <Icon
                  size={19}
                  strokeWidth={active ? 2.5 : 1.8}
                  className={`transition-colors duration-200 ${active ? 'text-accent' : 'text-slate-400 dark:text-slate-500'}`}
                />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[8px] font-semibold z-10 transition-colors duration-200 leading-tight ${
                  active ? 'text-accent' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {t(lang, item.labelKey)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
