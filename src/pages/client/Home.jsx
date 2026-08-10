import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity, BarChart3, Bell, CalendarDays, ChevronRight,
  CirclePause, CircleStop, Gauge, MapPinned, ShieldCheck, WifiOff
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import { VehicleIcon, getDeviceStatusKey, timeAgo } from '../../components/ui'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import { getSubscriptionSnapshot, getSubscriptionPlan } from '../../utils/subscriptions'

const STATUS = {
  moving:  { ar: 'تتحرك', fr: 'En mouvement', color: '#00D97E', soft: 'rgba(0,217,126,.12)' },
  idle:    { ar: 'خاملة', fr: 'Au ralenti', color: '#FFB020', soft: 'rgba(255,176,32,.12)' },
  stopped: { ar: 'متوقفة', fr: 'À l’arrêt', color: '#FF5A5F', soft: 'rgba(255,90,95,.12)' },
  offline: { ar: 'غير متصلة', fr: 'Hors ligne', color: '#8CA3B8', soft: 'rgba(140,163,184,.12)' },
}

const DAY_MS = 24 * 60 * 60 * 1000

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
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(value * eased))
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
      className="ath-card flex min-w-0 items-center gap-3 p-3.5"
      style={{ background: `linear-gradient(135deg, ${color}12, var(--ath-card2) 72%)` }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: color + '1c', color }}
      >
        <Icon size={18} strokeWidth={2.1} />
      </span>
      <span className="min-w-0">
        <strong className="ath-num block text-xl font-black leading-none" style={{ color: 'var(--ath-txt)' }}>
          <CountUp value={value} animate={animate} />
        </strong>
        <span className="mt-1.5 block truncate text-[10px] font-bold" style={{ color: 'var(--ath-mut)' }}>{label}</span>
      </span>
    </div>
  )
}

function QuickLink({ icon: Icon, title, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-[var(--ath-rb)] border border-[var(--ath-line)] bg-[var(--ath-card2)] px-1.5 py-3 text-center transition-all hover:-translate-y-0.5 hover:border-[rgba(0,217,126,.42)] active:scale-95"
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors group-hover:bg-[rgba(0,217,126,.18)]"
        style={{ background: 'rgba(0,217,126,.11)', color: 'var(--ath-green2)' }}
      >
        <Icon size={17} strokeWidth={2} />
      </span>
      <span className="block truncate text-[10px] font-bold" style={{ color: 'var(--ath-txt)' }}>{title}</span>
    </button>
  )
}

