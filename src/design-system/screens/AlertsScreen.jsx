import { api } from '../../api/index.js'
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BatteryLow,
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  Gauge,
  MapPin,
  ShieldAlert,
  WifiOff,
  Zap,
} from 'lucide-react'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { ClientLayout } from '../layout'
import VehicleBottomSheet from './VehicleBottomSheet'
import { useApp } from '../../context/AppContext'
import { useRealVehicles } from '../hooks/useRealVehicles'

const TYPE_META = {
  speeding: { Icon: Gauge, title: 'سرعة مرتفعة', variant: 'alert', label: 'تنبيه' },
  speed: { Icon: Gauge, title: 'سرعة مرتفعة', variant: 'alert', label: 'تنبيه' },
  geofence: { Icon: MapPin, title: 'منطقة جغرافية', variant: 'alert', label: 'تنبيه' },
  geofence_enter: { Icon: MapPin, title: 'دخول منطقة جغرافية', variant: 'online', label: 'معلومات' },
  geofence_exit: { Icon: MapPin, title: 'مغادرة منطقة جغرافية', variant: 'alert', label: 'تنبيه' },
  low_battery: { Icon: BatteryLow, title: 'بطارية منخفضة', variant: 'alert', label: 'تنبيه' },
  battery_alert: { Icon: BatteryLow, title: 'تنبيه البطارية', variant: 'alert', label: 'تنبيه' },
  power_cut: { Icon: Zap, title: 'انقطاع الطاقة', variant: 'danger', label: 'خطر' },
  power_disconnected: { Icon: Zap, title: 'انقطاع الطاقة', variant: 'danger', label: 'خطر' },
  power_restored: { Icon: Zap, title: 'عودة الطاقة', variant: 'online', label: 'معلومات' },
  engine_on: { Icon: Activity, title: 'تشغيل المحرك', variant: 'online', label: 'معلومات' },
  engine_off: { Icon: Activity, title: 'إيقاف المحرك', variant: 'alert', label: 'تنبيه' },
  signal_lost: { Icon: WifiOff, title: 'فقدان الإشارة', variant: 'danger', label: 'خطر' },
  signal_back: { Icon: WifiOff, title: 'عودة الإشارة', variant: 'online', label: 'معلومات' },
  intrusion: { Icon: ShieldAlert, title: 'محاولة دخول', variant: 'danger', label: 'خطر' },
  harsh_brake: { Icon: AlertTriangle, title: 'فرملة حادة', variant: 'alert', label: 'تنبيه' },
}

function alertType(alert) {
  return typeof alert?.type === 'string' && alert.type.trim() ? alert.type.trim() : null
}

function alertMeta(alert) {
  const type = alertType(alert)
  return TYPE_META[type] || {
    Icon: Bell,
    title: alert?.title || (type ? `تنبيه: ${type}` : 'تنبيه'),
    variant: 'default',
    label: 'معلومات',
  }
}

