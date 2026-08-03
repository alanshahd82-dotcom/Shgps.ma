import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Car, Map, BarChart2, Bell, Settings } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { t } from '../i18n/translations'

const NAV_ITEMS = [
  { path: '/client/home',     icon: Home,      labelKey: 'home'    },
  { path: '/client/devices',  icon: Car,       labelKey: 'devices' },
  { path: '/client/map',      icon: Map,       labelKey: 'liveMap' },
  { path: '/client/reports',  icon: BarChart2, labelKey: 'reports' },
  { path: '/client/alerts',   icon: Bell,      labelKey: 'alerts', badge: true },
  { path: '/client/settings', icon: Settings,  labelKey: 'settings'},
]

export default function ClientNav() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { unreadCount, lang } = useApp()

  return (
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
        {NAV_ITEMS.map(item => {
          const active = location.pathname === item.path ||
            (item.path !== '/client/home' && location.pathname.startsWith(item.path))
          const Icon = item.icon

          return (
            <button key={item.path} onClick={() => navigate(item.path)}
              className="flex-1 flex flex-col items-center justify-center pt-2.5 pb-2 relative transition-all">
              {/* Active indicator */}
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                  style={{ background: '#e4b56b' }}/>
              )}

              {/* Icon + badge */}
              <div className="relative mb-1">
                <Icon size={21} style={{ color: active ? '#17324d' : '#9aa7b5', transition: 'color 0.2s' }}/>
                {item.badge && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5"
                    style={{ background: '#FF3B30', minWidth: 16 }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className="text-[10px] font-semibold" style={{ color: active ? '#17324d' : '#9aa7b5', transition: 'color 0.2s' }}>
                {t(lang, item.labelKey)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
