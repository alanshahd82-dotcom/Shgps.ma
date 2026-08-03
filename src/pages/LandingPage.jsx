import React, { useEffect, useState } from 'react'
import {
  ArrowLeft, ArrowRight, BarChart3, BellRing, Check, ChevronDown,
  CircleHelp, Clock3, Mail, MapPinned, MessageCircle, Menu, ShieldCheck,
  X, Apple, Play
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api/index.js'
import { SUBSCRIPTION_PLANS } from '../utils/subscriptions'

const DEFAULT_SUPPORT = {
  email: 'support@athargps.ma',
  phone: '+212600000000',
  whatsapp: '212600000000',
  hours: 'كل يوم من 09:00 إلى 18:00',
  googlePlayUrl: '',
  appStoreUrl: '',
}

const COPY = {
  ar: {
    dir: 'rtl',
    nav: { features: 'المزايا', how: 'كيف يعمل', plans: 'الباقات', support: 'تواصل معنا', login: 'دخول العملاء' },
    hero: {
      eyebrow: 'تتبّع واضح لأسطولك',
      title: 'تتبّع مركباتك بوضوح، واتخذ القرار في الوقت المناسب.',
      body: 'ATHAR GPS يساعدك على متابعة المركبات، مراجعة الرحلات، استقبال التنبيهات وإدارة الصيانة من تطبيق واحد.',
      primary: 'اطلب تجربة مجانية',
      secondary: 'تعرّف على المزايا',
      note: 'تجربة 3 أشهر للعملاء الجدد بعد اعتماد الطلب',
    },
    stats: [['تتبع مباشر', 'لموقع المركبات'], ['تنبيهات فورية', 'للحالات المهمة'], ['دعم مباشر', 'عبر فريقك']],
    features: {
      eyebrow: 'ما الذي تحصل عليه',
      title: 'الأدوات التي تحتاجها لإدارة مركباتك بثقة',
      body: 'واجهة واضحة للعميل، وبيانات عملية تساعد المسؤول على المتابعة اليومية.',
      items: [
        [MapPinned, 'موقع مباشر', 'تابع المركبات على الخريطة واعرف السرعة وآخر تحديث.'],
        [BellRing, 'تنبيهات مفيدة', 'تنبيهات للسرعة، فقدان الاتصال، المناطق وحالة الاشتراك.'],
        [BarChart3, 'تقارير مفهومة', 'راجع الرحلات والمسافات وسلوك السائقين دون تعقيد.'],
        [ShieldCheck, 'تحكم آمن', 'صلاحيات للمستخدمين وأوامر عن بعد للأجهزة التي تدعمها.'],
      ],
    },
    how: {
      eyebrow: 'بداية بسيطة',
      title: 'من الجهاز إلى المتابعة في خطوات واضحة',
      steps: [
        ['01', 'تواصل معنا', 'أرسل بياناتك وعدد المركبات عبر WhatsApp أو البريد.'],
        ['02', 'نفعّل حسابك', 'يربط المسؤول الجهاز بحسابك ويحدد الباقة المناسبة.'],
        ['03', 'ابدأ المتابعة', 'سجّل الدخول وشاهد مركباتك وتقاريرك من أي مكان.'],
      ],
    },
    plans: {
      eyebrow: 'الباقات',
      title: 'أسعار واضحة بدون مفاجآت',
      body: 'اختر مدة الاشتراك المناسبة. الدفع نقدي ويتم التفعيل بعد التواصل مع المسؤول.',
      popular: 'الأكثر اختياراً',
      action: 'اطلب هذه الباقة',
      currency: 'درهم',
    },
    contact: {
      eyebrow: 'ابدأ مع ATHAR GPS',
      title: 'ثلاثة أشهر مجانية للعملاء الجدد',
      body: 'اطلب التجربة الأولى لجهاز واحد، وسيساعدك فريق ATHAR GPS في تجهيز الحساب والتفعيل.',
      whatsapp: 'اطلب عبر WhatsApp',
      email: 'أرسل بريداً',
      hours: 'ساعات الدعم',
    },
    footer: 'تتبّع مركباتك بثقة',
    language: 'Français',
  },
  fr: {
    dir: 'ltr',
    nav: { features: 'Fonctionnalités', how: 'Fonctionnement', plans: 'Forfaits', support: 'Contact', login: 'Espace client' },
    hero: {
      eyebrow: 'Le suivi qui reste lisible',
      title: 'Suivez vos véhicules clairement et agissez au bon moment.',
      body: 'ATHAR GPS vous aide à suivre vos véhicules, consulter les trajets, recevoir les alertes et gérer la maintenance depuis un seul espace.',
      primary: 'Demander un essai',
      secondary: 'Découvrir les fonctionnalités',
      note: '3 mois d’essai pour les nouveaux clients après validation',
    },
    stats: [['Suivi direct', 'de vos véhicules'], ['Alertes utiles', 'au bon moment'], ['Support direct', 'avec votre équipe']],
    features: {
      eyebrow: 'Ce que vous obtenez',
      title: 'Les outils essentiels pour piloter vos véhicules',
      body: 'Une interface claire pour le client et des informations utiles au quotidien.',
      items: [
        [MapPinned, 'Position en direct', 'Suivez la position, la vitesse et la dernière mise à jour.'],
        [BellRing, 'Alertes utiles', 'Vitesse, perte de connexion, zones et état de l’abonnement.'],
        [BarChart3, 'Rapports lisibles', 'Consultez trajets, distances et comportement des conducteurs.'],
        [ShieldCheck, 'Contrôle sécurisé', 'Gérez les rôles et les commandes des appareils compatibles.'],
      ],
    },
    how: {
      eyebrow: 'Un démarrage simple',
      title: 'Du tracker au suivi en quelques étapes',
      steps: [
        ['01', 'Contactez-nous', 'Envoyez vos informations et le nombre de véhicules par WhatsApp ou email.'],
        ['02', 'Nous activons votre compte', 'L’administrateur associe l’appareil et choisit le forfait adapté.'],
        ['03', 'Commencez le suivi', 'Connectez-vous et consultez vos véhicules et rapports partout.'],
      ],
    },
    plans: {
      eyebrow: 'Forfaits',
      title: 'Des prix simples et transparents',
      body: 'Choisissez la durée qui vous convient. Le paiement se fait comptant après contact avec l’administrateur.',
      popular: 'Le plus choisi',
      action: 'Demander ce forfait',
      currency: 'MAD',
    },
    contact: {
      eyebrow: 'Commencez avec ATHAR GPS',
      title: 'Trois mois offerts aux nouveaux clients',
      body: 'Demandez l’essai pour un appareil. Notre équipe vous accompagne pour préparer et activer votre compte.',
      whatsapp: 'Demander sur WhatsApp',
      email: 'Envoyer un email',
      hours: 'Horaires du support',
    },
    footer: 'Suivez vos véhicules en confiance',
    language: 'العربية',
  },
}

function planRequestMessage(plan, lang) {
  if (!plan) {
    return lang === 'ar'
      ? 'مرحباً، أود التعرف على خدمة ATHAR GPS وطلب تجربة 3 أشهر مجانية للعملاء الجدد. أرجو التواصل معي لتأكيد التفاصيل.'
      : 'Bonjour, je souhaite découvrir ATHAR GPS et demander l’essai gratuit de 3 mois réservé aux nouveaux clients. Merci de me contacter pour confirmer les détails.'
  }
  return lang === 'ar'
    ? `مرحباً فريق ATHAR GPS، أود طلب الاشتراك في باقة ${plan.label} بسعر ${plan.price} درهم. أرجو تزويدي بخطوات التفعيل ووسيلة الدفع المناسبة. شكراً.`
    : `Bonjour l’équipe ATHAR GPS, je souhaite souscrire au forfait ${plan.labelFr} au prix de ${plan.price} MAD. Merci de m’indiquer les étapes d’activation et le mode de paiement.`
}

function whatsappLink(number, lang, plan = null) {
  const message = planRequestMessage(plan, lang)
  return `https://wa.me/${String(number || '').replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
}

function supportEmail(email, lang, plan = null) {
  const subject = plan
    ? (lang === 'ar' ? `طلب باقة ATHAR GPS — ${plan.label}` : `Demande de forfait ATHAR GPS — ${plan.labelFr}`)
    : (lang === 'ar' ? 'طلب تجربة ATHAR GPS' : 'Demande d’essai ATHAR GPS')
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(planRequestMessage(plan, lang))}`
}

function StoreBadge({ href, kind, lang }) {
  const isPlay = kind === 'play'
  const Icon = isPlay ? Play : Apple
  const storeName = isPlay ? 'Google Play' : 'App Store'
  const content = (
    <>
      <Icon size={19} fill={isPlay ? 'currentColor' : 'none'} />
      <span className="text-start">
        <span className="block text-[9px] font-semibold opacity-70">{lang === 'ar' ? 'تحميل التطبيق' : 'Télécharger l’application'}</span>
        <span className="block text-xs font-extrabold">{storeName}</span>
      </span>
    </>
  )
  const className = `inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-white shadow-sm transition ${href ? 'bg-primary-500 hover:bg-[#244b6d]' : 'cursor-default bg-slate-400'}`
  return href
    ? <a href={href} target="_blank" rel="noreferrer" className={className}>{content}</a>
    : <span aria-disabled="true" className={className}>{content}</span>
}

function FeatureVisual({ support, lang }) {
  return (
    <div className="relative rounded-[30px] border border-primary-100 bg-white p-4 shadow-xl shadow-primary-500/10">
      <div className="overflow-hidden rounded-[22px] bg-primary-500 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">ATHAR GPS</p>
             <p className="mt-1 text-sm font-bold text-white">{lang === 'ar' ? 'عرض توضيحي للمنصة' : 'Aperçu de la plateforme'}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><BellRing size={16} className="text-accent" /></div>
        </div>
        <div className="relative h-48 overflow-hidden rounded-2xl border border-white/10 bg-[#24435e]">
          <div className="absolute inset-0 opacity-35" style={{ backgroundImage: 'linear-gradient(30deg, transparent 48%, #8fb1c8 49%, transparent 50%), linear-gradient(120deg, transparent 48%, #8fb1c8 49%, transparent 50%)', backgroundSize: '70px 70px' }} />
          <div className="absolute left-[22%] top-[30%] h-3 w-3 rounded-full border-2 border-white bg-accent shadow-[0_0_0_8px_rgba(228,181,107,.2)]" />
          <div className="absolute right-[27%] top-[56%] h-3 w-3 rounded-full border-2 border-white bg-emerald-400 shadow-[0_0_0_8px_rgba(52,211,153,.18)]" />
           <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl bg-white/95 px-3 py-2">
             <span className="text-[10px] font-bold text-primary-500">{lang === 'ar' ? 'الخريطة المباشرة' : 'Carte en direct'}</span>
             <span className="text-[10px] font-bold text-slate-500">{lang === 'ar' ? 'عرض توضيحي' : 'Démo'}</span>
           </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
           {[[MapPinned, lang === 'ar' ? 'موقع مباشر' : 'Position'], [BarChart3, lang === 'ar' ? 'تقارير الرحلات' : 'Rapports'], [BellRing, lang === 'ar' ? 'تنبيهات مهمة' : 'Alertes']].map(([Icon, label]) => (
            <div key={label} className="rounded-xl bg-white/10 px-2 py-2.5">
               <Icon size={15} className="text-accent" />
               <p className="mt-1 text-[9px] font-bold text-white/75">{label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-5 -left-5 flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2 shadow-lg">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50"><ShieldCheck size={16} className="text-emerald-600" /></div>
        <div><p className="text-[10px] font-bold text-primary-500">{lang === 'ar' ? 'حساب محمي' : 'Compte protégé'}</p><p className="text-[9px] text-slate-400">{support.hours}</p></div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [lang, setLang] = useState('ar')
  const [support, setSupport] = useState(DEFAULT_SUPPORT)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const copy = COPY[lang]
  const isAr = lang === 'ar'
  const Arrow = isAr ? ArrowLeft : ArrowRight

  useEffect(() => {
    api.settings.support().then(data => setSupport({ ...DEFAULT_SUPPORT, ...data })).catch(() => {})
  }, [])

  const faq = isAr
    ? [['هل يمكنني تجربة الخدمة؟', 'نعم، يتوفر عرض 3 أشهر للعملاء الجدد بعد التواصل واعتماد الطلب.'], ['هل أحتاج إلى جهاز GPS؟', 'نساعدك على اختيار الجهاز المناسب أو ربط جهازك الحالي إذا كان متوافقاً.'], ['هل أستطيع تعديل بيانات التواصل؟', 'نعم، يتم تحديثها من لوحة التحكم وتظهر مباشرة في صفحة الدعم والتواصل.']]
    : [['Puis-je essayer le service ?', 'Oui, une offre de 3 mois est proposée aux nouveaux clients après validation.'], ['Ai-je besoin d’un tracker ?', 'Nous vous aidons à choisir un appareil ou à connecter votre appareil compatible.'], ['Les contacts sont-ils à jour ?', 'Oui, ils sont gérés depuis le tableau de bord et affichés ici automatiquement.']]

  return (
    <div className="min-h-screen overflow-hidden bg-[#f5f7f8] text-primary-500" dir={copy.dir}>
      <style>{`
        .athar-link:hover { color:#9a6a32 !important; }
        .athar-primary:hover { background:#244b6d; transform:translateY(-1px); }
        .athar-secondary:hover { border-color:#e4b56b; background:#fffaf0; }
        .athar-card { transition:transform .25s ease, box-shadow .25s ease; }
        .athar-card:hover { transform:translateY(-4px); box-shadow:0 18px 45px rgba(23,50,77,.10); }
        @media (max-width: 760px) { .athar-desktop-nav { display:none !important; } .athar-mobile-menu { display:flex !important; } }
      `}</style>
      <header className="relative z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-5 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src="/athar-gps-mark.svg" alt="ATHAR GPS" className="h-10 w-10 rounded-xl" />
            <div><p className="text-sm font-extrabold tracking-[0.12em] text-primary-500">ATHAR GPS</p><p className="text-[9px] font-bold text-slate-400">{copy.footer}</p></div>
          </Link>
          <nav className="athar-desktop-nav hidden items-center gap-7 md:flex">
            {[[`#features`, copy.nav.features], [`#how`, copy.nav.how], [`#plans`, copy.nav.plans], [`#contact`, copy.nav.support]].map(([href, label]) => <a key={href} href={href} className="athar-link text-xs font-bold text-slate-500 transition-colors">{label}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setLang(isAr ? 'fr' : 'ar')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-primary-500">{copy.language}</button>
            <Link to="/client/login" className="athar-primary hidden rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-bold text-white transition md:inline-flex">{copy.nav.login}</Link>
            <button type="button" aria-label="Menu" onClick={() => setMenuOpen(value => !value)} className="rounded-xl border border-slate-200 p-2 md:hidden">{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
          </div>
        </div>
        {menuOpen && <nav className="athar-mobile-menu hidden flex-col gap-4 border-t border-slate-100 bg-white px-5 py-5 md:hidden">{[[`#features`, copy.nav.features], [`#how`, copy.nav.how], [`#plans`, copy.nav.plans], [`#contact`, copy.nav.support]].map(([href, label]) => <a key={href} href={href} onClick={() => setMenuOpen(false)} className="text-sm font-bold text-slate-600">{label}</a>)}<Link to="/client/login" className="rounded-xl bg-primary-500 px-4 py-3 text-center text-sm font-bold text-white">{copy.nav.login}</Link></nav>}
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pb-28 lg:pt-24">
          <div>
            <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-[#9a6a32]">{copy.hero.eyebrow}</p>
             <h1 className="max-w-xl text-[clamp(2rem,4vw,3.35rem)] font-extrabold leading-[1.16] tracking-[-0.035em] text-primary-500">{copy.hero.title}</h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-500">{copy.hero.body}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={whatsappLink(support.whatsapp, lang)} target="_blank" rel="noreferrer" className="athar-primary inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-3.5 text-sm font-bold text-white transition">{copy.hero.primary}<Arrow size={17} /></a>
              <a href="#features" className="athar-secondary inline-flex items-center rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-primary-500 transition">{copy.hero.secondary}</a>
            </div>
            <p className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-slate-400"><Clock3 size={14} className="text-accent" />{copy.hero.note}</p>
          </div>
          <FeatureVisual support={support} lang={lang} />
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-slate-100 px-5 py-3 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:px-8" dir={isAr ? 'rtl' : 'ltr'}>
            {copy.stats.map(([value, label]) => <div key={value} className="flex items-center gap-3 px-4 py-4 sm:justify-center"><Check size={17} className="text-emerald-600" /><div><p className="text-sm font-extrabold text-primary-500">{value}</p><p className="text-[11px] text-slate-400">{label}</p></div></div>)}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-5 py-24 lg:px-8">
          <div className="max-w-2xl"><p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#9a6a32]">{copy.features.eyebrow}</p><h2 className="text-3xl font-extrabold leading-tight text-primary-500 md:text-4xl">{copy.features.title}</h2><p className="mt-4 text-sm leading-7 text-slate-500">{copy.features.body}</p></div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {copy.features.items.map(([Icon, title, body]) => <article key={title} className="athar-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-7 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50"><Icon size={21} className="text-primary-500" /></div><h3 className="text-sm font-extrabold text-primary-500">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{body}</p></article>)}
          </div>
        </section>

        <section id="how" className="bg-primary-500 text-white">
          <div className="mx-auto max-w-6xl px-5 py-24 lg:px-8">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-accent">{copy.how.eyebrow}</p><h2 className="max-w-xl text-3xl font-extrabold leading-tight md:text-4xl">{copy.how.title}</h2>
            <div className="mt-12 grid gap-4 md:grid-cols-3">{copy.how.steps.map(([number, title, body]) => <article key={number} className="rounded-2xl border border-white/10 bg-white/[.06] p-6"><p className="text-sm font-black text-accent">{number}</p><h3 className="mt-8 text-base font-extrabold">{title}</h3><p className="mt-2 text-xs leading-6 text-white/65">{body}</p></article>)}</div>
          </div>
        </section>

        <section id="plans" className="mx-auto max-w-6xl px-5 py-24 lg:px-8">
          <div className="max-w-2xl"><p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#9a6a32]">{copy.plans.eyebrow}</p><h2 className="text-3xl font-extrabold leading-tight text-primary-500 md:text-4xl">{copy.plans.title}</h2><p className="mt-4 text-sm leading-7 text-slate-500">{copy.plans.body}</p></div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
             {SUBSCRIPTION_PLANS.map((plan, index) => <article key={plan.id} className={`athar-card relative rounded-2xl border bg-white p-6 shadow-sm ${index === 1 ? 'border-accent ring-1 ring-accent/30' : 'border-slate-200'}`}>{index === 1 && <span className="absolute -top-3 start-5 rounded-full bg-accent px-3 py-1 text-[10px] font-extrabold text-primary-500">{copy.plans.popular}</span>}<p className="text-sm font-extrabold text-primary-500">{isAr ? plan.label : plan.labelFr}</p><div className="mt-5 flex items-end gap-2"><span className="text-4xl font-black text-primary-500">{plan.price}</span><span className="mb-1 text-xs font-bold text-slate-400">{copy.plans.currency}</span></div><p className="mt-2 text-xs text-slate-400">{isAr ? 'دفع نقدي' : 'Paiement comptant'}</p><a href={whatsappLink(support.whatsapp, lang, plan)} target="_blank" rel="noreferrer" className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3 text-xs font-bold text-white">{copy.plans.action}<Arrow size={14} /></a><a href={supportEmail(support.email, lang, plan)} className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-[11px] font-bold text-primary-500"><Mail size={13} />{copy.contact.email}</a></article>)}
          </div>
        </section>

        <section id="contact" className="bg-[#eef3f2]">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-24 lg:grid-cols-[1.2fr_.8fr] lg:px-8">
             <div><p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#9a6a32]">{copy.contact.eyebrow}</p><h2 className="max-w-xl text-3xl font-extrabold leading-tight text-primary-500 md:text-4xl">{copy.contact.title}</h2><p className="mt-4 max-w-xl text-sm leading-7 text-slate-500">{copy.contact.body}</p><div className="mt-8 flex flex-wrap gap-3"><a href={whatsappLink(support.whatsapp, lang)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#1d9b69] px-5 py-3.5 text-sm font-bold text-white"><MessageCircle size={17} />{copy.contact.whatsapp}</a><a href={supportEmail(support.email, lang)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-primary-500"><Mail size={17} />{copy.contact.email}</a></div><div className="mt-7 flex flex-wrap gap-2"><StoreBadge href={support.googlePlayUrl} kind="play" lang={lang} /><StoreBadge href={support.appStoreUrl} kind="apple" lang={lang} /></div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50"><CircleHelp size={21} className="text-primary-500" /></div><h3 className="mt-5 text-sm font-extrabold text-primary-500">{copy.contact.hours}</h3><p className="mt-2 text-sm text-slate-500">{support.hours}</p><p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-400">{support.phone}<br />{support.email}</p></div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 lg:px-8"><div className="grid gap-3 sm:grid-cols-3">{faq.map(([question, answer], index) => <div key={question} className="rounded-2xl border border-slate-200 bg-white"><button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-3 p-4 text-start text-xs font-bold text-primary-500"><span>{question}</span><ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} /></button>{openFaq === index && <p className="px-4 pb-4 text-xs leading-6 text-slate-500">{answer}</p>}</div>)}</div></section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
         <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8"><div><p className="text-sm font-extrabold tracking-[0.12em] text-primary-500">ATHAR GPS</p><p className="mt-1 text-xs text-slate-400">{copy.footer}</p></div><div className="flex flex-wrap items-center gap-3"><Link to="/terms" className="text-xs font-bold text-slate-500"> {isAr ? 'الشروط' : 'CGU'} </Link><Link to="/privacy" className="text-xs font-bold text-slate-500">{isAr ? 'الخصوصية' : 'Confidentialité'}</Link></div></div>
      </footer>
    </div>
  )
}