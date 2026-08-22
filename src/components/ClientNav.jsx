import React, { useEffect, useId, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  Car,
  Settings,
  MoreHorizontal,
  BarChart2,
  Bell,
  Gauge,
  LogOut,
  CreditCard,
  Wrench,
  MapPinned,
  CircleHelp,
  Navigation as NavigationIcon,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { t } from '../i18n/translations'
import { Button, Card, Sheet } from '../design-system'

const PRIMARY_NAV = [
  { path: '/client/home',    icon: Home, labelKey: 'home' },
  { path: '/client/vehicles', icon: Car,  labelKey: 'vehicles' },
  { path: '/client/alerts',  icon: Bell, labelKey: 'alerts', badge: true },
  { path: '/client/trips',   icon: NavigationIcon, labelKey: 'trips' },
]

const MORE_NAV = [
  { path: '/subscriptions',           icon: CreditCard, labelKey: 'subscriptions' },
  { path: '/client/reports',          icon: BarChart2, labelKey: 'reports' },
  { path: '/client/driver-behavior',  icon: Gauge,      labelKey: 'driver_behavior' },
  { path: '/client/maintenance',      icon: Wrench,     labelKey: 'maintenance' },
  { path: '/client/geofences',        icon: MapPinned,  labelKey: 'geofencesPage' },
  { path: '/client/help',             icon: CircleHelp, labelKey: 'help' },
  { path: '/client/settings',         icon: Settings,   labelKey: 'settings' },
]

export default function ClientNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { unreadCount, lang, logoutClient } = useApp()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreTitleId = useId()

  const isPathActive = item => location.pathname === item.path ||
    (item.path !== '/client/home' && location.pathname.startsWith(item.path))

  const isVehiclesActive = location.pathname.startsWith('/client/devices') ||
    location.pathname.startsWith('/client/device/') ||
    location.pathname.startsWith('/client/vehicles') ||
    location.pathname.startsWith('/client/vehicle/')

  const isMoreActive = MORE_NAV.some(isPathActive)

  function navTo(path) {
    navigate(path)
    setMoreOpen(false)
  }

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!moreOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [moreOpen])

  return (
    <>
      <Sheet
        open={moreOpen}
        title={t(lang, 'more')}
        labelledBy={moreTitleId}
        onClose={() => setMoreOpen(false)}
         className="border-slate-200 bg-white pb-[max(var(--ds-space-4),env(safe-area-inset-bottom))]"
      >
         <p className="mb-4 text-xs font-semibold text-slate-500">
          {lang === 'ar' ? 'كل أدوات حسابك في مكان واحد' : 'Tous les outils de votre compte au même endroit'}
        </p>
        <div className="grid grid-cols-2 gap-[var(--ds-space-2)]">
          {MORE_NAV.map(item => {
            const active = isPathActive(item)
            const Icon = item.icon
            return (
              <Card
                as="button"
                type="button"
                variant="interactive"
                key={item.path}
                onClick={() => navTo(item.path)}
                aria-current={active ? 'page' : undefined}
                 className={`flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-3 ${active ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
                style={active ? {
                   borderColor: '#4f46e5',
                   background: '#eef2ff',
                } : undefined}
              >
                <Icon
                  size={20}
                  aria-hidden="true"
                   className={active ? 'text-indigo-600' : 'text-slate-500'}
                />
                <span
                   className={`text-xs font-bold ${active ? 'text-indigo-600' : 'text-slate-500'}`}
                >
                  {t(lang, item.labelKey)}
                </span>
              </Card>
            )
          })}
        </div>
        <Button
          variant="danger"
          size="md"
          onClick={async () => { setMoreOpen(false); await logoutClient(); navigate('/client/login') }}
          className="mt-3 w-full"
        >
          <LogOut size={17} aria-hidden="true" />
          {t(lang, 'logout')}
        </Button>
      </Sheet>

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
            onClick={() => {
              // The dedicated More route already renders the canonical menu.
              // Do not replace it with the compact sheet when returning from Profile.
              if (location.pathname === '/client/more') return
              setMoreOpen(v => !v)
            }}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
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
                 color: (moreOpen || isMoreActive) ? '#4f46e5' : '#64748b',
              }}
            />
            <span
               className={`mt-1 truncate px-1 text-[10px] font-semibold ${(moreOpen || isMoreActive) ? 'text-indigo-600' : 'text-slate-500'}`}
            >
              {t(lang, 'more')}
            </span>
          </button>
        </div>
      </div>
    </>
  )
}
