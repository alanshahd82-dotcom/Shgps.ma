import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, MapPinned, Activity, CarFront, CircleHelp,
  BarChart3, CalendarDays, RefreshCw, ShieldCheck
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import { VehicleIcon, getDeviceStatusKey, timeAgo } from '../../components/ui'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import SubscriptionBadge from '../../components/SubscriptionBadge'
import { getSubscriptionSnapshot, getSubscriptionPlan } from '../../utils/subscriptions'

const STATUS = {
  moving:  { ar: 'تتحرك', fr: 'En mouvement', color: '#16866d', soft: '#e8f5f0' },
  idle:    { ar: 'خاملة', fr: 'Au ralenti', color: '#b06b1b', soft: '#fff4e5' },
  stopped: { ar: 'متوقفة', fr: 'À l’arrêt', color: '#b64949', soft: '#fceded' },
  offline: { ar: 'غير متصلة', fr: 'Hors ligne', color: '#6b7785', soft: '#eef1f4' },
}

function Stat({ label, value, color, icon: Icon }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: color + '14' }}>
        <Icon size={16} style={{ color }} />
      </span>
      <span className="min-w-0">
        <strong className="block text-lg font-extrabold leading-none text-slate-900">{value}</strong>
        <span className="mt-1 block truncate text-[10px] font-semibold text-slate-500">{label}</span>
      </span>
    </div>
  )
}

