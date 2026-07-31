import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Cpu, Bell, Settings, BarChart2, Wrench, ShieldCheck } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { t } from '../i18n/translations'

export default function ClientNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { unreadCount, lang } = useApp()
  const isAr = lang === 'ar'

  const items = [
    { path: '/client/home',            icon: Home,        label: t(lang, 'home') },
    { path: '/client/devices',         icon: Cpu,         label: t(lang, 'devices') },
    { path: '/client/alerts',          icon: Bell,        label: t(lang, 'alerts'), badge: unreadCount },
    { path: '/client/maintenance',     icon: Wrench,      label: isAr ? 'الصيانة' : 'Entretien' },
    { path: '/client/driver-behavior', icon: ShieldCheck, label: isAr ? 'السائق' : 'Conduite' },
    { path: '/client/settings',        icon: Settings,    label: t(lang, 'settings') },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 glass border-t border-gray-200/80 z-30 pb-safe">
      <div className="flex items-center justify-around px-1 py-2">
        {items.map(item => {
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex min-w-[50px] min-h-[44px] flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-2xl transition-all duration-200 relative ${
                active ? 'text-accent' : 'text-slate-400'
              }`}
            >
              <div className="relative">
                <Icon
                  size={18}
                  strokeWidth={active ? 2.5 : 2}
                  className={`transition-all duration-200 ${active ? 'text-accent' : 'text-slate-400'}`}
                />
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[8px] font-medium transition-colors duration-200 leading-tight text-center ${active ? 'text-accent' : 'text-slate-400'}`}>
                {item.label}
              </span>
              {active && (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
