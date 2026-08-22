import React, { useMemo, useState } from 'react'
import { AlertCircle, CarFront, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { StatusBadge, VehicleIcon, getDeviceStatusKey, timeAgo } from '../../components/ui'
import { t } from '../../i18n/translations'
import { ClientLayout } from '../layout'
import { useRealVehicles } from '../hooks/useRealVehicles'

const FILTERS = ['all', 'moving', 'stopped', 'offline']

function SkeletonCard() {
  return <div className="ath-card h-[92px] animate-pulse"><div className="flex items-center gap-3"><span className="h-14 w-14 rounded-2xl bg-slate-100" /><span className="flex-1"><span className="block h-3 w-1/2 rounded bg-slate-100" /><span className="mt-3 block h-2 w-2/3 rounded bg-slate-100" /><span className="mt-3 block h-2 w-1/3 rounded bg-slate-100" /></span></div></div>
}

function VehicleCard({ vehicle, lang, onOpen }) {
  const status = getDeviceStatusKey(vehicle)
  const hasSpeed = vehicle.speed != null && Number.isFinite(Number(vehicle.speed))
  return (
    <button type="button" onClick={onOpen} className="ath-card flex w-full items-center gap-3 text-start transition-transform active:scale-[.99]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <VehicleIcon type={vehicle.type} iconSize={25} className="h-14 w-14 rounded-2xl" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2"><span className="truncate text-sm font-extrabold">{vehicle.name}</span><StatusBadge status={status} lang={lang} /></span>
        <span className="mt-1 block truncate text-[10px] font-semibold" style={{ color: 'var(--ath-mut)' }}>{vehicle.plate || t(lang, 'plateUnavailable')}</span>
        <span className="mt-1 block truncate text-[10px]" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'lastUpdate')}: {vehicle.lastUpdate ? timeAgo(vehicle.lastUpdate, lang) : t(lang, 'dataUnavailable')}</span>
      </span>
      <span className="shrink-0 text-end">{hasSpeed ? <><strong className="block text-sm font-black">{Math.round(Number(vehicle.speed))}</strong><span className="text-[9px]" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'kmh')}</span></> : <span className="text-[10px]" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'dataUnavailable')}</span>}</span>
      <span style={{ color: 'var(--ath-mut)' }}>{lang === 'ar' ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}</span>
    </button>
  )
}

export function VehiclesScreen({ vehicles: providedVehicles, alertCount = 0, onTabChange }) {
  const navigate = useNavigate()
  const { lang } = useApp()
  const { vehicles: realVehicles, alertCount: realAlertCount, loading, error } = useRealVehicles()
  const vehicles = providedVehicles ?? realVehicles
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return vehicles.filter(vehicle => {
      const status = getDeviceStatusKey(vehicle)
      const matchesQuery = !normalized || [vehicle.name, vehicle.plate].filter(Boolean).some(value => String(value).toLowerCase().includes(normalized))
      const matchesFilter = filter === 'all' || (filter === 'moving' && status === 'moving') || (filter === 'stopped' && status === 'stopped') || (filter === 'offline' && ['offline', 'awaiting_gps'].includes(status))
      return matchesQuery && matchesFilter
    })
  }, [filter, query, vehicles])
  const count = status => vehicles.filter(vehicle => getDeviceStatusKey(vehicle) === status).length

  return (
    <ClientLayout activeTab="vehicles" onTabChange={onTabChange} alertCount={alertCount || realAlertCount} showTopBar title={t(lang, 'vehicles')}>
      <div className="h-full overflow-y-auto" style={{ background: 'var(--ath-bg)' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
         <div className="sticky top-0 z-10 border-b border-slate-200 p-4" style={{ background: 'var(--ath-bg)' }}>
           <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"><Search size={16} style={{ color: 'var(--ath-mut)' }} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t(lang, 'vehicleSearchPlaceholder')} className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400" /></div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
             {FILTERS.map(item => <button key={item} type="button" onClick={() => setFilter(item)} aria-pressed={filter === item} className="shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-extrabold transition-colors" style={filter === item ? { color: '#ffffff', background: '#4f46e5', borderColor: '#4f46e5' } : { color: 'var(--ath-mut)', background: '#ffffff', borderColor: 'var(--ath-line)' }}>{t(lang, `vehicleFilter_${item}`)}{item === 'all' ? ` ${vehicles.length}` : ` ${item === 'moving' ? count('moving') : item === 'stopped' ? count('stopped') : count('offline') + count('awaiting_gps')}`}</button>)}
          </div>
        </div>
        <div className="space-y-2 p-4">
          {loading && !vehicles.length && [1, 2, 3].map(item => <SkeletonCard key={item} />)}
          {!loading && error && <div className="ath-card flex flex-col items-center justify-center py-12 text-center"><AlertCircle size={25} className="text-[#d86f6f]" /><p className="mt-3 text-sm font-extrabold">{t(lang, 'vehicleLoadError')}</p><p className="mt-1 text-[11px]" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'homeDataUnavailable')}</p></div>}
          {!loading && !error && filtered.map(vehicle => <VehicleCard key={vehicle.id} vehicle={vehicle} lang={lang} onOpen={() => navigate(`/client/device/${vehicle.id}`)} />)}
          {!loading && !error && !filtered.length && <div className="ath-card flex flex-col items-center justify-center py-14 text-center"><CarFront size={28} style={{ color: 'var(--ath-mut)' }} /><p className="mt-3 text-sm font-extrabold">{vehicles.length ? t(lang, 'vehicleNoResults') : t(lang, 'homeEmptyFleet')}</p><p className="mt-1 text-[11px]" style={{ color: 'var(--ath-mut)' }}>{vehicles.length ? t(lang, 'vehicleNoResultsBody') : t(lang, 'homeEmptyFleetBody')}</p></div>}
        </div>
      </div>
    </ClientLayout>
  )
}

export default VehiclesScreen