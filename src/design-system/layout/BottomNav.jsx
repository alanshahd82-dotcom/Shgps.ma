import React from 'react'
import { Bell, Car, Home, MoreHorizontal, Route } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import TabBar from '../../components/TabBar'

const tabs = [
  { id: 'home', labelKey: 'home', Icon: Home },
  { id: 'vehicles', labelKey: 'vehicles', Icon: Car },
  { id: 'alerts', labelKey: 'alerts', Icon: Bell },
  { id: 'trips', labelKey: 'trips', Icon: Route },
  { id: 'more', labelKey: 'more', Icon: MoreHorizontal },
]

export function BottomNav({ activeTab = 'home', onTabChange, alertCount = 0 }) {
  const { lang } = useApp()
  return (
    <TabBar
      position="absolute"
      tablist
      ariaLabel="التنقل الرئيسي"
      activeId={activeTab}
      onSelect={onTabChange}
      tabs={tabs.map(({ id, labelKey, Icon }) => ({ id, label: t(lang, labelKey), Icon, badge: id === 'alerts' ? alertCount : 0 }))}
    />
  )
}

export default BottomNav
