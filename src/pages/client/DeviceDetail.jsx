import React, { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  ChevronLeft, Zap, ZapOff, MapPin, Clock, Activity, Battery, Play,
  Gauge, Navigation, Wifi, Share2, Copy, CheckCheck, Loader2, Map, Route as RouteIcon, Terminal,
  Pencil, Check, X as CloseX, Phone, Radio
} from 'lucide-react'
import NativeAreaChart from '../../components/NativeAreaChart'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import ConfirmModal from '../../components/ConfirmModal'
import { getBatteryColor, getDeviceStatusKey, hasGpsPosition, timeAgo, VehicleIcon, VehicleTypeControl } from '../../components/ui'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import SubscriptionBadge from '../../components/SubscriptionBadge'
import SubscriptionRenewalModal from '../../components/SubscriptionRenewalModal'
import MapLayers from '../../components/MapLayers'
import Toast from '../../components/Toast'
import { bucketMax, downsample, simplifyPath } from '../../utils/simplify'

const TripReplay = lazy(() => import('../../components/TripReplay'))

function finiteCoordinate(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function validPosition(lat, lng) {
  return (
    lat !== null &&
    lng !== null &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

const MAX_POSITION_SPEED_KMH = 220

function haversineKm(a, b) {
  const radius = 6371
  const lat1 = a.latitude * Math.PI / 180
  const lat2 = b.latitude * Math.PI / 180
  const dLat = (b.latitude - a.latitude) * Math.PI / 180
  const dLng = (b.longitude - a.longitude) * Math.PI / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const value = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)))
}

function cleanRoute(points) {
  const candidates = (Array.isArray(points) ? points : [])
    .map((point) => ({
      ...point,
      latitude: finiteCoordinate(point?.latitude ?? point?.lat),
      longitude: finiteCoordinate(point?.longitude ?? point?.lng),
      fixTime: point?.fixTime ?? point?.timestamp ?? point?.time,
    }))
    .filter((point) => {
      const date = new Date(point.fixTime)
      return validPosition(point.latitude, point.longitude)
        && !(Math.abs(point.latitude) < 0.01 && Math.abs(point.longitude) < 0.01)
        && !Number.isNaN(date.getTime())
    })
    .sort((a, b) => new Date(a.fixTime) - new Date(b.fixTime))
  const cleaned = []
  for (const point of candidates) {
    const previous = cleaned.at(-1)
    if (previous) {
      const elapsedHours = (new Date(point.fixTime) - new Date(previous.fixTime)) / 3600000
      // Traccar can return several valid fixes with the same timestamp.
      // Preserve those samples so the replay still has a visible route;
      // only reject impossible movement when time has actually advanced.
      const speedKmh = elapsedHours > 0 ? haversineKm(previous, point) / elapsedHours : 0
      if (elapsedHours > 0 && speedKmh > MAX_POSITION_SPEED_KMH) continue
    }
    cleaned.push(point)
  }
  return cleaned
}

function speedColor(s) {
  if (s > 120) return '#FF3B30'
  if (s > 80)  return '#FF9500'
  return '#00D97E'
}

function mergeDeviceDetails(current, next) {
  if (!current) return next
  return {
    ...current,
    ...next,
    // Offline responses can omit live attributes. Keep the last known values
    // so the detail page agrees with the list/map instead of flashing blanks.
    battery: next?.battery ?? current.battery ?? null,
    signal: next?.signal ?? current.signal ?? null,
    fuel: next?.fuel ?? current.fuel ?? null,
  }
}

function FitRoute({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 1) map.fitBounds(positions, { padding:[40,40], animate:true })
  }, [positions.length])
  return null
}

const TABS = [
  { key:'info',     Icon: MapPin,      ar: 'المعلومات',  fr: 'Infos'    },
  { key:'route',    Icon: RouteIcon,   labelKey: 'replayRoute'         },
  { key:'commands', Icon: Terminal,    ar: 'الأوامر',    fr: 'Commandes'},
  { key:'share',    Icon: Share2,      ar: 'مشاركة',     fr: 'Partager' },
]

