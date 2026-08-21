import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, BarChart3, ChevronLeft, CreditCard, HelpCircle, Info, LogOut, MapPin, Settings, User, Wrench } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { ClientLayout } from '../layout'
import { useApp } from '../../context/AppContext'

const MENU_ROUTES = {
  'المناطق الجغرافية': '/client/geofences',
  'التقارير': '/client/reports',
  'سلوك السائق': '/client/driver-behavior',
  'الصيانة': '/client/maintenance',
  'الاشتراكات': '/subscriptions',
  'الملف الشخصي': '/client/settings',
  'الإعدادات': '/client/settings',
  'المساعدة': '/client/help',
}

function MenuItem({ Icon, label, badge, variant = 'default', onClick }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 border-b border-border py-3 text-right last:border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${variant === 'danger' ? 'text-red-500' : 'text-primary'} hover:bg-slate-50`} dir="rtl">
      <Icon className={`h-5 w-5 shrink-0 ${variant === 'danger' ? 'text-red-500' : 'text-slate-500'}`} aria-hidden="true" />
      <span className="flex-1 text-sm">{label}</span>
      {badge && <Badge variant="default" size="sm">{badge}</Badge>}
      <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 rtl:rotate-180" aria-hidden="true" />
    </button>
  )
}

function Section({ title, children }) {
  return <section><h2 className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">{title}</h2><Card variant="subtle" padding="sm">{children}</Card></section>
}

export function MoreScreen({ user: providedUser, alertCount = 0, onTabChange, onMenuItemClick }) {
  const { clientAuth, logoutClient, unreadCount } = useApp()
  const user = providedUser ?? clientAuth ?? {}
  const navigate = useNavigate()

  const handleMenuItemClick = (label) => {
    onMenuItemClick?.(label)

    if (label === 'تسجيل الخروج') {
      logoutClient()
      navigate('/client/login', { replace: true })
      return
    }

    if (label === 'حول التطبيق') {
      window.alert('ATHAR GPS\nمنصة تتبع وإدارة المركبات')
      return
    }

    const route = MENU_ROUTES[label]
    if (route) {
      navigate(route)
    }
  }

  const groups = [
    { title: 'إدارة', items: [[MapPin, 'المناطق الجغرافية'], [BarChart3, 'التقارير'], [Activity, 'سلوك السائق'], [Wrench, 'الصيانة']] },
    { title: 'الحساب', items: [[CreditCard, 'الاشتراكات', 'Pro'], [User, 'الملف الشخصي'], [Settings, 'الإعدادات']] },
    { title: 'الدعم', items: [[HelpCircle, 'المساعدة'], [Info, 'حول التطبيق'], [LogOut, 'تسجيل الخروج', null, 'danger']] },
  ]
  return (
       <ClientLayout activeTab="more" onTabChange={onTabChange} alertCount={alertCount || unreadCount} showTopBar title="المزيد">
      <div className="h-full overflow-y-auto bg-slate-50" dir="rtl">
        <div className="flex items-center gap-4 border-b border-border bg-white p-4">
          <Avatar name={user.name || user.email || 'المستخدم'} size="xl" />
          <div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold text-primary">{user.name || 'حسابي'}</h2><p className="mt-1 truncate text-xs text-slate-500">{user.email || 'بيانات الحساب غير متاحة'}</p><Badge variant="default" size="sm" className="mt-2">{String(user.subscription || user.plan || 'free').toUpperCase()}</Badge></div>
        </div>
        <div className="space-y-6 p-4">
          {groups.map(group => <Section key={group.title} title={group.title}>{group.items.map(([Icon, label, badge, variant]) => <MenuItem key={label} Icon={Icon} label={label} badge={badge} variant={variant} onClick={() => handleMenuItemClick(label)} />)}</Section>)}
        </div>
      </div>
    </ClientLayout>
  )
}

export default MoreScreen