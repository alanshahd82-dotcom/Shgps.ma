import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { MapContainer, useMap } from 'react-leaflet'
import LiveVehicleMarker from '../../components/LiveVehicleMarker'
import MapTileLayer from '../../components/MapTileLayer'
import { Activity, ArrowLeft, ArrowRight, Car, CheckCheck, Copy, LocateFixed, Loader2, Maximize2, Minimize2, Pencil, Phone, Route, Save, Share2, Square, User, X, Zap } from 'lucide-react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext'
import { useRealVehicles } from '../../design-system/hooks/useRealVehicles'
import { t } from '../../i18n/translations'
import { APP_TZ } from '../../utils/datetime.js'
import { formatVoltage } from '../../components/ui'
import { useEngineControl } from '../../hooks/useEngineControl'

const VEHICLE_TYPES = ['car', 'bike', 'truck']

function numOrNull(v) { const n = Number(v); return Number.isFinite(n) ? n : null }
function pt(v) {
  const la = numOrNull(v?.lat ?? v?.latitude), lo = numOrNull(v?.lng ?? v?.longitude)
  return la != null && lo != null && la >= -90 && la <= 90 && lo >= -180 && lo <= 180 && !(Math.abs(la) < 0.01 && Math.abs(lo) < 0.01) ? [la, lo] : null
}
// Camera state machine for the vehicle detail map.
// INITIAL_CENTER: center once per vehicle when its position first resolves,
//   preserving the user's current zoom. Does NOT recenter on every GPS packet.
// FOLLOW: LiveVehicleMarker's dead-zone autoFollow only pans when the vehicle
//   leaves a central safe area; user drag/zoom pauses it via onToggleFollow.
// RE-CENTER: the explicit control below smoothly flies to the vehicle.
function InitialCenter({ point, vehicleId }) {
  const m = useMap()
  const lastCenteredRef = useRef(null)
  useEffect(() => {
    if (!point || lastCenteredRef.current === vehicleId) return
    lastCenteredRef.current = vehicleId
    m.setView(point, m.getZoom?.() ?? 15, { animate: false })
  }, [m, point, vehicleId])
  return null
}
function Recenter({ point, trigger }) {
  const m = useMap()
  const firstRef = useRef(true)
  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return }
    if (!point) return
    m.flyTo(point, m.getZoom?.() ?? 15, { duration: 0.5 })
  }, [m, trigger]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
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
  if (typeof val === 'string') {
    const n = val.trim().toLowerCase()
    if (['available','confirmed','supported'].includes(n)) return 'available'
    if (['unsupported','unavailable','disabled','not_supported'].includes(n)) return 'unsupported'
    return 'unknown'
  }

  // The devices endpoint does not expose a separate capability field. A
  // Traccar mapping is the existing prerequisite for the command route, which
  // resolves the appropriate protocol/relay command server-side.
  const traccarId = v?.traccarId ?? v?.traccar_id ?? raw?.traccarId ?? raw?.traccar_id
  return traccarId != null && String(traccarId).trim() !== '' ? 'available' : 'unknown'
}
function dirUrl(type, p) {
  if (!p) return null
  const [la, lo] = p
  return type === 'waze' ? `https://waze.com/ul?ll=${la},${lo}&navigate=yes` : `https://www.google.com/maps/dir/?api=1&destination=${la},${lo}`
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

function EngineCutoffButton({ lang, engineRunning, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t(lang, engineRunning ? 'cutEngine' : 'startEngine')}
      className="engine-cutoff-button"
    >
      <span className="engine-cutoff-button__ring" aria-hidden="true">
        <span className="engine-cutoff-button__core">
          {engineRunning
            ? <Square size={31} strokeWidth={2.5} fill="currentColor" />
            : <Zap size={31} strokeWidth={2.5} fill="currentColor" />}
          <span>{t(lang, engineRunning ? 'cutEngine' : 'startEngine')}</span>
        </span>
      </span>
    </button>
  )
}

