import React, { useEffect, useMemo, useState } from 'react'
import { BellRing, ChevronLeft, ChevronRight, Mail, MapPinned, MessageCircle, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { SUBSCRIPTION_PLANS } from '../../utils/subscriptions'
import { DEFAULT_SUPPORT } from '../../config/support.js'

const CONTENT = {
  ar: {
    slides: [
      { Icon: MapPinned, title: 'مركباتك أمامك دائماً', body: 'تابع موقع كل مركبة وحركتها من شاشة واحدة، في الوقت الحقيقي.' },
      { Icon: BellRing, title: 'تنبيهات في الوقت المناسب', body: 'اعرف السرعة، الخروج من المناطق، فقدان الاتصال وحالة المركبة.' },
      { Icon: ShieldCheck, title: 'إدارة أبسط وأمان أكبر', body: 'راجع الرحلات والتقارير والصيانة وشارك الموقع مع من تثق بهم.' },
    ],
    skip: 'تخطي',
    next: 'التالي',
    start: 'ابدأ الآن',
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
    slides: [
      { Icon: MapPinned, title: 'Vos véhicules, toujours visibles', body: 'Suivez la position et les déplacements de chaque véhicule en temps réel.' },
      { Icon: BellRing, title: 'Les alertes au bon moment', body: 'Recevez les alertes de vitesse, de zone, de connexion et d’état du véhicule.' },
      { Icon: ShieldCheck, title: 'Plus de contrôle, moins de risques', body: 'Consultez les trajets, les rapports et la maintenance depuis un seul espace.' },
    ],
    skip: 'Passer',
    next: 'Suivant',
    start: 'Commencer',
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
  const [stage, setStage] = useState('splash')
  const [slide, setSlide] = useState(0)
  const [support, setSupport] = useState(DEFAULT_SUPPORT)

  useEffect(() => {
    api.settings.support().then(data => setSupport({ ...DEFAULT_SUPPORT, ...data })).catch(() => {})
    const timer = window.setTimeout(() => setStage('slides'), 1400)
    return () => window.clearTimeout(timer)
  }, [])

  const whatsapp = useMemo(() => buildWhatsApp(support.whatsapp, lang), [support.whatsapp, lang])
  const email = `mailto:${support.email}?subject=${encodeURIComponent(isAr ? 'طلب تجربة ATHAR GPS' : 'Demande d’essai ATHAR GPS')}`

  const goToLogin = () => {
    markOnboardingSeen()
    navigate('/client/login', { replace: true })
  }

  if (stage === 'splash') {
    return (
      <main
        className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden text-white"
        style={{
          background: 'var(--ath-bg)',
          backgroundImage: 'radial-gradient(circle at 50% 42%, rgba(224,179,111,.18), transparent 38%), linear-gradient(180deg, var(--ath-bg), var(--ath-bg2))',
        }}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="relative z-10 flex flex-col items-center">
          <img
            src="/athar-gps-mark.svg"
            alt="ATHAR GPS"
            className="h-[104px] w-[104px] rounded-[28px]"
            style={{
              border: '1px solid rgba(224,179,111,.8)',
              boxShadow: '0 0 0 5px rgba(224,179,111,.08), 0 0 38px rgba(224,179,111,.24), 0 14px 36px rgba(0,0,0,.45)',
            }}
          />
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight" dir="ltr">
            ATHAR <span style={{ color: 'var(--ath-gold)' }}>GPS</span>
          </h1>
          <p className="mt-2 text-sm font-medium uppercase tracking-[0.22em]" style={{ color: 'var(--ath-green2)' }} dir="ltr">
            FLEET INTELLIGENCE PLATFORM
          </p>
          <div className="mt-10 h-0.5 w-32 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-full animate-pulse rounded-full" style={{ background: 'linear-gradient(90deg, #C8843C, #38bdf8, #FFF0C9)' }} />
          </div>
        </div>
        <p className="absolute bottom-8 text-[11px] tracking-wide text-white/30" dir="ltr">
          ATHAR GPS · Fleet Intelligence 2026 ©
        </p>
      </main>
    )
  }

  if (stage === 'offer') {
    return (
      <main className="min-h-screen bg-[#f5f7f8] px-5 py-7 text-primary-500" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-sm flex-col justify-center">
          <div className="mb-8 flex items-center justify-between">
            <button type="button" onClick={() => setLang(isAr ? 'fr' : 'ar')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold shadow-sm">
              {copy.language}
            </button>
            <img src="/athar-gps-mark.svg" alt="" className="h-10 w-10 rounded-xl" />
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
              <div className="grid grid-cols-2 gap-2">
                <a href={email} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-primary-500">
                  <Mail size={15} />{copy.email}
                </a>
                <button type="button" onClick={goToLogin} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-600">
                  {copy.skipOffer}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    )
  }

  const current = copy.slides[slide]
  const CurrentIcon = current.Icon
  const isLast = slide === copy.slides.length - 1
  const goNext = () => {
    if (isLast) {
      markOnboardingSeen()
      setStage('offer')
    } else {
      setSlide(value => value + 1)
    }
  }
  const NextIcon = isAr ? ChevronLeft : ChevronRight

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-5 py-7 text-primary-500" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-sm flex-col">
        <header dir="ltr" className="flex items-center justify-between">
          <button type="button" onClick={() => setLang(isAr ? 'fr' : 'ar')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold shadow-sm">
            {copy.language}
          </button>
          <button type="button" onClick={() => { markOnboardingSeen(); setStage('offer') }} className="text-xs font-bold text-slate-500">
            {copy.skip}
          </button>
        </header>

        <section className="flex flex-1 flex-col justify-center py-10">
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl border border-primary-100 bg-white shadow-lg shadow-primary-500/10">
            <CurrentIcon size={42} strokeWidth={1.7} className="text-primary-500" />
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#9a6a32]">ATHAR GPS</p>
          <h1 className="max-w-xs text-3xl font-extrabold leading-tight text-primary-500">{current.title}</h1>
          <p className="mt-4 max-w-xs text-sm leading-7 text-slate-500">{current.body}</p>
        </section>

        <footer dir="ltr" className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5" aria-label={`${slide + 1} / ${copy.slides.length}`}>
            {copy.slides.map((_, index) => <span key={index} className={`h-1.5 rounded-full transition-all ${index === slide ? 'w-7 bg-primary-500' : 'w-1.5 bg-slate-300'}`} />)}
          </div>
          <button dir={isAr ? 'rtl' : 'ltr'} type="button" onClick={goNext} className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-3.5 text-sm font-bold text-white shadow-sm">
            {isLast ? copy.start : copy.next}
            <NextIcon size={17} />
          </button>
        </footer>
      </div>
    </main>
  )
}