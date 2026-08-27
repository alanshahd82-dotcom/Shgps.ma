import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, ChevronLeft, ChevronRight, Mail,
  RefreshCw, Smartphone, X
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import { VehicleIcon } from '../../components/ui'
import {
  SUBSCRIPTION_PLANS,
  addMonths,
  getSubscriptionPlan,
  getSubscriptionSnapshot,
} from '../../utils/subscriptions'
import { api } from '../../api/index.js'

const DAY_MS = 24 * 60 * 60 * 1000

function dateOnly(value) {
  if (!value) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const isoDate = trimmed.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
    if (isoDate) return isoDate
  }
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function formatDate(value, lang) {
  const date = dateOnly(value)
  if (!date) return '—'
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00.000Z`))
  } catch {
    return date
  }
}

function daysRemaining(endDate) {
  if (!endDate) return null
  const today = new Date()
  const todayOnly = new Date(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  return Math.round((end.getTime() - todayOnly.getTime()) / DAY_MS)
}

function RenewalActions({ device, lang, contacts, onClose }) {
  const { clientAuth } = useApp()
  const isAr = lang === 'ar'
  const snapshot = getSubscriptionSnapshot(device || {})
  const defaultPlanId = snapshot.planId && getSubscriptionPlan(snapshot.planId)
    ? snapshot.planId
    : SUBSCRIPTION_PLANS[0].id
  const [planId, setPlanId] = useState(defaultPlanId)
  const plate = device?.plate || device?.licensePlate || device?.license_plate || '—'
  const endDate = dateOnly(snapshot.endDate)
  const today = dateOnly(new Date()) || '1970-01-01'
  const renewalStartDate = endDate && endDate >= today ? endDate : today
  const selectedPlan = getSubscriptionPlan(planId) || SUBSCRIPTION_PLANS[0]
  const projectedEndDate = addMonths(
    renewalStartDate,
    Number(selectedPlan?.durationMonths) || 3,
  )
  const clientName = clientAuth?.name || '—'
  const email = clientAuth?.email || '—'
  const message = isAr
    ? `مرحباً، أرغب في تجديد اشتراك جهازي على منصة Athar GPS:\n• الجهاز: ${device?.name || '—'} (${plate})\n• العميل: ${clientName} (${email})\n• انتهاء الاشتراك الحالي: ${endDate || 'غير محدد'}\n• الخطة المطلوبة: ${selectedPlan.label} — ${selectedPlan.price} MAD\n• تاريخ الانتهاء بعد التجديد: ${projectedEndDate}\nشكراً لكم.`
    : `Bonjour, je souhaite renouveler l’abonnement de mon appareil sur la plateforme Athar GPS :\n• Appareil : ${device?.name || '—'} (${plate})\n• Client : ${clientName} (${email})\n• Expiration actuelle : ${endDate || 'non définie'}\n• Forfait souhaité : ${selectedPlan.labelFr} — ${selectedPlan.price} MAD\n• Nouvelle date d’expiration : ${projectedEndDate}\nMerci.`
  const whatsappNumber = String(contacts?.renew_whatsapp_phone || '').replace(/\D/g, '')
  const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` : ''
  const subject = isAr ? `تجديد اشتراك Athar GPS — ${device?.name || 'جهاز'}` : `Renouvellement Athar GPS — ${device?.name || 'appareil'}`
  const renewalEmail = String(contacts?.renew_email || '').trim()
  const mailtoUrl = renewalEmail
    ? `mailto:${renewalEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
    : ''

  return (
    <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
         <span className="text-[10px] font-bold text-orange-600">
          {isAr ? 'اختر طريقة التواصل' : 'Choisissez un moyen de contact'}
        </span>
         <button type="button" onClick={onClose} aria-label={isAr ? 'إغلاق' : 'Fermer'} className="text-slate-500">
          <X size={14} />
        </button>
      </div>
      <div className="mb-3">
         <p className="mb-2 text-[10px] font-bold text-slate-600">
          {isAr ? 'اختر مدة التجديد' : 'Choisissez la durée du renouvellement'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {SUBSCRIPTION_PLANS.map(plan => {
            const selected = plan.id === selectedPlan.id
            return (
              <button
                key={plan.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setPlanId(plan.id)}
                 className={`rounded-xl border px-2 py-2 text-center transition ${selected ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-600'}`}
                style={{
                   color: undefined,
                }}
              >
                <span className="block text-[10px] font-black">{isAr ? plan.label : plan.labelFr}</span>
                <span className="mt-0.5 block text-[9px] font-semibold opacity-70">{plan.price} MAD</span>
              </button>
            )
          })}
        </div>
         <p className="mt-2 text-[10px] font-semibold text-slate-600">
          {isAr
            ? `تاريخ الانتهاء المتوقع بعد التجديد: ${formatDate(projectedEndDate, lang)}`
            : `Nouvelle date d’expiration prévue : ${formatDate(projectedEndDate, lang)}`}
        </p>
      </div>
      {!whatsappUrl && !mailtoUrl && (
         <p className="rounded-xl bg-orange-50 px-3 py-2 text-[10px] font-semibold leading-5 text-orange-600">
          {isAr ? 'بيانات التجديد غير متاحة حالياً. يرجى التواصل مع الإدارة.' : 'Les coordonnées de renouvellement ne sont pas disponibles. Contactez l’administration.'}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <a
          href={whatsappUrl}
          aria-disabled={!whatsappUrl}
          onClick={event => { if (!whatsappUrl) event.preventDefault() }}
          target="_blank"
          rel="noreferrer"
           className="flex items-center justify-center gap-1.5 rounded-xl bg-green-600 px-2 py-2 text-[10px] font-black text-white"
           style={{ opacity: whatsappUrl ? 1 : .45, pointerEvents: whatsappUrl ? 'auto' : 'none' }}
        >
          <Smartphone size={14} />
          WhatsApp
        </a>
        <a
          href={mailtoUrl}
          aria-disabled={!mailtoUrl}
          onClick={event => { if (!mailtoUrl) event.preventDefault() }}
           className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[10px] font-black text-slate-700"
           style={{ opacity: mailtoUrl ? 1 : .45, pointerEvents: mailtoUrl ? 'auto' : 'none' }}
        >
          <Mail size={14} />
          Email
        </a>
      </div>
    </div>
  )
}