function QuickLink({ icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-start shadow-sm transition-colors hover:border-accent/50 hover:shadow-md"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-slate-900">{title}</span>
        <span className="mt-0.5 block truncate text-[10px] text-slate-500">{description}</span>
      </span>
      <ChevronRight size={15} className="shrink-0 text-slate-300 rtl:rotate-180" />
    </button>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { devices, lang, clientAuth } = useApp()
  const isAr = lang === 'ar'

  const stats = useMemo(() => ({
    moving: devices.filter(d => getDeviceStatusKey(d) === 'moving').length,
    stopped: devices.filter(d => getDeviceStatusKey(d) === 'stopped').length,
    idle: devices.filter(d => getDeviceStatusKey(d) === 'idle').length,
    offline: devices.filter(d => getDeviceStatusKey(d) === 'offline').length,
  }), [devices])

  const subscriptionSummary = useMemo(() => {
    const snapshots = devices.map(device => ({ device, subscription: getSubscriptionSnapshot(device) }))
    const active = snapshots.filter(item => item.subscription.status === 'active').length
    const needsSetup = snapshots.filter(item => item.subscription.status === 'unassigned').length
    const attention = snapshots.filter(item => ['expired', 'expiring_soon'].includes(item.subscription.status)).length
    const nearest = snapshots
      .filter(item => item.subscription.endDate)
      .sort((a, b) => a.subscription.endDate.localeCompare(b.subscription.endDate))[0]
    const plans = [...new Set(snapshots
      .map(item => getSubscriptionPlan(item.subscription.planId)?.[isAr ? 'label' : 'labelFr'])
      .filter(Boolean))]
    return {
      active, needsSetup, attention, nearest, plans,
      accountPlan: clientAuth?.subscription || null,
      accountExpiry: clientAuth?.expiryDate ? String(clientAuth.expiryDate).slice(0, 10) : null,
    }
  }, [devices, isAr, clientAuth])

  const attentionDevice = devices.find(d => {
    const status = getSubscriptionSnapshot(d).status
    return status === 'expired' || status === 'expiring_soon' || status === 'unassigned'
  })

  return (
    <div className="client-app client-home-screen fixed inset-0 overflow-hidden bg-[#f5f7f8]" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader fixed showUser />

      <main
        className="client-home-scroll absolute inset-x-0 overflow-y-auto overscroll-contain px-5 py-5"
        style={{
          top: 'calc(4rem + env(safe-area-inset-top, 0px))',
          bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mx-auto max-w-xl space-y-5">

        <section className="rounded-2xl bg-primary-500 p-5 text-white shadow-lg shadow-primary-500/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white/65">{isAr ? 'الأسطول الآن' : 'Flotte maintenant'}</p>
              <p className="mt-2 text-3xl font-extrabold leading-none">{devices.length}</p>
              <p className="mt-1 text-xs text-white/65">{isAr ? 'مركبة مسجلة' : 'véhicules enregistrés'}</p>
            </div>
            <span className="rounded-xl bg-white/10 p-2.5">
              <CarFront size={22} />
            </span>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3">
            <span className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <span className="h-2 w-2 rounded-full bg-accent" />
              {stats.moving} {isAr ? 'في حركة الآن' : 'en mouvement'}
            </span>
            <button onClick={() => navigate('/client/map')} className="flex items-center gap-1 text-xs font-bold text-accent">
              {isAr ? 'فتح الخريطة' : 'Ouvrir la carte'}
              <ChevronRight size={14} className="rtl:rotate-180" />
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2.5">
          <Stat label={isAr ? 'تتحرك' : 'En mouvement'} value={stats.moving} color="#16866d" icon={Activity} />
          <Stat label={isAr ? 'متوقفة' : 'À l’arrêt'} value={stats.stopped} color="#b64949" icon={CarFront} />
          <Stat label={isAr ? 'خاملة' : 'Au ralenti'} value={stats.idle} color="#b06b1b" icon={Activity} />
          <Stat label={isAr ? 'غير متصلة' : 'Hors ligne'} value={stats.offline} color="#6b7785" icon={ShieldCheck} />
        </section>

        {attentionDevice && (
          <SubscriptionBanner
            device={attentionDevice}
            lang={lang}
            onRenew={() => navigate('/client/device/' + attentionDevice.id)}
          />
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-[#9a6a32]">
                <CalendarDays size={17} />
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">{isAr ? 'الاشتراك' : 'Abonnement'}</h2>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {devices.length ? `${subscriptionSummary.active}/${devices.length} ${isAr ? 'نشط' : 'actifs'}` : (isAr ? 'لا توجد أجهزة بعد' : 'Aucun appareil')}
                </p>
              </div>
            </div>
            <button onClick={() => navigate('/client/devices')} className="text-xs font-bold text-primary-500">
              {isAr ? 'التفاصيل' : 'Détails'}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {subscriptionSummary.plans.length > 0
              ? subscriptionSummary.plans.map(plan => <span key={plan} className="rounded-md bg-accent/15 px-2 py-1 text-[10px] font-bold text-[#8b622e]">{plan}</span>)
              : subscriptionSummary.accountPlan
                ? <span className="rounded-md bg-accent/15 px-2 py-1 text-[10px] font-bold text-[#8b622e]">{subscriptionSummary.accountPlan}</span>
                : <span className="text-xs text-slate-500">{isAr ? 'لم تحدد خطة بعد' : 'Forfait non défini'}</span>}
            {(subscriptionSummary.nearest?.subscription.endDate || subscriptionSummary.accountExpiry) && (
              <span className="ms-auto text-[10px] text-slate-500">
                {isAr ? 'ينتهي ' : 'Expire '}{subscriptionSummary.nearest?.subscription.endDate || subscriptionSummary.accountExpiry}
              </span>
            )}
          </div>
          {(subscriptionSummary.needsSetup > 0 || subscriptionSummary.attention > 0) && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-warning">
              <RefreshCw size={12} />
              {subscriptionSummary.attention > 0
                ? (isAr ? `${subscriptionSummary.attention} اشتراك يحتاج التجديد` : `${subscriptionSummary.attention} abonnement(s) à renouveler`)
                : (isAr ? `${subscriptionSummary.needsSetup} جهاز يحتاج تحديد خطة` : `${subscriptionSummary.needsSetup} appareil(s) à configurer`)}
            </p>
          )}
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">{isAr ? 'اختصارات' : 'Accès rapide'}</h2>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">ATHAR GPS</span>
          </div>
          <div className="grid gap-2">
            <QuickLink icon={MapPinned} title={isAr ? 'الخريطة المباشرة' : 'Carte en direct'} description={isAr ? 'تابع مواقع مركباتك الآن' : 'Suivez vos véhicules maintenant'} onClick={() => navigate('/client/map')} />
            <QuickLink icon={BarChart3} title={isAr ? 'التقارير' : 'Rapports'} description={isAr ? 'الرحلات والمسافات والسرعات' : 'Trajets, distances et vitesses'} onClick={() => navigate('/client/reports')} />
            <QuickLink icon={CircleHelp} title={isAr ? 'مركز المساعدة' : 'Centre d’aide'} description={isAr ? 'إجابات وطرق التواصل' : 'Réponses et contact support'} onClick={() => navigate('/client/help')} />
          </div>
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">{isAr ? 'الأجهزة الأخيرة' : 'Appareils récents'}</h2>
            <button onClick={() => navigate('/client/devices')} className="text-xs font-bold text-primary-500">{t(lang, 'viewAll')}</button>
          </div>
          <div className="space-y-2">
            {devices.slice(0, 3).map(device => {
              const status = STATUS[getDeviceStatusKey(device)] || STATUS.offline
              return (
                <button key={device.id} type="button" onClick={() => navigate('/client/device/' + device.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-start shadow-sm transition-colors hover:border-accent/50">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: status.soft }}>
                    <VehicleIcon type={device.type} iconSize={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-slate-900">{device.name}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-[10px]" style={{ color: status.color }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
                      {isAr ? status.ar : status.fr}
                      {device.lastUpdate && <span className="text-slate-400">· {timeAgo(device.lastUpdate)}</span>}
                    </span>
                    <span className="mt-1 block"><SubscriptionBadge device={device} lang={lang} /></span>
                  </span>
                  <span className="flex items-center gap-1 text-xs font-bold text-slate-700">
                    {device.speed > 0 ? Math.round(device.speed) : '—'}
                    {device.speed > 0 && <small className="font-normal text-slate-400">km/h</small>}
                    <ChevronRight size={14} className="ms-1 text-slate-300 rtl:rotate-180" />
                  </span>
                </button>
              )
            })}
            {!devices.length && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-xs text-slate-500">
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