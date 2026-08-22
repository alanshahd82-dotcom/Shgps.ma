import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ArrowLeft, ArrowRight, Car, Loader2, Maximize2, Minimize2, Pencil, Phone, Play, Route, Save, Square, X } from 'lucide-react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext'
import { useRealVehicles } from '../../design-system/hooks/useRealVehicles'
import { t } from '../../i18n/translations'
import { markerFor } from '../../utils/vehicleAssets'

const TripReplay = lazy(() => import('../../components/TripReplay'))
const META_KEY = id => 'athargps_vehicle_meta_' + id

function numOrNull(v) { const n = Number(v); return Number.isFinite(n) ? n : null }
function pt(v) {
  const la = numOrNull(v?.lat ?? v?.latitude), lo = numOrNull(v?.lng ?? v?.longitude)
  return la != null && lo != null && la >= -90 && la <= 90 && lo >= -180 && lo <= 180 && !(Math.abs(la) < 0.01 && Math.abs(lo) < 0.01) ? [la, lo] : null
}
function CenterMap({ point }) { const m = useMap(); useEffect(() => { if (point) m.setView(point, 15, { animate: false }) }, [m, point]); return null }
function ResizeMap({ fullscreen }) {
  const map = useMap()
  useEffect(() => {
    const frame = requestAnimationFrame(() => map.invalidateSize({ animate: false }))
    return () => cancelAnimationFrame(frame)
  }, [fullscreen, map])
  return null
}
function cap(v) {
  const raw = v?._raw || v
  const val = raw?.engineControlStatus ?? raw?.engine_control_status ?? raw?.engineCommandStatus ?? raw?.engine_command_status ?? raw?.engineControl?.status ?? raw?.engine_control?.status
  if (typeof val !== 'string') return 'unknown'
  const n = val.trim().toLowerCase()
  if (['available','confirmed','supported'].includes(n)) return 'available'
  if (['unsupported','unavailable','disabled','not_supported'].includes(n)) return 'unsupported'
  return 'unknown'
}
function dirUrl(type, p) {
  if (!p) return null
  const [la, lo] = p
  return type === 'waze' ? `https://waze.com/ul?ll=${la},${lo}&navigate=yes` : `https://www.google.com/maps/dir/?api=1&destination=${la},${lo}`
}
const REPLAY_RANGES = [1, 2, 3, 7, 30]

function replayDayWindow(date, isToday = false) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  if (isToday) return { startTime: start.toISOString(), endTime: new Date().toISOString() }
  end.setDate(end.getDate() + 1)
  return { startTime: start.toISOString(), endTime: new Date(end.getTime() - 1).toISOString() }
}

function replayDays(count) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - index)
    return { date, ...replayDayWindow(date, index === 0) }
  })
}

function GIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5 flex-shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  )
}
function WIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 flex-shrink-0" fill="#33CCFF">
      <path d="M12 0C5.998 0 .783 4.03.783 10.09c0 2.455 1.05 4.393 2.51 6.066.524.6 1.026 1.194 1.418 1.943.525 1.002.878 2.253 1.134 3.706.05.284.29.495.575.495h11.162c.284 0 .525-.21.575-.495.255-1.453.608-2.704 1.133-3.706.392-.748.895-1.342 1.418-1.943 1.46-1.673 2.51-3.61 2.51-6.065C23.218 4.03 18.003 0 12 0zM8.2 10.4c.557 0 1.008.45 1.008 1.007 0 .556-.451 1.007-1.008 1.007a1.007 1.007 0 0 1 0-2.014zm7.6 0a1.007 1.007 0 1 1 0 2.014 1.007 1.007 0 0 1 0-2.014z"/>
    </svg>
  )
}

