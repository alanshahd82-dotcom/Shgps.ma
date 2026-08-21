import React, { useMemo, useState } from 'react'
import { Car, ChevronLeft, Gauge, Search } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { ClientLayout } from '../layout'
import VehicleBottomSheet from './VehicleBottomSheet'
import { useRealVehicles } from '../hooks/useRealVehicles'

function getVehicleState(vehicle) {
  if (vehicle.charge === false && vehicle.status === 'offline') return { color: 'danger', badge: 'danger', label: 'بطارية مفصولة' }
  if (vehicle.status === 'online' && Number.isFinite(vehicle.speed) && vehicle.speed > 5) return { color: 'online', badge: 'online', label: 'متحرك' }
  if (vehicle.status === 'online') return { color: 'idle', badge: 'idle', label: 'متصل' }
  if (vehicle.status === 'offline') return { color: 'offline', badge: 'offline', label: 'غير متصل' }
  return { color: 'offline', badge: 'offline', label: 'غير معروف' }
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active ? 'bg-accent text-white' : 'border border-border bg-slate-50 text-slate-500 hover:bg-border'}`}
    >
      {children}
    </button>
  )
}

function EmptyState({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center" role="status" dir="rtl">
      <span className="text-slate-400">{icon}</span>
      <h2 className="mt-4 text-base font-semibold text-primary">{title}</h2>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  )
}

function VehicleCard({ vehicle, onClick, selected }) {
  const state = getVehicleState(vehicle)
  return (
    <Card
      padding="md"
      onClick={onClick}
      className={`transition-shadow ${selected ? 'border-2 border-accent p-[15px]' : 'hover:shadow-md'}`}
      role="button"
      tabIndex={0}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick?.()
        }
      }}
      aria-label={`عرض تفاصيل ${vehicle.name}`}
    >
      <div className="flex items-center gap-3" dir="rtl">
        <Avatar name={vehicle.name} size="lg" status={state.color} />
        <div className="min-w-0 flex-1 text-right">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-primary">{vehicle.name}</h3>
            <Badge variant={state.badge} size="sm">{state.label}</Badge>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">آخر تحديث: {vehicle.lastUpdate || 'غير متوفر'}</p>
        </div>
        {vehicle.status === 'online' && Number.isFinite(vehicle.speed) && (
          <div className="shrink-0 text-left text-accent" dir="ltr">
            <div className="flex items-center gap-1">
              <Gauge className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-semibold">{vehicle.speed}</span>
            </div>
            <span className="text-[10px] text-slate-500">كم/س</span>
          </div>
        )}
        <ChevronLeft className="h-5 w-5 shrink-0 text-slate-400 rtl:rotate-180" aria-hidden="true" />
      </div>
    </Card>
  )
}

export function VehiclesScreen({
  vehicles: providedVehicles,
  onSelectVehicle,
  selectedVehicleId,
  alertCount = 0,
  onTabChange,
}) {
  const { vehicles: realVehicles, alertCount: realAlertCount, loading, error } = useRealVehicles()
  const vehicles = providedVehicles ?? realVehicles
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [internalSelectedId, setInternalSelectedId] = useState(null)
  const selectedId = selectedVehicleId ?? internalSelectedId
  const selectedVehicle = useMemo(() => vehicles.find(vehicle => String(vehicle.id) === String(selectedId)), [selectedId, vehicles])

  const counts = useMemo(() => ({
    online: vehicles.filter(vehicle => vehicle.status === 'online').length,
    offline: vehicles.filter(vehicle => vehicle.status !== 'online').length,
    alert: vehicles.filter(vehicle => vehicle.alerts?.length > 0 || getVehicleState(vehicle).badge === 'danger').length,
  }), [vehicles])

  const filteredVehicles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return vehicles.filter(vehicle => {
      const matchesQuery = !query || vehicle.name.toLowerCase().includes(query)
      const matchesFilter = filter === 'all'
        || (filter === 'online' && vehicle.status === 'online')
        || (filter === 'offline' && vehicle.status !== 'online')
        || (filter === 'alert' && (vehicle.alerts?.length > 0 || getVehicleState(vehicle).badge === 'danger'))
      return matchesQuery && matchesFilter
    })
  }, [filter, searchQuery, vehicles])

  const selectVehicle = id => {
    setInternalSelectedId(id)
    onSelectVehicle?.(id)
  }
  const closeSheet = () => {
    setInternalSelectedId(null)
    onSelectVehicle?.(null)
  }

  return (
    <ClientLayout
      activeTab="vehicles"
      onTabChange={onTabChange}
      alertCount={alertCount || realAlertCount}
      showTopBar
      title="المركبات"
      sheet={selectedVehicle ? <VehicleBottomSheet vehicle={selectedVehicle} stage="peek" onClose={closeSheet} /> : null}
    >
      <div className="h-full overflow-y-auto bg-slate-50" dir="rtl">
        <div className="sticky top-0 z-10 space-y-3 border-b border-border bg-white p-4">
          <Input icon={<Search className="h-4 w-4" />} placeholder="ابحث عن مركبة..." value={searchQuery} onChange={setSearchQuery} />
          <div className="flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="تصفية المركبات">
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>الكل ({vehicles.length})</Chip>
            <Chip active={filter === 'online'} onClick={() => setFilter('online')}>متصل ({counts.online})</Chip>
            <Chip active={filter === 'offline'} onClick={() => setFilter('offline')}>غير متصل ({counts.offline})</Chip>
            <Chip active={filter === 'alert'} onClick={() => setFilter('alert')}>تنبيه ({counts.alert})</Chip>
          </div>
        </div>
        <div className="space-y-3 p-4">
           {loading && (
             <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500" role="status">
               <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" aria-hidden="true" />
               جاري تحميل المركبات
             </div>
           )}
           {!loading && error && <EmptyState icon={<Car className="h-12 w-12" aria-hidden="true" />} title="تعذّر تحميل المركبات" description="تحقق من الاتصال وحاول مرة أخرى." />}
           {!loading && !error && filteredVehicles.map(vehicle => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} selected={String(vehicle.id) === String(selectedId)} onClick={() => selectVehicle(vehicle.id)} />
          ))}
           {!loading && !error && filteredVehicles.length === 0 && (
            <EmptyState icon={<Car className="h-12 w-12" aria-hidden="true" />} title={vehicles.length ? 'لا توجد نتائج' : 'لا توجد مركبات مرتبطة'} description={vehicles.length ? 'لم يتم العثور على مركبات تطابق البحث' : 'ستظهر المركبات هنا بعد ربط أجهزة التتبع بحسابك'} />
          )}
        </div>
      </div>
    </ClientLayout>
  )
}

export default VehiclesScreen