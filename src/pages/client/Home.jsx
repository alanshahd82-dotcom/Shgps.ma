import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity, CalendarDays, ChevronRight, CirclePause, CircleStop, WifiOff
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import { getDeviceStatusKey } from '../../components/ui'
import { getSubscriptionSnapshot, getSubscriptionPlan } from '../../utils/subscriptions'
import promoSlide1 from '../../assets/promo/slide1.png'
import promoSlide2 from '../../assets/promo/slide2.png'
import promoSlide3 from '../../assets/promo/slide3.png'

const STATUS = {
  moving:  { ar: 'تتحرك', fr: 'En mouvement', color: '#00D97E' },
  idle:    { ar: 'خاملة', fr: 'Au ralenti', color: '#FFB020' },
  stopped: { ar: 'متوقفة', fr: 'À l’arrêt', color: '#FF5A5F' },
  offline: { ar: 'غير متصلة', fr: 'Hors ligne', color: '#8CA3B8' },
}

function CountUp({ value, animate }) {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : value)

  useEffect(() => {
    if (!animate) {
      setDisplayValue(value)
      return undefined
    }

    let frame
    const startedAt = performance.now()
    const tick = now => {
      const progress = Math.min(1, (now - startedAt) / 700)
      setDisplayValue(Math.round(value * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animate, value])

  return <span className="ath-num">{displayValue}</span>
}

function Stat({ label, value, color, icon: Icon, animate }) {
  return (
    <div
      className="ath-card flex min-h-0 items-center gap-2.5 p-3"
      style={{ background: `linear-gradient(135deg, ${color}13, var(--ath-card2) 76%)` }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${color}1c`, color }}
      >
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <strong className="block text-lg font-black leading-none" style={{ color: 'var(--ath-txt)' }}>
          <CountUp value={value} animate={animate} />
        </strong>
        <span className="mt-1 block truncate text-[9px] font-bold" style={{ color: 'var(--ath-mut)' }}>{label}</span>
      </span>
    </div>
  )
}

const PROMO_SLIDES = [
  {
    image: promoSlide1,
    fallback: '🛰️',
    title: { ar: 'تتبّع لحظي دقيق', fr: 'Suivi en temps réel précis' },
    body: { ar: 'شاهد مركباتك على الخريطة في الوقت الفعلي', fr: 'Visualisez vos véhicules sur la carte en temps réel' },
  },
  {
    image: promoSlide2,
    fallback: '🛡️',
    title: { ar: 'تنبيهات ذكية', fr: 'Alertes intelligentes' },
    body: { ar: 'إشعارات فورية عند تجاوز السرعة أو الخروج عن المسار', fr: 'Notifications instantanées en cas d’excès de vitesse ou de sortie de route' },
  },
  {
    image: promoSlide3,
    fallback: '📊',
    title: { ar: 'تقارير احترافية', fr: 'Rapports professionnels' },
    body: { ar: 'إحصائيات الرحلات وسلوك السائقين بنقرة واحدة', fr: 'Statistiques des trajets et du comportement des conducteurs en un clic' },
  },
]

function PromoCarousel({ lang, reducedMotion, sectionStyle }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [failedImages, setFailedImages] = useState({})
  const touchStartX = useRef(null)
  const isAr = lang === 'ar'

  useEffect(() => {
    if (reducedMotion || paused) return undefined
    const timer = window.setInterval(() => {
      setActiveIndex(index => (index + 1) % PROMO_SLIDES.length)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [paused, reducedMotion])

  function goTo(index) {
    setActiveIndex((index + PROMO_SLIDES.length) % PROMO_SLIDES.length)
  }

  function handleTouchStart(event) {
    touchStartX.current = event.touches[0]?.clientX ?? null
    setPaused(true)
  }

  function handleTouchEnd(event) {
    const startX = touchStartX.current
    const endX = event.changedTouches[0]?.clientX
    touchStartX.current = null
    setPaused(false)
    if (startX == null || endX == null || Math.abs(endX - startX) < 35) return
    goTo(activeIndex + (endX < startX ? 1 : -1))
  }

  function handleTouchCancel() {
    touchStartX.current = null
    setPaused(false)
  }

  return (
    <section
      className="ath-promo relative min-h-0 flex-1 overflow-hidden rounded-[var(--ath-r)]"
      style={sectionStyle(180)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      aria-label={isAr ? 'مزايا Athar GPS' : 'Fonctionnalités Athar GPS'}
    >
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)`, direction: 'ltr' }}
      >
        {PROMO_SLIDES.map((slide, index) => (
          <div key={slide.title.ar} className="relative h-full min-w-full overflow-hidden">
            {failedImages[index] ? (
              <div className="flex h-full w-full items-center justify-center bg-[#10253b] text-5xl" aria-hidden="true">
                {slide.fallback}
              </div>
            ) : (
              <img
                src={slide.image}
                alt=""
                className="h-full w-full object-cover object-center"
                onError={() => setFailedImages(current => ({ ...current, [index]: true }))}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#030914]/90 via-[#061222]/25 to-transparent" />
            <div className={`absolute inset-x-0 bottom-0 p-4 ${isAr ? 'text-right' : 'text-left'}`}>
              <p className="text-sm font-black text-white drop-shadow-md">{isAr ? slide.title.ar : slide.title.fr}</p>
              <p className="mt-1 max-w-[85%] text-[10px] font-semibold leading-4 text-white/80">{isAr ? slide.body.ar : slide.body.fr}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5" dir="ltr">
        {PROMO_SLIDES.map((slide, index) => (
          <button
            key={slide.title.ar}
            type="button"
            onClick={() => { goTo(index); setPaused(true) }}
            className="h-1.5 rounded-full transition-all"
            style={{ width: index === activeIndex ? 18 : 6, background: index === activeIndex ? '#00D97E' : 'rgba(255,255,255,.55)' }}
            aria-label={isAr ? `الشريحة ${index + 1}` : `Diapositive ${index + 1}`}
            aria-current={index === activeIndex ? 'true' : undefined}
          />
        ))}
      </div>
    </section>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { devices, lang, clientAuth } = useApp()
  const isAr = lang === 'ar'
  const [reducedMotion, setReducedMotion] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches)
    updateMotionPreference()
    mediaQuery.addEventListener?.('change', updateMotionPreference)
    return () => mediaQuery.removeEventListener?.('change', updateMotionPreference)
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      setMounted(true)
      return undefined
    }
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [reducedMotion])

  const stats = useMemo(() => ({
    moving: devices.filter(d => getDeviceStatusKey(d) === 'moving').length,
    stopped: devices.filter(d => getDeviceStatusKey(d) === 'stopped').length,
    idle: devices.filter(d => getDeviceStatusKey(d) === 'idle').length,
    offline: devices.filter(d => getDeviceStatusKey(d) === 'offline').length,
  }), [devices])

  const movingDevice = useMemo(
    () => devices.find(device => getDeviceStatusKey(device) === 'moving'),
    [devices],
  )

  const subscriptionSummary = useMemo(() => {
    const snapshots = devices.map(device => ({ device, subscription: getSubscriptionSnapshot(device) }))
    const active = snapshots.filter(item => item.subscription.status === 'active').length
    const nearest = snapshots
      .filter(item => item.subscription.endDate)
      .sort((a, b) => a.subscription.endDate.localeCompare(b.subscription.endDate))[0]
    const plan = getSubscriptionPlan(nearest?.subscription.planId)
      || snapshots.map(item => getSubscriptionPlan(item.subscription.planId)).find(Boolean)
    return {
      active,
      nearest,
      plan,
      accountExpiry: clientAuth?.expiryDate ? String(clientAuth.expiryDate).slice(0, 10) : null,
    }
  }, [devices, clientAuth])

  const totalDevices = devices.length
  const activePercent = totalDevices
    ? Math.min(100, Math.round((subscriptionSummary.active / totalDevices) * 100))
    : 0
  const movingPercent = totalDevices ? (stats.moving / totalDevices) * 100 : 0
  const stoppedPercent = totalDevices ? (stats.stopped / totalDevices) * 100 : 0
  const idlePercent = totalDevices ? (stats.idle / totalDevices) * 100 : 0
  const donut = totalDevices
    ? `conic-gradient(${STATUS.moving.color} 0 ${movingPercent}%, ${STATUS.stopped.color} ${movingPercent}% ${movingPercent + stoppedPercent}%, ${STATUS.idle.color} ${movingPercent + stoppedPercent}% ${movingPercent + stoppedPercent + idlePercent}%, ${STATUS.offline.color} ${movingPercent + stoppedPercent + idlePercent}% 100%)`
    : 'conic-gradient(rgba(140,163,184,.3) 0 100%)'
  const movingSpeed = movingDevice
    ? Math.round(Number(movingDevice.speed ?? movingDevice.last_speed ?? 0))
    : 0
  const sectionStyle = delay => reducedMotion
    ? undefined
    : { animation: 'ath-fadeUp .45s cubic-bezier(.22,1,.36,1) both', animationDelay: `${delay}ms` }

  return (
    <div
      className="client-app client-home-screen fixed inset-0 overflow-hidden"
      style={{ background: 'var(--ath-bg)' }}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <ClientHeader fixed showUser />

      <main
        className="absolute inset-x-0 overflow-hidden px-4 py-3 sm:px-5 sm:py-4"
        style={{
          top: 'calc(4rem + env(safe-area-inset-top, 0px))',
          bottom: 'calc(5.6rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mx-auto flex h-full min-h-0 max-w-xl flex-col gap-2.5">
          <section className="ath-card relative min-h-0 shrink-0 overflow-hidden p-3.5 sm:p-5" style={{ ...sectionStyle(0), color: 'var(--ath-txt)' }}>
            <div
              className="pointer-events-none absolute -end-16 -top-24 h-52 w-52 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(0,217,126,.22), transparent 68%)' }}
            />
            <div className="relative flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold" style={{ color: 'var(--ath-mut)' }}>{isAr ? 'الأسطول الآن' : 'Flotte maintenant'}</p>
                <p className="ath-num mt-1.5 text-4xl font-black leading-none">
                  <CountUp value={totalDevices} animate={!reducedMotion} />
                </p>
                <p className="mt-1.5 text-[10px] font-semibold" style={{ color: 'var(--ath-mut)' }}>{isAr ? 'مركبات مسجّلة' : 'véhicules enregistrés'}</p>
              </div>

              <div
                className="relative flex h-[5.2rem] w-[5.2rem] shrink-0 items-center justify-center rounded-full p-2"
                style={{
                  background: donut,
                  transform: `rotate(${mounted ? 360 : 0}deg)`,
                  transition: reducedMotion ? 'none' : 'transform .8s cubic-bezier(.22,1,.36,1)',
                }}
                aria-label={isAr ? 'توزيع حالة الأسطول' : 'Répartition de la flotte'}
              >
                <div className="flex h-full w-full items-center justify-center rounded-full" style={{ background: 'var(--ath-card)' }}>
                  <div className="text-center" style={{ transform: `rotate(${mounted ? -360 : 0}deg)`, transition: reducedMotion ? 'none' : 'transform .8s cubic-bezier(.22,1,.36,1)' }}>
                    <strong className="ath-num block text-xl font-black leading-none">{totalDevices}</strong>
                    <span className="mt-0.5 block text-[8px] font-bold" style={{ color: 'var(--ath-mut)' }}>{isAr ? 'الإجمالي' : 'Total'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--ath-line)] pt-2.5">
              <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold" style={{ color: 'var(--ath-txt)' }}>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${movingDevice ? 'live-dot' : ''}`} style={{ background: movingDevice ? STATUS.moving.color : STATUS.offline.color }} />
                <span className="truncate">
                  {movingDevice
                    ? `${movingDevice.name} ${isAr ? 'تتحرك الآن' : 'en mouvement'} · ${movingSpeed} ${isAr ? 'كم/س' : 'km/h'}`
                    : (isAr ? 'لا توجد مركبة تتحرك الآن' : 'Aucun véhicule en mouvement')}
                </span>
              </span>
              <button onClick={() => navigate('/client/map')} className="flex shrink-0 items-center gap-0.5 text-[10px] font-black" style={{ color: 'var(--ath-green2)' }}>
                {isAr ? 'فتح الخريطة' : 'Ouvrir la carte'}
                <ChevronRight size={13} className="rtl:rotate-180" />
              </button>
            </div>
          </section>

          <section className="grid min-h-0 shrink-0 grid-cols-2 gap-2" style={sectionStyle(60)}>
            <Stat label={isAr ? 'تتحرك' : 'En mouvement'} value={stats.moving} color={STATUS.moving.color} icon={Activity} animate={!reducedMotion} />
            <Stat label={isAr ? 'متوقفة' : 'À l’arrêt'} value={stats.stopped} color={STATUS.stopped.color} icon={CircleStop} animate={!reducedMotion} />
            <Stat label={isAr ? 'خاملة' : 'Au ralenti'} value={stats.idle} color={STATUS.idle.color} icon={CirclePause} animate={!reducedMotion} />
            <Stat label={isAr ? 'غير متصلة' : 'Hors ligne'} value={stats.offline} color={STATUS.offline.color} icon={WifiOff} animate={!reducedMotion} />
          </section>

          <button
            type="button"
            onClick={() => navigate('/subscriptions')}
            className="ath-card group min-h-0 shrink-0 p-3.5 text-start transition-all hover:-translate-y-0.5 hover:border-[rgba(224,179,111,.4)] sm:p-5"
            style={{ ...sectionStyle(120), color: 'var(--ath-txt)' }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(224,179,111,.14)', color: 'var(--ath-gold)' }}>
                  <CalendarDays size={17} />
                </span>
                <span className="min-w-0">
                  <strong className="block text-sm font-black">{isAr ? 'الاشتراكات' : 'Abonnements'}</strong>
                  <span className="mt-0.5 block text-[9px] font-semibold" style={{ color: 'var(--ath-mut)' }}>
                    {totalDevices ? `${subscriptionSummary.active}/${totalDevices} ${isAr ? 'نشطة' : 'actifs'}` : (isAr ? 'لا توجد أجهزة بعد' : 'Aucun appareil')}
                  </span>
                </span>
              </div>
              <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-black" style={{ color: 'var(--ath-gold)' }}>
                {isAr ? 'التفاصيل' : 'Détails'}
                <ChevronRight size={14} className="rtl:rotate-180" />
              </span>
            </div>

            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(224,179,111,.13)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${mounted ? activePercent : 0}%`,
                  background: 'linear-gradient(90deg, var(--ath-gold), #F0CF8D)',
                  transition: reducedMotion ? 'none' : 'width .8s cubic-bezier(.22,1,.36,1)',
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[9px] font-semibold" style={{ color: 'var(--ath-mut)' }}>
              <span className="truncate">
                {subscriptionSummary.nearest?.subscription.endDate || subscriptionSummary.accountExpiry
                  ? `${isAr ? 'ينتهي أقرب اشتراك' : 'Prochaine expiration'}: ${subscriptionSummary.nearest?.subscription.endDate || subscriptionSummary.accountExpiry}`
                  : (isAr ? 'تاريخ الانتهاء غير محدد' : 'Date d’expiration non définie')}
              </span>
              {subscriptionSummary.plan && (
                <span className="shrink-0 rounded-full px-2 py-0.5 font-black" style={{ background: 'rgba(224,179,111,.15)', color: 'var(--ath-gold)' }}>
                  {isAr ? subscriptionSummary.plan.label : subscriptionSummary.plan.labelFr}
                </span>
              )}
            </div>
          </button>

          <PromoCarousel lang={lang} reducedMotion={reducedMotion} sectionStyle={sectionStyle} />
        </div>
      </main>

      <ClientNav />
    </div>
  )
}