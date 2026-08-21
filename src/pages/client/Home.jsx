import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Gauge,
  ShieldCheck,
} from 'lucide-react'
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
  {
    image: promoSlide1,
    titleKey: 'homePromoLiveTitle',
    bodyKey: 'homePromoLiveBody',
    actionKey: 'vehicles',
    route: '/client/vehicles',
  },
  {
    image: promoSlide2,
    titleKey: 'homePromoAlertTitle',
    bodyKey: 'homePromoAlertBody',
    actionKey: 'alerts',
    route: '/client/alerts',
  },
  {
    image: promoSlide3,
    titleKey: 'homePromoTripTitle',
    bodyKey: 'homePromoTripBody',
    actionKey: 'trips',
    route: '/client/trips',
  },
]

const STATUS_KEYS = ['moving', 'idle', 'stopped', 'offline', 'awaiting_gps', 'unknown']
const STATUS_COLORS = {
  moving: '#38d39f',
  idle: '#d7a458',
  stopped: '#e47a78',
  offline: '#8296aa',
  awaiting_gps: '#d7a458',
  unknown: '#8296aa',
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

function validCoordinate(value, min, max) {
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max
}

function alertDate(alert) {
  return alert?.time ?? alert?.created_at ?? alert?.createdAt ?? alert?.eventTime
}

function FleetPulse({ vehicles, loading, error, lang }) {
  if (loading) {
    return (
      <section className="phase18-pulse phase18-skeleton" aria-label={t(lang, 'loading')}>
        <span className="h-3 w-24 rounded-full" />
        <span className="mt-4 h-8 w-16 rounded-lg" />
        <span className="mt-5 h-2 w-full rounded-full" />
      </section>
    )
  }

  if (error) {
    return (
      <section className="phase18-state" role="status">
        <CircleAlert size={22} />
        <div>
          <strong>{t(lang, 'homeVehiclesError')}</strong>
          <span>{t(lang, 'homeDataUnavailable')}</span>
        </div>
      </section>
    )
  }

  if (!vehicles.length) {
    return (
      <section className="phase18-state" role="status">
        <ShieldCheck size={22} />
        <div>
          <strong>{t(lang, 'homeEmptyFleet')}</strong>
          <span>{t(lang, 'homeEmptyFleetBody')}</span>
        </div>
      </section>
    )
  }

  const counts = STATUS_KEYS.reduce((result, key) => {
    result[key] = vehicles.filter(vehicle => getDeviceStatusKey(vehicle) === key).length
    return result
  }, {})
  const segments = STATUS_KEYS.filter(key => counts[key] > 0)

  return (
    <section className="phase18-pulse" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="phase18-pulse-top">
        <div>
          <span className="phase18-eyebrow">{t(lang, 'homeFleetNow')}</span>
          <strong>{vehicles.length}</strong>
          <small>{t(lang, 'homeVehiclesRegistered')}</small>
        </div>
        <div className="phase18-live-indicator">
          <i />
          <span>{t(lang, 'homeLiveStatus')}</span>
        </div>
      </div>
      <div className="phase18-pulse-bar" aria-hidden="true">
        {segments.map(key => (
          <span key={key} style={{ width: `${(counts[key] / vehicles.length) * 100}%`, background: STATUS_COLORS[key] }} />
        ))}
      </div>
      <div className="phase18-pulse-legend">
        {segments.map(key => (
          <span key={key}><i style={{ background: STATUS_COLORS[key] }} />{t(lang, `status_${key}`)} <b>{counts[key]}</b></span>
        ))}
      </div>
    </section>
  )
}

function PromoCarousel({ lang, reducedMotion, onNavigate }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStart = useRef(null)
  const isAr = lang === 'ar'
  const slide = PROMO_SLIDES[index]

  useEffect(() => {
    if (paused || reducedMotion) return undefined
    const timer = window.setInterval(() => setIndex(current => (current + 1) % PROMO_SLIDES.length), 5200)
    return () => window.clearInterval(timer)
  }, [paused, reducedMotion])

  const changeSlide = nextIndex => {
    setIndex((nextIndex + PROMO_SLIDES.length) % PROMO_SLIDES.length)
    setPaused(true)
  }

  return (
    <section
      className="phase18-hero"
      aria-label={t(lang, 'homePromoLabel')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={event => {
        touchStart.current = event.touches[0]?.clientX ?? null
        setPaused(true)
      }}
      onTouchEnd={event => {
        const start = touchStart.current
        const end = event.changedTouches[0]?.clientX
        touchStart.current = null
        if (start == null || end == null || Math.abs(end - start) < 32) return
        changeSlide(index + (end < start ? 1 : -1))
      }}
    >
      <div className="phase18-hero-image" key={slide.image}>
        <img src={slide.image} alt="" />
      </div>
      <div className="phase18-hero-shade" />
      <div className={`phase18-hero-copy ${isAr ? 'text-right' : 'text-left'}`}>
        <span className="phase18-hero-kicker">ATHAR GPS · {String(index + 1).padStart(2, '0')}</span>
        <h2>{t(lang, slide.titleKey)}</h2>
        <p>{t(lang, slide.bodyKey)}</p>
        <button type="button" onClick={() => onNavigate(slide.route)} className="phase18-hero-action">
          {t(lang, 'homeHeroAction')}
          {isAr ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      <div className="phase18-hero-controls" dir="ltr">
        <button type="button" onClick={() => changeSlide(index - 1)} aria-label={isAr ? 'الشريحة السابقة' : 'Previous slide'}><ChevronLeft size={16} /></button>
        <div>
          {PROMO_SLIDES.map((item, slideIndex) => (
            <button key={item.titleKey} type="button" onClick={() => changeSlide(slideIndex)} aria-label={`${t(lang, 'homePromoSlide')} ${slideIndex + 1}`} aria-current={index === slideIndex ? 'true' : undefined}>
              <i className={index === slideIndex ? 'is-active' : ''} />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => changeSlide(index + 1)} aria-label={isAr ? 'الشريحة التالية' : 'Next slide'}><ChevronRight size={16} /></button>
      </div>
    </section>
  )
}

function VehicleRail({ vehicles, lang, onOpen, onViewAll }) {
  return (
    <section className="phase18-section">
      <div className="phase18-section-heading">
        <div>
          <span className="phase18-eyebrow">{t(lang, 'homeFleetNow')}</span>
          <h2>{t(lang, 'homeMyVehicles')}</h2>
        </div>
        <button type="button" onClick={onViewAll}>{t(lang, 'viewAll')}</button>
      </div>
      {vehicles.length ? (
        <div className="phase18-vehicle-rail" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          {vehicles.slice(0, 6).map(vehicle => {
            const status = getDeviceStatusKey(vehicle)
            const speed = Number(vehicle.speed)
            const hasSpeed = Number.isFinite(speed)
            return (
              <button type="button" key={vehicle.id} onClick={() => onOpen(vehicle.id)} className="phase18-vehicle-card" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <span className="phase18-vehicle-photo">
                  <VehicleIcon type={vehicle.type} iconSize={40} className="h-24 w-full rounded-none" />
                  <i className={`phase18-status-dot phase18-status-dot--${status}`} />
                </span>
                <span className="phase18-vehicle-copy">
                  <strong>{vehicle.name}</strong>
                  <small>{vehicle.plate || t(lang, 'plateUnavailable')}</small>
                  <span><StatusBadge status={status} lang={lang} /></span>
                </span>
                <span className="phase18-speed">
                  <Gauge size={13} />
                  <b>{hasSpeed ? Math.round(speed) : '—'}</b>
                  <small>{t(lang, 'kmh')}</small>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="phase18-empty">{t(lang, 'homeVehiclesWillAppear')}</div>
      )}
    </section>
  )
}

function RecentAlert({ alert, vehicle, lang, onOpen }) {
  if (!alert) {
    return (
      <section className="phase18-alert phase18-alert-empty">
        <span><ShieldCheck size={19} /></span>
        <div><strong>{t(lang, 'homeNoRecentAlerts')}</strong><small>{t(lang, 'homeNoRecentAlertsBody')}</small></div>
      </section>
    )
  }

  return (
    <button type="button" onClick={onOpen} className="phase18-alert" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <span className="phase18-alert-icon"><AlertTriangle size={19} /></span>
      <span className="phase18-alert-copy">
        <strong>{alert.title || alert.message || t(lang, 'homeRecentAlert')}</strong>
        <small>{vehicle?.name || alert.deviceName || t(lang, 'vehicleUnavailable')} · {alertDate(alert) ? timeAgo(alertDate(alert), lang) : t(lang, 'dataUnavailable')}</small>
      </span>
      {lang === 'ar' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { lang, clientAuth, alertsList } = useApp()
  const { vehicles, loading, error } = useRealVehicles()
  const reducedMotion = useReducedMotion()
  const isAr = lang === 'ar'
  const latestAlert = useMemo(() => {
    if (!Array.isArray(alertsList) || !alertsList.length) return null
    return [...alertsList].sort((a, b) => new Date(alertDate(b) || 0) - new Date(alertDate(a) || 0))[0]
  }, [alertsList])
  const alertVehicle = useMemo(() => {
    const id = latestAlert?.deviceId ?? latestAlert?.vehicleId ?? latestAlert?.device_id
    return vehicles.find(vehicle => String(vehicle.id) === String(id))
  }, [latestAlert, vehicles])
  const displayName = clientAuth?.name || clientAuth?.fullName || clientAuth?.email?.split('@')[0] || t(lang, 'homeDriver')

  function openAlert() {
    if (!latestAlert) return
    const lat = Number(latestAlert.latitude ?? latestAlert.lat)
    const lng = Number(latestAlert.longitude ?? latestAlert.lng)
    if (validCoordinate(lat, -90, 90) && validCoordinate(lng, -180, 180) && !(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)) {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
      if (alertVehicle?.id != null) params.set('device', String(alertVehicle.id))
      if (latestAlert.id != null) params.set('alert', String(latestAlert.id))
      navigate(`/client/map?${params.toString()}`)
      return
    }
    navigate('/client/alerts')
  }

  return (
    <div className="client-app client-home-screen phase18-home fixed inset-0 overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader fixed showUser />
      <main className="phase18-home-scroll absolute inset-x-0 overflow-y-auto" style={{ top: 'calc(4rem + env(safe-area-inset-top, 0px))', bottom: 'calc(5.6rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className={`phase18-container ${reducedMotion ? '' : 'page-enter'}`}>
          <header className="phase18-welcome">
            <div>
              <span className="phase18-eyebrow">{t(lang, 'welcome')}</span>
              <h1>{displayName}</h1>
              <p>{t(lang, 'homeOwnershipLine')}</p>
            </div>
            <button type="button" onClick={() => navigate('/client/alerts')} className="phase18-notification-link" aria-label={t(lang, 'alerts')}>
              <Bell size={18} />
            </button>
          </header>

          <PromoCarousel lang={lang} reducedMotion={reducedMotion} onNavigate={navigate} />
          <FleetPulse vehicles={vehicles} loading={loading} error={error} lang={lang} />
          <VehicleRail vehicles={vehicles} lang={lang} onOpen={id => navigate(`/client/vehicle/${id}`)} onViewAll={() => navigate('/client/vehicles')} />

          <section className="phase18-section">
            <div className="phase18-section-heading">
              <div>
                <span className="phase18-eyebrow">{t(lang, 'alerts')}</span>
                <h2>{t(lang, 'homeRecentAlertTitle')}</h2>
              </div>
              <button type="button" onClick={() => navigate('/client/alerts')}>{t(lang, 'viewAll')}</button>
            </div>
            <RecentAlert alert={latestAlert} vehicle={alertVehicle} lang={lang} onOpen={openAlert} />
          </section>

        </div>
      </main>
      <ClientNav />
    </div>
  )
}