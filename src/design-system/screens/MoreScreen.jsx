import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, BarChart3, ChevronLeft, CreditCard, HelpCircle, Info, LogOut, MapPin, Settings, Wrench } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { ClientLayout } from '../layout'
import { useApp } from '../../context/AppContext'

const GROUPS = [
  {
    ar: 'إدارة', fr: 'Gestion',
    items: [
      [MapPin, 'geofences', 'المناطق الجغرافية', 'Géofences'],
      [BarChart3, 'reports', 'التقارير', 'Rapports'],
      [Activity, 'driverBehavior', 'سلوك السائق', 'Comportement conducteur'],
      [Wrench, 'maintenance', 'الصيانة', 'Maintenance'],
    ],
  },
  {
    ar: 'الحساب', fr: 'Compte',
    items: [
      [CreditCard, 'subscriptions', 'الاشتراكات', 'Abonnements'],
      [Settings, 'settings', 'الإعدادات', 'Paramètres'],
    ],
  },
  {
    ar: 'الدعم', fr: 'Support',
    items: [
      [HelpCircle, 'help', 'المساعدة', 'Aide'],
      [Info, 'about', 'حول التطبيق', 'À propos'],
      [LogOut, 'logout', 'تسجيل الخروج', 'Déconnexion', 'danger'],
    ],
  },
]

const MENU_ROUTES = {
  geofences: '/client/geofences',
  reports: '/client/reports',
  driverBehavior: '/client/driver-behavior',
  maintenance: '/client/maintenance',
  subscriptions: '/subscriptions',
  settings: '/client/settings',
  help: '/client/help',
}

function MenuItem({ Icon, label, badge, variant = 'default', onClick }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 border-b border-slate-200 py-3 text-right last:border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 ${variant === 'danger' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'text-slate-900 hover:bg-slate-50'}`} dir="rtl">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${variant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className={`flex-1 text-sm ${variant === 'danger' ? 'text-red-600' : 'text-slate-900'}`}>{label}</span>
      {badge && <Badge variant="default" size="sm">{badge}</Badge>}
      <ChevronLeft className={`h-4 w-4 shrink-0 rtl:rotate-180 ${variant === 'danger' ? 'text-red-400' : 'text-slate-400'}`} aria-hidden="true" />
    </button>
  )
}

function Section({ title, children }) {
  return <section><h2 className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-slate-600">{title}</h2><Card variant="subtle" padding="sm">{children}</Card></section>
}

export function MoreScreen({ user: providedUser, alertCount = 0, onTabChange, onMenuItemClick }) {
  const { clientAuth, logoutClient, unreadCount, lang } = useApp()
  const user = providedUser ?? clientAuth ?? {}
  const navigate = useNavigate()
  const isAr = lang === 'ar'

  const handleMenuItemClick = (item) => {
    const label = isAr ? item[2] : item[3]
    onMenuItemClick?.(label)

    if (item[1] === 'logout') {
      logoutClient()
      navigate('/client/login', { replace: true })
      return
    }

    // about menu disabled
    if (false) return

    const route = MENU_ROUTES[item[1]]
    if (route) navigate(route)
  }

  return (
    <ClientLayout activeTab="more" onTabChange={onTabChange} alertCount={alertCount || unreadCount} showTopBar title={isAr ? 'المزيد' : 'Plus'}>
      <div className="h-full overflow-y-auto bg-white" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-4 border-b border-slate-200 bg-white p-4">
          <Avatar name={user.name || user.email || (isAr ? 'المستخدم' : 'Utilisateur')} size="xl" />
          <div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold text-slate-900">{user.name || (isAr ? 'حسابي' : 'Mon compte')}</h2><p className="mt-1 truncate text-xs text-slate-600">{user.email || (isAr ? 'بيانات الحساب غير متاحة' : 'Données du compte indisponibles')}</p>{(user.subscription || user.plan) && <Badge variant="default" size="sm" className="mt-2">{String(user.subscription || user.plan).toUpperCase()}</Badge>}</div>
        </div>
        <div className="space-y-6 bg-white p-4">
          {GROUPS.map(group => <Section key={group.ar} title={isAr ? group.ar : group.fr}>{group.items.map(item => <MenuItem key={item[1]} Icon={item[0]} label={isAr ? item[2] : item[3]} variant={item[4]} onClick={() => handleMenuItemClick(item)} />)}</Section>)}
        </div>
      </div>
    </ClientLayout>
  )
}

export default MoreScreen
