import React from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Fab } from './Fab'
import { TopBar } from './TopBar'

const TAB_ROUTES = {
  map: '/client/map',
  vehicles: '/client/vehicles',
  alerts: '/client/alerts',
  trips: '/client/trips',
  more: '/client/more',
}

export function ClientLayout({
  children,
  activeTab = 'map',
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
        {children}
      </main>
      {fab && <Fab {...fab} />}
      {sheet && <div className="absolute inset-0 z-40">{sheet}</div>}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} alertCount={alertCount} />
    </div>
  )
}

export default ClientLayout