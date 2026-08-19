import React, { useState } from 'react'
import { Clock, Gauge, MapPin, Play, Route } from 'lucide-react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Select } from '../components/Select'
import { ClientLayout } from '../layout'

const defaultVehicles = [{ id: 16, name: 'DACIA' }, { id: 14, name: 'bekane' }, { id: 37, name: 'Othmane' }]
const defaultTrips = [
  { id: 1, date: '19 أغسطس 2026', startTime: '10:23', endTime: '11:45', distance: '45.2 كم', duration: '1س 22د', maxSpeed: 95, stops: 3 },
  { id: 2, date: '18 أغسطس 2026', startTime: '08:15', endTime: '09:30', distance: '28.7 كم', duration: '1س 15د', maxSpeed: 82, stops: 2 },
]

export function Chip({ active, onClick, children }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active ? 'bg-accent text-white' : 'border border-border bg-slate-50 text-slate-500 hover:bg-border'}`}>{children}</button>
}

function Stat({ Icon, label, value }) {
  return <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-accent" aria-hidden="true" /><span className="text-xs text-slate-500">{label}</span><strong className="ms-auto text-sm text-primary">{value}</strong></div>
}

function TripCard({ trip, onPlay }) {
  return (
    <Card padding="md">
      <div dir="rtl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div><h3 className="text-sm font-semibold text-primary">{trip.date}</h3><p className="mt-1 text-xs text-slate-500" dir="ltr">{trip.startTime} — {trip.endTime}</p></div>
          <Button variant="secondary" size="sm" icon={<Play className="h-3.5 w-3.5" />} onClick={onPlay}>تشغيل الرحلة</Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat Icon={Route} label="المسافة" value={trip.distance} />
          <Stat Icon={Clock} label="المدة" value={trip.duration} />
          <Stat Icon={Gauge} label="السرعة القصوى" value={`${trip.maxSpeed} كم/س`} />
          <Stat Icon={MapPin} label="التوقفات" value={trip.stops} />
        </div>
      </div>
    </Card>
  )
}

export function TripsScreen({ vehicles = defaultVehicles, trips = defaultTrips, onSelectTrip, alertCount = 0, onTabChange }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState(String(vehicles[0]?.id || ''))
  const [dateRange, setDateRange] = useState('today')
  const ranges = [['today', 'اليوم'], ['yesterday', 'الأمس'], ['week', 'آخر 7 أيام'], ['custom', 'مخصص']]
  return (
    <ClientLayout activeTab="trips" onTabChange={onTabChange} alertCount={alertCount} showTopBar title="الرحلات">
      <div className="h-full overflow-y-auto bg-slate-50" dir="rtl">
        <div className="sticky top-0 z-10 space-y-3 border-b border-border bg-white p-4">
          <Select label="المركبة" options={vehicles.map(vehicle => ({ value: String(vehicle.id), label: vehicle.name }))} value={selectedVehicleId} onChange={setSelectedVehicleId} />
          <div className="flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="الفترة الزمنية">
            {ranges.map(([id, label]) => <Chip key={id} active={dateRange === id} onClick={() => setDateRange(id)}>{label}</Chip>)}
          </div>
        </div>
        <div className="space-y-3 p-4">
          {trips.map(trip => <TripCard key={trip.id} trip={trip} onPlay={() => onSelectTrip?.(trip.id)} />)}
          {trips.length === 0 && <div className="py-16 text-center text-sm text-slate-500" role="status">لا توجد رحلات في هذه الفترة</div>}
        </div>
      </div>
    </ClientLayout>
  )
}

export default TripsScreen