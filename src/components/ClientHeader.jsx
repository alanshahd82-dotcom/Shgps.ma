import React from 'react'
import { Bell } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Logo from './Logo'
import { IconButton } from '../design-system'

export default function ClientHeader({ overlay = false, fixed = false, showUser = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { unreadCount, lang, clientAuth } = useApp()
  const isAr = lang === 'ar'
  const displayName = String(clientAuth?.name || 'ATHAR GPS').trim().split(/\s+/).slice(0, 2).join(' ')

  return (
    <header
      className={`ath-client-header ${fixed ? 'fixed' : overlay ? 'absolute' : 'sticky'} inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur`}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'rgba(255,255,255,.90)',
      }}
    >
      <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-5">
        <Logo size="sm" />
        <div className="flex min-w-0 items-center gap-2.5">
          {showUser && (
            <div className="min-w-0 max-w-[8.5rem] text-end">
               <p className="truncate text-[10px] font-semibold text-slate-500">
                {isAr ? 'مرحباً، ' : 'Bonjour, '}{displayName}
              </p>
            </div>
          )}
          <IconButton
            onClick={() => navigate('/client/alerts')}
            label={isAr ? 'التنبيهات' : 'Notifications'}
            aria-current={location.pathname === '/client/alerts' ? 'page' : undefined}
             className="relative shrink-0 border-slate-200 bg-slate-100 text-slate-600 shadow-sm hover:border-indigo-300 focus-visible:outline-none"
          >
            <Bell size={18} strokeWidth={2} />
             {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-slate-100" aria-label={isAr ? 'تنبيهات غير مقروءة' : 'Unread notifications'} />}
          </IconButton>
        </div>
      </div>
    </header>
  )
}