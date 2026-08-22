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

const TYPE_COPY = {
  speeding: { ar: 'سرعة مرتفعة', fr: 'Vitesse élevée' },
  speed: { ar: 'سرعة مرتفعة', fr: 'Vitesse élevée' },
  geofence: { ar: 'منطقة جغرافية', fr: 'Zone géographique' },
  geofence_enter: { ar: 'دخول منطقة جغرافية', fr: 'Entrée dans une zone géographique' },
  geofence_exit: { ar: 'مغادرة منطقة جغرافية', fr: 'Sortie d’une zone géographique' },
  low_battery: { ar: 'بطارية منخفضة', fr: 'Batterie faible' },
  battery_alert: { ar: 'تنبيه البطارية', fr: 'Alerte de batterie' },
  power_cut: { ar: 'انقطاع الطاقة', fr: 'Coupure d’alimentation' },
  power_disconnected: { ar: 'انقطاع الطاقة', fr: 'Alimentation déconnectée' },
  power_restored: { ar: 'عودة الطاقة', fr: 'Alimentation rétablie' },
  engine_on: { ar: 'تشغيل المحرك', fr: 'Moteur démarré' },
  engine_off: { ar: 'إيقاف المحرك', fr: 'Moteur arrêté' },
  signal_lost: { ar: 'فقدان الإشارة', fr: 'Signal perdu' },
  signal_back: { ar: 'عودة الإشارة', fr: 'Signal rétabli' },
  intrusion: { ar: 'محاولة دخول', fr: 'Tentative d’intrusion' },
  harsh_brake: { ar: 'فرملة حادة', fr: 'Freinage brusque' },
}

const ALERT_LABELS = {
  ar: { alert: 'تنبيه', info: 'معلومات', danger: 'خطر', unread: 'غير مقروء', delete: 'حذف', vehicleUnavailable: 'المركبة غير متاحة', openVehicle: 'فتح المركبة', viewMap: 'عرض على الخريطة', locationUnavailable: 'الموقع غير متاح', all: 'الكل', deleteRead: 'حذف المقروءة', markAllRead: 'تعليم الكل كمقروء', title: 'التنبيهات', filter: 'تصفية التنبيهات', loading: 'جاري تحميل التنبيهات', loadError: 'تعذّر تحميل التنبيهات', connectionError: 'تحقق من الاتصال وحاول مرة أخرى.', empty: 'لا توجد تنبيهات في هذا التصنيف', fallback: 'تنبيه', timeUnavailable: 'الوقت غير متوفر' },
  fr: { alert: 'Alerte', info: 'Information', danger: 'Danger', unread: 'Non lue', delete: 'Supprimer', vehicleUnavailable: 'Véhicule indisponible', openVehicle: 'Ouvrir le véhicule', viewMap: 'Voir sur la carte', locationUnavailable: 'Position indisponible', all: 'Toutes', deleteRead: 'Supprimer les lues', markAllRead: 'Tout marquer comme lu', title: 'Alertes', filter: 'Filtrer les alertes', loading: 'Chargement des alertes', loadError: 'Impossible de charger les alertes', connectionError: 'Vérifiez la connexion et réessayez.', empty: 'Aucune alerte dans cette catégorie', fallback: 'Alerte', timeUnavailable: 'Heure indisponible' },
}

function alertType(alert) {
  return typeof alert?.type === 'string' && alert.type.trim() ? alert.type.trim() : null
}

