import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Car, Map, Settings, MoreHorizontal, BarChart2, Bell } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { t } from '../i18n/translations'

const PRIMARY_NAV = [
  { path: '/client/home',     icon: Home,     labelKey: 'home'    },
  { path: '/client/devices',  icon: Car,      labelKey: 'devices' },
  { path: '/client/map',      icon: Map,      labelKey: 'liveMap' },
  { path: '/client/settings', icon: Settings, labelKey: 'settings'},
]

const MORE_NAV = [
  { path: '/client/reports', icon: BarChart2, labelKey: 'reports' },
  { path: '/client/alerts',  icon: Bell,      labelKey: 'alerts',  badge: true },
]

export default function ClientNav() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { unreadCount, lang } = useApp()
  const [moreOpen, setMoreOpen] = useState(false)

  const isMoreActive = MORE_NAV.some(item =>
    location.pathname === item.path ||
    (item.path !== '/client/home' && location.pathname.startsWith(item.path))
  )

  function navTo(path) { navigate(path); setMoreOpen(false) }

  return (
    <>
      {/* Overlay to close "more" panel */}
      {moreOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
      )}

      {/* More panel — slides up above nav bar */}
      {moreOpen && (
        <div
          className="fixed bottom-[calc(5.8rem+env(safe-area-inset-bottom))] right-4 z-50 min-w-[170px] overflow-hidden rounded-2xl border border-white/10 bg-[#0e2035]/95 shadow-2xl backdrop-blur-xl"
          style={{ boxShadow: '0 -4px 32px rgba(0,0,0,.35)' }}
        >
          {MORE_NAV.map(item => {
            const active = location.pathname === item.path ||
              (item.path !== '/client/home' && location.pathname.startsWith(item.path))
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navTo(item.path)}
                className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/5"
              >
                <div className="relative">
                  <Icon size={18} style={{ color: active ? '#00D97E' : '#64748b' }} />
                  {item.badge && unreadCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1.5 min-w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5"
                      style={{ background: '#FF3B30', minWidth: 16 }}
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold" style={{ color: active ? '#38d39f' : '#a2b3c1' }}>
                  {t(lang, item.labelKey)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Bottom bar */}
      <div
        className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-30 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-[1.35rem]"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom,0px)',
           background: 'rgba(14,32,53,0.86)',
           border: '1px solid rgba(255,255,255,.1)',
           boxShadow: '0 16px 42px rgba(0,0,0,.35)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-stretch px-1.5">
          {/* Primary 4 items */}
          {PRIMARY_NAV.map(item => {
            const active = location.pathname === item.path ||
              (item.path !== '/client/home' && location.pathname.startsWith(item.path))
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                    className="flex-1 flex flex-col items-center justify-center rounded-xl py-2.5 relative transition-all active:scale-95"
              >
                {active && (
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                    style={{ background: '#00D97E' }}
                  />
                )}
                 <Icon size={20} style={{ color: active ? '#38d39f' : '#7890a4', transition: 'color 0.2s' }} />
                 <span className="text-[10px] font-semibold mt-1" style={{ color: active ? '#edf4f2' : '#7890a4', transition: 'color 0.2s' }}>
                  {t(lang, item.labelKey)}
                </span>
              </button>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(v => !v)}
            className="flex-1 flex flex-col items-center justify-center rounded-xl py-2.5 relative transition-all active:scale-95"
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
              className="text-xs font-semibold mt-1"
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
