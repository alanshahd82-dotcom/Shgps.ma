import React from 'react'
import { Bell } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Logo from './Logo'

export default function ClientHeader({ overlay = false, fixed = false, showUser = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { unreadCount, lang, clientAuth } = useApp()
  const isAr = lang === 'ar'
  const displayName = String(clientAuth?.name || 'ATHAR GPS').trim().split(/\s+/).slice(0, 2).join(' ')

  return (
    <header
      className={`${fixed ? 'fixed' : overlay ? 'absolute' : 'sticky'} inset-x-0 top-0 z-40 border-b border-white/10 bg-[#07111f]/85 shadow-[0_8px_30px_rgba(0,0,0,.18)] backdrop-blur-xl`}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: overlay
          ? 'linear-gradient(180deg, rgba(7,17,31,.94) 0%, rgba(7,17,31,.62) 72%, transparent 100%)'
          : 'linear-gradient(180deg, rgba(7,17,31,.98) 0%, rgba(11,27,51,.94) 100%)',
      }}
    >
      <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-5">
        <Logo size="sm" />
        <div className="flex min-w-0 items-center gap-2.5">
          {showUser && (
            <div className="min-w-0 max-w-[8.5rem] text-end">
              <p className="truncate text-[10px] font-semibold text-[#8da2b5]">
                {isAr ? 'مرحباً، ' : 'Bonjour, '}{displayName}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate('/client/alerts')}
            aria-label={isAr ? 'التنبيهات' : 'Notifications'}
            aria-current={location.pathname === '/client/alerts' ? 'page' : undefined}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0e2035] text-[#d9ad62] shadow-sm transition-all hover:border-[#38d39f]/60 active:scale-95 focus-visible:outline-none"
          >
            <Bell size={18} strokeWidth={2} />
            {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#FF5A5F] ring-2 ring-[#0e2035]" aria-label={isAr ? 'تنبيهات غير مقروءة' : 'Unread notifications'} />}
          </button>
        </div>
      </div>
    </header>
  )
}