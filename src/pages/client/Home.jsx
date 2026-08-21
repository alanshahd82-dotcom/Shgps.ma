import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bell, ChevronLeft, ChevronRight, CircleAlert, Map, Navigation, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import ClientHeader from '../../components/ClientHeader'
import ClientNav from '../../components/ClientNav'
import { StatusBadge, VehicleIcon, getDeviceStatusKey, timeAgo } from '../../components/ui'
import { useRealVehicles } from '../../design-system/hooks/useRealVehicles'
import { t } from '../../i18n/translations'
import promoSlide1 from '../../assets/promo/slide1.jpg'
import promoSlide2 from '../../assets/promo/slide2.jpg'
import promoSlide3 from '../../assets/promo/slide3.jpg'

const PROMO_SLIDES = [
  { image: promoSlide1, titleKey: 'homePromoLiveTitle', bodyKey: 'homePromoLiveBody' },
  { image: promoSlide2, titleKey: 'homePromoAlertTitle', bodyKey: 'homePromoAlertBody' },
  { image: promoSlide3, titleKey: 'homePromoTripTitle', bodyKey: 'homePromoTripBody' },
]

const STATUS_KEYS = ['moving', 'idle', 'stopped', 'offline', 'awaiting_gps', 'unknown']
const STATUS_COLORS = {
  moving: '#32c48d',
  idle: '#d7a458',
  stopped: '#d86f6f',
  offline: '#8091a4',
  awaiting_gps: '#d7a458',
  unknown: '#8091a4',
}

function fleetStatus(vehicle) {
  const key = getDeviceStatusKey(vehicle)
  return STATUS_KEYS.includes(key) ? key : 'unknown'
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])
  return reduced
}

