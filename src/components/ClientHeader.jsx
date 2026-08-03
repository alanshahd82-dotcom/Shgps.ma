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
      className={`${fixed ? 'fixed' : overlay ? 'absolute' : 'sticky'} inset-x-0 top-0 z-40 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-md`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-5">
        <Logo size="sm" />
        <div className="flex min-w-0 items-center gap-2.5">
          {showUser && (
            <div className="min-w-0 max-w-[8.5rem] text-end">
              <p className="truncate text-[9px] font-semibold text-slate-400">
                {isAr ? 'مرحباً بك' : 'Bienvenue'}
              </p>
              <p className="truncate text-xs font-extrabold text-primary-500">{displayName}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate('/client/alerts')}
            aria-label={isAr ? 'التنبيهات' : 'Notifications'}
            aria-current={location.pathname === '/client/alerts' ? 'page' : undefined}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary-500 shadow-sm transition-colors hover:border-accent focus-visible:outline-none"
          >
            <Bell size={18} strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}