function SubscriptionCard({ device, lang, contacts, renewOpen, onRenew }) {
  if (!device) return null
  const isAr = lang === 'ar'
  const snapshot = getSubscriptionSnapshot(device)
  const remaining = snapshot.status === 'expired' ? daysRemaining(snapshot.endDate) : snapshot.daysRemaining
  const status = snapshot.status === 'expired'
    ? { label: isAr ? 'منتهٍ' : 'Expiré', color: '#FF5A5F', bg: 'rgba(255,90,95,.12)' }
    : snapshot.status === 'expiring_soon'
      ? { label: isAr ? 'ينتهي قريباً' : 'Expire bientôt', color: '#FFB020', bg: 'rgba(255,176,32,.12)' }
      : { label: isAr ? 'نشط' : 'Actif', color: '#1d4ed8', bg: 'rgba(29, 78, 216,.12)' }
  const plate = device.plate || device.licensePlate || device.license_plate
  const remainingLabel = snapshot.status === 'expired'
    ? (isAr ? 'منتهية' : 'Expiré')
    : snapshot.status === 'unassigned'
      ? (isAr ? 'غير محدد' : 'Non défini')
    : (isAr ? `${remaining} يوم متبقّي` : `${remaining} jours restants`)

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm text-slate-900">
      <div className="flex items-start gap-3">
        <VehicleIcon type={device.type} iconSize={19} className="!h-11 !w-11 !rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
             <h2 className="min-w-0 truncate text-sm font-black text-slate-900">{device.name || (isAr ? 'جهاز بدون اسم' : 'Appareil sans nom')}</h2>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black" style={{ background: status.bg, color: status.color }}>
              {status.label}
            </span>
          </div>
           <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold text-slate-500">
            <span>{isAr ? 'اللوحة' : 'Plaque'}:</span>
             <span dir="ltr" className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-700">{plate || '—'}</span>
          </div>
        </div>
        <span className="shrink-0 text-end">
          <strong className="ath-num block text-lg font-black" style={{ color: status.color }}>{remainingLabel}</strong>
        </span>
      </div>

       <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 text-[10px]">
        <div>
           <span className="flex items-center gap-1 font-semibold text-slate-500"><CalendarDays size={12} />{isAr ? 'تاريخ البدء' : 'Début'}</span>
          <strong className="mt-1 block font-bold">{formatDate(snapshot.startDate, lang)}</strong>
        </div>
        <div>
           <span className="flex items-center gap-1 font-semibold text-slate-500"><CalendarDays size={12} />{isAr ? 'تاريخ الانتهاء' : 'Fin'}</span>
          <strong className="mt-1 block font-bold">{formatDate(snapshot.endDate, lang)}</strong>
        </div>
      </div>

      <button
        type="button"
        onClick={onRenew}
         className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
      >
        <RefreshCw size={14} />
        {isAr ? 'تجديد' : 'Renouveler'}
      </button>
      {renewOpen && <RenewalActions device={device} lang={lang} contacts={contacts} onClose={onRenew} />}
    </article>
  )
}