function PromoCarousel({ lang }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStart = useRef(null)
  const isAr = lang === 'ar'

  useEffect(() => {
    if (paused) return undefined
    const timer = window.setInterval(() => setIndex(current => (current + 1) % PROMO_SLIDES.length), 5000)
    return () => window.clearInterval(timer)
  }, [paused])

  function onTouchStart(event) {
    touchStart.current = event.touches[0]?.clientX ?? null
    setPaused(true)
  }

  function onTouchEnd(event) {
    const start = touchStart.current
    const end = event.changedTouches[0]?.clientX
    touchStart.current = null
    setPaused(false)
    if (start == null || end == null || Math.abs(end - start) < 32) return
    setIndex(current => (current + (end < start ? 1 : -1) + PROMO_SLIDES.length) % PROMO_SLIDES.length)
  }

  return (
    <section
      className="ath-promo relative overflow-hidden rounded-[var(--ath-r)]"
      aria-label={t(lang, 'homePromoLabel')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex h-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)`, direction: 'ltr' }}>
        {PROMO_SLIDES.map(slide => (
          <article key={slide.titleKey} className="relative min-w-full">
            <img src={slide.image} alt="" className="h-full min-h-[154px] w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#061321] via-[#061321]/30 to-transparent" />
            <div className={`absolute inset-x-0 bottom-0 p-4 ${isAr ? 'text-right' : 'text-left'}`}>
              <h2 className="text-sm font-extrabold text-white">{t(lang, slide.titleKey)}</h2>
              <p className="mt-1 max-w-[88%] text-[11px] leading-5 text-white/75">{t(lang, slide.bodyKey)}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5" dir="ltr">
        {PROMO_SLIDES.map((slide, slideIndex) => (
          <button
            key={slide.titleKey}
            type="button"
            onClick={() => { setIndex(slideIndex); setPaused(true) }}
            className="h-1.5 rounded-full transition-all"
            style={{ width: index === slideIndex ? 20 : 6, background: index === slideIndex ? '#32c48d' : 'rgba(255,255,255,.55)' }}
            aria-label={`${t(lang, 'homePromoSlide')} ${slideIndex + 1}`}
            aria-current={index === slideIndex ? 'true' : undefined}
          />
        ))}
      </div>
    </section>
  )
}

function SectionHeading({ title, action, onAction }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 px-1">
      <h2 className="text-sm font-extrabold" style={{ color: 'var(--ath-txt)' }}>{title}</h2>
      {action && (
        <button type="button" onClick={onAction} className="text-[11px] font-extrabold" style={{ color: 'var(--ath-green2)' }}>
          {action}
        </button>
      )}
    </div>
  )
}

function FleetSummary({ vehicles, loading, error, lang }) {
  const isAr = lang === 'ar'
  if (loading) {
    return <div className="ath-card h-[150px] animate-pulse" aria-label={t(lang, 'loading')}><div className="h-4 w-28 rounded bg-white/10" /><div className="mt-6 h-12 w-20 rounded bg-white/10" /><div className="mt-5 h-2 rounded bg-white/10" /></div>
  }
  if (error) {
    return <div className="ath-card flex min-h-[150px] flex-col items-center justify-center text-center"><CircleAlert size={22} className="text-[#d86f6f]" /><p className="mt-2 text-sm font-bold">{t(lang, 'homeVehiclesError')}</p><p className="mt-1 text-[11px]" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'homeDataUnavailable')}</p></div>
  }
  if (!vehicles.length) {
    return <div className="ath-card flex min-h-[150px] flex-col items-center justify-center text-center"><ShieldCheck size={24} style={{ color: 'var(--ath-green2)' }} /><p className="mt-2 text-sm font-bold">{t(lang, 'homeEmptyFleet')}</p><p className="mt-1 text-[11px]" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'homeEmptyFleetBody')}</p></div>
  }

  const counts = STATUS_KEYS.reduce((result, key) => {
    result[key] = vehicles.filter(vehicle => fleetStatus(vehicle) === key).length
    return result
  }, {})
  const segments = STATUS_KEYS.filter(key => counts[key] > 0)
  return (
    <div className="ath-card" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'homeFleetNow')}</p>
          <p className="mt-1 text-4xl font-black leading-none ath-num">{vehicles.length}</p>
          <p className="mt-1 text-[10px] font-semibold" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'homeVehiclesRegistered')}</p>
        </div>
        <div className="rounded-2xl border px-3 py-2 text-end" style={{ borderColor: 'rgba(50,196,141,.24)', background: 'rgba(50,196,141,.07)' }}>
          <p className="text-[10px] font-bold" style={{ color: 'var(--ath-green2)' }}>{t(lang, 'homeLiveStatus')}</p>
          <p className="mt-1 text-xs font-extrabold">{counts.moving > 0 ? t(lang, 'homeMovingNow') : t(lang, 'homeNoMovement')}</p>
        </div>
      </div>
      <div className="mt-5 flex h-2 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,.07)' }}>
        {segments.map(key => <span key={key} style={{ width: `${(counts[key] / vehicles.length) * 100}%`, background: STATUS_COLORS[key] }} />)}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
        {segments.map(key => <span key={key} className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: 'var(--ath-mut)' }}><i className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[key] }} />{t(lang, `status_${key}`)} {counts[key]}</span>)}
      </div>
    </div>
  )
}

function VehiclePreview({ vehicle, lang, onOpen }) {
  const status = getDeviceStatusKey(vehicle)
  return (
    <button type="button" onClick={onOpen} className="ath-card flex w-full items-center gap-3 text-start transition-transform active:scale-[.99]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <VehicleIcon type={vehicle.type} iconSize={23} className="h-14 w-14 rounded-2xl" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold">{vehicle.name}</span>
        <span className="mt-1 block truncate text-[10px] font-semibold" style={{ color: 'var(--ath-mut)' }}>{vehicle.plate || t(lang, 'plateUnavailable')}</span>
        <span className="mt-2 block"><StatusBadge status={status} lang={lang} /></span>
      </span>
      <span className="shrink-0" style={{ color: 'var(--ath-mut)' }}>{lang === 'ar' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}</span>
    </button>
  )
}

function RecentAlert({ alert, vehicle, lang, onOpen }) {
  if (!alert) return <div className="ath-card flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: 'var(--ath-green2)', background: 'rgba(50,196,141,.10)' }}><ShieldCheck size={18} /></span><div><p className="text-xs font-extrabold">{t(lang, 'homeNoRecentAlerts')}</p><p className="mt-1 text-[10px]" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'homeNoRecentAlertsBody')}</p></div></div>
  const alertTime = alert.time ?? alert.created_at ?? alert.createdAt ?? alert.eventTime
  return (
    <button type="button" onClick={onOpen} className="ath-card flex w-full items-start gap-3 text-start">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: '#d7a458', background: 'rgba(215,164,88,.12)' }}><AlertTriangle size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-extrabold">{alert.title || t(lang, 'homeRecentAlert')}</span>
        <span className="mt-1 block truncate text-[10px]" style={{ color: 'var(--ath-mut)' }}>{vehicle?.name || t(lang, 'vehicleUnavailable')}</span>
        <span className="mt-1 block text-[10px]" style={{ color: 'var(--ath-mut)' }}>{alertTime ? timeAgo(alertTime, lang) : t(lang, 'dataUnavailable')}</span>
      </span>
      <Navigation size={16} style={{ color: 'var(--ath-mut)' }} />
    </button>
  )
}

function validMapCoordinate(value, min, max) {
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max
}

export default function Home() {
  const navigate = useNavigate()
  const { lang, clientAuth, alertsList } = useApp()
  const { vehicles, loading, error } = useRealVehicles()
  const reducedMotion = useReducedMotion()
  const isAr = lang === 'ar'
  const latestAlert = useMemo(() => {
    if (!Array.isArray(alertsList) || !alertsList.length) return null
    return [...alertsList].sort((a, b) => new Date(b.time ?? b.created_at ?? b.createdAt ?? 0) - new Date(a.time ?? a.created_at ?? a.createdAt ?? 0))[0]
  }, [alertsList])
  const alertVehicle = useMemo(() => {
    const id = latestAlert?.deviceId ?? latestAlert?.vehicleId ?? latestAlert?.device_id
    return vehicles.find(vehicle => String(vehicle.id) === String(id))
  }, [latestAlert, vehicles])
  const displayVehicles = vehicles.slice(0, 3)
  const userName = clientAuth?.name || clientAuth?.fullName || clientAuth?.email?.split('@')[0] || t(lang, 'homeDriver')
  const openAlert = () => {
    if (!latestAlert) return
    const lat = Number(latestAlert.latitude ?? latestAlert.lat)
    const lng = Number(latestAlert.longitude ?? latestAlert.lng)
    if (validMapCoordinate(lat, -90, 90) && validMapCoordinate(lng, -180, 180) && !(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)) {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
      if (alertVehicle?.id != null) params.set('device', String(alertVehicle.id))
      if (latestAlert.id != null) params.set('alert', String(latestAlert.id))
      navigate(`/client/map?${params.toString()}`)
    }
    else navigate('/client/alerts')
  }

  return (
    <div className="client-app client-home-screen fixed inset-0 overflow-hidden" dir={isAr ? 'rtl' : 'ltr'} style={{ background: 'var(--ath-bg)' }}>
      <ClientHeader fixed showUser />
      <main className="absolute inset-x-0 overflow-y-auto px-4 py-4 sm:px-5" style={{ top: 'calc(4rem + env(safe-area-inset-top, 0px))', bottom: 'calc(5.6rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className={`mx-auto max-w-xl space-y-4 ${reducedMotion ? '' : 'page-enter'}`}>
          <header className="pt-1">
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'welcome')}</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">{userName}</h1>
            <p className="mt-1 text-xs font-medium" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'homeOwnershipLine')}</p>
          </header>
          <PromoCarousel lang={lang} />
          <FleetSummary vehicles={vehicles} loading={loading} error={error} lang={lang} />
          <section>
            <SectionHeading title={t(lang, 'homeMyVehicles')} action={t(lang, 'viewAll')} onAction={() => navigate('/client/vehicles')} />
            {displayVehicles.length ? <div className="space-y-2">{displayVehicles.map(vehicle => <VehiclePreview key={vehicle.id} vehicle={vehicle} lang={lang} onOpen={() => navigate(`/client/vehicle/${vehicle.id}`)} />)}</div> : <div className="ath-card text-center text-xs" style={{ color: 'var(--ath-mut)' }}>{t(lang, 'homeVehiclesWillAppear')}</div>}
          </section>
          <section>
            <SectionHeading title={t(lang, 'homeRecentAlertTitle')} action={t(lang, 'viewAll')} onAction={() => navigate('/client/alerts')} />
            <RecentAlert alert={latestAlert} vehicle={alertVehicle} lang={lang} onOpen={openAlert} />
          </section>
          <section>
            <SectionHeading title={t(lang, 'homeShortcuts')} />
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => navigate('/client/map')} className="ath-card flex min-h-[78px] flex-col items-center justify-center gap-2 p-2 text-center"><Map size={19} style={{ color: 'var(--ath-green2)' }} /><span className="text-[10px] font-extrabold">{t(lang, 'liveMap')}</span></button>
              <button type="button" onClick={() => navigate('/client/trips')} className="ath-card flex min-h-[78px] flex-col items-center justify-center gap-2 p-2 text-center"><Navigation size={19} style={{ color: 'var(--ath-gold)' }} /><span className="text-[10px] font-extrabold">{t(lang, 'trips')}</span></button>
              <button type="button" onClick={() => navigate('/client/alerts')} className="ath-card flex min-h-[78px] flex-col items-center justify-center gap-2 p-2 text-center"><Bell size={19} style={{ color: '#8cb4d8' }} /><span className="text-[10px] font-extrabold">{t(lang, 'alerts')}</span></button>
            </div>
          </section>
        </div>
      </main>
      <ClientNav />
    </div>
  )
}