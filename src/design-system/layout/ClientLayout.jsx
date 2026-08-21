import React from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Fab } from './Fab'
import { TopBar } from './TopBar'
import { useApp } from '../../context/AppContext'

const TAB_ROUTES = {
  home: '/client/home',
  map: '/client/map',
  vehicles: '/client/vehicles',
  alerts: '/client/alerts',
  trips: '/client/trips',
  more: '/client/more',
}

export function ClientLayout({
  children,
  activeTab = 'home',
  onTabChange,
  sheet,
  showTopBar = true,
  title,
  onBack,
  alertCount = 0,
  topBarLeft,
  topBarRight,
  topBarTransparent = false,
  fab,
}) {
  const navigate = useNavigate()
  const { networkError, refreshDevices } = useApp()
  const handleTabChange = (tab) => {
    onTabChange?.(tab)
    navigate(TAB_ROUTES[tab] || '/client/home')
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-slate-50" dir="rtl">
      {showTopBar && (
        <TopBar
          title={title}
          left={topBarLeft}
          right={topBarRight}
          transparent={topBarTransparent}
          onBack={onBack}
        />
      )}
      <main className={`absolute inset-x-0 overflow-hidden ${showTopBar ? 'top-[calc(56px+env(safe-area-inset-top))]' : 'top-0'} bottom-[calc(64px+env(safe-area-inset-bottom))]`}>
        {networkError && (
          <div className="absolute inset-x-3 top-3 z-30 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-sm" role="status" dir="rtl">
            <span className="min-w-0 flex-1">تعذر تحديث البيانات. تحقق من الاتصال وحاول مرة أخرى.</span>
            <button type="button" onClick={refreshDevices} className="shrink-0 rounded-lg px-2 py-1 font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">إعادة المحاولة</button>
          </div>
        )}
        {children}
      </main>
      {fab && <Fab {...fab} />}
      {sheet && <div className="absolute inset-0 z-40">{sheet}</div>}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} alertCount={alertCount} />
    </div>
  )
}

export default ClientLayout