function alertTimestamp(alert) {
  const value = alert?.time ?? alert?.created_at ?? alert?.createdAt ?? alert?.eventTime ?? alert?.ts ?? alert?.timestamp
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function alertCoordinates(alert) {
  const data = alert?.data && typeof alert.data === 'object' ? alert.data : {}
  const position = alert?.position && typeof alert.position === 'object' ? alert.position : {}
  const nestedPosition = data.position && typeof data.position === 'object' ? data.position : {}
  const latitude = Number(alert?.latitude ?? alert?.lat ?? position.latitude ?? position.lat ?? data.latitude ?? data.lat ?? nestedPosition.latitude ?? nestedPosition.lat)
  const longitude = Number(alert?.longitude ?? alert?.lng ?? position.longitude ?? position.lng ?? data.longitude ?? data.lng ?? nestedPosition.longitude ?? nestedPosition.lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  if (Math.abs(latitude) < 0.01 && Math.abs(longitude) < 0.01) return null
  return { latitude, longitude }
}

function vehicleHasPosition(vehicle) {
  const latitude = Number(vehicle?.lat)
  const longitude = Number(vehicle?.lng)
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180
    && !(Math.abs(latitude) < 0.01 && Math.abs(longitude) < 0.01)
}

function alertDeviceId(alert) {
  return alert?.deviceId ?? alert?.vehicleId ?? alert?.device_id ?? alert?.device?.id ?? null
}

function AlertRow({ alert, vehicle, onOpen, onOpenVehicle, onOpenMap, onDelete }) {
  const { Icon, title, variant, label } = alertMeta(alert)
  const timestamp = alertTimestamp(alert)
  const message = alert?.message || alert?.description || null
  const vehicleName = vehicle?.name || alert?.vehicleName || alert?.deviceName || null
  const coordinates = alertCoordinates(alert)
  return (
    <Card padding="sm" className={`transition-shadow hover:shadow-md ${!alert.read ? 'border-s-2 border-s-accent bg-accent/[0.03]' : ''}`}>
      <div className="flex items-start gap-3" dir="rtl">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${variant === 'danger' ? 'bg-red-500/10 text-red-500' : variant === 'alert' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 text-right">
          <div className="flex items-start justify-between gap-2">
            <button type="button" onClick={onOpen} className="min-w-0 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <span className="block truncate text-sm font-semibold text-primary">{title}</span>
              {!alert.read && <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" />غير مقروء</span>}
            </button>
            <Badge variant={variant} size="sm">{label}</Badge>
          </div>
          {message && <p className="mt-2 text-xs leading-5 text-slate-600">{message}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span>{vehicleName || 'المركبة غير متاحة'}</span>
            {timestamp ? (
              <time dateTime={timestamp.toISOString()} title={timestamp.toLocaleString('ar-MA')}>
                {timestamp.toLocaleString('ar-MA', { dateStyle: 'medium', timeStyle: 'short' })}
              </time>
            ) : <span>الوقت غير متوفر</span>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {vehicle ? (
              <button type="button" onClick={onOpenVehicle} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                فتح المركبة
              </button>
            ) : <span className="text-[11px] text-slate-400">المركبة غير متاحة</span>}
            {coordinates ? (
              <button type="button" onClick={onOpenMap} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                عرض على الخريطة
              </button>
            ) : <span className="text-[11px] text-slate-400">الموقع غير متاح</span>}
            <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              حذف
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function AlertsScreen({ alerts: providedAlerts, vehicles: providedVehicles, onSelectVehicle, alertCount = 0, onMarkAllRead, onTabChange }) {
  const { alertsList, alertsLoading, alertsLoaded, alertsError, markAlertRead, markAllAlertsRead, unreadCount } = useApp()
  const { vehicles: realVehicles } = useRealVehicles()
  const navigate = useNavigate()
  const rawAlerts = providedAlerts ?? alertsList
  const [dismissed, setDismissed] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('athargps_dismissed_alerts') || '[]') } catch { return [] }
  })
  React.useEffect(() => {
    const handler = () => {
      try { setDismissed(JSON.parse(localStorage.getItem('athargps_dismissed_alerts') || '[]')) } catch {}
    }
    window.addEventListener('athar:alerts-changed', handler)
    return () => window.removeEventListener('athar:alerts-changed', handler)
  }, [])
  const alerts = rawAlerts.filter(a => !dismissed.includes(a.id))
  const vehicles = providedVehicles ?? realVehicles
  const [filter, setFilter] = useState('all')
  const [selectedVehicleId, setSelectedVehicleId] = useState(null)
  const selectedVehicle = useMemo(() => vehicles.find(vehicle => String(vehicle.id) === String(selectedVehicleId)), [selectedVehicleId, vehicles])
  const filterOptions = useMemo(() => {
    const types = [...new Set(alerts.map(alertType).filter(Boolean))]
    return [
      ['all', 'الكل'],
      ...(unreadCount > 0 ? [['unread', 'غير مقروء']] : []),
      ...types.map(type => [type, TYPE_META[type]?.title || type]),
    ]
  }, [alerts, unreadCount])
  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true
    if (filter === 'unread') return !alert.read
    return alertType(alert) === filter
  })
  const markAllRead = () => {
    void markAllAlertsRead()
    onMarkAllRead?.()
  }
  const readCount = alerts.filter(a => a.read).length
  const deleteAlert = (alertId) => {
    // حذف من localStorage كـ cache محلي
    try {
      const stored = JSON.parse(localStorage.getItem('athargps_dismissed_alerts') || '[]')
      if (!stored.includes(alertId)) stored.push(alertId)
      localStorage.setItem('athargps_dismissed_alerts', JSON.stringify(stored))
    } catch {}
    // إذا كان هناك API delete حقيقي، نستخدمه
    if (api && api.alerts && typeof api.alerts.delete === 'function') {
      api.alerts.delete(alertId).catch(() => {})
    }
    // إعادة تحميل التنبيهات
    window.dispatchEvent(new CustomEvent('athar:alerts-changed'))
  }
  const deleteRead = () => {
    alerts.filter(a => a.read).forEach(a => deleteAlert(a.id))
  }
  const selectAlert = alert => {
    if (!alert.read) void markAlertRead(alert.id)
    selectVehicle(alertDeviceId(alert))
  }
  const selectVehicle = vehicleId => {
    setSelectedVehicleId(vehicleId)
    onSelectVehicle?.(vehicleId)
  }
  const vehicleForAlert = alert => {
    const deviceId = alertDeviceId(alert)
    return deviceId == null ? null : vehicles.find(vehicle => String(vehicle.id) === String(deviceId))
  }

  return (
    <ClientLayout activeTab="alerts" onTabChange={onTabChange} alertCount={alertCount || unreadCount} showTopBar title="التنبيهات" sheet={selectedVehicle ? <VehicleBottomSheet vehicle={selectedVehicle} stage="peek" onClose={() => { setSelectedVehicleId(null); onSelectVehicle?.(null) }} /> : null}>
      <div className="h-full overflow-y-auto bg-slate-50" dir="rtl">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-white p-4">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5" role="tablist" aria-label="تصفية التنبيهات">
            {filterOptions.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${filter === id ? 'bg-accent text-white' : 'border border-border bg-slate-50 text-slate-500 hover:bg-border'}`}>{label}</button>
            ))}
          </div>
          {readCount > 0 && (
            <button type="button" onClick={deleteRead} aria-label="حذف المقروءة" className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">حذف المقروءة</span>
            </button>
          )}
          {unreadCount > 0 && (
            <button type="button" onClick={markAllRead} aria-label="تعليم الكل كمقروء" className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">تعليم الكل كمقروء</span>
            </button>
          )}
        </div>
        <div className="space-y-2 p-4">
          {filteredAlerts.map(alert => {
            const vehicle = vehicleForAlert(alert)
            const deviceId = alertDeviceId(alert)
            return (
              <AlertRow
                key={alert.id}
                alert={alert}
                vehicle={vehicle}
                onOpen={() => selectAlert(alert)}
                onDelete={() => deleteAlert(alert.id)}
                onOpenVehicle={() => {
                  if (!vehicle) return
                  if (!alert.read) void markAlertRead(alert.id)
                   navigate(`/client/vehicle/${vehicle.id}`)
                }}
                onOpenMap={() => {
                  const coordinates = alertCoordinates(alert)
                  if (!coordinates) return
                  if (!alert.read) void markAlertRead(alert.id)
                  const params = new URLSearchParams()
                  if (deviceId ?? vehicle?.id) params.set('device', String(deviceId ?? vehicle.id))
                  params.set('lat', String(coordinates.latitude))
                  params.set('lng', String(coordinates.longitude))
                  if (alert.id != null) params.set('alert', String(alert.id))
                  navigate(`/client/map?${params.toString()}`)
                }}
              />
            )
          })}
          {alertsLoading && !alertsLoaded && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500" role="status">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" aria-hidden="true" />
              جاري تحميل التنبيهات
            </div>
          )}
          {!alertsLoading && alertsError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center" role="alert">
              <p className="text-sm font-semibold text-red-700">تعذّر تحميل التنبيهات</p>
              <p className="mt-1 text-xs text-red-600">تحقق من الاتصال وحاول مرة أخرى.</p>
            </div>
          )}
          {!alertsLoading && !alertsError && filteredAlerts.length === 0 && (
            <div className="py-16 text-center text-sm text-slate-500" role="status">لا توجد تنبيهات في هذا التصنيف</div>
          )}
        </div>
      </div>
    </ClientLayout>
  )
}

export default AlertsScreen