function daysUntil(date) {
  if (!date) return null
  const today = new Date()
  const target = new Date(`${date}T00:00:00.000Z`)
  const start = new Date(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`)
  return Math.max(0, Math.round((target.getTime() - start.getTime()) / DAY_MS) + 1)
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
    const needsSetup = snapshots.filter(item => item.subscription.status === 'unassigned').length
    const attention = snapshots.filter(item => ['expired', 'expiring_soon'].includes(item.subscription.status)).length
    const nearest = snapshots
      .filter(item => item.subscription.endDate)
      .sort((a, b) => a.subscription.endDate.localeCompare(b.subscription.endDate))[0]
    const plan = getSubscriptionPlan(nearest?.subscription.planId)
      || snapshots.map(item => getSubscriptionPlan(item.subscription.planId)).find(Boolean)
      || null
    const accountExpiry = clientAuth?.expiryDate ? String(clientAuth.expiryDate).slice(0, 10) : null
    return {
      active,
      needsSetup,
      attention,
      nearest,
      plan,
      accountPlan: clientAuth?.subscription || null,
      accountExpiry,
      daysRemaining: nearest?.subscription.daysRemaining ?? daysUntil(accountExpiry),
    }
  }, [devices, isAr, clientAuth])

  const attentionDevice = devices.find(device => {
    const status = getSubscriptionSnapshot(device).status
    return status === 'expired' || status === 'expiring_soon' || status === 'unassigned'
  })

  const totalDevices = devices.length
  const activePercent = totalDevices ? Math.round((subscriptionSummary.active / totalDevices) * 100) : 0
  const movingPercent = totalDevices ? (stats.moving / totalDevices) * 100 : 0
  const stoppedPercent = totalDevices ? (stats.stopped / totalDevices) * 100 : 0
  const idlePercent = totalDevices ? (stats.idle / totalDevices) * 100 : 0
  const donut = totalDevices
    ? `conic-gradient(${STATUS.moving.color} 0 ${movingPercent}%, ${STATUS.stopped.color} ${movingPercent}% ${movingPercent + stoppedPercent}%, ${STATUS.idle.color} ${movingPercent + stoppedPercent}% ${movingPercent + stoppedPercent + idlePercent}%, ${STATUS.offline.color} ${movingPercent + stoppedPercent + idlePercent}% 100%)`
    : 'conic-gradient(rgba(140,163,184,.3) 0 100%)'
  const sectionMotion = delay => reducedMotion
    ? undefined
    : { animation: 'ath-fadeUp .55s cubic-bezier(.22,1,.36,1) both', animationDelay: `${delay}ms` }
  const movingSpeed = movingDevice ? Math.round(Number(movingDevice.speed ?? movingDevice.last_speed ?? 0)) : 0

  return (
    <div className="client-app client-home-screen fixed inset-0 overflow-hidden" style={{ background: 'var(--ath-bg)' }} dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader fixed showUser />

      <main
        className="client-home-scroll absolute inset-x-0 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5"
        style={{
          top: 'calc(4rem + env(safe-area-inset-top, 0px))',
          bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mx-auto max-w-xl space-y-4">
          <section className="ath-card relative overflow-hidden p-5" style={{ ...sectionMotion(0), color: 'var(--ath-txt)' }}>
            <div className="pointer-events-none absolute -end-20 -top-28 h-64 w-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,217,126,.22), transparent 66%)' }} />
            <div className="pointer-events-none absolute -end-6 -top-12 h-40 w-40 rounded-full border border-[rgba(0,217,126,.14)]" />
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold" style={{ color: 'var(--ath-mut)' }}>{isAr ? 'الأسطول الآن' : 'Flotte maintenant'}</p>
                <p className="ath-num mt-2 text-5xl font-black leading-none tracking-tight">
                  <CountUp value={totalDevices} animate={!reducedMotion} />
                </p>
                <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--ath-mut)' }}>{isAr ? 'مركبات مسجّلة' : 'véhicules enregistrés'}</p>
              </div>

              <div
                className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full p-2"
                style={{
                  background: donut,
                  transform: `rotate(${mounted ? 360 : 0}deg)`,
                  transition: reducedMotion ? 'none' : 'transform .85s cubic-bezier(.22,1,.36,1)',
                }}
                aria-label={isAr ? 'توزيع حالة الأسطول' : 'Répartition de la flotte'}
              >
                <div className="flex h-full w-full items-center justify-center rounded-full" style={{ background: 'var(--ath-card)' }}>
                  <div className="text-center" style={{ transform: `rotate(${mounted ? -360 : 0}deg)`, transition: reducedMotion ? 'none' : 'transform .85s cubic-bezier(.22,1,.36,1)' }}>
                    <strong className="ath-num block text-2xl font-black leading-none">{totalDevices}</strong>
                    <span className="mt-1 block text-[9px] font-bold" style={{ color: 'var(--ath-mut)' }}>{isAr ? 'الإجمالي' : 'Total'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-[var(--ath-line)] pt-3">
              <span className="flex min-w-0 items-center gap-2 text-xs font-bold" style={{ color: 'var(--ath-txt)' }}>
                <span className={`h-2 w-2 shrink-0 rounded-full ${movingDevice ? 'live-dot' : ''}`} style={{ background: movingDevice ? STATUS.moving.color : STATUS.offline.color }} />
                <span className="truncate">
                  {movingDevice
                    ? `${movingDevice.name} ${isAr ? 'تتحرك الآن' : 'en mouvement'} · ${movingSpeed} ${isAr ? 'كم/س' : 'km/h'}`
                    : (isAr ? 'لا توجد مركبة تتحرك الآن' : 'Aucun véhicule en mouvement')}
                </span>
              </span>
              <button onClick={() => navigate('/client/map')} className="flex shrink-0 items-center gap-1 text-xs font-black" style={{ color: 'var(--ath-green2)' }}>
                {isAr ? 'فتح الخريطة' : 'Ouvrir la carte'}
                <ChevronRight size={14} className="rtl:rotate-180" />
              </button>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3" style={sectionMotion(70)}>
            <Stat label={isAr ? 'تتحرك' : 'En mouvement'} value={stats.moving} color={STATUS.moving.color} icon={Activity} animate={!reducedMotion} />
            <Stat label={isAr ? 'متوقفة' : 'À l’arrêt'} value={stats.stopped} color={STATUS.stopped.color} icon={CircleStop} animate={!reducedMotion} />
            <Stat label={isAr ? 'خاملة' : 'Au ralenti'} value={stats.idle} color={STATUS.idle.color} icon={CirclePause} animate={!reducedMotion} />
            <Stat label={isAr ? 'غير متصلة' : 'Hors ligne'} value={stats.offline} color={STATUS.offline.color} icon={WifiOff} animate={!reducedMotion} />
          </section>

          {attentionDevice && (
            <SubscriptionBanner
              device={attentionDevice}
              lang={lang}
              onRenew={() => navigate('/client/device/' + attentionDevice.id)}
            />
          )}

          <section className="ath-card p-4" style={{ ...sectionMotion(140), color: 'var(--ath-txt)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(224,179,111,.14)', color: 'var(--ath-gold)' }}>
                  <CalendarDays size={19} />
                </span>
                <div>
                  <h2 className="text-sm font-black">{isAr ? 'الاشتراك' : 'Abonnement'}</h2>
                  <p className="mt-1 text-[10px] font-semibold" style={{ color: 'var(--ath-mut)' }}>
                    {totalDevices
                      ? `${subscriptionSummary.active}/${totalDevices} ${isAr ? 'أجهزة نشطة' : 'appareils actifs'}`
                      : (isAr ? 'لا توجد أجهزة بعد' : 'Aucun appareil')}
                  </p>
                </div>
              </div>
              {(subscriptionSummary.plan || subscriptionSummary.accountPlan) && (
                <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: 'rgba(224,179,111,.16)', color: 'var(--ath-gold)' }}>
                  {subscriptionSummary.plan
                    ? (isAr ? subscriptionSummary.plan.label : subscriptionSummary.plan.labelFr)
                    : subscriptionSummary.accountPlan}
                </span>
              )}
            </div>

            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full" style={{ background: 'rgba(224,179,111,.13)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${mounted ? activePercent : 0}%`,
                    background: 'linear-gradient(90deg, var(--ath-gold), #F0CF8D)',
                    transition: reducedMotion ? 'none' : 'width .8s cubic-bezier(.22,1,.36,1)',
                  }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-semibold" style={{ color: 'var(--ath-mut)' }}>
                <span>
                  {subscriptionSummary.nearest?.subscription.endDate || subscriptionSummary.accountExpiry
                    ? `${isAr ? 'ينتهي' : 'Expire'} ${subscriptionSummary.nearest?.subscription.endDate || subscriptionSummary.accountExpiry}`
                    : (isAr ? 'تاريخ الانتهاء غير محدد' : 'Date d’expiration non définie')}
                </span>
                {subscriptionSummary.daysRemaining !== null && subscriptionSummary.daysRemaining !== undefined && (
                  <span className="text-end">{isAr ? `≈ ${subscriptionSummary.daysRemaining} يوم متبقّي` : `≈ ${subscriptionSummary.daysRemaining} j restants`}</span>
                )}
              </div>
            </div>

            {(subscriptionSummary.needsSetup > 0 || subscriptionSummary.attention > 0) && (
              <button onClick={() => navigate('/client/devices')} className="mt-3 flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--ath-amber)' }}>
                <ShieldCheck size={13} />
                {subscriptionSummary.attention > 0
                  ? (isAr ? `${subscriptionSummary.attention} اشتراك يحتاج التجديد` : `${subscriptionSummary.attention} abonnement(s) à renouveler`)
                  : (isAr ? `${subscriptionSummary.needsSetup} جهاز يحتاج تحديد خطة` : `${subscriptionSummary.needsSetup} appareil(s) à configurer`)}
              </button>
            )}
          </section>

          <section style={{ ...sectionMotion(210) }}>
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-sm font-black" style={{ color: 'var(--ath-txt)' }}>{isAr ? 'اختصارات' : 'Accès rapide'}</h2>
              <span className="text-[9px] font-black uppercase tracking-[.18em]" style={{ color: 'var(--ath-mut)' }}>ATHAR GPS</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <QuickLink icon={MapPinned} title={isAr ? 'الخريطة' : 'Carte'} onClick={() => navigate('/client/map')} />
              <QuickLink icon={BarChart3} title={isAr ? 'التقارير' : 'Rapports'} onClick={() => navigate('/client/reports')} />
              <QuickLink icon={Bell} title={isAr ? 'التنبيهات' : 'Alertes'} onClick={() => navigate('/client/alerts')} />
              <QuickLink icon={Gauge} title={isAr ? 'سلوك السائق' : 'Conducteur'} onClick={() => navigate('/client/driver-behavior')} />
            </div>
          </section>

          <section style={{ ...sectionMotion(280) }}>
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-sm font-black" style={{ color: 'var(--ath-txt)' }}>{isAr ? 'الأجهزة الأخيرة' : 'Appareils récents'}</h2>
              <button onClick={() => navigate('/client/devices')} className="flex items-center gap-0.5 text-xs font-black" style={{ color: 'var(--ath-green2)' }}>
                {t(lang, 'viewAll')}
                <ChevronRight size={14} className="rtl:rotate-180" />
              </button>
            </div>

            <div className="space-y-2.5">
              {devices.slice(0, 3).map(device => {
                const deviceStatus = getDeviceStatusKey(device)
                const status = STATUS[deviceStatus] || STATUS.offline
                const speed = Math.round(Number(device.speed ?? device.last_speed ?? 0))
                const plate = device.plate || device.licensePlate || device.license_plate
                return (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => navigate('/client/device/' + device.id)}
                    className="relative flex w-full items-center gap-3 overflow-hidden rounded-[var(--ath-r)] border border-[var(--ath-line)] bg-[var(--ath-card)] p-3.5 text-start transition-all hover:-translate-y-0.5 hover:border-[rgba(0,217,126,.38)]"
                  >
                    <span className="absolute inset-y-0 start-0 w-1" style={{ background: status.color }} />
                    <VehicleIcon type={device.type} iconSize={19} className="!h-11 !w-11 !rounded-xl" />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="block truncate text-xs font-black" style={{ color: 'var(--ath-txt)' }}>{device.name}</span>
                        {plate && <span dir="ltr" className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold" style={{ background: 'rgba(140,163,184,.12)', color: 'var(--ath-mut)' }}>{plate}</span>}
                      </span>
                      <span className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold" style={{ color: status.color }}>
                        <span className={`h-1.5 w-1.5 rounded-full ${deviceStatus === 'moving' ? 'live-dot' : ''}`} style={{ background: status.color }} />
                        {isAr ? status.ar : status.fr}
                        {device.lastUpdate && <span className="font-medium" style={{ color: 'var(--ath-mut)' }}>· {timeAgo(device.lastUpdate, lang)}</span>}
                      </span>
                    </span>
                    {deviceStatus === 'moving' && (
                      <span dir="ltr" className="shrink-0 text-end">
                        <strong className="ath-num block text-xl font-black leading-none" style={{ color: 'var(--ath-green2)' }}>{speed}</strong>
                        <small className="mt-1 block text-[9px] font-bold" style={{ color: 'var(--ath-mut)' }}>km/h</small>
                      </span>
                    )}
                    <ChevronRight size={15} className="shrink-0 text-[var(--ath-mut)] rtl:rotate-180" />
                  </button>
                )
              })}
              {!devices.length && (
                <div className="rounded-[var(--ath-r)] border border-dashed border-[var(--ath-line)] px-4 py-9 text-center text-xs font-semibold" style={{ color: 'var(--ath-mut)' }}>
                  {isAr ? 'لا توجد أجهزة مرتبطة بحسابك' : 'Aucun appareil lié à votre compte'}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
      <ClientNav />
    </div>
  )
}