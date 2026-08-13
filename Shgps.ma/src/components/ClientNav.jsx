import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Car, Map, Settings, MoreHorizontal, BarChart2, Bell, Gauge, LogOut, CreditCard, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { t } from '../i18n/translations'

const PRIMARY_NAV = [
  { path: '/client/home',     icon: Home,     labelKey: 'home'    },
  { path: '/client/devices',  icon: Car,      labelKey: 'devices' },
  { path: '/client/map',      icon: Map,      labelKey: 'liveMap' },
  { path: '/client/alerts',   icon: Bell,     labelKey: 'alerts', badge: true },
]

const MORE_NAV = [
  { path: '/subscriptions',  icon: CreditCard, label: 'الاشتراكات', labelFr: 'Abonnements' },
  { path: '/client/reports', icon: BarChart2, labelKey: 'reports' },
  { path: '/client/driver-behavior', icon: Gauge, label: 'سلوك السائق', labelFr: 'Comportement' },
  { path: '/client/settings', icon: Settings, labelKey: 'settings' },
]

export default function ClientNav() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { unreadCount, lang, logoutClient } = useApp()
  const [moreOpen, setMoreOpen] = useState(false)

  const isMoreActive = location.pathname === '/subscriptions' || MORE_NAV.some(item =>
    location.pathname === item.path ||
    (item.path !== '/client/home' && location.pathname.startsWith(item.path))
  )

  function navTo(path) { navigate(path); setMoreOpen(false) }

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
      {/* Overlay to close "more" panel */}
      {moreOpen && (
        <button
          type="button"
          aria-label={lang === 'ar' ? 'إغلاق قائمة المزيد' : 'Fermer le menu Plus'}
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More bottom sheet */}
      {moreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lang === 'ar' ? 'المزيد' : 'Plus'}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[78dvh] overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#0e2035]/[.98] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-18px_60px_rgba(0,0,0,.46)] backdrop-blur-2xl"
        >
          <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-white/20" />
          <div className="flex items-center justify-between px-5 pb-3 pt-4">
            <div>
              <p className="text-base font-extrabold text-[#edf4f2]">{lang === 'ar' ? 'المزيد' : 'Plus'}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-[#7890a4]">{lang === 'ar' ? 'اختصارات حسابك' : 'Raccourcis du compte'}</p>
            </div>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              aria-label={lang === 'ar' ? 'إغلاق' : 'Fermer'}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#a2b3c1] transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={17} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4">
            {MORE_NAV.map(item => {
              const active = location.pathname === item.path ||
                (item.path !== '/client/home' && location.pathname.startsWith(item.path))
              const Icon = item.icon
              return (
                <button
                  type="button"
                  key={item.path}
                  onClick={() => navTo(item.path)}
                  className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[.035] px-3 py-3 transition-all hover:border-[#38d39f]/35 hover:bg-[#38d39f]/10 active:scale-[.98]"
                >
                  <div className="relative">
                    <Icon size={20} style={{ color: active ? '#00D97E' : '#94a8ba' }} />
                  </div>
                  <span className="text-xs font-bold" style={{ color: active ? '#38d39f' : '#a2b3c1' }}>
                    {item.labelKey ? t(lang, item.labelKey) : (lang === 'ar' ? item.label : item.labelFr)}
                  </span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={async () => { setMoreOpen(false); await logoutClient(); navigate('/client/login') }}
            className="mx-4 mt-3 flex min-h-12 w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-2xl border border-[#ff5a5f]/20 bg-[#ff5a5f]/[.07] text-sm font-bold text-[#ff9a9d] transition-colors hover:bg-[#ff5a5f]/[.14]"
          >
            <LogOut size={17} />
            {t(lang, 'logout')}
          </button>
        </div>
      )}

      {/* Bottom bar */}
      <div
        className="athar-bottom-nav fixed inset-x-0 bottom-0 z-30 w-full border-t border-white/10"
        style={{
          paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
          background: 'rgba(14,32,53,0.94)',
          boxShadow: '0 -12px 34px rgba(0,0,0,.28)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="mx-auto flex w-full max-w-xl items-stretch px-1.5 pt-1.5">
          {/* Primary 4 items + More = 5 equal-width destinations */}
          {PRIMARY_NAV.map(item => {
            const active = location.pathname === item.path ||
              (item.path !== '/client/home' && location.pathname.startsWith(item.path))
            const Icon = item.icon
            return (
              <button
                type="button"
                key={item.path}
                onClick={() => navigate(item.path)}
                className="relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl py-2.5 transition-all active:scale-95"
              >
                {active && (
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                    style={{ background: '#00D97E' }}
                  />
                )}
                <div className="relative">
                  <Icon size={20} style={{ color: active ? '#38d39f' : '#7890a4', transition: 'color 0.2s' }} />
                  {item.badge && unreadCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[9px] font-extrabold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="mt-1 truncate px-1 text-[10px] font-semibold" style={{ color: active ? '#edf4f2' : '#7890a4', transition: 'color 0.2s' }}>
                  {t(lang, item.labelKey)}
                </span>
              </button>
            )
          })}

          {/* More button */}
          <button
            type="button"
            onClick={() => setMoreOpen(v => !v)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className="relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl py-2.5 transition-all active:scale-95"
          >
            {isMoreActive && (
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                style={{ background: '#00D97E' }}
              />
            )}
            <MoreHorizontal
              size={21}
              style={{ color: (moreOpen || isMoreActive) ? '#38d39f' : '#7890a4', transition: 'color 0.2s' }}
            />
            <span
              className="mt-1 truncate px-1 text-[10px] font-semibold"
              style={{ color: (moreOpen || isMoreActive) ? '#edf4f2' : '#7890a4', transition: 'color 0.2s' }}
            >
              {lang === 'ar' ? 'المزيد' : 'Plus'}
            </span>
          </button>
        </div>
      </div>
    </>
  )
}
