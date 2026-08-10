import React, { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  ChevronLeft, Zap, ZapOff, MapPin, Clock, Activity, Battery, Play,
  Gauge, Navigation, Wifi, Share2, Copy, CheckCheck, Loader2, Map, Route as RouteIcon, Terminal,
  Pencil, Check, X as CloseX
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import ConfirmModal from '../../components/ConfirmModal'
import { getDeviceStatusKey, timeAgo } from '../../components/ui'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import SubscriptionBadge from '../../components/SubscriptionBadge'
import SubscriptionRenewalModal from '../../components/SubscriptionRenewalModal'
import MapLayers from '../../components/MapLayers'
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

function FitRoute({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 1) map.fitBounds(positions, { padding:[40,40], animate:true })
  }, [positions.length])
  return null
}

const TABS = [
  { key:'info',     Icon: MapPin,      ar: 'المعلومات',  fr: 'Infos'    },
  { key:'route',    Icon: RouteIcon,   ar: 'الرحلات',    fr: 'Trajets'  },
  { key:'commands', Icon: Terminal,    ar: 'الأوامر',    fr: 'Commandes'},
  { key:'share',    Icon: Share2,      ar: 'مشاركة',     fr: 'Partager' },
]

const COMMANDS = [
  { type:'engine_stop',  ar:'إيقاف المحرك',    fr:'Couper moteur', color:'#FF3B30', Icon: ZapOff },
  { type:'engine_start', ar:'تشغيل المحرك',    fr:'Démarrer moteur', color:'#00D97E', Icon: Zap   },
]

