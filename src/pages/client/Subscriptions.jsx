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
import { getSubscriptionSnapshot } from '../../utils/subscriptions'
import { api } from '../../api/index.js'

const DAY_MS = 24 * 60 * 60 * 1000

function dateOnly(value) {
  if (!value) return null
  return String(value).slice(0, 10)
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
  const plate = device.plate || device.licensePlate || device.license_plate || '—'
  const endDate = dateOnly(getSubscriptionSnapshot(device).endDate)
  const clientName = clientAuth?.name || '—'
  const email = clientAuth?.email || '—'
  const message = isAr
    ? `مرحباً، أرغب في تجديد اشتراك جهازي على منصة Athar GPS:\n• الجهاز: ${device.name || '—'} (${plate})\n• العميل: ${clientName} (${email})\n• انتهاء الاشتراك: ${endDate || 'غير محدد'}\n• مدة التجديد المطلوبة: 6 أشهر\nشكراً لكم.`
    : `Bonjour, je souhaite renouveler l’abonnement de mon appareil sur la plateforme Athar GPS :\n• Appareil : ${device.name || '—'} (${plate})\n• Client : ${clientName} (${email})\n• Expiration : ${endDate || 'non définie'}\n• Durée souhaitée : 6 mois\nMerci.`
  const whatsappNumber = String(contacts?.renew_whatsapp_phone || '').replace(/\D/g, '')
  const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` : ''
  const subject = isAr ? `تجديد اشتراك Athar GPS — ${device.name || 'جهاز'}` : `Renouvellement Athar GPS — ${device.name || 'appareil'}`
  const mailtoUrl = contacts?.renew_email
    ? `mailto:${contacts.renew_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
    : ''

  return (
    <div className="mt-3 rounded-xl border border-[rgba(224,179,111,.18)] p-3" style={{ background: 'rgba(224,179,111,.06)' }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold" style={{ color: 'var(--ath-gold)' }}>
          {isAr ? 'اختر طريقة التواصل' : 'Choisissez un moyen de contact'}
        </span>
        <button type="button" onClick={onClose} aria-label={isAr ? 'إغلاق' : 'Fermer'} style={{ color: 'var(--ath-mut)' }}>
          <X size={14} />
        </button>
      </div>
      {!whatsappUrl && !mailtoUrl && (
        <p className="rounded-lg bg-[rgba(255,176,32,.10)] px-3 py-2 text-[10px] font-semibold leading-5" style={{ color: 'var(--ath-amber)' }}>
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
          className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-black"
          style={{ background: '#25D366', color: '#052b15', opacity: whatsappUrl ? 1 : .45, pointerEvents: whatsappUrl ? 'auto' : 'none' }}
        >
          <Smartphone size={14} />
          WhatsApp
        </a>
        <a
          href={mailtoUrl}
          aria-disabled={!mailtoUrl}
          onClick={event => { if (!mailtoUrl) event.preventDefault() }}
          className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-black"
          style={{ background: 'rgba(140,163,184,.16)', color: 'var(--ath-txt)', opacity: mailtoUrl ? 1 : .45, pointerEvents: mailtoUrl ? 'auto' : 'none' }}
        >
          <Mail size={14} />
          Email
        </a>
      </div>
    </div>
  )
}

function SubscriptionCard({ device, lang, contacts, renewOpen, onRenew }) {
  const isAr = lang === 'ar'
  const snapshot = getSubscriptionSnapshot(device)
  const remaining = snapshot.status === 'expired' ? daysRemaining(snapshot.endDate) : snapshot.daysRemaining
  const status = snapshot.status === 'expired'
    ? { label: isAr ? 'منتهٍ' : 'Expiré', color: '#FF5A5F', bg: 'rgba(255,90,95,.12)' }
    : snapshot.status === 'expiring_soon'
      ? { label: isAr ? 'ينتهي قريباً' : 'Expire bientôt', color: '#FFB020', bg: 'rgba(255,176,32,.12)' }
      : { label: isAr ? 'نشط' : 'Actif', color: '#00D97E', bg: 'rgba(0,217,126,.12)' }
  const plate = device.plate || device.licensePlate || device.license_plate
  const remainingLabel = snapshot.status === 'expired'
    ? (isAr ? 'منتهية' : 'Expiré')
    : snapshot.status === 'unassigned'
      ? (isAr ? 'غير محدد' : 'Non défini')
    : (isAr ? `${remaining} يوم متبقّي` : `${remaining} jours restants`)

  return (
    <article className="ath-card p-3.5" style={{ color: 'var(--ath-txt)' }}>
      <div className="flex items-start gap-3">
        <VehicleIcon type={device.type} iconSize={19} className="!h-11 !w-11 !rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-black">{device.name || (isAr ? 'جهاز بدون اسم' : 'Appareil sans nom')}</h2>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black" style={{ background: status.bg, color: status.color }}>
              {status.label}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold" style={{ color: 'var(--ath-mut)' }}>
            <span>{isAr ? 'اللوحة' : 'Plaque'}:</span>
            <span dir="ltr" className="rounded-md px-1.5 py-0.5" style={{ background: 'rgba(140,163,184,.12)', color: 'var(--ath-txt)' }}>{plate || '—'}</span>
          </div>
        </div>
        <span className="shrink-0 text-end">
          <strong className="ath-num block text-lg font-black" style={{ color: status.color }}>{remainingLabel}</strong>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--ath-line)] pt-3 text-[10px]">
        <div>
          <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--ath-mut)' }}><CalendarDays size={12} />{isAr ? 'تاريخ البدء' : 'Début'}</span>
          <strong className="mt-1 block font-bold">{formatDate(snapshot.startDate, lang)}</strong>
        </div>
        <div>
          <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--ath-mut)' }}><CalendarDays size={12} />{isAr ? 'تاريخ الانتهاء' : 'Fin'}</span>
          <strong className="mt-1 block font-bold">{formatDate(snapshot.endDate, lang)}</strong>
        </div>
      </div>

      <button
        type="button"
        onClick={onRenew}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[var(--ath-rb)] py-2.5 text-xs font-black"
        style={{ background: 'rgba(224,179,111,.14)', color: 'var(--ath-gold)' }}
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
  const [renewingId, setRenewingId] = useState(null)
  const [renewalContacts, setRenewalContacts] = useState(null)
  const subscribedDevices = useMemo(
    () => devices.filter(device => {
      const snapshot = getSubscriptionSnapshot(device)
      return Boolean(snapshot.planId || snapshot.startDate || snapshot.endDate)
    }),
    [devices],
  )

  useEffect(() => {
    let active = true
    api.settings.renewalContacts()
      .then(data => { if (active) setRenewalContacts(data) })
      .catch(() => { if (active) setRenewalContacts({}) })
    return () => { active = false }
  }, [])

  return (
    <div className="client-app min-h-screen bg-[#07111f] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />
      <main className="mx-auto max-w-xl px-4 py-4 sm:px-5">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={isAr ? 'رجوع' : 'Retour'}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--ath-line)] bg-[var(--ath-card)]"
            style={{ color: 'var(--ath-txt)' }}
          >
            {isAr ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}
          </button>
          <div>
            <h1 className="text-xl font-black" style={{ color: 'var(--ath-txt)' }}>{isAr ? 'الاشتراكات' : 'Abonnements'}</h1>
            <p className="mt-0.5 text-[10px] font-semibold" style={{ color: 'var(--ath-mut)' }}>
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
            <div className="ath-card flex flex-col items-center justify-center px-5 py-14 text-center">
              <CalendarDays size={30} style={{ color: 'var(--ath-gold)' }} />
              <h2 className="mt-3 text-sm font-black" style={{ color: 'var(--ath-txt)' }}>{isAr ? 'لا توجد اشتراكات' : 'Aucun abonnement'}</h2>
              <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--ath-mut)' }}>
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