function BottomNav({ navigate, lang }) {
  const tabs = [
    { id:'home', label:{ar:'الرئيسية',fr:'Accueil'}, route:'/client/home', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg> },
    { id:'vehicles', label:{ar:'المركبات',fr:'Véhicules'}, route:'/client/vehicles', icon:<Car className="h-5 w-5"/> },
    { id:'alerts', label:{ar:'التنبيهات',fr:'Alertes'}, route:'/client/alerts', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg> },
    { id:'trips', label:{ar:'الرحلات',fr:'Trajets'}, route:'/client/trips', icon:<Route className="h-5 w-5"/> },
    { id:'more', label:{ar:'المزيد',fr:'Plus'}, route:'/client/more', icon:<svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg> },
  ]
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {tabs.map(tb => (
          <button key={tb.id} type="button" onClick={() => navigate(tb.route)} className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-slate-500">
            {tb.icon}<span>{tb.label[lang] || tb.label.ar}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

function ConfirmDialog({ lang, turnOff, name, sending, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">{t(lang, turnOff ? 'engineCutConfirmTitle' : 'engineStartConfirmTitle')}</h2>
            <p className="mt-1 text-xs text-slate-500">{name}</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-xl p-2 text-slate-400"><X size={17}/></button>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">{t(lang, turnOff ? 'engineCutConfirmMsg' : 'engineStartConfirmMsg')}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 px-3 py-3 text-xs font-extrabold text-slate-600">{t(lang,'cancel')}</button>
          <button type="button" onClick={onConfirm} disabled={sending} className="flex-1 rounded-xl bg-indigo-600 px-3 py-3 text-xs font-extrabold text-white disabled:opacity-50">{sending ? <Loader2 className="mx-auto animate-spin" size={16}/> : t(lang,'confirm')}</button>
        </div>
      </div>
    </div>
  )
}

export default function VehicleControl() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { lang, refreshDevices } = useApp()
  const { vehicles, loading, error } = useRealVehicles()
  const [command, setCommand] = useState(null)
  const [sending, setSending] = useState(false)
  const [cmdErr, setCmdErr] = useState('')
  const [replay, setReplay] = useState(null)
  const [tripLoading, setTripLoading] = useState(false)
  const [tripError, setTripError] = useState('')
  const [tripOptions, setTripOptions] = useState(null)
  const [replayRange, setReplayRange] = useState(1)
  const [meta, setMeta] = useState({ name:'', driverName:'', driverPhone:'' })
  const [saved, setSaved] = useState(false)
  const [mapFullscreen, setMapFullscreen] = useState(false)
  const vehicleMapRef = useRef(null)
  const [infoOpen, setInfoOpen] = useState(false)

  const vehicle = useMemo(() => vehicles.find(v => String(v.id) === String(id)), [id, vehicles])
  const point = pt(vehicle)
  const capability = cap(vehicle)
  const lastUp = vehicle?.lastUpdate ?? vehicle?.fixTime
  const online = lastUp && (Date.now() - new Date(lastUp).getTime()) < 15*60*1000

  useEffect(() => {
    if (!vehicle) return
    let s = {}
    try { s = JSON.parse(localStorage.getItem(META_KEY(vehicle.id)) || '{}') } catch (e) { s = {} }
    setMeta({
      name: s.name || vehicle.name || '',
      driverName: s.driverName || vehicle.driverName || '',
      driverPhone: s.driverPhone || vehicle.driverPhone || vehicle.phone || '',
    })
  }, [vehicle?.id])

  const T = lang === 'fr' ? {
    details:'Informations du véhicule', vName:'Nom du véhicule', dName:'Nom du conducteur',
    dPhone:'Téléphone du conducteur', devId:"ID de l'appareil",
    save:'Enregistrer', saved:'Enregistré', online:'En ligne', offline:'Hors ligne',
    noEngine:"Le contrôle du moteur n'est pas disponible pour ce véhicule",
    replay:"Rejouer l'itinéraire", loading:'Chargement...',
    fullscreen:'Plein écran', exitFullscreen:'Quitter le plein écran',
    plate:'Plaque', type:'Type', voltage:'Tension', status:'Statut',
    replayRanges:['Aujourd’hui', '2 jours', '3 jours', '7 jours', '30 jours'],
    showAll:'Afficher tout',
  } : {
    details:'معلومات المركبة', vName:'اسم المركبة', dName:'اسم السائق',
    dPhone:'هاتف السائق', devId:'رقم الجهاز',
    save:'حفظ', saved:'تم الحفظ', online:'متصلة', offline:'غير متصلة',
    noEngine:'التحكم بالمحرك غير متاح حتى يؤكد النظام دعمه لهذه المركبة',
    replay:'إعادة المسار', loading:'جاري التحميل...',
    fullscreen:'ملء الشاشة', exitFullscreen:'الخروج من ملء الشاشة',
    plate:'اللوحة', type:'النوع', voltage:'الفولطاج', status:'الحالة',
    replayRanges:['اليوم', 'يومان', '3 أيام', '7 أيام', '30 يومًا'],
    showAll:'عرض الكل',
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setMapFullscreen(document.fullscreenElement === vehicleMapRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  async function toggleMapFullscreen() {
    const mapElement = vehicleMapRef.current
    if (mapFullscreen) {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {})
      }
      setMapFullscreen(false)
      return
    }
    setMapFullscreen(true)
    if (mapElement?.requestFullscreen) {
      await mapElement.requestFullscreen().catch(() => {})
    }
  }

  async function confirmCommand() {
    if (!vehicle || sending || !command) return
    setSending(true); setCmdErr('')
    try {
      await api.devices.sendCommand(vehicle.id, command.turnOff ? 'engineStop' : 'engineResume')
      setCommand(null); await refreshDevices?.()
    } catch (e) { setCmdErr(t(lang,'vehicleCommandFailed')) } finally { setSending(false) }
  }

  async function openReplay() {
    if (!vehicle || tripLoading) return
    setTripLoading(true); setTripError('')
    // The replay component loads the recorded positions for this exact window.
    // Keep the selector day-based even when a day contains several trip segments.
    setTripOptions(replayDays(replayRange))
    setTripLoading(false)
  }

  function saveDetails() {
    if (!vehicle) return
    localStorage.setItem(META_KEY(vehicle.id), JSON.stringify(meta))
    try { if (api.devices && typeof api.devices.update === 'function') { api.devices.update(vehicle.id, { name: meta.name, driverName: meta.driverName, driverPhone: meta.driverPhone }).catch(function(){}) } } catch (e) {}
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }

  if (loading && !vehicle) return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50"><div className="h-8 w-8 animate-pulse rounded-full border-2 border-indigo-200 border-t-indigo-600"/></div>
  if ((error && !vehicle) || !vehicle) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-6 text-center" dir={lang==='ar'?'rtl':'ltr'}>
      <Car size={28} className="text-slate-400"/>
      <p className="mt-3 text-sm font-extrabold text-slate-700">{t(lang,'vehicleUnavailable')}</p>
      <button type="button" onClick={() => navigate('/client/vehicles')} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-extrabold text-white">{t(lang,'back')}</button>
    </div>
  )

  const markerIcon = L.divIcon({
    className: 'athar-vc-marker',
    html: '<span style="display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:50%;background:#fff;border:3px solid #4F46E5;box-shadow:0 8px 24px rgba(79,70,229,.35)"><img src="' + markerFor(vehicle.type).url + '" alt="" style="width:36px;height:36px;object-fit:contain"/></span>',
    iconSize:[52,52], iconAnchor:[26,26],
  })
  const displayValue = value => value == null || value === '' ? '—' : String(value)
  const vehicleType = vehicle.type === 'car'
    ? (lang === 'fr' ? 'Voiture' : 'سيارة')
    : vehicle.type === 'truck'
      ? (lang === 'fr' ? 'Camion' : 'شاحنة')
      : vehicle.type === 'bike' || vehicle.type === 'motorcycle'
        ? (lang === 'fr' ? 'Moto' : 'دراجة')
        : '—'
  const voltageValue = Number(vehicle.voltage)
  const voltageLabel = Number.isFinite(voltageValue) && voltageValue > 0
    ? `${voltageValue.toFixed(1)} V`
    : '—'

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-24" dir={lang==='ar'?'rtl':'ltr'}>
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            {lang==='ar' ? <ArrowRight size={18}/> : <ArrowLeft size={18}/>}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold text-slate-900">{meta.name || vehicle.name}</h1>
            <p className="text-[11px] font-medium text-slate-500">
              <span className={'inline-block h-2 w-2 rounded-full ' + (online ? 'bg-green-500' : 'bg-slate-400')}/>
              <span className="ms-1.5">{online ? T.online : T.offline}</span>
            </p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {point ? (
            <div
              ref={vehicleMapRef}
              className={'vehicle-control-map' + (mapFullscreen ? ' is-fullscreen' : '')}
            >
              <MapContainer center={point} zoom={15} zoomControl={false} className="h-full w-full">
                <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap"/>
                <ResizeMap fullscreen={mapFullscreen}/>
                <CenterMap point={point}/>
                <Marker position={point} icon={markerIcon}/>
              </MapContainer>
              <button
                type="button"
                onClick={toggleMapFullscreen}
                className="vehicle-control-map__fullscreen"
                aria-label={mapFullscreen ? T.exitFullscreen : T.fullscreen}
                title={mapFullscreen ? T.exitFullscreen : T.fullscreen}
              >
                {mapFullscreen ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
              </button>
            </div>
          ) : (
            <div className="flex h-40 flex-col items-center justify-center text-slate-400">
              <Car size={32}/><p className="mt-2 text-xs">{t(lang,'locationUnavailable')}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 p-3">
            <button type="button" disabled={!point} onClick={() => { const u = dirUrl('google', point); if (u) window.open(u,'_blank','noopener') }} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-extrabold text-slate-700 disabled:bg-slate-200 disabled:text-slate-400">
              <GIcon/>Google Maps
            </button>
            <button type="button" disabled={!point} onClick={() => { const u = dirUrl('waze', point); if (u) window.open(u,'_blank','noopener') }} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-3 text-xs font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400">
              <WIcon/>Waze
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className={'h-3 w-3 rounded-full ' + (capability === 'available' ? 'bg-green-500' : 'bg-slate-400')}/>
            <h2 className="text-sm font-extrabold text-slate-900">{lang==='fr' ? 'Contrôle du moteur' : 'التحكم بالمحرك'}</h2>
          </div>
          {capability !== 'available' && <p className="mt-2 text-[11px] text-slate-500">{T.noEngine}</p>}
          {capability === 'available' && (
            <button type="button" onClick={() => setCommand({ turnOff: true })} className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-red-600 py-5 text-base font-black text-white shadow-lg shadow-red-200 hover:bg-red-700 active:scale-[0.98]">
              <Square size={22} fill="currentColor"/>
              {lang==='fr' ? 'ARRÊTER LE MOTEUR' : 'إيقاف المحرك'}
            </button>
          )}
          {cmdErr && <p className="mt-3 text-xs text-red-600">{cmdErr}</p>}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <p className="mb-2 text-[11px] font-extrabold text-slate-500">{lang === 'fr' ? 'Période' : 'الفترة الزمنية'}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {REPLAY_RANGES.map((days, index) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => { setReplayRange(days); setTripOptions(null); setTripError('') }}
                  aria-pressed={replayRange === days}
                  className={'rounded-xl border px-2 py-2.5 text-[11px] font-extrabold transition ' + (
                    replayRange === days
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300'
                  )}
                >
                  {T.replayRanges[index]}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={openReplay} disabled={tripLoading} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-extrabold text-slate-700 disabled:opacity-50">
            {tripLoading ? <Loader2 className="animate-spin" size={15}/> : <Play size={15}/>}
            {tripLoading ? T.loading : T.replay}
          </button>
          {tripOptions && (
            <div className="mt-3 space-y-2">
              {tripOptions.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const first = tripOptions.at(-1)
                    const last = tripOptions[0]
                    if (first && last) setReplay({ startTime: first.startTime, endTime: last.endTime })
                  }}
                  className="flex w-full items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-xs font-black text-indigo-700"
                >
                  {T.showAll}
                </button>
              )}
              {tripOptions.map((day, index) => (
                <button
                  key={day.startTime}
                  type="button"
                  onClick={() => setReplay({ startTime: day.startTime, endTime: day.endTime })}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-start text-xs font-bold"
                >
                  <span>
                    {day.date.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })}
                  </span>
                  <span className="text-slate-400">{index + 1}</span>
                </button>
              ))}
            </div>
          )}
          {tripError && <p className="mt-2 text-center text-[11px] text-orange-600">{tripError}</p>}
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setInfoOpen(value => !value)}
            aria-expanded={infoOpen}
            className="flex w-full items-center justify-between gap-3 p-4 text-start"
          >
            <span className="flex items-center gap-2">
              <Pencil size={16} className="text-indigo-600"/>
              <span className="text-sm font-extrabold text-slate-900">{T.details}</span>
            </span>
            <span className="text-lg leading-none text-slate-400" aria-hidden="true">{infoOpen ? '−' : '+'}</span>
          </button>
          {infoOpen && <div className="space-y-3 border-t border-slate-100 p-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                [T.dName, meta.driverName],
                [T.plate, vehicle.plate ?? vehicle.licensePlate],
                [T.type, vehicleType],
                [T.dPhone, meta.driverPhone],
                [T.devId, vehicle.uniqueId || vehicle.id],
                [T.voltage, voltageLabel],
                [T.status, online ? T.online : T.offline],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="truncate text-[10px] font-bold text-slate-500">{label}</p>
                  <p className="mt-1 truncate text-xs font-extrabold text-slate-800">{displayValue(value)}</p>
                </div>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-500">{T.vName}</label>
              <input type="text" value={meta.name} onChange={e => setMeta(Object.assign({}, meta, { name: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"/>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-500">{T.dName}</label>
              <input type="text" value={meta.driverName} onChange={e => setMeta(Object.assign({}, meta, { driverName: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"/>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-500">{T.dPhone}</label>
              <input type="tel" dir="ltr" value={meta.driverPhone} onChange={e => setMeta(Object.assign({}, meta, { driverPhone: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"/>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-500">{T.devId}</label>
              <div className="flex items-center gap-2">
                <input type="text" value={vehicle.uniqueId || String(vehicle.id)} readOnly className="flex-1 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500"/>
                {meta.driverPhone ? (
                  <a href={'tel:' + meta.driverPhone} className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500 text-white"><Phone size={16}/></a>
                ) : null}
              </div>
            </div>
            <button type="button" onClick={saveDetails} className={'flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-extrabold text-white transition ' + (saved ? 'bg-green-500' : 'bg-indigo-600 hover:bg-indigo-700')}>
              {saved ? <><Save size={14}/> {T.saved}</> : <><Pencil size={14}/> {T.save}</>}
            </button>
          </div>}
        </section>
      </main>

      <BottomNav navigate={navigate} lang={lang}/>
      {command && <ConfirmDialog lang={lang} name={meta.name || vehicle.name} turnOff={command.turnOff} sending={sending} onCancel={() => setCommand(null)} onConfirm={confirmCommand}/>}
      {replay && <Suspense fallback={<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80"><Loader2 className="animate-spin text-indigo-400" size={40}/></div>}><TripReplay deviceId={vehicle.id} deviceName={vehicle.name} deviceType={vehicle.type} startTime={replay.startTime} endTime={replay.endTime} onClose={() => setReplay(null)} allowSatellite={false}/></Suspense>}
    </div>
  )
}