export default function VehicleControl() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  // Same component, two authorized entry points: /client/vehicle/:id (ClientRoute)
  // and /admin/vehicle/:id (AdminRoute). Only the surrounding navigation chrome
  // differs so an admin is never sent into client-only routes.
  const isAdminView = location.pathname.startsWith('/admin/')
  const backRoute = isAdminView ? '/admin/devices' : '/client/vehicles'
  const { lang, refreshDevices } = useApp()
  const { vehicles, loading, error } = useRealVehicles()
  const [command, setCommand] = useState(null)
  // Editable vehicle information. The backend (PATCH /devices/:id/info) is the
  // single source of truth; this form is only the local draft before saving.
  const [form, setForm] = useState({ name:'', driver:'', phone:'', plate:'', type:'car' })
  // Authoritative fields returned by the API after a successful save, merged on
  // top of the context vehicle until the shared device list refreshes.
  const [infoOverride, setInfoOverride] = useState(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [shareLink, setShareLink] = useState('')
  const [shareExpiresAt, setShareExpiresAt] = useState(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareErr, setShareErr] = useState('')
  const [copied, setCopied] = useState(false)
  const [mapFullscreen, setMapFullscreen] = useState(false)
  const vehicleMapRef = useRef(null)

  const baseVehicle = useMemo(() => vehicles.find(v => String(v.id) === String(id)), [id, vehicles])
  const vehicle = useMemo(
    () => (baseVehicle && infoOverride ? { ...baseVehicle, ...infoOverride } : baseVehicle),
    [baseVehicle, infoOverride]
  )
  const engine = useEngineControl(vehicle, lang)
  const sending = engine.sending
  const cmdErr = engine.error
  const cmdSuccess = engine.success
  const point = pt(vehicle)
  const capability = cap(vehicle)
  const engineRunning = engine.engineRunning
  const lastUp = vehicle?.lastUpdate ?? vehicle?.fixTime
  const online = lastUp && (Date.now() - new Date(lastUp).getTime()) < 15*60*1000

  // Camera follow state: starts on, paused by user drag/zoom (via
  // LiveVehicleMarker's onToggleFollow). Recenter resumes follow + smoothly
  // re-centers the vehicle. Reset follow when a different vehicle is opened.
  const [follow, setFollow] = useState(true)
  const [recenterTrigger, setRecenterTrigger] = useState(0)
  useEffect(() => { setFollow(true) }, [id])
  const handleRecenter = () => {
    setRecenterTrigger(n => n + 1)
    setFollow(true)
  }

  // Reset the draft (and the share state) whenever another vehicle is opened.
  useEffect(() => {
    setInfoOverride(null)
    setShareLink(''); setShareExpiresAt(null); setShareErr(''); setCopied(false)
    setSaveErr('')
  }, [id])

  useEffect(() => {
    if (!vehicle) return
    setForm({
      name: vehicle.name || '',
      driver: vehicle.driver || vehicle.driverName || '',
      phone: vehicle.phone || vehicle.driverPhone || '',
      plate: vehicle.plate || vehicle.licensePlate || '',
      type: VEHICLE_TYPES.includes(vehicle.type) ? vehicle.type : (vehicle.type === 'motorcycle' ? 'bike' : 'car'),
    })
  }, [vehicle?.id, vehicle?.name, vehicle?.driver, vehicle?.phone, vehicle?.plate, vehicle?.type])

  const T = lang === 'fr' ? {
    details:'Informations du véhicule', vName:'Nom du véhicule', dName:'Nom du conducteur',
    dPhone:'Téléphone du conducteur', devId:"ID de l'appareil",
    save:'Enregistrer', saved:'Enregistré', online:'En ligne', offline:'Hors ligne',
    noEngine:"Le contrôle du moteur n'est pas disponible pour ce véhicule",
    loading:'Chargement...',
    fullscreen:'Plein écran', exitFullscreen:'Quitter le plein écran',
    recenter:'Recentrer sur le véhicule',
    plate:'Plaque', type:'Type', voltage:'Tension', status:'Statut',
    secVehicle:'Véhicule', secDriver:'Conducteur', secDevice:'Appareil GPS', secStatus:'État actuel',
    speed:'Vitesse', lastUpdate:'Dernière mise à jour', call:'Appeler',
    share:'Partager la position', shareCreate:'Générer un lien', shareCopy:'Copier le lien',
    shareCopied:'Lien copié', shareHint:'Lien public valable 24 heures.',
    shareExpires:'Expire le', shareForbidden:"Vous n'êtes pas autorisé à partager ce véhicule.",
    shareExpired:"L'abonnement de cet appareil est expiré. Renouvelez-le avant de partager.",
    shareFailed:'Impossible de créer le lien. Réessayez.',
    saveFailed:'Impossible d’enregistrer. Réessayez.',
    saveForbidden:"Vous n'êtes pas autorisé à modifier ce véhicule.",
    saveInvalid:'Données invalides. Vérifiez les champs.',
    types:{ car:'Voiture', bike:'Moto', truck:'Camion' },
  } : {
    details:'معلومات المركبة', vName:'اسم المركبة', dName:'اسم السائق',
    dPhone:'هاتف السائق', devId:'رقم الجهاز',
    save:'حفظ', saved:'تم الحفظ', online:'متصلة', offline:'غير متصلة',
    noEngine:'التحكم بالمحرك غير متاح حتى يؤكد النظام دعمه لهذه المركبة',
    loading:'جاري التحميل...',
    fullscreen:'ملء الشاشة', exitFullscreen:'الخروج من ملء الشاشة',
    recenter:'تمركز على المركبة',
    plate:'اللوحة', type:'النوع', voltage:'الفولطاج', status:'الحالة',
    secVehicle:'المركبة', secDriver:'السائق', secDevice:'جهاز التتبع', secStatus:'الحالة الحالية',
    speed:'السرعة', lastUpdate:'آخر تحديث', call:'اتصال',
    share:'مشاركة الموقع', shareCreate:'إنشاء رابط', shareCopy:'نسخ الرابط',
    shareCopied:'تم نسخ الرابط', shareHint:'رابط عمومي صالح لمدة 24 ساعة.',
    shareExpires:'ينتهي في', shareForbidden:'ليس لديك صلاحية مشاركة هذه المركبة.',
    shareExpired:'اشتراك هذا الجهاز منتهي. جدّده قبل مشاركة الموقع.',
    shareFailed:'تعذّر إنشاء الرابط. حاول مرة أخرى.',
    saveFailed:'تعذّر الحفظ. حاول مرة أخرى.',
    saveForbidden:'ليس لديك صلاحية تعديل هذه المركبة.',
    saveInvalid:'بيانات غير صالحة. تحقق من الحقول.',
    types:{ car:'سيارة', bike:'دراجة', truck:'شاحنة' },
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
    const turnOff = command.turnOff
    setCommand(null)
    await engine.send(turnOff)
  }

  // Vehicle information edit — migrated from the legacy DeviceDetail page.
  // Uses the existing PATCH /api/devices/:id/info endpoint (unchanged) with the
  // local application device id, then refetches the device from the backend.
  async function saveDetails() {
    if (!vehicle || saving) return
    setSaving(true); setSaveErr(''); setSaved(false)
    try {
      const payload = {
        name: form.name.trim(),
        driver: form.driver.trim(),
        phone: form.phone.trim(),
        plate: form.plate.trim(),
        type: form.type,
      }
      const updated = await api.devices.updateInfo(vehicle.id, payload)
      if (updated && typeof updated === 'object') setInfoOverride(updated)
      // The server is authoritative: read the device back instead of trusting
      // the local draft.
      try {
        const refreshed = await api.devices.get(vehicle.id)
        if (refreshed && typeof refreshed === 'object') setInfoOverride(refreshed)
      } catch {}
      try { await refreshDevices?.() } catch {}
      setSaved(true); setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setSaveErr(e?.status === 403 ? T.saveForbidden : e?.status === 400 ? T.saveInvalid : T.saveFailed)
    } finally { setSaving(false) }
  }

  // Sharing — migrated from the legacy DeviceDetail page. Backend, token and
  // expiration logic stay exactly as they are (POST /api/sharing).
  async function generateShareLink() {
    if (!vehicle || shareLoading) return
    setShareLoading(true); setShareErr(''); setCopied(false)
    try {
      const data = await api.sharing.create(vehicle.id, 24)
      const token = data?.token || data?.share_token || data?.shareToken
      if (!token) throw new Error('no token')
      setShareLink(window.location.origin + '/share/' + token)
      setShareExpiresAt(data?.expiresAt || data?.expires_at || null)
    } catch (e) {
      setShareLink(''); setShareExpiresAt(null)
      setShareErr(e?.status === 403 ? T.shareForbidden : e?.status === 409 ? T.shareExpired : T.shareFailed)
    } finally { setShareLoading(false) }
  }

  function copyShareLink() {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => setShareErr(T.shareFailed))
  }

  if (loading && !vehicle) return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50"><div className="h-8 w-8 animate-pulse rounded-full border-2 border-indigo-200 border-t-indigo-600"/></div>
  if ((error && !vehicle) || !vehicle) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-6 text-center" dir={lang==='ar'?'rtl':'ltr'}>
      <Car size={28} className="text-slate-400"/>
      <p className="mt-3 text-sm font-extrabold text-slate-700">{t(lang,'vehicleUnavailable')}</p>
      <button type="button" onClick={() => navigate(backRoute)} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-extrabold text-white">{t(lang,'back')}</button>
    </div>
  )

  const displayValue = value => value == null || value === '' ? '—' : String(value)
  // Use the shared voltage formatter (src/components/ui.jsx) so this surface
  // stays consistent with the rest of the app: same value source
  // (vehicle.voltage), same empty/disconnected handling, and no fabricated
  // number. Never falls back to batteryLevel as voltage.
  const voltageLabel = formatVoltage(vehicle.voltage, lang, vehicle?.lastUpdate ?? vehicle?.last_update, vehicle?.powerDisconnected, vehicle?.voltageStale)
  // Real saved driver phone — the Call action uses this, never the unsaved
  // form draft, so the user always dials the number currently on record.
  const realPhone = vehicle?.phone ?? vehicle?.driverPhone ?? ''
  const speedLabel = (() => { const s = Number(vehicle?.speed); return Number.isFinite(s) ? Math.round(s) + ' km/h' : null })()
  const lastUpLabel = lastUp ? new Date(lastUp).toLocaleString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { timeZone: APP_TZ }) : null

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-24" dir={lang==='ar'?'rtl':'ltr'}>
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            {lang==='ar' ? <ArrowRight size={18}/> : <ArrowLeft size={18}/>}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold text-slate-900">{vehicle.name}</h1>
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
                <MapTileLayer/>
                <ResizeMap fullscreen={mapFullscreen}/>
                <InitialCenter point={point} vehicleId={id}/>
                <LiveVehicleMarker device={{ ...vehicle, lat: point[0], lng: point[1], lang }} isSelected autoFollow={follow} onToggleFollow={setFollow}/>
                <Recenter point={point} trigger={recenterTrigger}/>
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
              <button
                type="button"
                onClick={handleRecenter}
                className="vehicle-control-map__recenter"
                aria-label={T.recenter}
                title={T.recenter}
              >
                <LocateFixed size={18}/>
              </button>
            </div>
          ) : (
            <div className="flex h-40 flex-col items-center justify-center text-slate-400">
              <Car size={32}/><p className="mt-2 text-xs">{t(lang,'locationUnavailable')}</p>
            </div>
          )}
          {isAdminView && capability === 'available' && (
            <div className="vehicle-control-engine flex flex-col items-center gap-2 border-t border-slate-100 px-3 pt-4">
              <EngineCutoffButton
                lang={lang}
                engineRunning={engineRunning}
                onClick={() => setCommand({ turnOff: engineRunning })}
              />
              {cmdErr && <p role="alert" className="vehicle-control-map__engine-error">{cmdErr}</p>}
              {cmdSuccess && <p role="status" className="vehicle-control-map__engine-success">{cmdSuccess}</p>}
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

        {/* Vehicle information */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Car size={16} className="text-indigo-600"/>
            <span className="text-sm font-extrabold text-slate-900">{T.secVehicle}</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-500">{T.vName}</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-500">{T.plate}</label>
                <input type="text" value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"/>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-500">{T.type}</label>
                <div className="grid grid-cols-3 gap-2">
                  {VEHICLE_TYPES.map(value => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: value }))}
                      aria-pressed={form.type === value}
                      className={'rounded-xl border px-2 py-2.5 text-[11px] font-extrabold transition ' + (
                        form.type === value
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                      )}
                    >
                      {T.types[value]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Driver information */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <User size={16} className="text-indigo-600"/>
            <span className="text-sm font-extrabold text-slate-900">{T.secDriver}</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-500">{T.dName}</label>
              <input type="text" value={form.driver} onChange={e => setForm(f => ({ ...f, driver: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"/>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-500">{T.dPhone}</label>
              <div className="flex items-center gap-2">
                <input type="tel" dir="ltr" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"/>
                {realPhone ? (
                  <a href={'tel:' + realPhone} aria-label={T.call} title={T.call} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-green-500 text-white hover:bg-green-600">
                    <Phone size={16}/>
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* GPS device — read-only identifiers */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Zap size={16} className="text-indigo-600"/>
            <span className="text-sm font-extrabold text-slate-900">{T.secDevice}</span>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-500">{T.devId}</label>
            <input type="text" value={vehicle.uniqueId || '—'} readOnly className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500"/>
          </div>
        </section>

        {/* Current status — read-only telemetry */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Activity size={16} className="text-indigo-600"/>
            <span className="text-sm font-extrabold text-slate-900">{T.secStatus}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="truncate text-[10px] font-bold text-slate-500">{T.status}</p>
              <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-extrabold text-slate-800">
                <span className={'inline-block h-2 w-2 flex-shrink-0 rounded-full ' + (online ? 'bg-green-500' : 'bg-slate-400')}/>
                {online ? T.online : T.offline}
              </p>
            </div>
            <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="truncate text-[10px] font-bold text-slate-500">{T.speed}</p>
              <p className="mt-1 truncate text-xs font-extrabold text-slate-800">{displayValue(speedLabel)}</p>
            </div>
            <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="truncate text-[10px] font-bold text-slate-500">{T.lastUpdate}</p>
              <p className="mt-1 truncate text-xs font-extrabold text-slate-800">{displayValue(lastUpLabel)}</p>
            </div>
            <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="truncate text-[10px] font-bold text-slate-500">{T.voltage}</p>
              <p className="mt-1 truncate text-xs font-extrabold text-slate-800">{displayValue(voltageLabel)}</p>
            </div>
          </div>
        </section>

        <button type="button" onClick={saveDetails} disabled={saving} className={'flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-extrabold text-white transition disabled:opacity-60 ' + (saved ? 'bg-green-500' : 'bg-indigo-600 hover:bg-indigo-700')}>
          {saving ? <><Loader2 size={14} className="animate-spin"/> {T.loading}</> : saved ? <><Save size={14}/> {T.saved}</> : <><Pencil size={14}/> {T.save}</>}
        </button>
        {saveErr && <p role="alert" className="text-center text-[11px] font-bold text-red-600">{saveErr}</p>}

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Share2 size={16} className="text-indigo-600"/>
            <span className="text-sm font-extrabold text-slate-900">{T.share}</span>
          </div>
          <p className="mb-3 text-[11px] font-medium text-slate-500">{T.shareHint}</p>
          {shareLink ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p dir="ltr" className="min-w-0 flex-1 break-all text-[11px] font-semibold text-slate-700">{shareLink}</p>
                <button type="button" onClick={copyShareLink} aria-label={T.shareCopy} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  {copied ? <CheckCheck size={15}/> : <Copy size={15}/>}
                </button>
              </div>
              {copied && <p role="status" className="text-[11px] font-bold text-green-600">{T.shareCopied}</p>}
              {shareExpiresAt && (
                <p className="text-[11px] font-medium text-slate-500">
                  {T.shareExpires} {new Date(shareExpiresAt).toLocaleString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { timeZone: APP_TZ })}
                </p>
              )}
            </div>
          ) : (
            <button type="button" onClick={generateShareLink} disabled={shareLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-3 text-xs font-extrabold text-white transition hover:bg-indigo-700 disabled:opacity-60">
              {shareLoading ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14}/>}
              {shareLoading ? T.loading : T.shareCreate}
            </button>
          )}
          {shareErr && <p role="alert" className="mt-2 text-center text-[11px] font-bold text-red-600">{shareErr}</p>}
        </section>
      </main>

      {!isAdminView && <BottomNav navigate={navigate} lang={lang}/>}
      {command && <ConfirmDialog lang={lang} name={vehicle.name} turnOff={command.turnOff} sending={sending} onCancel={() => setCommand(null)} onConfirm={confirmCommand}/>}
    </div>
  )
}
