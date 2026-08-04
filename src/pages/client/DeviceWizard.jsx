import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, MessageCircle, ShieldCheck } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'

// Device provisioning is intentionally admin-only. This route remains as a
// safe landing page for old bookmarks; it never collects or submits device data.
export default function DeviceWizard() {
  const navigate = useNavigate()
  const { lang } = useApp()
  const isAr = lang === 'ar'

  return (
    <div className="client-app min-h-screen bg-[#f5f7f8] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />
      <main className="mx-auto max-w-xl px-5 py-6">
        <button
          onClick={() => navigate('/client/devices')}
          className="mb-6 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white"
          aria-label={isAr ? 'العودة إلى الأجهزة' : 'Retour aux appareils'}
        >
          <ChevronLeft size={18} className={isAr ? 'rotate-180' : ''} />
        </button>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
            <ShieldCheck size={32} className="text-primary-500" />
          </div>
          <h1 className="text-xl font-extrabold text-primary-500">
            {isAr ? 'إضافة الجهاز تتم عبر المسؤول' : 'Ajout de l’appareil par l’administrateur'}
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            {isAr
              ? 'لإضافة جهاز جديد إلى حسابك، أرسل رقم IMEI واسم المركبة إلى المسؤول. سيقوم المسؤول بإعداد الجهاز وربطه بحسابك.'
              : 'Pour ajouter un appareil, envoyez son IMEI et le nom du véhicule à l’administrateur. Il configurera l’appareil et le liera à votre compte.'}
          </p>

          <button
            onClick={() => navigate('/client/help')}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3.5 text-sm font-bold text-white"
          >
            <MessageCircle size={17} />
            {isAr ? 'التواصل مع المسؤول' : 'Contacter l’administrateur'}
          </button>
        </section>
      </main>
      <ClientNav />
    </div>
  )
}