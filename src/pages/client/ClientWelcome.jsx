import React, { useEffect, useMemo, useState } from 'react'
import { Mail, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { SUBSCRIPTION_PLANS } from '../../utils/subscriptions'
import { DEFAULT_SUPPORT } from '../../config/support.js'

const CONTENT = {
  ar: {
    offerEyebrow: 'عرض العملاء الجدد',
    offerTitle: '3 أشهر مجانية',
    offerBody: 'اطلب تفعيل تجربتك الأولى وتعرّف على مزايا التتبع قبل اختيار الباقة المناسبة.',
    offerNote: 'يتم تفعيل العرض بعد تسجيل العميل واعتماده من فريق ATHAR GPS.',
    contact: 'اطلب التجربة',
    login: 'لدي حساب — تسجيل الدخول',
    skipOffer: 'تخطي العرض والمتابعة',
    email: 'البريد الإلكتروني',
    whatsapp: 'WhatsApp',
    language: 'Français',
  },
  fr: {
    offerEyebrow: 'Offre nouveaux clients',
    offerTitle: '3 mois offerts',
    offerBody: 'Demandez votre première période d’essai et découvrez le suivi avant de choisir votre forfait.',
    offerNote: 'L’offre est activée après l’enregistrement et la validation par l’équipe ATHAR GPS.',
    contact: 'Demander l’essai',
    login: 'J’ai déjà un compte — Connexion',
    skipOffer: 'Passer l’offre et continuer',
    email: 'Email',
    whatsapp: 'WhatsApp',
    language: 'العربية',
  },
}

function markOnboardingSeen() {
  localStorage.setItem('athargps_onboarding_seen', 'true')
}

function buildWhatsApp(number, lang) {
  const message = lang === 'ar'
    ? 'مرحباً، أريد طلب تجربة ATHAR GPS المجانية لمدة 3 أشهر.'
    : 'Bonjour, je souhaite demander l’essai gratuit ATHAR GPS de 3 mois.'
  return `https://wa.me/${String(number).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
}

export default function ClientWelcome() {
  const navigate = useNavigate()
  const { lang, setLang } = useApp()
  const isAr = lang === 'ar'
  const copy = CONTENT[lang]
  const [support, setSupport] = useState(DEFAULT_SUPPORT)

  useEffect(() => {
    api.settings.support().then(data => setSupport({ ...DEFAULT_SUPPORT, ...data })).catch(() => {})
  }, [])

  const whatsapp = useMemo(() => buildWhatsApp(support.whatsapp, lang), [support.whatsapp, lang])
  const email = `mailto:${support.email}?subject=${encodeURIComponent(isAr ? 'طلب تجربة ATHAR GPS' : 'Demande d’essai ATHAR GPS')}`

  const goToLogin = () => {
    markOnboardingSeen()
    navigate('/client/login', { replace: true })
  }

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-5 py-7 text-primary-500" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-sm flex-col justify-center">
        <div className="mb-8 flex items-center justify-between">
          <button type="button" onClick={() => setLang(isAr ? 'fr' : 'ar')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold shadow-sm">
            {copy.language}
          </button>
          <img src="/athar-gps-mark.png" alt="" className="h-10 w-10 rounded-xl" />
        </div>

        <section className="overflow-hidden rounded-3xl border border-primary-100 bg-white shadow-xl shadow-primary-500/10">
          <div className="bg-primary-500 px-6 pb-7 pt-8 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{copy.offerEyebrow}</p>
            <h1 className="mt-3 text-3xl font-extrabold">{copy.offerTitle}</h1>
            <p className="mt-3 text-sm leading-7 text-white/75">{copy.offerBody}</p>
          </div>
          <div className="space-y-4 p-6">
            <div className="space-y-2">
              {SUBSCRIPTION_PLANS.map(plan => (
                <div key={plan.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <span className="text-xs font-bold text-slate-700">{isAr ? plan.label : plan.labelFr}</span>
                  <span className="text-xs font-extrabold text-primary-500">{plan.price} MAD</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-5 text-slate-500">{copy.offerNote}</p>
            <a href={whatsapp} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-[#1d9b69] px-4 py-3.5 text-sm font-bold text-white shadow-sm">
              <MessageCircle size={17} />{copy.contact}
            </a>
            <a href={email} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-primary-500">
              <Mail size={15} />{copy.email}
            </a>
            <button type="button" onClick={goToLogin} className="w-full rounded-xl bg-primary-500 px-4 py-3.5 text-sm font-bold text-white shadow-sm">
              {copy.login}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
