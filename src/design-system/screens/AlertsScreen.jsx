import React, { useMemo, useState } from 'react'
import { Bell, CheckCheck, Gauge, MapPin, Zap } from 'lucide-react'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { IconButton } from '../components/IconButton'
import { ClientLayout } from '../layout'
import VehicleBottomSheet from './VehicleBottomSheet'
import { useApp } from '../../context/AppContext'
import { useRealVehicles } from '../hooks/useRealVehicles'

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

export function AlertsScreen({ alerts: providedAlerts, vehicles: providedVehicles, onSelectVehicle, alertCount = 0, onMarkAllRead, onTabChange }) {
  const { alertsList, markAlertRead, markAllAlertsRead, unreadCount } = useApp()
  const { vehicles: realVehicles } = useRealVehicles()
  const alerts = providedAlerts ?? alertsList
  const vehicles = providedVehicles ?? realVehicles
  const [filter, setFilter] = useState('all')
  const [selectedVehicleId, setSelectedVehicleId] = useState(null)
  const selectedVehicle = useMemo(() => vehicles.find(vehicle => vehicle.id === selectedVehicleId), [selectedVehicleId, vehicles])
  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true
    if (filter === 'power') return alert.type === 'power_disconnected' || alert.type === 'power_restored'
    return alert.type === filter
  })
  const markAllRead = () => {
    markAllAlertsRead()
    onMarkAllRead?.()
  }
  const selectAlert = alert => {
    if (!alert.read) markAlertRead(alert.id)
    selectVehicle(alert.deviceId ?? alert.vehicleId)
  }
  const selectVehicle = vehicleId => {
    setSelectedVehicleId(vehicleId)
    onSelectVehicle?.(vehicleId)
  }

  return (
    <ClientLayout activeTab="alerts" onTabChange={onTabChange} alertCount={alertCount || unreadCount} showTopBar title="التنبيهات" sheet={selectedVehicle ? <VehicleBottomSheet vehicle={selectedVehicle} stage="peek" onClose={() => setSelectedVehicleId(null)} /> : null}>
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
          {filteredAlerts.map(alert => <AlertRow key={alert.id} alert={{ ...alert, vehicleName: alert.vehicleName || alert.deviceName || 'مركبة', time: alert.time || alert.createdAt || 'غير معروف' }} onClick={() => selectAlert(alert)} />)}
          {filteredAlerts.length === 0 && <div className="py-16 text-center text-sm text-slate-500" role="status">لا توجد تنبيهات في هذا التصنيف</div>}
        </div>
      </div>
    </ClientLayout>
  )
}

export default AlertsScreen