export default function Subscriptions() {
  const navigate = useNavigate()
  const { devices, lang } = useApp()
  const isAr = lang === 'ar'
  const safeDevices = Array.isArray(devices) ? devices : []
  const [renewingId, setRenewingId] = useState(null)
  const [renewalContacts, setRenewalContacts] = useState(null)
  const subscribedDevices = useMemo(
    () => safeDevices.filter(device => {
      if (!device) return false
      const snapshot = getSubscriptionSnapshot(device)
      return Boolean(snapshot.planId || snapshot.startDate || snapshot.endDate)
    }),
    [safeDevices],
  )

  useEffect(() => {
    let active = true
    api.settings.renewalContacts()
      .then(data => { if (active) setRenewalContacts(data) })
      .catch(() => { if (active) setRenewalContacts({}) })
    return () => { active = false }
  }, [])

  return (
    <div className="client-app min-h-screen bg-[#F5F6F8] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />
      <main className="mx-auto max-w-xl px-4 py-4 sm:px-5">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={isAr ? 'رجوع' : 'Retour'}
             className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
          >
            {isAr ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}
          </button>
          <div>
             <h1 className="text-xl font-black text-slate-900">{isAr ? 'الاشتراكات' : 'Abonnements'}</h1>
             <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
              {isAr ? 'إدارة اشتراكات أجهزتك' : 'Gérez les abonnements de vos appareils'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {subscribedDevices.map(device => (
            <SubscriptionCard
              key={device.id}
              device={device}
              lang={lang}
              contacts={renewalContacts}
              renewOpen={renewingId === device.id}
              onRenew={() => setRenewingId(current => current === device.id ? null : device.id)}
            />
          ))}
          {!subscribedDevices.length && (
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col items-center justify-center px-5 py-14 text-center">
               <CalendarDays size={30} className="text-indigo-600" />
               <h2 className="mt-3 text-sm font-black text-slate-900">{isAr ? 'لا توجد اشتراكات' : 'Aucun abonnement'}</h2>
               <p className="mt-1 text-xs font-semibold text-slate-500">
                {isAr ? 'ستظهر اشتراكات أجهزتك هنا عند تفعيلها.' : 'Les abonnements de vos appareils apparaîtront ici.'}
              </p>
            </div>
          )}
        </div>
      </main>
      <ClientNav />
    </div>
  )
}