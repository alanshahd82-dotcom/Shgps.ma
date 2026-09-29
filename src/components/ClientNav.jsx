import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  Car,
  Bell,
  MoreHorizontal,
  Navigation as NavigationIcon,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { t } from '../i18n/translations'
import TabBar from './TabBar'

const PRIMARY_NAV = [
  { path: '/client/home',    icon: Home, labelKey: 'home' },
  { path: '/client/vehicles', icon: Car,  labelKey: 'vehicles' },
  { path: '/client/alerts',  icon: Bell, labelKey: 'alerts', badge: true },
  { path: '/client/trips',   icon: NavigationIcon, labelKey: 'trips' },
]

const MORE_PATHS = [
  '/subscriptions',
  '/client/reports',
  '/client/driver-behavior',
  '/client/maintenance',
  '/client/geofences',
  '/client/help',
  '/client/settings',
]

export default function ClientNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { unreadCount, lang } = useApp()

  const isPathActive = item => location.pathname === item.path ||
    (item.path !== '/client/home' && location.pathname.startsWith(item.path))

  const isVehiclesActive = location.pathname.startsWith('/client/devices') ||
    location.pathname.startsWith('/client/device/') ||
    location.pathname.startsWith('/client/vehicles') ||
    location.pathname.startsWith('/client/vehicle/')

  const isMoreActive = location.pathname === '/client/more' || MORE_PATHS.some(path => location.pathname.startsWith(path))

  const activeId = isMoreActive
    ? 'more'
    : isVehiclesActive
      ? 'vehicles'
      : PRIMARY_NAV.find(item => item.labelKey !== 'vehicles' && isPathActive(item))?.labelKey
  const tabs = [
    ...PRIMARY_NAV.map(item => ({
      id: item.labelKey,
      label: t(lang, item.labelKey),
      Icon: item.icon,
      badge: item.badge ? unreadCount : 0,
      path: item.path,
    })),
    { id: 'more', label: t(lang, 'more'), Icon: MoreHorizontal, path: '/client/more' },
  ]

  return (
    <TabBar
      activeId={activeId}
      onSelect={id => navigate(tabs.find(tab => tab.id === id).path)}
      tabs={tabs}
    />
  )
}