export default function DeviceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { devices, clientAuth, lang } = useApp()
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
  const [cmdMsg, setCmdMsg] = useState('')
  const [shareErr, setShareErr] = useState('')
  const [imeiCopied, setImeiCopied] = useState(false)
  const [coordinatesCopied, setCoordinatesCopied] = useState(false)
  const [coordinatesToast, setCoordinatesToast] = useState(false)
  const [editing,   setEditing]   = useState(false)
  const [editForm,  setEditForm]  = useState({ name: '', driver: '', plate: '' })
  const [saving,    setSaving]    = useState(false)
  const [saveMsg,   setSaveMsg]   = useState('')
  const isAr = lang === 'ar'
  const trackingEnabled = device?.trackingEnabled !== false
  const latitude = finiteCoordinate(device?.lat) ?? finiteCoordinate(device?.last_lat)
  const longitude = finiteCoordinate(device?.lng) ?? finiteCoordinate(device?.last_lng)
  const currentSpeed = device?.speed ?? device?.last_speed
  const ignition = device?.ignition ?? device?.engineOn
  const lastUpdate = device?.lastUpdate ?? device?.last_update
  const canControlEngine = !clientAuth?.parentClientId || ['owner', 'manager'].includes(clientAuth?.role)
  const tabs = canControlEngine
    ? TABS
    : TABS.filter(tabItem => tabItem.key !== 'commands')

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
  const stColor = { moving:'#00D97E', idle:'#FF9500', stopped:'#FF3B30', offline:'#6b7280' }[st] || '#6b7280'
  const stLabel = { moving: isAr?'يتحرك':'En mouvement', idle:isAr?'خمول':'Ralenti', stopped:isAr?'متوقف':'Arrêté', offline:isAr?'غير متصل':'Hors ligne' }[st] || st

  useEffect(() => {
    let cancelled = false
    let requestInFlight = false
    async function fetchDevice() {
      if (cancelled || requestInFlight || document.hidden) return
      requestInFlight = true
      setLoading(true)
      try {
        const nextDevice = await api.devices.get(id)
        if (!cancelled) setDevice(nextDevice)
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

  async function sendCommand(type) {
    setSending(true)
    try {
      await api.devices.sendCommand(id, type)
      setCmdMsg(isAr ? 'تم إرسال الأمر بنجاح ✓' : 'Commande envoyée avec succès ✓')
    } catch (e) { setCmdMsg(isAr ? 'تعذّر إرسال الأمر. حاول مرة أخرى.' : 'Erreur lors de la commande. Réessayez.') }
    finally { setSending(false); setConfirm(null) }
  }

  function openEdit() {
    setEditForm({ name: device?.name || '', driver: device?.driver || '', plate: device?.plate || '' })
    setEditing(true)
    setSaveMsg('')
  }

  async function saveEdit() {
    setSaving(true); setSaveMsg('')
    try {
      const updated = await api.devices.updateInfo(id, editForm)
      setDevice(d => ({ ...d, ...updated }))
      setSaveMsg(isAr ? 'تم الحفظ بنجاح ✓' : 'Enregistré ✓')
      setEditing(false)
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (e) {
      setSaveMsg(isAr ? 'تعذّر الحفظ. حاول مرة أخرى.' : 'Erreur. Réessayez.')
    } finally { setSaving(false) }
  }

  async function generateShareLink() {
    try {
      const data = await api.sharing.create(id, 24)
      const token = data.token || data.share_token || data.shareToken
      if (token) setShareLink(window.location.origin + '/share/' + token)
    } catch (e) { setShareErr(isAr ? 'تعذّر إنشاء الرابط. حاول مرة أخرى.' : 'Impossible de créer le lien. Réessayez.') }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function copyCoordinates() {
    if (!validPosition(latitude, longitude)) return
    const coordinates = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
    navigator.clipboard.writeText(coordinates).then(() => {
      setCoordinatesCopied(true)
      setCoordinatesToast(true)
      setTimeout(() => setCoordinatesCopied(false), 2000)
      setTimeout(() => setCoordinatesToast(false), 2200)
    }).catch(() => {
      setCoordinatesCopied(false)
      setCoordinatesToast(false)
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
  const speedMax = speedData.reduce((max, point) => Math.max(max, point.speed), 0)
  const speedDomainMax = Math.max(10, Math.ceil((speedMax + 5) / 5) * 5)
  const speedTicks = speedData.length > 1
    ? Array.from({ length: Math.min(5, speedData.length) }, (_, index) => {
      const position = Math.round(index * (speedData.length - 1) / Math.max(1, Math.min(5, speedData.length) - 1))
      return speedData[position].index
    })
    : []
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

  if (loading && !device) return (
      <div className="client-app min-h-screen flex items-center justify-center bg-[#07111f]">
       <div className="w-9 h-9 rounded-full border-2 animate-spin" style={{ borderColor:'#e4b56b', borderTopColor:'transparent' }}/>
    </div>
  )

  return (
      <div className="client-app min-h-screen bg-[#07111f] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />

      {/* Header */}
        <div className="mx-4 mt-3 rounded-3xl border border-white/10 bg-gradient-to-br from-[#102945] to-[#0e2035] px-4 pb-5 pt-4 shadow-[0_18px_48px_rgba(0,0,0,.25)] flex items-center gap-3">
         <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10 bg-[#07111f] active:scale-95"
           >
           <ChevronLeft size={20} className="text-primary-500" style={{ transform: isAr ? 'rotate(180deg)' : 'none' }}/>
        </button>
        <div className="flex-1 min-w-0">
            <h1 className="text-[#edf4f2] font-extrabold text-lg truncate">{device?.name || '...'}</h1>
            <p className="text-xs font-mono text-slate-500">{device?.plate || device?.imei || (isAr ? 'معرّف غير متاح' : 'Identifier unavailable')}</p>
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0"
          style={{ background: stColor + '1a', border:'1px solid ' + stColor + '44' }}>
           <div className={`w-1.5 h-1.5 rounded-full ${st === 'moving' ? 'live-dot' : ''}`} style={{ background:stColor }}/>
             <span className="text-xs font-bold" style={{ color:stColor }}>{stLabel}</span>
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
              { Icon:Gauge,   label:isAr?'السرعة':'Vitesse', val: currentSpeed != null ? Math.round(currentSpeed)+' km/h' : t(lang, 'noData'), color:'#38d39f', always: true },
              { Icon:Navigation, label:isAr?'المسافة اليوم':'Distance aujourd\'hui', val: distanceToday != null ? Number(distanceToday).toFixed(1)+' km' : t(lang, 'noData'), color:'#d9ad62', always: true },
             { Icon:Wifi, label:isAr?'الإشارة':'Signal', val: signalStrength != null ? signalStrength + (Number(signalStrength) <= 5 ? '/5' : '%') : null, color:'#6fc8ff', always: false },
             { Icon:Battery, label:isAr?'البطارية':'Batterie', val: device.battery != null ? device.battery+'%' : null, color: device.battery < 30 ? '#e46b68' : '#38d39f', always: false },
          ].filter(m => m.always || m.val != null).map(({ Icon, label, val, color },i) => (
            <div key={i} className="flex min-w-0 flex-col items-center rounded-2xl p-3.5"
              style={cardStyle}>
              <Icon size={16} style={{ color }} className="mb-1.5"/>
               <span className="text-xs font-bold text-[#edf4f2]">{val}</span>
               <span className="text-[9px] mt-0.5 text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 px-5 mb-4 overflow-x-auto" style={{ scrollbarWidth:'none' }}>
        {tabs.map(({ key, Icon, ar, fr }) => (
          <motion.button key={key} whileTap={{ scale:0.94 }} onClick={() => setTab(key)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all"
               style={tab===key
               ? { background:'#38d39f', color:'#07111f' }
               : { background:'#0e2035', color:'#8da2b5', border:'1px solid rgba(255,255,255,.10)' }}>
            <Icon size={12}/>{isAr ? ar : fr}
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
              {saveMsg && (
                <div className={`text-xs text-center px-4 py-2 rounded-xl font-medium ${saveMsg.includes('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {saveMsg}
                </div>
              )}
               {coordinatesToast && (
                 <div role="status" className="fixed bottom-24 left-1/2 z-[1100] -translate-x-1/2 rounded-xl bg-[#102945] px-4 py-2 text-xs font-bold text-[#8ceac5] shadow-xl">
                   {isAr ? 'تم النسخ' : 'Coordonnées copiées'}
                 </div>
               )}
              <div className="rounded-2xl overflow-hidden" style={cardStyle}>
                {/* Edit header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{isAr ? 'معلومات الجهاز' : 'Appareil'}</span>
                  {!editing
                    ? <button onClick={openEdit} className="flex items-center gap-1 text-[11px] font-bold text-primary-500 hover:opacity-70 transition-opacity">
                        <Pencil size={11}/>{isAr ? 'تعديل' : 'Modifier'}
                      </button>
                    : <div className="flex items-center gap-2">
                        <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600"><CloseX size={14}/></button>
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
                      { label: isAr?'اللوحة':'Plaque', key:'plate', placeholder: isAr?'رقم اللوحة':'Numéro de plaque' },
                    ].map(field => (
                      <div key={field.key} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-xs text-slate-500 w-20 flex-shrink-0">{field.label}</span>
                        <input
                           className="flex-1 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/40"
                          value={editForm[field.key]}
                          onChange={e => setEditForm(f => ({ ...f, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Read-only rows */
                  [
                    { label: isAr?'الجهاز':'Appareil', val: device.name },
                    { label: isAr?'اللوحة':'Plaque', val: device.plate || '—' },
                    { label: isAr?'السائق':'Conducteur', val: device.driver || '—' },
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
                             onClick={() => { navigator.clipboard.writeText(row.copy).catch(()=>{}); setImeiCopied(true); setTimeout(()=>setImeiCopied(false),2000) }}
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
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    ['today', t(lang, 'today')],
                    ['week', t(lang, 'last7Days')],
                    ['fifteen', t(lang, 'last15Days')],
                    ['custom', t(lang, 'customRange')],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setRangePreset(key)}
                      className="rounded-xl px-3 py-2 text-[11px] font-bold transition"
                      style={rangePreset === key
                        ? { background: '#1DBF73', color: '#07111f' }
                        : { background: 'rgba(255,255,255,.07)', color: '#a9bac7', border: '1px solid rgba(255,255,255,.09)' }}
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
                      <ResponsiveContainer width="100%" height={132}>
                        <AreaChart data={speedData} margin={{ top: 4, right: 22, left: 0, bottom: 2 }}>
                          <defs>
                            <linearGradient id="device-speed-fill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#1DBF73" stopOpacity={0.42} />
                              <stop offset="100%" stopColor="#1DBF73" stopOpacity={0.03} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} stroke="rgba(255,255,255,.08)" strokeDasharray="3 4" />
                          <XAxis dataKey="xIndex" ticks={speedTicks} tickFormatter={value => speedData[value]?.time || ''} tick={{ fill: '#8da2b5', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                          <YAxis domain={[0, speedDomainMax]} tickFormatter={value => `${value}`} label={{ value: 'km/h', angle: -90, position: 'insideLeft', offset: 8, fill: '#8da2b5', fontSize: 9 }} tick={{ fill: '#8da2b5', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                          <Tooltip
                            labelFormatter={value => value}
                            formatter={value => [`${value} km/h`, isAr ? 'السرعة' : 'Vitesse']}
                            contentStyle={{ background: '#0a1220', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, color: '#edf4f2', fontSize: 11 }}
                            labelStyle={{ color: '#8da2b5', marginBottom: 4 }}
                          />
                          <Area type="monotone" dataKey="speed" stroke="#1DBF73" strokeWidth={2.5} fill="url(#device-speed-fill)" dot={false} activeDot={{ r: 4, fill: '#1DBF73', stroke: '#07111f', strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
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
            const cmdLabel = engineOn ? (isAr ? 'إيقاف المحرك' : 'Couper le moteur') : (isAr ? 'تشغيل المحرك' : 'Démarrer le moteur')
            const cmdDesc  = engineOn ? (isAr ? 'سيتم إيقاف محرك المركبة عن بعد' : 'Coupure moteur à distance') : (isAr ? 'سيتم تشغيل محرك المركبة عن بعد' : 'Démarrage moteur à distance')
            const cmdType  = engineOn ? 'engine_stop' : 'engine_start'
            return (
              <motion.div key="cmds" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} className="space-y-3">
                {cmdMsg && (
                  <div className={`text-xs text-center px-4 py-2.5 rounded-xl font-medium ${cmdMsg.includes('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    {cmdMsg}
                  </div>
                )}
                {/* Engine status indicator */}
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
                  style={{ background: (engineOn ? '#00D97E' : '#6b7280') + '14', border: '1px solid ' + (engineOn ? '#00D97E' : '#6b7280') + '30' }}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: engineOn ? '#00D97E' : '#6b7280' }}/>
                  <p className="text-sm font-bold" style={{ color: engineOn ? '#16866d' : '#6b7280' }}>
                    {isAr
                      ? (engineOn ? 'المحرك يعمل حالياً' : 'المحرك متوقف حالياً')
                      : (engineOn ? 'Moteur en marche' : 'Moteur à l\'arrêt')}
                  </p>
                  <p className="text-[10px] text-slate-400 mr-auto ml-auto">{isAr ? 'آخر تحديث:' : 'Mis à jour:'} {timeAgo(lastUpdate, lang)}</p>
                </div>
                {/* Single action button */}
                <motion.button whileTap={{ scale:0.97 }}
                  onClick={() => setConfirm({ type: cmdType, label: cmdLabel })}
                  disabled={sending}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl disabled:opacity-50 transition-all"
                  style={{ background: cmdColor+'18', border:'1.5px solid '+cmdColor+'44' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: cmdColor+'22' }}>
                    {sending
                      ? <Loader2 size={22} className="animate-spin" style={{ color: cmdColor }}/>
                      : <CmdIcon size={22} style={{ color: cmdColor }}/>}
                  </div>
                  <div className={isAr ? 'text-right' : 'text-left'}>
                    <p className="text-slate-800 font-bold text-sm">{cmdLabel}</p>
                    <p className="text-xs mt-0.5 text-slate-500">{cmdDesc}</p>
                  </div>
                </motion.button>
                <p className="text-[10px] text-slate-400 text-center px-4">
                  {isAr
                    ? 'حالة الزر تعكس الحالة الحقيقية للجهاز. لن تتغير إلا بعد تأكيد تنفيذ الأمر.'
                    : 'L\'état du bouton reflète l\'état réel de l\'appareil.'}
                </p>
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
          title={isAr ? 'تأكيد الأمر' : 'Confirmer la commande'}
          message={(isAr ? 'هل تريد تنفيذ: ' : 'Exécuter : ') + confirm.label + ' ?'}
          onConfirm={() => sendCommand(confirm.type)}
          onCancel={() => setConfirm(null)}
          lang={lang}
        />
      )}

      {replayTrip && (
        <Suspense fallback={<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#0B1220]"><div className="h-9 w-9 animate-spin rounded-full border-2 border-[#35d39a] border-t-transparent" /></div>}>
          <TripReplay
          deviceId={id}
          deviceName={device?.name}
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
