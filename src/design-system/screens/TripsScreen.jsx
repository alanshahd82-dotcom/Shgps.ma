import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Clock, Gauge, Loader2, MapPin, Play, Route as RouteIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Select } from '../components/Select'
import { ClientLayout } from '../layout'
import { useRealVehicles } from '../hooks/useRealVehicles'

const TripReplay = lazy(() => import('../../components/TripReplay'))

const RANGES = [
  ['today', 'اليوم'],
  ['yesterday', 'الأمس'],
  ['week', 'آخر 7 أيام'],
]

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

function getTripStart(trip) {
  return trip?.startTime ?? trip?.start_time ?? trip?.start ?? null
}

function getTripEnd(trip) {
  return trip?.endTime ?? trip?.end_time ?? trip?.end ?? null
}

function validDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
  const date = validDate(value)
  return date
    ? date.toLocaleDateString('ar-MA', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'التاريخ غير متوفر'
}

function formatTime(value) {
  const date = validDate(value)
  return date ? date.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' }) : 'غير متوفر'
}

function formatNumber(value, suffix = '') {
  if (value === null || value === undefined || value === '') return 'غير متوفر'
  const number = Number(value)
  return Number.isFinite(number) ? `${number}${suffix}` : 'غير متوفر'
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined || minutes === '') return 'غير متوفر'
  const value = Number(minutes)
  if (!Number.isFinite(value)) return 'غير متوفر'
  const hours = Math.floor(value / 60)
  const rest = Math.round(value % 60)
  return hours > 0 ? `${hours} س ${rest} د` : `${rest} د`
}

function getPeriodBounds(range) {
  const now = new Date()
  const end = new Date(now)
  const start = new Date(now)
  if (range === 'today') {
    start.setHours(0, 0, 0, 0)
  } else if (range === 'yesterday') {
    end.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - 1)
    start.setHours(0, 0, 0, 0)
  } else {
    start.setDate(start.getDate() - 7)
  }
  return { from: start.toISOString(), to: end.toISOString() }
}

function Stat({ Icon, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
      <span className="text-xs text-slate-500">{label}</span>
      <strong className="ms-auto text-sm text-primary">{value}</strong>
    </div>
  )
}

