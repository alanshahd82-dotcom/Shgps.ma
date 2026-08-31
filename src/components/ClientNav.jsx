import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  Car,
  Bell,
  MoreHorizontal,
  Navigation as NavigationIcon,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { t } from '../i18n/translations'

const PRIMARY_NAV = [
  { path: '/client/home',    icon: Home, labelKey: 'home' },
  { path: '/client/vehicles', icon: Car,  labelKey: 'vehicles' },
  { path: '/client/alerts',  icon: Bell, labelKey: 'alerts', badge: true },
  { path: '/client/trips',   icon: NavigationIcon, labelKey: 'trips' },
]

const MORE_PATHS = [
  '/subscriptions',
  '/client/reports',
  '/client/driver-behavior',
  '/client/maintenance',
  '/client/geofences',
  '/client/help',
  '/client/settings',
]

export default function ClientNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { unreadCount, lang } = useApp()

  const isPathActive = item => location.pathname === item.path ||
    (item.path !== '/client/home' && location.pathname.startsWith(item.path))

  const isVehiclesActive = location.pathname.startsWith('/client/devices') ||
    location.pathname.startsWith('/client/device/') ||
    location.pathname.startsWith('/client/vehicles') ||
    location.pathname.startsWith('/client/vehicle/')

  const isMoreActive = location.pathname === '/client/more' || MORE_PATHS.some(isPathActive)

  return (
    <>
      {/* Bottom bar */}
      <div
         className="ath-client-nav athar-bottom-nav fixed inset-x-0 bottom-0 z-30 w-full border-t border-slate-200 bg-white"
        style={{
          paddingBottom: 'max(var(--ds-space-2), env(safe-area-inset-bottom))',
           background: '#ffffff',
           borderColor: '#e2e8f0',
           boxShadow: '0 -4px 18px rgba(15,23,42,.06)',
        }}
      >
        <div className="mx-auto flex w-full max-w-xl items-stretch px-[var(--ds-space-1)] pt-[var(--ds-space-1)]">
          {/* Primary 4 items + More = 5 equal-width destinations */}
          {PRIMARY_NAV.map(item => {
            const active = item.labelKey === 'vehicles'
              ? isVehiclesActive
              : isPathActive(item)
            const Icon = item.icon
            return (
              <button
                type="button"
                key={item.path}
                onClick={() => navigate(item.path)}
                aria-current={active ? 'page' : undefined}
                className="ds-focus-ring relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-[var(--ds-radius-md)] py-[var(--ds-space-2)] transition-transform active:scale-95"
              >
                {active && (
                  <div
                     className="absolute inset-x-3 top-0 h-[3px] rounded-full bg-indigo-600"
                  />
                )}
                <div className="relative">
                  <Icon
                    size={20}
                    aria-hidden="true"
                    style={{
                       color: active ? '#4f46e5' : '#64748b',
                    }}
                  />
                  {item.badge && unreadCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ds-color-danger)] px-1 text-[9px] font-extrabold text-[var(--ds-color-white)]">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span
                   className={`mt-1 truncate px-1 text-[10px] font-semibold ${active ? 'text-indigo-600' : 'text-slate-500'}`}
                >
                  {t(lang, item.labelKey)}
                </span>
              </button>
            )
          })}

          {/* More button */}
          <button
            type="button"
            onClick={() => navigate('/client/more')}
            aria-current={isMoreActive ? 'page' : undefined}
            className="ds-focus-ring relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-[var(--ds-radius-md)] py-[var(--ds-space-2)] transition-transform active:scale-95"
          >
            {isMoreActive && (
              <div
                 className="absolute inset-x-3 top-0 h-[3px] rounded-full bg-indigo-600"
              />
            )}
            <MoreHorizontal
              size={21}
              aria-hidden="true"
              style={{
                 color: isMoreActive ? '#4f46e5' : '#64748b',
              }}
            />
            <span
               className={`mt-1 truncate px-1 text-[10px] font-semibold ${isMoreActive ? 'text-indigo-600' : 'text-slate-500'}`}
            >
              {t(lang, 'more')}
            </span>
          </button>
        </div>
      </div>
    </>
  )
}
