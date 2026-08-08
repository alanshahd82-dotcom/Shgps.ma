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
          className="fixed bottom-[68px] right-4 z-50 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden min-w-[170px]"
          style={{ boxShadow: '0 -4px 32px rgba(23,50,77,0.13)' }}
        >
          {MORE_NAV.map(item => {
            const active = location.pathname === item.path ||
              (item.path !== '/client/home' && location.pathname.startsWith(item.path))
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navTo(item.path)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors"
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
                <span className="text-sm font-semibold" style={{ color: active ? '#00D97E' : '#374151' }}>
                  {t(lang, item.labelKey)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom,0px)',
          background: 'rgba(255,255,255,0.97)',
          borderTop: '1px solid #e2e8f0',
          boxShadow: '0 -8px 24px rgba(23,50,77,0.06)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-stretch">
          {/* Primary 4 items */}
          {PRIMARY_NAV.map(item => {
            const active = location.pathname === item.path ||
              (item.path !== '/client/home' && location.pathname.startsWith(item.path))
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex-1 flex flex-col items-center justify-center pt-2.5 pb-2 relative transition-all"
              >
                {active && (
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                    style={{ background: '#00D97E' }}
                  />
                )}
                <Icon size={21} style={{ color: active ? '#0F2044' : '#9aa7b5', transition: 'color 0.2s' }} />
                <span className="text-xs font-semibold mt-1" style={{ color: active ? '#0F2044' : '#9aa7b5', transition: 'color 0.2s' }}>
                  {t(lang, item.labelKey)}
                </span>
              </button>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(v => !v)}
            className="flex-1 flex flex-col items-center justify-center pt-2.5 pb-2 relative transition-all"
          >
            {isMoreActive && (
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                style={{ background: '#00D97E' }}
              />
            )}
            <MoreHorizontal
              size={21}
              style={{ color: (moreOpen || isMoreActive) ? '#0F2044' : '#9aa7b5', transition: 'color 0.2s' }}
            />
            <span
              className="text-xs font-semibold mt-1"
              style={{ color: (moreOpen || isMoreActive) ? '#0F2044' : '#9aa7b5', transition: 'color 0.2s' }}
            >
              {lang === 'ar' ? 'المزيد' : 'Plus'}
            </span>
          </button>
        </div>
      </div>
    </>
  )
}
