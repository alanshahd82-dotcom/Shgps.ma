import React, { useMemo, useState } from 'react'
import { Bell, CheckCheck, Gauge, MapPin, Zap } from 'lucide-react'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { IconButton } from '../components/IconButton'
import { ClientLayout } from '../layout'
import VehicleBottomSheet from './VehicleBottomSheet'

const defaultAlerts = [
  { id: 1042, type: 'power_restored', vehicleName: 'bekane', vehicleId: 14, severity: 'info', time: 'منذ دقيقتين', read: false },
  { id: 1041, type: 'power_disconnected', vehicleName: 'DACIA', vehicleId: 16, severity: 'danger', time: 'منذ 10 دقائق', read: false },
  { id: 1040, type: 'speed', vehicleName: 'Othmane', vehicleId: 37, severity: 'alert', time: 'منذ ساعة', read: true },
  { id: 1039, type: 'geofence', vehicleName: 'DACIA', vehicleId: 16, severity: 'alert', time: 'منذ 3 ساعات', read: true },
]

const defaultVehicles = [
  { id: 16, name: 'DACIA', status: 'online', speed: 0, battery: 85, charge: true, ignition: false, lastUpdate: 'منذ دقيقتين', lat: 33.5731, lng: -7.5898 },
  { id: 14, name: 'bekane', status: 'offline', speed: 0, battery: 45, charge: false, ignition: false, lastUpdate: 'منذ ساعة', lat: 33.58, lng: -7.6 },
  { id: 37, name: 'Othmane', status: 'online', speed: 45, battery: 92, charge: true, ignition: true, lastUpdate: 'منذ 30 ثانية', lat: 33.565, lng: -7.595 },
]

const filters = [
  ['all', 'الكل'],
  ['power', 'طاقة'],
  ['geofence', 'جغرافية'],
  ['speed', 'سرعة'],
  ['other', 'أخرى'],
]

function alertMeta(alert) {
  if (alert.type === 'speed') return { Icon: Gauge, title: 'سرعة مرتفعة', variant: 'alert', label: 'تنبيه' }
  if (alert.type === 'geofence') return { Icon: MapPin, title: 'مغادرة منطقة جغرافية', variant: 'alert', label: 'تنبيه' }
  if (alert.type === 'power_disconnected') return { Icon: Zap, title: 'انقطاع الطاقة', variant: 'danger', label: 'خطر' }
  return { Icon: Zap, title: 'عودة الطاقة', variant: 'online', label: 'معلومات' }
}

function AlertRow({ alert, onClick }) {
  const { Icon, title, variant, label } = alertMeta(alert)
  return (
    <Card padding="sm" onClick={onClick} className={`transition-shadow hover:shadow-md ${!alert.read ? 'border-s-2 border-s-accent' : ''}`} role="button" tabIndex={0} onKeyDown={event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick?.() }
    }} aria-label={`${title}: ${alert.vehicleName}`}>
      <div className="flex items-center gap-3" dir="rtl">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${variant === 'danger' ? 'bg-red-500/10 text-red-500' : variant === 'alert' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 text-right">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-primary">{title}</h3>
            {!alert.read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="غير مقروء" />}
          </div>
          <p className="mt-1 text-xs text-slate-500">{alert.vehicleName} · {alert.time}</p>
        </div>
        <Badge variant={variant} size="sm">{label}</Badge>
      </div>
    </Card>
  )
}

export function AlertsScreen({ alerts = defaultAlerts, vehicles = defaultVehicles, onSelectVehicle, alertCount = 0, onMarkAllRead, onTabChange }) {
  const [filter, setFilter] = useState('all')
  const [internalAlerts, setInternalAlerts] = useState(alerts)
  const [selectedVehicleId, setSelectedVehicleId] = useState(null)
  const selectedVehicle = useMemo(() => vehicles.find(vehicle => vehicle.id === selectedVehicleId), [selectedVehicleId, vehicles])
  const filteredAlerts = internalAlerts.filter(alert => {
    if (filter === 'all') return true
    if (filter === 'power') return alert.type === 'power_disconnected' || alert.type === 'power_restored'
    return alert.type === filter
  })
  const markAllRead = () => {
    setInternalAlerts(current => current.map(alert => ({ ...alert, read: true })))
    onMarkAllRead?.()
  }
  const selectVehicle = vehicleId => {
    setSelectedVehicleId(vehicleId)
    onSelectVehicle?.(vehicleId)
  }

  return (
    <ClientLayout activeTab="alerts" onTabChange={onTabChange} alertCount={alertCount} showTopBar title="التنبيهات" sheet={selectedVehicle ? <VehicleBottomSheet vehicle={selectedVehicle} stage="peek" onClose={() => setSelectedVehicleId(null)} /> : null}>
      <div className="h-full overflow-y-auto bg-slate-50" dir="rtl">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-white p-4">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5" role="tablist" aria-label="تصفية التنبيهات">
            {filters.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${filter === id ? 'bg-accent text-white' : 'border border-border bg-slate-50 text-slate-500 hover:bg-border'}`}>{label}</button>
            ))}
          </div>
          <IconButton icon={<CheckCheck className="h-5 w-5" />} label="تحديد الكل كمقروء" onClick={markAllRead} variant="ghost" />
        </div>
        <div className="space-y-2 p-4">
          {filteredAlerts.map(alert => <AlertRow key={alert.id} alert={alert} onClick={() => selectVehicle(alert.vehicleId)} />)}
          {filteredAlerts.length === 0 && <div className="py-16 text-center text-sm text-slate-500" role="status">لا توجد تنبيهات في هذا التصنيف</div>}
        </div>
      </div>
    </ClientLayout>
  )
}

export default AlertsScreen