function TripCard({ trip, vehicle, replaying, onPlay }) {
  const start = getTripStart(trip)
  const end = getTripEnd(trip)
  const tripId = trip?.index ?? start ?? 'unknown'
  return (
    <Card padding="md">
      <div dir="rtl">
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-primary">{vehicle?.name || 'المركبة غير متاحة'}</h3>
            <p className="mt-1 text-xs text-slate-500">{formatDate(start)}</p>
            <p className="mt-1 text-xs text-slate-500" dir="ltr">{formatTime(start)} — {formatTime(end)}</p>
          </div>
          {vehicle ? (
            <Link
              to={`/client/device/${vehicle.id}`}
              className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              فتح المركبة
            </Link>
          ) : <span className="shrink-0 text-[11px] text-slate-400">المركبة غير متاحة</span>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat Icon={RouteIcon} label="المسافة" value={formatNumber(trip?.distanceKm ?? trip?.distance_km ?? trip?.distance, ' كم')} />
          <Stat Icon={Clock} label="المدة" value={formatDuration(trip?.durationMin ?? trip?.duration_min ?? trip?.duration)} />
          <Stat Icon={Gauge} label="متوسط السرعة" value={formatNumber(trip?.avgSpeed ?? trip?.avg_speed, ' كم/س')} />
          <Stat Icon={Gauge} label="السرعة القصوى" value={formatNumber(trip?.maxSpeed ?? trip?.max_speed, ' كم/س')} />
          <Stat Icon={MapPin} label="التوقف" value={formatDuration(trip?.stopMin ?? trip?.stop_min)} />
          <Button
            variant="secondary"
            size="sm"
            icon={replaying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            onClick={() => onPlay(trip, tripId)}
            disabled={replaying}
            aria-label="عرض الرحلة على الخريطة"
          >
            {replaying ? 'جاري التحميل' : 'عرض الرحلة'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function EmptyTrips({ hasVehicle, hasReport }) {
  return (
    <div className="rounded-2xl border border-accent/15 bg-accent/[0.05] px-5 py-12 text-center" role="status">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <RouteIcon className="h-7 w-7" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm font-semibold text-primary">
        {hasVehicle && hasReport ? 'لا توجد بيانات رحلات متاحة حالياً' : 'لا توجد مركبات مرتبطة'}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500">
        {hasVehicle && hasReport
          ? 'ستظهر الرحلات هنا عندما تتوفر سجلات مواقع صالحة للمركبة المحددة.'
          : 'ستظهر الرحلات بعد ربط مركبة بحسابك.'}
      </p>
    </div>
  )
}

export function TripsScreen({ vehicles: providedVehicles, trips: providedTrips, onSelectTrip, alertCount = 0, onTabChange }) {
  const { vehicles: realVehicles, alertCount: realAlertCount } = useRealVehicles()
  const { lang } = useApp()
  const vehicles = providedVehicles ?? realVehicles
  const hasProvidedTrips = Array.isArray(providedTrips)
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [range, setRange] = useState('today')
  const [trips, setTrips] = useState(hasProvidedTrips ? providedTrips : [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [replay, setReplay] = useState(null)
  const [replayLoading, setReplayLoading] = useState('')
  const [replayError, setReplayError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!selectedVehicleId && vehicles[0]?.id != null) setSelectedVehicleId(String(vehicles[0].id))
    if (selectedVehicleId && !vehicles.some(vehicle => String(vehicle.id) === selectedVehicleId)) {
      setSelectedVehicleId(vehicles[0]?.id == null ? '' : String(vehicles[0].id))
    }
  }, [selectedVehicleId, vehicles])

  const selectedVehicle = useMemo(
    () => vehicles.find(vehicle => String(vehicle.id) === selectedVehicleId),
    [selectedVehicleId, vehicles],
  )

  useEffect(() => {
    if (hasProvidedTrips || !selectedVehicleId) return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    setReplayError('')
    const { from, to } = getPeriodBounds(range)
    api.reports.get(selectedVehicleId, from, to)
      .then(data => {
        if (!cancelled) setTrips(Array.isArray(data?.trips) ? data.trips : [])
      })
      .catch(nextError => {
        if (!cancelled) {
          setTrips([])
          setError(nextError?.message || 'تعذّر تحميل الرحلات')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [hasProvidedTrips, range, reloadKey, selectedVehicleId])

  async function openReplay(trip, tripKey) {
    const start = getTripStart(trip)
    const end = getTripEnd(trip)
    if (!selectedVehicleId || !validDate(start) || !validDate(end) || replayLoading) {
      setReplayError('المسار غير متوفر')
      return
    }
    setReplayLoading(String(tripKey))
    setReplayError('')
    try {
      const points = await api.stats.getPositions(selectedVehicleId, start, end, 900)
      if (!Array.isArray(points) || points.length < 2) {
        setReplayError('المسار غير متوفر')
      } else {
        setReplay({ startTime: start, endTime: end, positions: points })
        onSelectTrip?.(trip?.id ?? tripKey)
      }
    } catch (nextError) {
      setReplayError(nextError?.message || 'تعذّر تحميل مسار الرحلة')
    } finally {
      setReplayLoading('')
    }
  }

  return (
    <ClientLayout activeTab="trips" onTabChange={onTabChange} alertCount={alertCount || realAlertCount} showTopBar title="الرحلات">
      <div className="h-full overflow-y-auto bg-slate-50" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="sticky top-0 z-10 space-y-3 border-b border-border bg-white p-4">
          {vehicles.length > 0 && (
            <Select
              label="المركبة"
              options={vehicles.map(vehicle => ({ value: String(vehicle.id), label: vehicle.name || 'مركبة غير مسماة' }))}
              value={selectedVehicleId}
              onChange={setSelectedVehicleId}
            />
          )}
          <div className="flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="الفترة الزمنية">
            {RANGES.map(([id, label]) => (
              <Chip key={id} active={range === id} onClick={() => setRange(id)}>{label}</Chip>
            ))}
          </div>
        </div>
        <div className="space-y-3 p-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
              جاري تحميل الرحلات
            </div>
          )}
          {!loading && error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center" role="alert">
              <p className="text-sm font-semibold text-red-700">تعذّر تحميل الرحلات</p>
              <p className="mt-1 text-xs text-red-600">{error}</p>
              <button type="button" onClick={() => setReloadKey(current => current + 1)} className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
                إعادة المحاولة
              </button>
            </div>
          )}
          {!loading && !error && trips.length > 0 && trips.map((trip, index) => (
            <TripCard
              key={trip.id ?? `${getTripStart(trip) ?? 'trip'}-${index}`}
              trip={trip}
              vehicle={selectedVehicle}
              replaying={replayLoading === String(trip.index ?? trip.id ?? getTripStart(trip) ?? index)}
              onPlay={openReplay}
            />
          ))}
          {!loading && !error && trips.length === 0 && (
            <EmptyTrips hasVehicle={Boolean(selectedVehicle)} hasReport={!hasProvidedTrips || Array.isArray(providedTrips)} />
          )}
          {replayError && <p className="text-center text-xs text-amber-700" role="status">{replayError}</p>}
        </div>
      </div>
      {replay && (
        <Suspense fallback={<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>}>
          <TripReplay
            deviceId={selectedVehicleId}
            deviceName={selectedVehicle?.name}
            deviceType={selectedVehicle?.type}
            startTime={replay.startTime}
            endTime={replay.endTime}
            positions={replay.positions}
            allowSatellite={false}
            onClose={() => setReplay(null)}
          />
        </Suspense>
      )}
    </ClientLayout>
  )
}

export default TripsScreen