function alertMeta(alert, lang, L) {
  const type = alertType(alert)
  const meta = TYPE_META[type]
  if (meta) {
    return {
      ...meta,
      title: TYPE_COPY[type]?.[lang] || meta.title,
      label: meta.variant === 'danger' ? L.danger : meta.variant === 'online' ? L.info : L.alert,
    }
  }
  return {
    Icon: Bell,
    title: alert?.title || (type ? `${L.fallback}: ${type}` : L.fallback),
    variant: 'default',
    label: L.info,
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

function AlertRow({ alert, vehicle, onOpen, onOpenVehicle, onOpenMap, onDelete, lang, L }) {
  const { Icon, title, variant, label } = alertMeta(alert, lang, L)
  const timestamp = alertTimestamp(alert)
  const message = alert?.message || alert?.description || null
  const vehicleName = vehicle?.name || alert?.vehicleName || alert?.deviceName || null
  const coordinates = alertCoordinates(alert)
  return (
    <Card padding="sm" className={`transition-shadow hover:shadow-md ${!alert.read ? 'border-s-2 border-s-accent bg-accent/[0.03]' : ''}`}>
      <div className="flex items-start gap-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${variant === 'danger' ? 'bg-red-500/10 text-red-500' : variant === 'alert' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 text-right">
          <div className="flex items-start justify-between gap-2">
            <button type="button" onClick={onOpen} className="min-w-0 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <span className="block truncate text-sm font-semibold text-primary">{title}</span>
              {!alert.read && <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{L.unread}</span>}
            </button>
            <Badge variant={variant} size="sm">{label}</Badge>
          </div>
          {message && <p className="mt-2 text-xs leading-5 text-slate-600">{message}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span>{vehicleName || L.vehicleUnavailable}</span>
            {timestamp ? (
              <time dateTime={timestamp.toISOString()} title={timestamp.toLocaleString(lang === 'fr' ? 'fr-FR' : 'ar-MA')}>
                {timestamp.toLocaleString(lang === 'fr' ? 'fr-FR' : 'ar-MA', { dateStyle: 'medium', timeStyle: 'short' })}
              </time>
            ) : <span>{L.timeUnavailable}</span>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {vehicle ? (
              <button type="button" onClick={onOpenVehicle} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                {L.openVehicle}
              </button>
            ) : <span className="text-[11px] text-slate-400">{L.vehicleUnavailable}</span>}
            {coordinates ? (
              <button type="button" onClick={onOpenMap} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {L.viewMap}
              </button>
            ) : <span className="text-[11px] text-slate-400">{L.locationUnavailable}</span>}
            <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {L.delete}
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function AlertsScreen({ alerts: providedAlerts, vehicles: providedVehicles, onSelectVehicle, alertCount = 0, onMarkAllRead, onTabChange }) {
  const { alertsList, alertsLoading, alertsLoaded, alertsError, markAlertRead, markAllAlertsRead, unreadCount } = useApp()
  const { lang } = useApp()
  const L = ALERT_LABELS[lang === 'fr' ? 'fr' : 'ar']
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
      ['all', L.all],
      ...(unreadCount > 0 ? [['unread', L.unread]] : []),
      ...types.map(type => [type, TYPE_COPY[type]?.[lang] || type]),
    ]
  }, [alerts, unreadCount, lang, L])
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
    <ClientLayout activeTab="alerts" onTabChange={onTabChange} alertCount={alertCount || unreadCount} showTopBar title={L.title} sheet={selectedVehicle ? <VehicleBottomSheet vehicle={selectedVehicle} stage="peek" onClose={() => { setSelectedVehicleId(null); onSelectVehicle?.(null) }} /> : null}>
      <div className="h-full overflow-y-auto bg-slate-50" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-white p-4">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5" role="tablist" aria-label={L.filter}>
            {filterOptions.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${filter === id ? 'bg-accent text-white' : 'border border-border bg-slate-50 text-slate-500 hover:bg-border'}`}>{label}</button>
            ))}
          </div>
          {readCount > 0 && (
            <button type="button" onClick={deleteRead} aria-label={L.deleteRead} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{L.deleteRead}</span>
            </button>
          )}
          {unreadCount > 0 && (
            <button type="button" onClick={markAllRead} aria-label={L.markAllRead} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{L.markAllRead}</span>
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
                lang={lang}
                L={L}
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
              {L.loading}
            </div>
          )}
          {!alertsLoading && alertsError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center" role="alert">
              <p className="text-sm font-semibold text-red-700">{L.loadError}</p>
              <p className="mt-1 text-xs text-red-600">{L.connectionError}</p>
            </div>
          )}
          {!alertsLoading && !alertsError && filteredAlerts.length === 0 && (
            <div className="py-16 text-center text-sm text-slate-500" role="status">{L.empty}</div>
          )}
        </div>
      </div>
    </ClientLayout>
  )
}

export default AlertsScreen