export default function DeviceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { devices, lang, toggleEngine } = useApp()
  const [tab, setTab] = useState('info')
  const [device, setDevice] = useState(devices.find(d => String(d.id) === String(id)) || null)
  const [loading, setLoading] = useState(!device)
  const [trips, setTrips] = useState([])
  const [routePoints, setRoutePoints] = useState([])
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeLoaded, setRouteLoaded] = useState(false)
  const [routeError, setRouteError] = useState('')
  const [replayLoading, setReplayLoading] = useState('')
  const [tripsLoading, setTripsLoading] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [sending, setSending] = useState(false)
  const [showRenew, setShowRenew] = useState(false)
  const [tripsError, setTripsError] = useState('')
  const [replayTrip, setReplayTrip] = useState(null)
  const [rangePreset, setRangePreset] = useState('today')
  const [selectedDay, setSelectedDay] = useState(() => localDateValue(new Date()))
  const [dayRequest, setDayRequest] = useState(null)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const dayRequestRef = useRef(0)
  const [toast, setToast] = useState(null)
  const [shareErr, setShareErr] = useState('')
  const [imeiCopied, setImeiCopied] = useState(false)
  const [coordinatesCopied, setCoordinatesCopied] = useState(false)
  const [editing,   setEditing]   = useState(false)
  const [editForm,  setEditForm]  = useState({ name: '', driver: '', phone: '', plate: '', type: 'bike' })
  const [saving,    setSaving]    = useState(false)
  const isAr = lang === 'ar'
  const trackingEnabled = device?.trackingEnabled !== false
  const latitude = finiteCoordinate(device?.lat) ?? finiteCoordinate(device?.last_lat)
  const longitude = finiteCoordinate(device?.lng) ?? finiteCoordinate(device?.last_lng)
  const currentSpeed = device?.speed ?? device?.last_speed
  const ignition = device?.ignition ?? device?.engineOn
  const lastUpdate = device?.lastUpdate ?? device?.last_update
  const tabs = TABS

  function getRangeBounds() {
    const now = new Date()
    if (rangePreset === 'custom') {
      if (!customFrom || !customTo) return null
      const from = new Date(`${customFrom}T00:00:00`)
      const selectedTo = new Date(`${customTo}T00:00:00`)
      if (Number.isNaN(from.getTime()) || Number.isNaN(selectedTo.getTime())) return null
      const to = new Date(selectedTo)
      to.setHours(23, 59, 59, 999)
      return { from, to }
    }

    const days = rangePreset === 'week' ? 7 : rangePreset === 'fifteen' ? 15 : 1
    const from = new Date(now)
    from.setHours(0, 0, 0, 0)
    from.setDate(from.getDate() - (days - 1))
    return { from, to: now }
  }

  function localDateValue(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const rangeBounds = getRangeBounds()
  const customRangeTooLong = rangePreset === 'custom' && rangeBounds
    ? rangeBounds.to.getTime() - rangeBounds.from.getTime() > 15 * 24 * 60 * 60 * 1000
    : false
  const rangeReady = rangePreset !== 'custom' || Boolean(rangeBounds && !customRangeTooLong)

  const availableDays = useMemo(() => {
    const days = []
    const today = new Date()
    if (rangePreset === 'custom') {
      if (!rangeBounds || customRangeTooLong) return days
      const cursor = new Date(rangeBounds.from)
      cursor.setHours(0, 0, 0, 0)
      const end = new Date(rangeBounds.to)
      end.setHours(0, 0, 0, 0)
      while (cursor <= end && days.length < 31) {
        days.push(localDateValue(cursor))
        cursor.setDate(cursor.getDate() + 1)
      }
      return days.reverse()
    }

    const count = rangePreset === 'week' ? 7 : rangePreset === 'fifteen' ? 15 : 1
    for (let index = 0; index < count; index += 1) {
      const date = new Date(today)
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - index)
      days.push(localDateValue(date))
    }
    return days
  }, [customFrom, customRangeTooLong, customTo, rangeBounds, rangePreset])

  const st = getDeviceStatusKey(device || {})
  const stColor = { moving:'#00D97E', idle:'#FF9500', stopped:'#FF3B30', awaiting_gps:'#F59E0B', offline:'#6b7280' }[st] || '#6b7280'
  const stLabel = { moving: isAr?'يتحرك':'En mouvement', idle:isAr?'خمول':'Ralenti', stopped:isAr?'متوقف':'Arrêté', awaiting_gps:isAr?'في انتظار تحديد الموقع':'En attente de localisation', offline:isAr?'غير متصل':'Hors ligne' }[st] || st

  useEffect(() => {
    let cancelled = false
    let requestInFlight = false
    async function fetchDevice() {
      if (cancelled || requestInFlight || document.hidden) return
      requestInFlight = true
      setLoading(true)
      try {
        const nextDevice = await api.devices.get(id)
        if (!cancelled) setDevice(current => mergeDeviceDetails(current, nextDevice))
      } catch (e) {
        if (!cancelled) console.error(e)
      } finally {
        requestInFlight = false
        if (!cancelled) setLoading(false)
      }
    }
    fetchDevice()
    const iv = setInterval(fetchDevice, 30000)
    const handleVisibility = () => {
      if (!document.hidden) fetchDevice()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      cancelled = true
      clearInterval(iv)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [id])

  useEffect(() => {
    dayRequestRef.current += 1
    setTrips([])
    setTripsError('')
    setRoutePoints([])
    setRouteLoaded(false)
    setRouteError('')
    setDayRequest(null)
  }, [id, rangePreset, customFrom, customTo, rangeReady])

  useEffect(() => {
    if (!availableDays.length || !availableDays.includes(selectedDay)) {
      setSelectedDay(availableDays[0] || '')
    }
  }, [availableDays, selectedDay])

  async function loadSelectedDay() {
    if (tab !== 'route' || !trackingEnabled || !selectedDay || tripsLoading) return
    const requestId = ++dayRequestRef.current
    const from = new Date(`${selectedDay}T00:00:00`)
    const to = new Date(from)
    to.setDate(to.getDate() + 1)
    const requestTo = to > new Date() ? new Date() : to
    setTripsLoading(true)
    setTripsError('')
    setTrips([])
    setRoutePoints([])
    setRouteLoaded(false)
    setRouteError('')
    try {
      const data = await api.reports.get(id, from.toISOString(), requestTo.toISOString())
      if (requestId === dayRequestRef.current) {
        setTrips(Array.isArray(data.trips) ? data.trips : [])
        setDayRequest(selectedDay)
      }
    } catch (e) {
      if (requestId === dayRequestRef.current) {
        setTripsError(e?.code === 'DEVICE_NOT_LINKED'
          ? (isAr ? 'هذا الجهاز غير مرتبط بخدمة التتبع.' : 'Cet appareil n’est pas lié au service de suivi.')
          : (isAr ? 'تعذّر تحميل رحلات هذا اليوم. تحقق من اتصالك وأعد المحاولة.' : 'Impossible de charger les trajets de ce jour. Vérifiez votre connexion.'))
      }
    } finally {
      if (requestId === dayRequestRef.current) setTripsLoading(false)
    }
  }

  function chooseDay(day) {
    dayRequestRef.current += 1
    setSelectedDay(day)
    setDayRequest(null)
    setTrips([])
    setTripsError('')
    setRoutePoints([])
    setRouteLoaded(false)
    setRouteError('')
  }

  async function loadRoute(from = rangeBounds?.from, to = rangeBounds?.to) {
    if (!from || !to) {
      const selectedFrom = selectedDay ? new Date(`${selectedDay}T00:00:00`) : null
      from = selectedFrom
      to = selectedFrom ? new Date(selectedFrom.getTime() + 24 * 60 * 60 * 1000) : null
    }
    if (!from || !to || routeLoading) return null
    const requestId = dayRequestRef.current
    setRouteLoading(true)
    setRouteError('')
    try {
      const data = await api.stats.getPositions(id, from.toISOString(), to.toISOString(), 350)
      const cleaned = cleanRoute(data)
      if (requestId !== dayRequestRef.current) return null
      if (cleaned.length < 2) {
        setRoutePoints([])
        setRouteLoaded(true)
        setRouteError(isAr ? 'لا توجد نقاط كافية لرسم المسار.' : 'Pas assez de points pour afficher le trajet.')
        return null
      }
      setRoutePoints(cleaned)
      setRouteLoaded(true)
      return cleaned
    } catch {
      if (requestId !== dayRequestRef.current) return null
      setRouteLoaded(false)
      setRouteError(isAr ? 'تعذّر تحميل المسار. حاول مرة أخرى.' : 'Impossible de charger le trajet. Réessayez.')
      return null
    } finally {
      setRouteLoading(false)
    }
  }

  async function replaySingleTrip(trip, index) {
    const startTime = getTripStart(trip)
    const endTime = getTripEnd(trip)
    if (!startTime || !endTime || replayLoading) return
    setReplayLoading(String(index))
    try {
      const startDate = new Date(startTime)
      const endDate = new Date(endTime)
      const requestEnd = Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())
        ? endTime
        : new Date(Math.max(endDate.getTime(), startDate.getTime() + 60 * 1000)).toISOString()
      const points = await api.stats.getPositions(id, startTime, requestEnd, 900)
      const route = cleanRoute(points)
      if (route.length > 1) {
        setReplayTrip({
          ...trip,
          startTime: route[0].fixTime || startTime,
          endTime: route.at(-1).fixTime || endTime,
          route,
        })
      }
    } finally {
      setReplayLoading('')
    }
  }

  async function sendCommand(turnOff) {
    if (sending) return
    setSending(true)
    try {
      await toggleEngine(id, turnOff)
      setDevice(current => ({ ...current, engineOn: !turnOff, ignition: !turnOff }))
      setToast({ type: 'success', message: t(lang, turnOff ? 'engineCutSuccess' : 'engineStartSuccess') })
    } catch (e) {
      setToast({ type: 'error', message: e?.status === 403
          ? (isAr ? 'ليس لديك صلاحية للتحكم بهذا الجهاز.' : 'Vous n’êtes pas autorisé à contrôler cet appareil.')
          : (isAr ? 'تعذّر إرسال الأمر. حاول مرة أخرى.' : 'Erreur lors de la commande. Réessayez.') })
    } finally {
      setSending(false)
      setConfirm(null)
    }
  }

  function openEdit() {
    setEditForm({
      name: device?.name || '',
      driver: device?.driver || '',
      phone: device?.phone || '',
      plate: device?.plate || '',
      type: ['car', 'bike', 'truck'].includes(device?.type) ? device.type : 'bike',
    })
    setEditing(true)
    setToast(null)
  }

  async function saveEdit() {
    setSaving(true); setToast(null)
    try {
      const updated = await api.devices.updateInfo(id, editForm)
      setDevice(d => mergeDeviceDetails(d, updated))
      setToast({ type: 'success', message: isAr ? 'تم الحفظ' : 'Enregistré' })
      setEditing(false)
    } catch (e) {
      setToast({ type: 'error', message: isAr ? 'تعذّر الحفظ. حاول مرة أخرى.' : 'Erreur. Réessayez.' })
    } finally { setSaving(false) }
  }

  function driverPhone(value = device?.phone) {
    return String(value || '').trim()
  }

  function canCallDriver(value = device?.phone) {
    return /^\+?[0-9\s().-]{8,24}$/.test(driverPhone(value))
  }

  function callDriver() {
    if (canCallDriver()) window.location.href = `tel:${driverPhone()}`
  }

  async function generateShareLink() {
    try {
      const data = await api.sharing.create(id, 24)
      const token = data.token || data.share_token || data.shareToken
      if (token) setShareLink(window.location.origin + '/share/' + token)
    } catch (e) { setShareErr(isAr ? 'تعذّر إنشاء الرابط. حاول مرة أخرى.' : 'Impossible de créer le lien. Réessayez.') }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true)
      setToast({ type: 'success', message: isAr ? 'تم نسخ الرابط' : 'Lien copié' })
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => setToast({ type: 'error', message: isAr ? 'تعذّر النسخ' : 'Copie impossible' }))
  }

  function copyCoordinates() {
    if (!validPosition(latitude, longitude)) return
    const coordinates = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
    navigator.clipboard.writeText(coordinates).then(() => {
      setCoordinatesCopied(true)
      setToast({ type: 'success', message: isAr ? 'تم نسخ الإحداثيات' : 'Coordonnées copiées' })
      setTimeout(() => setCoordinatesCopied(false), 2000)
    }).catch(() => {
      setCoordinatesCopied(false)
      setToast({ type: 'error', message: isAr ? 'تعذّر النسخ' : 'Copie impossible' })
    })
  }

  const positions = useMemo(() => downsample(simplifyPath(routePoints
    .map(p => [finiteCoordinate(p.latitude), finiteCoordinate(p.longitude)])
    .filter(([lat, lng]) => validPosition(lat, lng)), 0.00005), 600), [routePoints])
  const speedData = useMemo(() => bucketMax(
    routePoints.map((point, index) => {
      const date = new Date(point.fixTime || point.timestamp || point.time)
      return {
        index,
        xIndex: index,
        time: date.toLocaleTimeString(isAr ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }),
        speed: Math.max(0, Math.round(Number(point.speed) || 0)),
      }
    }),
    300,
  ), [isAr, routePoints])
  const formatTripDateTime = (value) => {
    if (!value) return isAr ? 'لا توجد بيانات' : 'Aucune donnée'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return isAr ? 'لا توجد بيانات' : 'Aucune donnée'
    return `${date.toLocaleDateString(isAr ? 'ar-MA' : 'fr-MA', { day: 'numeric', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString(isAr ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  }
  const getTripStart = trip => trip.startTime || trip.start_time || trip.start
  const getTripEnd = trip => trip.endTime || trip.end_time || trip.end
  const getTripDistance = trip => Number(trip.distanceKm ?? trip.distance_km ?? trip.distance ?? 0)
  const getTripMaxSpeed = trip => Number(trip.maxSpeed ?? trip.max_speed ?? 0)
  const getTripPointCount = trip => Number(trip.points ?? trip.pointCount ?? trip.route?.length ?? 0)
  const displayTrips = trips.map((trip, index) => ({
    trip,
    index,
    isStop: getTripDistance(trip) < 0.05 && getTripMaxSpeed(trip) < 1,
  }))
  const cardStyle = { background:'#0e2035', border:'1px solid rgba(255,255,255,.10)', boxShadow:'0 16px 38px rgba(0,0,0,.20)' }
  const distanceToday = device?.distanceToday ?? device?.distance_today ?? device?.distance_km ?? device?.distance
  const signalStrength = device?.signalStrength ?? device?.signal_strength ?? device?.signal ?? device?.rssi
  const vehicleType = ['car', 'bike', 'truck'].includes(device?.type) ? device.type : 'bike'
  const batteryLevel = device?.battery ?? device?.last_battery ?? null

  if (loading && !device) return (
      <div className="client-app min-h-screen flex items-center justify-center bg-[#07111f]">
       <div className="w-9 h-9 rounded-full border-2 animate-spin" style={{ borderColor:'#e4b56b', borderTopColor:'transparent' }}/>
    </div>
  )

  return (
      <div className="client-app min-h-screen bg-[#07111f] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />

      {/* Header */}
        <div className="mx-4 mt-3 rounded-3xl border border-white/10 bg-gradient-to-br from-[#102945] to-[#0e2035] px-4 pb-5 pt-4 shadow-[0_18px_48px_rgba(0,0,0,.25)]">
          <div className="flex items-start gap-3">
         <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10 bg-[#07111f] active:scale-95"
           >
           <ChevronLeft size={20} className="text-primary-500" style={{ transform: isAr ? 'rotate(180deg)' : 'none' }}/>
        </button>
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#07111f]">
          <VehicleIcon type={vehicleType} iconSize={24} className="!h-10 !w-10 !rounded-xl" />
        </div>
        <div className="flex-1 min-w-0">
            {editing ? (
              <input
                aria-label={isAr ? 'اسم الجهاز' : 'Nom du véhicule'}
                value={editForm.name}
                onChange={event => setEditForm(form => ({ ...form, name: event.target.value }))}
                className="w-full rounded-lg border border-[#38d39f]/50 bg-[#07111f]/70 px-2 py-1 text-base font-extrabold text-white outline-none focus:border-[#38d39f]"
              />
            ) : (
              <h1 className="truncate text-lg font-extrabold text-[#edf4f2]">{device?.name || '...'}</h1>
            )}
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0"
          style={{ background: stColor + '1a', border:'1px solid ' + stColor + '44' }}>
           <div className={`w-1.5 h-1.5 rounded-full ${st === 'moving' ? 'live-dot' : ''}`} style={{ background:stColor }}/>
             <span className="text-xs font-bold" style={{ color:stColor }}>{stLabel}</span>
        </div>
        {!editing && (
          <button onClick={openEdit} aria-label={isAr ? 'تعديل بيانات الجهاز' : 'Modifier l’appareil'} className="mt-1 rounded-xl border border-white/10 bg-white/[.06] p-2 text-[#8ceac5] transition hover:bg-white/10">
            <Pencil size={14} />
          </button>
        )}
        </div>
      </div>

      {/* Status bar */}
      <div className="h-0.5 mx-5 rounded-full mb-4" style={{ background: stColor, opacity:0.6 }}/>

      <div className="px-5 mb-4">
        <SubscriptionBanner device={device} lang={lang} onRenew={() => setShowRenew(true)} />
      </div>

      {/* Quick stats */}
      {device && (
        <div className="grid grid-cols-2 gap-2.5 px-5 mb-4">
          {[
              { Icon:Gauge, label:isAr?'السرعة':'Vitesse', val: currentSpeed != null ? `${Math.round(Number(currentSpeed))} km/h` : '—', color:'#38d39f', always: true },
              { Icon:Battery, label:isAr?'البطارية':'Batterie', val: batteryLevel != null ? `${Math.round(Number(batteryLevel))}%` : '—', color: getBatteryColor(batteryLevel), always: true, bar: batteryLevel },
              { Icon:Activity, label:'IMEI', val: device.imei || '—', color:'#d9ad62', always: true },
              { Icon:Radio, label:isAr?'الإشارة':'Signal', val: signalStrength != null ? signalStrength + (Number(signalStrength) <= 5 ? '/5' : '%') : '—', color:'#6fc8ff', always: true },
              { Icon:Clock, label:isAr?'آخر تحديث':'Dernière mise à jour', val: lastUpdate ? timeAgo(lastUpdate, lang) : '—', color:'#b49cff', always: true, className:'col-span-2' },
                    ].filter(m => m.always || m.val != null).map(({ Icon, label, val, color, bar, className },i) => (
            <div key={i} className={`flex min-w-0 flex-col items-center rounded-2xl p-3.5 ${className || ''}`}
              style={cardStyle}>
              <Icon size={16} style={{ color }} className="mb-1.5"/>
               <span className={`max-w-full truncate text-xs font-bold text-[#edf4f2] ${label === 'IMEI' ? 'font-mono' : ''}`}>{val}</span>
               <span className="text-[9px] mt-0.5 text-slate-400">{label}</span>
                        {bar != null && (
                          <div className="mt-2 h-1.5 w-full max-w-24 overflow-hidden rounded-full bg-white/10" aria-label={`${Math.round(Number(bar))}%`}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${Math.max(0, Math.min(100, Number(bar) || 0))}%`, background: color }}
                            />
                          </div>
                        )}
            </div>
          ))}
        </div>
      )}

      {/* Primary device actions */}
      {device && (
        <div className="grid grid-cols-2 gap-2.5 px-5 mb-5">
          <button
            onClick={() => navigate(`/client/map?device=${encodeURIComponent(id)}`)}
            disabled={!validPosition(latitude, longitude)}
            className="ath-btn-solid col-span-2 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Map size={16} />{isAr ? 'عرض على الخريطة' : 'Voir sur la carte'}
          </button>
        </div>
      )}

      {/* Tabs */}
       <div className="flex gap-1.5 px-5 mb-4 overflow-x-auto" style={{ scrollbarWidth:'none' }}>
         {tabs.map(({ key, Icon, ar, fr, labelKey }) => (
          <motion.button key={key} whileTap={{ scale:0.94 }} onClick={() => setTab(key)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all"
               style={tab===key
               ? { background:'transparent', color:'#38d39f', borderBottom:'2px solid #38d39f', borderRadius:0 }
               : { background:'transparent', color:'#8da2b5', borderBottom:'2px solid transparent' }}>
             <Icon size={12}/>{labelKey ? t(lang, labelKey) : (isAr ? ar : fr)}
          </motion.button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-5">
        <AnimatePresence mode="wait">
          {/* INFO */}
          {tab === 'info' && device && (
            <motion.div key="info" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} className="space-y-3">
              <div className="flex items-center justify-between">
                 <span className="text-xs text-slate-500">{isAr ? 'اشتراك الجهاز' : 'Abonnement appareil'}</span>
                <SubscriptionBadge device={device} lang={lang} dark />
              </div>
              {/* Offline / stale data guidance */}
              {device.status !== 'online' && lastUpdate && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl" style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
                   <Zap size={14} className="text-red-400 flex-shrink-0" />
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {isAr
                      ? `آخر اتصال منذ ${timeAgo(lastUpdate, lang)}. تحقق من طاقة الجهاز وتغطية الشبكة.`
                      : `Dernier signal il y a ${timeAgo(lastUpdate, lang)}. Vérifiez l'alimentation et la couverture réseau.`}
                  </p>
                </div>
              )}
      {device.status === 'online' && !hasGpsPosition(device) && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl" style={{ background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.28)' }}>
          <MapPin size={14} className="text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-200 leading-relaxed">
            {isAr ? 'في انتظار تحديد الموقع' : 'En attente de localisation'}
          </p>
        </div>
      )}
              {/* Mini map */}
              {trackingEnabled && validPosition(latitude, longitude) && (
                <div className="rounded-2xl overflow-hidden" style={{ height:180 }}>
                  <MapContainer center={[latitude, longitude]} zoom={14} style={{ height:'100%',width:'100%' }} zoomControl={false} preferCanvas>
                    <MapLayers />
                    <Marker position={[latitude, longitude]}
                      icon={L.divIcon({ className:'', html:'<div style="width:14px;height:14px;border-radius:50%;background:'+stColor+';border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>', iconSize:[14,14], iconAnchor:[7,7] })}/>
                  </MapContainer>
                </div>
              )}
              {/* Detail rows + edit */}
              <div className="rounded-2xl overflow-hidden" style={cardStyle}>
                {/* Edit header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{isAr ? 'معلومات الجهاز' : 'Appareil'}</span>
                  {!editing
                    ? <button onClick={openEdit} className="flex items-center gap-1 text-[11px] font-bold text-primary-500 hover:opacity-70 transition-opacity">
                        <Pencil size={11}/>{isAr ? 'تعديل' : 'Modifier'}
                      </button>
                    : <div className="flex items-center gap-2">
                        <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600">
                          <CloseX size={14}/>{isAr ? 'إلغاء' : 'Annuler'}
                        </button>
                        <button onClick={saveEdit} disabled={saving}
                          className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:opacity-70 disabled:opacity-50">
                          {saving ? <Loader2 size={11} className="animate-spin"/> : <Check size={11}/>}
                          {isAr ? 'حفظ' : 'Enregistrer'}
                        </button>
                      </div>}
                </div>

                {editing ? (
                  /* Edit form */
                  <div className="divide-y divide-slate-100">
                    {[
                      { label: isAr?'اسم الجهاز':'Nom', key:'name', placeholder: isAr?'مثال: سيارة المدير':'Ex: Voiture du directeur' },
                      { label: isAr?'السائق':'Conducteur', key:'driver', placeholder: isAr?'اسم السائق':'Nom du conducteur' },
                      { label: isAr?'هاتف السائق':'Téléphone', key:'phone', placeholder: isAr?'+212 6…':'+212 6…', inputMode:'tel' },
                      { label: isAr?'اللوحة':'Plaque', key:'plate', placeholder: isAr?'رقم اللوحة':'Numéro de plaque' },
                    ].map(field => (
                      <div key={field.key} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-xs text-slate-500 w-20 flex-shrink-0">{field.label}</span>
                        <input
                           className="flex-1 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/40"
                          value={editForm[field.key]}
                          onChange={e => setEditForm(f => ({ ...f, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          inputMode={field.inputMode}
                        />
                      </div>
                    ))}
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-xs text-slate-500 w-20 flex-shrink-0">{isAr ? 'نوع المركبة' : 'Type'}</span>
                      <VehicleTypeControl
                        value={editForm.type}
                        onChange={type => setEditForm(f => ({ ...f, type }))}
                        lang={lang}
                        className="flex-1"
                      />
                    </div>
                  </div>
                ) : (
                  /* Read-only rows */
                  [
                    { label: isAr?'الجهاز':'Appareil', val: device.name },
                    { label: isAr?'اللوحة':'Plaque', val: device.plate || '—' },
                    { label: isAr?'السائق':'Conducteur', val: device.driver || '—' },
                    { label: isAr?'هاتف السائق':'Téléphone', val: device.phone || '—', phone: device.phone },
                     { label: isAr?'الموقع':'Position', val: validPosition(latitude, longitude) ? latitude.toFixed(5)+', '+longitude.toFixed(5) : '—', copyCoordinates: validPosition(latitude, longitude) },
                    { label: isAr?'IMEI':'IMEI', val: device.imei ? (device.imei.slice(0,6)+'✦✦✦✦✦✦'+device.imei.slice(-4)) : '—', copy: device.imei },
                    { label: isAr?'آخر تحديث':'Dernier signal', val: lastUpdate ? timeAgo(lastUpdate, lang) : (isAr?'لا توجد بيانات':'Aucune donnée') },
                  ].map((row,i,arr) => (
                     <div key={i} onClick={row.copyCoordinates ? copyCoordinates : undefined} onKeyDown={event => {
                       if (row.copyCoordinates && (event.key === 'Enter' || event.key === ' ')) {
                         event.preventDefault()
                         copyCoordinates()
                       }
                     }} role={row.copyCoordinates ? 'button' : undefined} tabIndex={row.copyCoordinates ? 0 : undefined} className={`flex items-center justify-between px-4 py-3 ${row.copyCoordinates ? 'cursor-pointer' : ''}`}
                       style={{ borderBottom: i<arr.length-1 ? '1px solid #f1f5f9' : 'none' }}>
                       <span className="text-xs text-slate-500">{row.label}</span>
                       <div className="flex items-center gap-2">
                         <span className="text-xs font-semibold text-slate-800 text-right max-w-40 truncate">{row.val}</span>
                          {row.phone && (
                            <button
                              onClick={(event) => { event.stopPropagation(); callDriver() }}
                              aria-label={isAr ? 'الاتصال بالسائق' : 'Appeler le conducteur'}
                              className="flex-shrink-0 rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600 transition-colors hover:bg-emerald-500/20"
                            >
                              <Phone size={12} />
                            </button>
                          )}
                          {row.copyCoordinates && (
                            <button
                              onClick={copyCoordinates}
                              aria-label={isAr ? 'نسخ الإحداثيات' : 'Copier les coordonnées'}
                              title={isAr ? 'نسخ الإحداثيات' : 'Copier les coordonnées'}
                              className="flex-shrink-0 rounded-lg p-1 text-slate-400 transition-colors"
                            >
                              {coordinatesCopied ? <CheckCheck size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            </button>
                          )}
                         {row.copy && (
                           <button
                             onClick={() => {
                               navigator.clipboard.writeText(row.copy).then(() => {
                                 setImeiCopied(true)
                                 setToast({ type: 'success', message: isAr ? 'تم نسخ IMEI' : 'IMEI copié' })
                                 setTimeout(() => setImeiCopied(false), 2000)
                               }).catch(() => setToast({ type: 'error', message: isAr ? 'تعذّر النسخ' : 'Copie impossible' }))
                             }}
                             aria-label={isAr?'نسخ IMEI':'Copier IMEI'}
                             className="flex-shrink-0 p-1 rounded-lg text-slate-400 transition-colors">
                             {imeiCopied ? <CheckCheck size={12} className="text-emerald-600"/> : <Copy size={12}/>}
                           </button>
                         )}
                       </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* ROUTE */}
          {tab === 'route' && (
            <motion.div key="route" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} className="space-y-3">
               <div className="rounded-2xl p-3" style={cardStyle}>
                 <div className="ath-period-control" role="tablist" aria-label={isAr ? 'الفترة' : 'Période'}>
                  {[
                    ['today', t(lang, 'today')],
                    ['week', t(lang, 'last7Days')],
                    ['fifteen', t(lang, 'last15Days')],
                    ['custom', t(lang, 'customRange')],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                       type="button"
                       role="tab"
                       aria-selected={rangePreset === key}
                      onClick={() => setRangePreset(key)}
                       className={`ath-period-control-button ${rangePreset === key ? 'is-active' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {rangePreset === 'custom' && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="min-w-0 text-[10px] font-semibold text-slate-400">
                      {t(lang, 'from')}
                      <input
                        type="date"
                        value={customFrom}
                        max={customTo || localDateValue(new Date())}
                        onChange={event => setCustomFrom(event.target.value)}
                        className="mt-1 block w-full min-w-0 rounded-xl border border-white/10 bg-[#07111f] px-2.5 py-2 text-xs text-white outline-none focus:border-[#1DBF73]"
                      />
                    </label>
                    <label className="min-w-0 text-[10px] font-semibold text-slate-400">
                      {t(lang, 'to')}
                      <input
                        type="date"
                        value={customTo}
                        min={customFrom}
                        max={localDateValue(new Date())}
                        onChange={event => setCustomTo(event.target.value)}
                        className="mt-1 block w-full min-w-0 rounded-xl border border-white/10 bg-[#07111f] px-2.5 py-2 text-xs text-white outline-none focus:border-[#1DBF73]"
                      />
                    </label>
                  </div>
                )}
                {rangePreset === 'custom' && (!rangeBounds || customRangeTooLong) && (
                  <p className="mt-2 text-[11px] font-semibold text-amber-300">
                    {customRangeTooLong ? t(lang, 'rangeTooLong') : t(lang, 'selectCustomRange')}
                  </p>
                )}
              </div>
              {!trackingEnabled ? (
                <SubscriptionBanner device={device} lang={lang} onRenew={() => setShowRenew(true)} />
              ) : !rangeReady ? (
                <div className="flex flex-col items-center rounded-2xl p-8 text-center" style={cardStyle}>
                  <RouteIcon size={28} className="mb-3 text-slate-500"/>
                  <p className="text-xs font-semibold text-slate-400">{t(lang, 'selectCustomRange')}</p>
                </div>
              ) : tripsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor:'#e4b56b', borderTopColor:'transparent' }}/>
                </div>
              ) : (
                <>
                  {dayRequest && availableDays.length > 1 && (
                    <div className="rounded-2xl p-3" style={cardStyle}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          {isAr ? 'اليوم المحمّل' : 'Jour chargé'}
                        </p>
                        <button
                          onClick={() => chooseDay(selectedDay)}
                          className="text-[10px] font-bold text-[#38d39f]"
                        >
                          {isAr ? 'تغيير اليوم' : 'Changer de jour'}
                        </button>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                        {availableDays.map((day) => {
                          const date = new Date(`${day}T00:00:00`)
                          return (
                            <button
                              key={day}
                              onClick={() => chooseDay(day)}
                              className="min-w-[82px] rounded-xl px-2.5 py-2 text-start transition"
                              style={day === selectedDay
                                ? { background: 'rgba(56,211,159,.16)', border: '1px solid rgba(56,211,159,.55)' }
                                : { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}
                            >
                              <p className="text-[9px] font-bold text-slate-400">
                                {date.toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR', { weekday: 'short' })}
                              </p>
                              <p className="mt-1 text-xs font-black text-white">
                                {date.toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'short' })}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {!dayRequest ? (
                <div className="space-y-3">
                  <div className="rounded-2xl p-4 text-center" style={cardStyle}>
                    <RouteIcon size={28} className="mx-auto mb-2 text-[#38d39f]" />
                    <p className="text-sm font-bold text-white">
                      {rangePreset === 'today'
                        ? (isAr ? 'اختر تحميل بيانات اليوم عند الحاجة' : 'Chargez les données du jour à la demande')
                        : (isAr ? 'اختر يوماً واحداً لتحميل بياناته' : 'Choisissez un seul jour à charger')}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {isAr ? 'لن يتم تحميل الفترة كاملة أو نقاط الخريطة قبل اختيارك.' : 'La période complète et les points de la carte ne seront pas chargés avant votre choix.'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {availableDays.map((day) => {
                      const date = new Date(`${day}T00:00:00`)
                      const isSelected = day === selectedDay
                      return (
                        <button
                          key={day}
                          onClick={() => chooseDay(day)}
                          className="rounded-2xl p-3 text-start transition"
                          style={isSelected
                            ? { background: 'rgba(56,211,159,.16)', border: '1px solid rgba(56,211,159,.55)' }
                            : { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}
                        >
                          <p className="text-[10px] font-bold text-slate-400">
                            {date.toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR', { weekday: 'short' })}
                          </p>
                          <p className="mt-1 text-sm font-black text-white">
                            {date.toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'short' })}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={loadSelectedDay}
                    disabled={!selectedDay}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-extrabold text-[#07111f] disabled:opacity-50"
                    style={{ background: '#38d39f' }}
                  >
                    <RouteIcon size={14} />
                    {isAr ? 'تحميل هذا اليوم فقط' : 'Charger uniquement ce jour'}
                  </button>
                </div>
                  ) : tripsError ? (
                <div className="flex flex-col items-center p-6 rounded-2xl text-center" style={cardStyle}>
                  <p className="text-xs font-semibold text-red-500 mb-3">{tripsError}</p>
                  <button
                    onClick={loadSelectedDay}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background:'#17324d' }}>
                    {isAr?'إعادة المحاولة':'Réessayer'}
                  </button>
                </div>
                  ) : trips.length === 0 ? (
                <div className="flex flex-col items-center py-14" style={cardStyle}>
                  <RouteIcon size={32} className="mb-3 text-slate-300"/>
                  <p className="text-sm font-semibold text-slate-500">{t(lang, 'noTripsInRange')}</p>
                </div>
                  ) : (
                <>
                  <div className="relative overflow-hidden rounded-2xl" style={{ height:200 }}>
                    {positions.length > 0 ? (
                      <MapContainer center={positions[0]} zoom={12} style={{ height:'100%',width:'100%' }} zoomControl={false} preferCanvas>
                        <MapLayers />
                        <Polyline positions={positions} color="#16866d" weight={3} opacity={0.8}/>
                        <FitRoute positions={positions}/>
                      </MapContainer>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0b1929] text-center">
                        {routeLoading ? (
                          <Loader2 size={22} className="animate-spin text-[#38d39f]" />
                        ) : (
                          <>
                            <Map size={24} className="text-slate-500" />
                            <button
                               onClick={() => loadRoute()}
                              className="rounded-xl bg-[#38d39f] px-5 py-2.5 text-xs font-extrabold text-[#07111f] transition hover:brightness-110"
                            >
                              {t(lang, 'showRoute')}
                            </button>
                          </>
                        )}
                        {routeError && <p className="px-4 text-[10px] font-semibold text-amber-300">{routeError}</p>}
                      </div>
                    )}
                  </div>
                   {routeLoaded && routePoints.length > 1 && (
                    <button
                      onClick={() => setReplayTrip({
                         startTime: routePoints[0].fixTime,
                         endTime: routePoints.at(-1).fixTime,
                        route: routePoints,
                      })}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-extrabold text-[#07111f] shadow-lg shadow-[#1DBF73]/10 transition hover:brightness-110"
                      style={{ background: '#1DBF73' }}
                    >
                      <Play size={14} fill="currentColor" />
                         {isAr ? 'إعادة عرض اليوم المحدد' : 'Rejouer le jour sélectionné'}
                    </button>
                  )}
                  {routeLoaded && (
                    <div className="p-4 rounded-2xl" style={cardStyle}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-bold tracking-wide uppercase text-slate-500">
                          {isAr ? 'منحنى السرعة' : 'Vitesse'}
                        </p>
                        {speedData.length > 1 && <span className="text-[10px] text-slate-500">{speedData.length} {isAr ? 'نقطة' : 'points'}</span>}
                      </div>
                      {speedData.length > 1 ? (
                        <NativeAreaChart
                          data={speedData}
                          xKey="time"
                          series={[{ dataKey: 'speed', color: '#1DBF73' }]}
                          height={132}
                        />
                      ) : (
                        <div className="flex h-[132px] flex-col items-center justify-center gap-2 text-center">
                          <Activity size={22} className="text-slate-500" />
                          <p className="text-xs text-slate-500">{isAr ? 'لا توجد بيانات سرعة' : 'Aucune donnée de vitesse'}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    {displayTrips.map(({ trip, index, isStop }) => (
                      <div key={`${getTripStart(trip) || index}-${index}`} className="flex items-center gap-3 rounded-2xl p-3" style={cardStyle}>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background:'rgba(56,211,159,.12)' }}>
                          <RouteIcon size={16} style={{ color:'#38d39f' }}/>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-white">{formatTripDateTime(getTripStart(trip))}</p>
                           <p className="mt-1 truncate text-[10px] text-slate-400" dir="ltr">
                             {getTripEnd(trip) ? `${isAr ? 'حتى' : 'jusqu’à'} ${formatTripDateTime(getTripEnd(trip))} · ` : ''}
                             {getTripDistance(trip).toFixed(1)} km · {Math.round(getTripMaxSpeed(trip))} km/h · {getTripPointCount(trip)} {isAr ? 'نقطة' : 'points'}
                          </p>
                        </div>
                        {isStop ? (
                          <span className="shrink-0 rounded-lg bg-amber-400/15 px-2.5 py-1.5 text-[10px] font-bold text-amber-300">{t(lang, 'stopLabel')}</span>
                        ) : (
                          <button
                      onClick={() => replaySingleTrip(trip, index)}
                      disabled={replayLoading === String(index)}
                            className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold text-[#07111f]"
                            style={{ background:'#38d39f' }}
                          >
                            {replayLoading === String(index) ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}{t(lang, 'replay')}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* COMMANDS — single dynamic engine button */}
          {tab === 'commands' && (() => {
            const engineOn = !!ignition
            const cmdColor = engineOn ? '#FF3B30' : '#00D97E'
            const CmdIcon  = engineOn ? ZapOff : Zap
            const cmdLabel = engineOn ? t(lang, 'cutEngine') : t(lang, 'startEngine')
            const turnOff  = engineOn
            return (
              <motion.div key="cmds" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} className="space-y-3">
                {/* Engine status indicator */}
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
                  style={{ background: (engineOn ? '#00D97E' : '#6b7280') + '14', border: '1px solid ' + (engineOn ? '#00D97E' : '#6b7280') + '30' }}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: engineOn ? '#00D97E' : '#6b7280' }}/>
                  <p className="text-sm font-bold" style={{ color: engineOn ? '#16866d' : '#6b7280' }}>
                     {t(lang, engineOn ? 'engineOn' : 'engineOff')}
                   </p>
                </div>
                {/* Single action button */}
                <motion.button whileTap={{ scale:0.97 }}
                  onClick={() => setConfirm({ label: cmdLabel, turnOff })}
                  disabled={sending}
                  aria-label={cmdLabel}
                  className="w-full min-h-[88px] flex items-center gap-4 p-4 rounded-2xl disabled:opacity-50 transition-all"
                  style={{ background: cmdColor+'18', border:'1.5px solid '+cmdColor+'44' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: cmdColor+'22' }}>
                    {sending
                      ? <Loader2 size={22} className="animate-spin" style={{ color: cmdColor }}/>
                      : <CmdIcon size={22} style={{ color: cmdColor }}/>}
                  </div>
                  <div className={isAr ? 'text-right' : 'text-left'}>
                     <p className="font-bold text-sm" style={{ color: cmdColor }}>{cmdLabel}</p>
                  </div>
                </motion.button>
              </motion.div>
            )
          })()}

          {/* SHARE */}
          {tab === 'share' && (
            <motion.div key="share" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} className="space-y-3">
              <div className="p-5 rounded-2xl text-center" style={cardStyle}>
                 <Share2 size={32} className="mx-auto mb-3 text-primary-500"/>
                 {shareErr && <p className="text-xs text-red-500 mb-2">{shareErr}</p>}
                 <p className="text-slate-800 font-extrabold mb-1">{isAr ? 'مشاركة الموقع المباشر' : 'Partage de localisation live'}</p>
                 <p className="text-xs mb-4 text-slate-500">
                  {isAr ? 'أنشئ رابطاً مؤقتاً لمشاركة الموقع المباشر للجهاز' : 'Créez un lien temporaire pour partager la position en temps réel'}
                </p>
                {!trackingEnabled ? (
                  <SubscriptionBanner device={device} lang={lang} onRenew={() => setShowRenew(true)} />
                ) : !shareLink ? (
                  <motion.button whileTap={{ scale:0.96 }} onClick={generateShareLink}
                    className="px-6 py-3 rounded-xl text-sm font-bold text-white"
                    style={{ background:'linear-gradient(135deg,#00D97E,#00b86a)', boxShadow:'0 4px 16px rgba(0,217,126,0.3)' }}>
                    {isAr ? 'إنشاء رابط' : 'Créer le lien'}
                  </motion.button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 rounded-xl text-left break-all"
                     style={{ background:'rgba(56,211,159,.08)', border:'1px solid rgba(56,211,159,.25)' }}>
                       <p className="flex-1 text-xs text-[#a8e6cf] break-all">{shareLink}</p>
                    </div>
                    <button onClick={copyLink}
                      className="flex items-center gap-2 mx-auto px-4 py-2.5 rounded-xl text-xs font-semibold"
                      style={{ background: copied ? 'rgba(56,211,159,.15)' : 'rgba(255,255,255,.07)', color: copied ? '#38d39f' : '#edf4f2', border: '1px solid rgba(255,255,255,.12)' }}>
                      {copied ? <CheckCheck size={14}/> : <Copy size={14}/>}
                      {copied ? (isAr?'تم النسخ!':'Copié !') : (isAr?'نسخ الرابط':'Copier le lien')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirm modal */}
      {confirm && (
        <ConfirmModal
          open={!!confirm}
          title={t(lang, confirm.turnOff ? 'engineCutConfirmTitle' : 'engineStartConfirmTitle')}
          message={t(lang, confirm.turnOff ? 'engineCutConfirmMsg' : 'engineStartConfirmMsg')}
          onConfirm={() => sendCommand(confirm.turnOff)}
          onCancel={() => setConfirm(null)}
          danger={confirm.turnOff}
          lang={lang}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />

      {replayTrip && (
        <Suspense fallback={<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#0B1220]"><div className="h-9 w-9 animate-spin rounded-full border-2 border-[#35d39a] border-t-transparent" /></div>}>
          <TripReplay
          deviceId={id}
          deviceName={device?.name}
          deviceType={device?.type}
          startTime={replayTrip.startTime}
          endTime={replayTrip.endTime}
          positions={replayTrip.route || []}
           allowSatellite={false}
          onClose={() => setReplayTrip(null)}
          />
        </Suspense>
      )}

      <SubscriptionRenewalModal
        open={showRenew}
        device={device}
        lang={lang}
        onClose={() => setShowRenew(false)}
        onSaved={result => setDevice(current => ({ ...current, ...result, trackingEnabled: true, subscriptionStatus: 'active' }))}
      />

      <ClientNav/>
    </div>
  )
}
