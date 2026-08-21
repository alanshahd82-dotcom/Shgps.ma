import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CarFront, ChevronDown, Gauge, Loader2, MapPin, Navigation, Play, Route, ShieldAlert, Square, X, Zap } from 'lucide-react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext'
import ClientHeader from '../../components/ClientHeader'
import ClientNav from '../../components/ClientNav'
import { StatusBadge, VehicleIcon, formatVoltage, getDeviceStatusKey, hasGpsPosition, timeAgo } from '../../components/ui'
import { useRealVehicles } from '../../design-system/hooks/useRealVehicles'
import { t } from '../../i18n/translations'
import { markerFor } from '../../utils/vehicleAssets'

const TripReplay = lazy(() => import('../../components/TripReplay'))

function numberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function vehiclePoint(vehicle) {
  const lat = numberOrNull(vehicle?.lat ?? vehicle?.latitude)
  const lng = numberOrNull(vehicle?.lng ?? vehicle?.longitude)
  return lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)
    ? [lat, lng]
    : null
}

function vehicleMarker(type) {
  const marker = markerFor(type)
  return L.divIcon({
    className: 'athar-vehicle-control-marker',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:#102945;border:2px solid #32c48d;box-shadow:0 8px 24px rgba(3,14,28,.35)"><img src="${marker.url}" alt="" style="width:34px;height:34px;object-fit:contain" /></span>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  })
}

function CenterMap({ point }) {
  const map = useMap()
  useEffect(() => {
    if (point) map.setView(point, 15, { animate: false })
  }, [map, point])
  return null
}

function readEngineCapability(vehicle) {
  const raw = vehicle?._raw || vehicle
  const value = raw?.engineControlStatus
    ?? raw?.engine_control_status
    ?? raw?.engineCommandStatus
    ?? raw?.engine_command_status
    ?? raw?.engineControl?.status
    ?? raw?.engine_control?.status
  if (typeof value !== 'string') return 'unknown'
  const normalized = value.trim().toLowerCase()
  if (['available', 'confirmed', 'supported'].includes(normalized)) return normalized === 'supported' ? 'available' : normalized
  if (['unsupported', 'unavailable', 'disabled', 'not_supported'].includes(normalized)) return 'unsupported'
  return 'unknown'
}

function directionUrl(type, point) {
  if (!point) return null
  const [lat, lng] = point
  return type === 'waze'
    ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

function displayTime(value, lang) {
  if (!value) return t(lang, 'dataUnavailable')
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? t(lang, 'dataUnavailable')
    : `${date.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

function tripStart(trip) {
  return trip?.startTime ?? trip?.start_time ?? trip?.start ?? null
}

function tripEnd(trip) {
  return trip?.endTime ?? trip?.end_time ?? trip?.end ?? null
}

function CapabilityMessage({ capability, lang }) {
  if (capability === 'available' || capability === 'confirmed') return null
  return <p className="mt-2 text-[10px] leading-4" style={{ color: 'var(--ath-mut)' }}>{t(lang, capability === 'unsupported' ? 'vehicleEngineUnsupported' : 'vehicleEngineUnknown')}</p>
}

function ControlDialog({ lang, turnOff, vehicleName, sending, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#020b16]/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#102945] p-5 text-right shadow-2xl" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-base font-extrabold">{t(lang, turnOff ? 'engineCutConfirmTitle' : 'engineStartConfirmTitle')}</h2><p className="mt-1 text-xs" style={{ color: 'var(--ath-mut)' }}>{vehicleName}</p></div>
          <button type="button" onClick={onCancel} className="rounded-xl p-2" aria-label={t(lang, 'close')}><X size={17} /></button>
        </div>
        <p className="mt-5 text-sm leading-6" style={{ color: 'var(--ath-mut)' }}>{t(lang, turnOff ? 'engineCutConfirmMsg' : 'engineStartConfirmMsg')}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-white/10 px-3 py-3 text-xs font-extrabold">{t(lang, 'cancel')}</button>
          <button type="button" onClick={onConfirm} disabled={sending} className="flex-1 rounded-xl bg-[#32c48d] px-3 py-3 text-xs font-extrabold text-[#061321] disabled:opacity-50">{sending ? <Loader2 className="mx-auto animate-spin" size={16} /> : t(lang, 'confirm')}</button>
        </div>
      </div>
    </div>
  )
}

export default function VehicleControl() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { lang, alertsList, refreshDevices } = useApp()
  const { vehicles, loading, error } = useRealVehicles()
  const [command, setCommand] = useState(null)
  const [sending, setSending] = useState(false)
  const [commandError, setCommandError] = useState('')
  const [replay, setReplay] = useState(null)
  const [tripLoading, setTripLoading] = useState(false)
  const [tripError, setTripError] = useState('')
  const [tripOptions, setTripOptions] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
  const vehicle = useMemo(() => vehicles.find(item => String(item.id) === String(id)), [id, vehicles])
  const point = vehiclePoint(vehicle)
  const status = getDeviceStatusKey(vehicle)
  const capability = readEngineCapability(vehicle)
  const lastUpdate = vehicle?.lastUpdate ?? vehicle?.fixTime
  const vehicleAlerts = useMemo(() => {
    if (!Array.isArray(alertsList) || !vehicle) return []
    return alertsList.filter(alert => String(alert.deviceId ?? alert.vehicleId ?? alert.device_id ?? '') === String(vehicle.id)).slice(0, 3)
  }, [alertsList, vehicle])

  async function confirmCommand() {
    if (!vehicle || (capability !== 'available' && capability !== 'confirmed') || sending || !command) return
    setSending(true)
    setCommandError('')
    try {
      await api.devices.sendCommand(vehicle.id, command.turnOff ? 'engineStop' : 'engineResume')
      setCommand(null)
      await refreshDevices?.()
    } catch {
      setCommandError(t(lang, 'vehicleCommandFailed'))
    } finally {
      setSending(false)
    }
  }

  async function openReplay() {
    if (!vehicle || tripLoading) return
    const end = new Date()
    const start = new Date(end)
    start.setHours(0, 0, 0, 0)
    setTripLoading(true)
    setTripError('')
    setTripOptions(null)
    try {
      const report = await api.reports.get(vehicle.id, start.toISOString(), end.toISOString())
      const trips = Array.isArray(report?.trips)
        ? report.trips.filter(item => tripStart(item) && tripEnd(item))
        : []
      if (!trips.length) {
        setTripError(t(lang, 'vehicleNoTripsToday'))
        return
      }
      setTripOptions(trips)
    } catch {
      setTripError(t(lang, 'vehicleReplayUnavailable'))
    } finally {
      setTripLoading(false)
    }
  }

  function startReplay(trip) {
    const startTime = tripStart(trip)
    const endTime = tripEnd(trip)
    if (startTime && endTime) setReplay({ startTime, endTime })
  }

  function openDirections(type) {
    const url = directionUrl(type, point)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (loading && !vehicle) {
    return <div className="client-app flex min-h-[100dvh] items-center justify-center" style={{ background: 'var(--ath-bg)' }}><div className="h-8 w-8 animate-pulse rounded-full border-2 border-[#32c48d]/30 border-t-[#32c48d]" /></div>
  }
  if (error && !vehicle) {
    return <div className="client-app flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--ath-bg)' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}><ShieldAlert size={28} className="text-[#d86f6f]" /><p className="mt-3 text-sm font-extrabold">{t(lang, 'vehicleLoadError')}</p><button type="button" onClick={() => navigate('/client/vehicles')} className="mt-4 rounded-xl bg-[#32c48d] px-5 py-3 text-xs font-extrabold text-[#061321]">{t(lang, 'back')}</button></div>
  }
  if (!vehicle) {
    return <div className="client-app flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--ath-bg)' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}><CarFront size={28} style={{ color: 'var(--ath-mut)' }} /><p className="mt-3 text-sm font-extrabold">{t(lang, 'vehicleUnavailable')}</p><button type="button" onClick={() => navigate('/client/vehicles')} className="mt-4 rounded-xl bg-[#32c48d] px-5 py-3 text-xs font-extrabold text-[#061321]">{t(lang, 'back')}</button></div>
  }

  return (
    <div className="client-app min-h-[100dvh] overflow-y-auto pb-28" style={{ background: 'var(--ath-bg)' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <ClientHeader />
      <main className="mx-auto max-w-xl px-4 pb-8 pt-3">
        <div className="mb-4 flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.04]" aria-label={t(lang, 'back')}>{lang === 'ar' ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}</button>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-bold" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'vehicleControl')}</p><h1 className="truncate text-xl font-black">{vehicle.name}</h1></div>
          <StatusBadge status={status} lang={lang} />
        </div>

        <section className="ath-card mb-3" style={{ background: 'linear-gradient(145deg, #102945, #0c1e34)' }}>
          <div className="flex items-center gap-3">
            <VehicleIcon type={vehicle.type} iconSize={27} className="h-16 w-16 rounded-2xl" />
            <div className="min-w-0 flex-1"><h2 className="truncate text-base font-extrabold">{vehicle.name}</h2><p className="mt-1 text-xs font-semibold" style={{ color: 'var(--ath-mut)' }}>{vehicle.plate || t(lang, 'plateUnavailable')}</p><p className="mt-2 text-[10px]" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'lastUpdate')}: {lastUpdate ? timeAgo(lastUpdate, lang) : t(lang, 'dataUnavailable')}</p></div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/[.05] p-2.5 text-center"><Gauge size={15} className="mx-auto text-[#32c48d]" /><strong className="mt-1 block text-xs">{vehicle.speed == null ? t(lang, 'dataUnavailable') : `${Math.round(Number(vehicle.speed))} ${t(lang, 'kmh')}`}</strong><span className="mt-1 block text-[9px]" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'speed')}</span></div>
            <div className="rounded-xl bg-white/[.05] p-2.5 text-center"><Zap size={15} className="mx-auto text-[#d7a458]" /><strong className="mt-1 block text-xs">{formatVoltage(vehicle.voltage, lang, lastUpdate, vehicle.powerDisconnected)}</strong><span className="mt-1 block text-[9px]" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'battery')}</span></div>
            <div className="rounded-xl bg-white/[.05] p-2.5 text-center"><MapPin size={15} className="mx-auto text-[#8cb4d8]" /><strong className="mt-1 block text-xs">{point ? t(lang, 'available') : t(lang, 'dataUnavailable')}</strong><span className="mt-1 block text-[9px]" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'location')}</span></div>
          </div>
        </section>

        <section className="mb-3 overflow-hidden rounded-3xl border border-white/10 bg-[#0d2138]">
          {point ? <div className="h-[230px]"><MapContainer center={point} zoom={15} zoomControl={false} className="h-full w-full"><TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" /><CenterMap point={point} /><Marker position={point} icon={vehicleMarker(vehicle.type)} /></MapContainer></div> : <div className="flex h-[180px] flex-col items-center justify-center px-5 text-center"><MapPin size={25} style={{ color: 'var(--ath-mut)' }} /><p className="mt-2 text-xs font-bold">{t(lang, 'locationUnavailable')}</p><p className="mt-1 text-[10px]" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'locationUnavailableBody')}</p></div>}
          <div className="grid grid-cols-2 gap-2 p-3"><button type="button" disabled={!point} onClick={() => openDirections('google')} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-[11px] font-extrabold disabled:cursor-not-allowed disabled:opacity-35"><Navigation size={15} />{t(lang, 'googleDirections')}</button><button type="button" disabled={!point} onClick={() => openDirections('waze')} className="flex items-center justify-center gap-2 rounded-xl bg-[#32c48d] px-3 py-3 text-[11px] font-extrabold text-[#061321] disabled:cursor-not-allowed disabled:opacity-35"><MapPin size={15} />{t(lang, 'wazeDirections')}</button></div>
        </section>

        <section className="ath-card mb-3">
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Zap size={17} className="text-[#d7a458]" /><h2 className="text-sm font-extrabold">{t(lang, 'engineControl')}</h2></div><span className="text-[10px] font-bold" style={{ color: 'var(--ath-mut)' }}>{vehicle.ignition == null ? t(lang, 'dataUnavailable') : vehicle.ignition ? t(lang, 'engineOn') : t(lang, 'engineOff')}</span></div>
          <CapabilityMessage capability={capability} lang={lang} />
          {(capability === 'available' || capability === 'confirmed') && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setCommand({ turnOff: false })} className="flex items-center justify-center gap-2 rounded-xl border border-[#32c48d]/35 px-3 py-3 text-[11px] font-extrabold text-[#8ceac5]"><Play size={14} />{t(lang, 'startEngine')}</button><button type="button" onClick={() => setCommand({ turnOff: true })} className="flex items-center justify-center gap-2 rounded-xl border border-[#d86f6f]/35 px-3 py-3 text-[11px] font-extrabold text-[#f0a09c]"><Square size={14} />{t(lang, 'cutEngine')}</button></div>}
          {commandError && <p className="mt-3 text-xs text-[#f0a09c]" role="alert">{commandError}</p>}
        </section>

        <section className="ath-card mb-3">
          <button type="button" onClick={() => setShowInfo(value => !value)} className="flex w-full items-center justify-between text-start"><span className="flex items-center gap-2"><Route size={17} className="text-[#8cb4d8]" /><span className="text-sm font-extrabold">{t(lang, 'vehicleTrips')}</span></span><ChevronDown size={17} className={`transition-transform ${showInfo ? 'rotate-180' : ''}`} /></button>
           {showInfo && <div className="mt-3 border-t border-white/10 pt-3">
             <p className="text-[11px]" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'vehicleTripsBody')}</p>
             <button type="button" disabled={tripLoading} onClick={openReplay} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#32c48d] px-3 py-3 text-xs font-extrabold text-[#061321] disabled:opacity-50">{tripLoading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}{t(lang, 'vehicleReplayToday')}</button>
             {tripOptions && <div className="mt-3 space-y-2">
               <p className="text-[10px] font-bold" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'vehicleChooseTrip')}</p>
               {tripOptions.map((trip, index) => (
                 <button key={`${tripStart(trip)}-${index}`} type="button" onClick={() => startReplay(trip)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.04] px-3 py-3 text-start text-xs font-bold">
                   <span>{displayTime(tripStart(trip), lang)}</span>
                   <span style={{ color: 'var(--ath-mut)' }}>{displayTime(tripEnd(trip), lang)}</span>
                 </button>
               ))}
             </div>}
             {tripError && <p className="mt-2 text-center text-[11px] text-[#d7a458]">{tripError}</p>}
           </div>}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between px-1"><h2 className="text-sm font-extrabold">{t(lang, 'vehicleAlerts')}</h2><button type="button" onClick={() => navigate('/client/alerts')} className="text-[11px] font-extrabold text-[#32c48d]">{t(lang, 'viewAll')}</button></div>
          {vehicleAlerts.length ? <div className="space-y-2">{vehicleAlerts.map(alert => <button type="button" key={alert.id} onClick={() => navigate('/client/alerts')} className="ath-card flex w-full items-center gap-3 text-start"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d7a458]/10 text-[#d7a458]"><ShieldAlert size={16} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{alert.title || t(lang, 'alert')}</span><span className="mt-1 block text-[10px]" style={{ color: 'var(--ath-mut)' }}>{displayTime(alert.time ?? alert.created_at ?? alert.createdAt, lang)}</span></span></button>)}</div> : <div className="ath-card text-center text-xs" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'vehicleNoAlerts')}</div>}
        </section>
      </main>
      <ClientNav />
      {command && <ControlDialog lang={lang} vehicleName={vehicle.name} turnOff={command.turnOff} sending={sending} onCancel={() => setCommand(null)} onConfirm={confirmCommand} />}
      {replay && <Suspense fallback={<div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#061321]"><Loader2 className="animate-spin text-[#32c48d]" /></div>}><TripReplay deviceId={vehicle.id} deviceName={vehicle.name} deviceType={vehicle.type} startTime={replay.startTime} endTime={replay.endTime} onClose={() => setReplay(null)} allowSatellite={false} /></Suspense>}
    </div>
  )
}