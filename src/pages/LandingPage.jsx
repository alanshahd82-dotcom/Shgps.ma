import React, { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/* ─────────────────────────────────────────────────────
   CONTENT  (bilingual)
───────────────────────────────────────────────────── */
const content = {
  en: {
    dir: 'ltr',
    fontFamily: "'Inter', sans-serif",
    nav: {
      features: 'Features', dashboard: 'Dashboard',
      fleet: 'Fleet', pricing: 'Pricing', cta: 'Get Started',
    },
    hero: {
      h1a: 'Next-Gen', h1b: 'GPS Tracking', h1c: 'for Modern Fleets',
      p: 'Real-time vehicle tracking, route optimization, and fleet management powered by cutting-edge satellite technology. Monitor your assets anywhere, anytime.',
      btn1: 'View Plans →', btn2: '▶ Watch Demo',
      stats: [
        { val: '500+', label: 'Active Vehicles' },
        { val: '99.9%', label: 'Uptime SLA' },
        { val: '24/7',  label: 'Support' },
      ],
    },
    store: {
      badge: 'Coming Soon',
      body1: 'The AtharGPS app is in advanced development and will be available for download on',
      body2: 'soon.',
      note: 'Register your interest via WhatsApp and we\'ll notify you at launch.',
      btnLabel: 'Notify Me at Launch',
    },
    features: {
      badge: 'Features', h2: 'Everything You Need to Track & Manage',
      p: 'Comprehensive GPS tracking tools designed for businesses of all sizes',
      items: [
        { icon: '📡', h: 'Real-Time Tracking',    p: 'Monitor vehicle locations with high accuracy using multi-constellation GNSS technology.' },
        { icon: '🗺️', h: 'Geofencing Alerts',     p: 'Instant notifications when vehicles enter or leave defined zones and boundaries.' },
        { icon: '⚡', h: 'Smart Alerts',           p: 'Notifications for speeding, unauthorized usage, and maintenance needs.' },
        { icon: '📊', h: 'Analytics Dashboard',   p: 'Comprehensive reports on driver behavior, fuel consumption, and fleet metrics.' },
        { icon: '🔒', h: 'Remote Immobilization', p: 'Remote engine cut-off, tamper alerts, and 24/7 monitoring for asset protection.' },
        { icon: '👥', h: 'Multi-User Management', p: 'Flexible permissions for every team member from one unified control panel.' },
      ],
    },
    dashboard: {
      badge: 'Live Dashboard', h2: 'Command Center for Your Entire Fleet',
      p: 'Our intuitive dashboard gives you complete visibility into your fleet operations. Track every vehicle, monitor driver performance, and make data-driven decisions in real-time.',
      items: [
        'Live vehicle positions with GPS accuracy',
        'Battery status and SIM card monitoring',
        'Historical route playback and analysis',
        'Custom geofences and zone management',
        'Detailed trip reports and fuel logs',
      ],
    },
    fleet: {
      badge: 'Fleet Management', h2: 'Optimize Every Route',
      p: 'From last-mile delivery to long-haul logistics, AtharGPS provides the tools you need to manage your fleet efficiently. Reduce costs, improve satisfaction, and scale your operations.',
      items: [
        'Multi-vehicle dispatch and scheduling',
        'Driver scorecards and performance tracking',
        'Fuel management and consumption reports',
        'Proof of delivery and trip summaries',
      ],
    },
    pricing: {
      badge: 'Pricing', h2: 'Simple, Transparent Pricing',
      p: 'Choose the plan that fits your fleet size and needs. No setup fees — cancel anytime.',
      popular: 'Most Popular',
      plans: [
        {
          name: 'Basic',    sub: 'For individuals',      price: '30', unit: 'MAD/mo',
          features: ['Real-time GPS tracking','Trip history log','Mobile app iOS & Android','Basic support'],
          neg: [],
          btnLabel: 'Subscribe via WhatsApp', btnClass: 'secondary',
          wa: 'Hello,%20I\'d%20like%20to%20subscribe%20to%20the%20Basic%20plan.',
        },
        {
          name: 'Professional', sub: 'For growing fleets', price: '70', unit: 'MAD/mo',
          features: ['Everything in Basic','Geofencing alerts','Speed notifications','Remote engine cut-off','PDF reports'],
          neg: [],
          btnLabel: 'Subscribe via WhatsApp', btnClass: 'primary', popular: true,
          wa: 'Hello,%20I\'d%20like%20to%20subscribe%20to%20the%20Professional%20plan.',
        },
        {
          name: 'Enterprise', sub: 'For large fleets',   price: '120', unit: 'MAD/mo',
          features: ['Everything in Professional','Unlimited users','Custom dashboard','Open API access','Priority support 24/7'],
          neg: [],
          btnLabel: 'Contact Us via WhatsApp', btnClass: 'secondary',
          wa: 'Hello,%20I\'d%20like%20to%20subscribe%20to%20the%20Enterprise%20plan.',
        },
      ],
    },
    cta: {
      h2: 'Ready to Transform Your Fleet?',
      p: 'Join businesses already using AtharGPS to optimize their operations. Get in touch today.',
      btnLabel: 'Contact Us via WhatsApp',
    },
    footer: {
      desc: 'Advanced GPS tracking solutions for modern fleet management in Morocco.',
      cols: [
        { h: 'Product', links: [
          { label: 'Features',      href: '#features' },
          { label: 'Pricing',       href: '#pricing' },
          { label: 'Mobile App',    action: 'store' },
        ]},
        { h: 'Company', links: [
          { label: 'About Us', href: 'https://wa.me/212618846582?text=Hello,%20I%20want%20to%20know%20more%20about%20AtharGPS', external: true },
          { label: 'Contact',  href: 'https://wa.me/212618846582?text=Hello,%20I%20need%20help%20with%20AtharGPS', external: true },
        ]},
        { h: 'Support', links: [
          { label: 'Help Center',    href: 'https://wa.me/212618846582?text=Hello,%20I%20need%20technical%20support', external: true },
          { label: 'Privacy Policy', href: '/privacy' },
          { label: 'Terms',          href: '/terms' },
        ]},
      ],
      copy: `© ${new Date().getFullYear()} AtharGPS. All rights reserved.`,
    },
  },

  ar: {
    dir: 'rtl',
    fontFamily: "'Cairo', sans-serif",
    nav: {
      features: 'المزايا', dashboard: 'لوحة التحكم',
      fleet: 'الأسطول', pricing: 'الباقات', cta: 'ابدأ الآن',
    },
    hero: {
      h1a: 'نظام تتبع', h1b: 'GPS متطور', h1c: 'للأساطيل الحديثة',
      p: 'تتبع مركباتك في الوقت الفعلي، إدارة المسارات، وقطع المحرك عن بُعد — كل شيء في منصة واحدة.',
      btn1: 'عرض الباقات ←', btn2: '▶ شاهد العرض',
      stats: [
        { val: '500+', label: 'مركبة نشطة' },
        { val: '99.9%', label: 'ضمان التشغيل' },
        { val: '24/7',  label: 'دعم فني' },
      ],
    },
    store: {
      badge: 'قريباً',
      body1: 'تطبيق AtharGPS في مرحلة التطوير المتقدم وسيكون متاحاً قريباً على',
      body2: '.',
      note: 'سجّل اهتمامك عبر واتساب وسنُخطرك فور الإطلاق.',
      btnLabel: 'أبلغني عند الإطلاق',
    },
    features: {
      badge: 'المزايا', h2: 'كل ما تحتاجه لإدارة أسطولك',
      p: 'ميزات متكاملة مصممة خصيصاً لاحتياجات الشركات والأفراد في المغرب',
      items: [
        { icon: '📡', h: 'تتبع حي',              p: 'تابع مركباتك لحظةً بلحظة بدقة عالية على خريطة تفاعلية.' },
        { icon: '🗺️', h: 'الأسوار الجغرافية',   p: 'تنبيه فوري عند خروج أي مركبة عن المنطقة المحددة.' },
        { icon: '⚡', h: 'تنبيهات السرعة',       p: 'إشعار تلقائي فور تجاوز السائق لحد السرعة المحدد.' },
        { icon: '📊', h: 'تقارير تفصيلية',       p: 'تقارير PDF لسجل الرحلات والمسافات واستهلاك الوقود.' },
        { icon: '🔒', h: 'قطع المحرك عن بُعد',  p: 'أوقف أي مركبة فورياً عند السرقة بضغطة واحدة من هاتفك.' },
        { icon: '👥', h: 'إدارة متعددة المستخدمين', p: 'صلاحيات مرنة لكل موظف من لوحة تحكم موحدة.' },
      ],
    },
    dashboard: {
      badge: 'لوحة التحكم', h2: 'مركز قيادة لأسطولك بالكامل',
      p: 'لوحة تحكم سهلة الاستخدام تمنحك رؤية كاملة لعمليات أسطولك. تتبع كل مركبة، راقب أداء السائقين، واتخذ قرارات دقيقة في الوقت الفعلي.',
      items: [
        'مواقع المركبات الحية بدقة GPS عالية',
        'حالة البطارية ومراقبة شريحة SIM',
        'إعادة تشغيل المسارات السابقة وتحليلها',
        'إدارة الأسوار الجغرافية والمناطق',
        'تقارير الرحلات والوقود التفصيلية',
      ],
    },
    fleet: {
      badge: 'إدارة الأسطول', h2: 'تحسين كل مسار توصيل',
      p: 'من التوصيل في المدينة إلى النقل بعيد المدى، توفر AtharGPS الأدوات اللازمة لإدارة أسطولك بكفاءة. خفّض التكاليف وحسّن رضا العملاء.',
      items: [
        'جدولة وتوزيع المركبات المتعددة',
        'بطاقات أداء السائقين',
        'إدارة الوقود وتقارير الاستهلاك',
        'ملخصات الرحلات وتأكيد التسليم',
      ],
    },
    pricing: {
      badge: 'الباقات', h2: 'أسعار واضحة وشفافة',
      p: 'اختر الباقة المناسبة لحجم أسطولك. لا رسوم تثبيت — إلغاء في أي وقت.',
      popular: 'الأكثر طلباً',
      plans: [
        {
          name: 'أساسية',    sub: 'للأفراد والشركات الصغيرة', price: '30', unit: 'درهم/شهر',
          features: ['تتبع حي في الوقت الفعلي','سجل الرحلات الكامل','تطبيق موبايل iOS & Android','دعم فني أساسي'],
          neg: [],
          btnLabel: 'اشترك عبر واتساب', btnClass: 'secondary',
          wa: 'مرحباً،%20أريد%20الاشتراك%20في%20الباقة%20الأساسية.',
        },
        {
          name: 'احترافية',  sub: 'للأساطيل المتنامية',       price: '70', unit: 'درهم/شهر',
          features: ['كل ميزات الأساسية','الأسوار الجغرافية','تنبيهات السرعة','قطع المحرك عن بُعد','تقارير PDF'],
          neg: [],
          btnLabel: 'اشترك عبر واتساب', btnClass: 'primary', popular: true,
          wa: 'مرحباً،%20أريد%20الاشتراك%20في%20الباقة%20الاحترافية.',
        },
        {
          name: 'أساطيل',   sub: 'للشركات الكبرى',           price: '120', unit: 'درهم/شهر',
          features: ['كل ميزات الاحترافية','مستخدمون غير محدودون','لوحة تحكم مخصصة','API مفتوح','دعم ذو أولوية 24/7'],
          neg: [],
          btnLabel: 'تواصل معنا عبر واتساب', btnClass: 'secondary',
          wa: 'مرحباً،%20أريد%20الاشتراك%20في%20باقة%20الأساطيل.',
        },
      ],
    },
    cta: {
      h2: 'هل أنت مستعد لتحسين أسطولك؟',
      p: 'انضم إلى الشركات التي تستخدم AtharGPS لتحسين عملياتها. تواصل معنا اليوم.',
      btnLabel: 'تواصل معنا عبر واتساب',
    },
    footer: {
      desc: 'منصة تتبع GPS متطورة لإدارة الأساطيل الحديثة في المغرب.',
      cols: [
        { h: 'المنتج', links: [
          { label: 'المزايا',          href: '#features' },
          { label: 'الباقات',          href: '#pricing' },
          { label: 'التطبيق',          action: 'store' },
        ]},
        { h: 'الشركة', links: [
          { label: 'من نحن',   href: 'https://wa.me/212618846582?text=مرحباً،%20أريد%20معرفة%20المزيد%20عن%20AtharGPS', external: true },
          { label: 'اتصل بنا', href: 'https://wa.me/212618846582?text=مرحباً،%20أحتاج%20مساعدة', external: true },
        ]},
        { h: 'الدعم', links: [
          { label: 'مركز المساعدة',    href: 'https://wa.me/212618846582?text=مرحباً،%20أحتاج%20دعماً%20فنياً', external: true },
          { label: 'سياسة الخصوصية',  href: '/privacy' },
          { label: 'الشروط',           href: '/terms' },
        ]},
      ],
      copy: `© ${new Date().getFullYear()} AtharGPS. جميع الحقوق محفوظة.`,
    },
  },
}

/* ─────────────────────────────────────────────────────
   STORE MODAL
───────────────────────────────────────────────────── */
function StoreModal({ store, lang, onClose }) {
  const t = content[lang].store
  const isPlay = store === 'play'
  const storeName = isPlay ? 'Google Play' : 'App Store'
  const wa = lang === 'ar'
    ? `https://wa.me/212618846582?text=مرحباً،%20أريد%20أن%20أكون%20أول%20من%20يحصل%20على%20AtharGPS%20على%20${isPlay ? 'Google%20Play' : 'App%20Store'}.`
    : `https://wa.me/212618846582?text=Hello,%20I%20want%20to%20be%20notified%20when%20AtharGPS%20launches%20on%20${isPlay ? 'Google%20Play' : 'App%20Store'}.`

  return (
    <AnimatePresence>
      {store && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'flex-end',
            justifyContent:'center',padding:'1rem',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(12px)' }}
          onClick={onClose}>
          <motion.div
            initial={{ opacity:0, y:50 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:30 }}
            transition={{ duration:0.35, ease:[0.22,1,0.36,1] }}
            style={{ width:'100%',maxWidth:420,background:'#111827',border:'1px solid #1e293b',
              borderRadius:24,padding:'2rem',textAlign:'center',boxShadow:'0 25px 60px rgba(0,0,0,0.5)',
              marginBottom:'env(safe-area-inset-bottom)',fontFamily: content[lang].fontFamily }}
            dir={content[lang].dir}
            onClick={e => e.stopPropagation()}>

            <button onClick={onClose}
              style={{ position:'absolute',top:16,right:16,width:32,height:32,borderRadius:'50%',
                background:'rgba(255,255,255,0.07)',border:'none',color:'rgba(255,255,255,0.5)',
                fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
              ×
            </button>

            {/* store icon */}
            <div style={{ width:64,height:64,margin:'0 auto 1.25rem',borderRadius:16,
              background:'rgba(0,212,255,0.08)',border:'1px solid rgba(0,212,255,0.2)',
              display:'flex',alignItems:'center',justifyContent:'center' }}>
              {isPlay ? (
                <svg viewBox="0 0 24 24" style={{ width:30,height:30,fill:'#00d4ff' }}>
                  <path d="M3.18 23.76a2.5 2.5 0 001.24-.33l.07-.04 13.84-8.01-3.99-4-11.16 12.38zm-1.72-20.3C1.17 3.9 1 4.48 1 5.14v13.72c0 .66.17 1.24.46 1.68l.08.1L14.02 8.16l-12.56-4.7zm17.37 4.24l-3.57-2.07-4.43 4.43 4.43 4.43 3.61-2.09a2.58 2.58 0 000-4.7zM4.42.57l-.07-.04A2.5 2.5 0 001.9.53L14.02 8.16 18.01 4.17 4.42.57z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" style={{ width:30,height:30,fill:'#00d4ff' }}>
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              )}
            </div>

            {/* badge */}
            <div style={{ display:'inline-flex',alignItems:'center',gap:8,background:'rgba(251,191,36,0.1)',
              border:'1px solid rgba(251,191,36,0.25)',borderRadius:20,padding:'4px 14px',marginBottom:'1rem' }}>
              <span style={{ width:7,height:7,borderRadius:'50%',background:'#fbbf24',
                animation:'pulse 1.5s infinite',display:'inline-block' }} />
              <span style={{ color:'#fbbf24',fontSize:12,fontWeight:700 }}>{t.badge}</span>
            </div>

            <h3 style={{ color:'#fff',fontSize:'1.3rem',fontWeight:800,marginBottom:8 }}>{storeName}</h3>
            <p style={{ color:'#94a3b8',fontSize:'0.9rem',lineHeight:1.7,marginBottom:24 }}>
              {t.body1} <strong style={{ color:'#00d4ff' }}>{storeName}</strong> {t.body2}
              <br />{t.note}
            </p>

            <a href={wa} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,width:'100%',
                padding:'0.85rem',borderRadius:12,background:'linear-gradient(135deg,#00d4ff,#00ff88)',
                color:'#0a0e1a',fontWeight:700,fontSize:'0.95rem',textDecoration:'none',
                transition:'transform 0.2s' }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='none'}>
              <WaIcon />
              {t.btnLabel}
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ─────────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────────── */
function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width:17,height:17,fill:'currentColor',flexShrink:0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

function PlayIcon({ size = 28, color = '#fff' }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width:size,height:size,fill:color,flexShrink:0 }}>
      <path d="M3.18 23.76a2.5 2.5 0 001.24-.33l.07-.04 13.84-8.01-3.99-4-11.16 12.38zm-1.72-20.3C1.17 3.9 1 4.48 1 5.14v13.72c0 .66.17 1.24.46 1.68l.08.1L14.02 8.16l-12.56-4.7zm17.37 4.24l-3.57-2.07-4.43 4.43 4.43 4.43 3.61-2.09a2.58 2.58 0 000-4.7zM4.42.57l-.07-.04A2.5 2.5 0 001.9.53L14.02 8.16 18.01 4.17 4.42.57z"/>
    </svg>
  )
}

function AppleIcon({ size = 28, color = '#fff' }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width:size,height:size,fill:color,flexShrink:0 }}>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}

/* ─────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────── */
export default function LandingPage() {
  const [lang, setLang]       = useState('ar')
  const [modal, setModal]     = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const t = content[lang]

  // scroll effect
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // fade-in observer
  useEffect(() => {
    const els = document.querySelectorAll('.fade-in')
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) } }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [lang])

  const S = {
    grad: 'linear-gradient(135deg,#00d4ff,#00ff88)',
    gradText: { background:'linear-gradient(135deg,#00d4ff,#00ff88)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' },
    card: { background:'#111827', border:'1px solid #1e293b', borderRadius:16 },
  }

  const wa = (msg) => `https://wa.me/212618846582?text=${msg}`

  return (
    <div dir={t.dir} style={{ fontFamily:t.fontFamily, background:'#0a0e1a', color:'#fff', overflowX:'hidden', minHeight:'100vh' }}>

      {/* ── global styles ── */}
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        html{scroll-behavior:smooth}
        .fade-in{opacity:0;transform:translateY(30px);transition:all 0.6s ease}
        .fade-in.visible{opacity:1;transform:translateY(0)}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-15px)}}
        @keyframes pulse2{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.1);opacity:1}}
        @keyframes drift{0%{transform:translateY(100vh);opacity:0}10%{opacity:.3}90%{opacity:.3}100%{transform:translateY(-100px);opacity:0}}
        @keyframes bounce{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(10px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .particle{position:absolute;width:3px;height:3px;background:#00d4ff;border-radius:50%;opacity:.3;animation:drift linear infinite}
        .pricing-btn-hover:hover{transform:translateY(-2px)}
        .store-btn-hover:hover{border-color:rgba(0,212,255,0.5)!important;background:rgba(0,212,255,0.07)!important}
        .nav-link-hover:hover{color:#00d4ff!important}
        .feature-card-hover:hover{transform:translateY(-5px);border-color:rgba(0,212,255,0.3)!important;background:#1a2332!important}
        @media(max-width:900px){
          .hero-grid{grid-template-columns:1fr!important}
          .features-grid-resp{grid-template-columns:repeat(2,1fr)!important}
          .pricing-grid-resp{grid-template-columns:1fr!important;max-width:400px!important;margin:0 auto!important}
          .footer-grid-resp{grid-template-columns:1fr 1fr!important}
          .hero-h1{font-size:2.5rem!important}
          .dash-grid{grid-template-columns:1fr!important}
          .popular-scale{transform:none!important}
        }
        @media(max-width:640px){
          .hero-h1{font-size:1.9rem!important}
          .section-h2{font-size:1.75rem!important}
          .features-grid-resp{grid-template-columns:1fr!important}
          .footer-grid-resp{grid-template-columns:1fr!important}
          .hero-stats{flex-direction:column;gap:.75rem}
          .nav-links-desktop{display:none!important}
          .nav-mobile-toggle{display:flex!important}
          .store-btns{flex-direction:column}
        }
      `}</style>

      {/* ═══════════════ NAV ═══════════════ */}
      <nav style={{ position:'fixed',top:0,width:'100%',zIndex:1000,padding:'1rem 2rem',
        background:'rgba(10,14,26,0.85)',backdropFilter:'blur(20px)',
        borderBottom: scrolled ? '1px solid #1e293b' : '1px solid transparent',
        transition:'all .3s ease' }}>
        <div style={{ maxWidth:1200,margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          {/* Logo */}
          <a href="#" style={{ display:'flex',alignItems:'center',gap:10,textDecoration:'none',color:'#fff' }}>
            <div style={{ width:36,height:36,borderRadius:8,overflow:'hidden' }}>
              <img src="/logo.jpeg" alt="AtharGPS" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
            </div>
            <span style={{ fontSize:'1.3rem',fontWeight:800 }}>Athar<span style={{ ...S.gradText }}>GPS</span></span>
          </a>

          {/* Desktop links */}
          <ul className="nav-links-desktop" style={{ display:'flex',gap:'1.75rem',listStyle:'none',alignItems:'center' }}>
            {[['#features',t.nav.features],['#dashboard',t.nav.dashboard],['#fleet',t.nav.fleet],['#pricing',t.nav.pricing]].map(([href,label])=>(
              <li key={href}>
                <a href={href} className="nav-link-hover" style={{ color:'#94a3b8',textDecoration:'none',fontSize:'0.9rem',fontWeight:500,transition:'color .3s' }}>
                  {label}
                </a>
              </li>
            ))}
            {/* Language toggle */}
            <li>
              <button onClick={() => setLang(l => l==='ar'?'en':'ar')}
                style={{ background:'rgba(0,212,255,0.08)',border:'1px solid rgba(0,212,255,0.25)',borderRadius:8,
                  color:'#00d4ff',padding:'0.4rem 0.9rem',cursor:'pointer',fontSize:'0.85rem',fontWeight:700,
                  transition:'all .3s',fontFamily:t.fontFamily }}>
                {lang==='ar' ? 'EN' : 'عربي'}
              </button>
            </li>
            <li>
              <a href={wa(lang==='ar'?'مرحباً،%20أريد%20الاستفسار%20عن%20AtharGPS':'Hello,%20I%20want%20to%20know%20more%20about%20AtharGPS')}
                target="_blank" rel="noopener noreferrer"
                style={{ background:S.grad,color:'#0a0e1a',padding:'0.5rem 1.3rem',borderRadius:8,
                  fontWeight:700,fontSize:'0.9rem',textDecoration:'none',transition:'all .3s' }}>
                {t.nav.cta}
              </a>
            </li>
          </ul>

          {/* Mobile: lang toggle + hamburger */}
          <div className="nav-mobile-toggle" style={{ display:'none',alignItems:'center',gap:10 }}>
            <button onClick={() => setLang(l => l==='ar'?'en':'ar')}
              style={{ background:'rgba(0,212,255,0.08)',border:'1px solid rgba(0,212,255,0.2)',borderRadius:7,
                color:'#00d4ff',padding:'0.35rem 0.75rem',cursor:'pointer',fontSize:'0.8rem',fontWeight:700,fontFamily:t.fontFamily }}>
              {lang==='ar'?'EN':'عربي'}
            </button>
            <button onClick={() => setMobileOpen(o=>!o)}
              style={{ background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',gap:5,padding:4 }}>
              {[0,1,2].map(i=>(
                <span key={i} style={{ width:24,height:2,background:'#fff',borderRadius:2,transition:'all .3s',
                  transform: mobileOpen ? (i===0?'rotate(45deg) translate(5px,5px)':i===2?'rotate(-45deg) translate(5px,-5px)':'scale(0)') : 'none',
                  opacity: mobileOpen && i===1 ? 0 : 1 }} />
              ))}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ height:0,opacity:0 }} animate={{ height:'auto',opacity:1 }} exit={{ height:0,opacity:0 }}
              style={{ background:'#0a0e1a',borderTop:'1px solid #1e293b',overflow:'hidden' }}>
              <ul style={{ listStyle:'none',padding:'1rem 2rem',display:'flex',flexDirection:'column',gap:'1rem' }}>
                {[['#features',t.nav.features],['#dashboard',t.nav.dashboard],['#fleet',t.nav.fleet],['#pricing',t.nav.pricing]].map(([href,label])=>(
                  <li key={href}>
                    <a href={href} onClick={()=>setMobileOpen(false)}
                      style={{ color:'#94a3b8',textDecoration:'none',fontWeight:500 }}>
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ═══════════════ HERO ═══════════════ */}
      <section style={{ minHeight:'100vh',display:'flex',alignItems:'center',position:'relative',overflow:'hidden',padding:'8rem 2rem 4rem' }}>
        {/* bg glows */}
        <div style={{ position:'absolute',inset:0,pointerEvents:'none' }}>
          <div style={{ position:'absolute',top:'-50%',right:'-20%',width:800,height:800,borderRadius:'50%',
            background:'radial-gradient(circle,rgba(0,212,255,.1) 0%,transparent 70%)',animation:'pulse2 4s ease-in-out infinite' }} />
          <div style={{ position:'absolute',bottom:'-30%',left:'-10%',width:600,height:600,borderRadius:'50%',
            background:'radial-gradient(circle,rgba(0,255,136,.08) 0%,transparent 70%)',animation:'pulse2 5s ease-in-out infinite reverse' }} />
        </div>
        {/* particles */}
        <Particles />

        <div className="hero-grid" style={{ maxWidth:1200,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4rem',alignItems:'center',position:'relative',zIndex:1,width:'100%' }}>
          <div className="fade-in">
            <h1 className="hero-h1" style={{ fontSize:'3.5rem',fontWeight:900,lineHeight:1.1,marginBottom:'1.5rem' }}>
              {t.hero.h1a} <span style={S.gradText}>{t.hero.h1b}</span> {t.hero.h1c}
            </h1>
            <p style={{ fontSize:'1.1rem',color:'#94a3b8',lineHeight:1.7,marginBottom:'2rem',maxWidth:500 }}>
              {t.hero.p}
            </p>

            {/* Store buttons */}
            <div className="store-btns" style={{ display:'flex',gap:'0.75rem',flexWrap:'wrap',marginBottom:'2rem' }}>
              <button onClick={() => setModal('play')} className="store-btn-hover"
                style={{ display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,0.05)',
                  border:'1px solid #1e293b',borderRadius:12,padding:'0.75rem 1.25rem',cursor:'pointer',
                  transition:'all .3s',color:'#fff',fontFamily:t.fontFamily }}>
                <PlayIcon />
                <div style={{ textAlign: lang==='ar'?'right':'left' }}>
                  <div style={{ fontSize:10,color:'#94a3b8',lineHeight:1 }}>{lang==='ar'?'تنزيل من':'Download on'}</div>
                  <div style={{ fontSize:'1rem',fontWeight:700,lineHeight:1.4 }}>Google Play</div>
                </div>
              </button>
              <button onClick={() => setModal('apple')} className="store-btn-hover"
                style={{ display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,0.05)',
                  border:'1px solid #1e293b',borderRadius:12,padding:'0.75rem 1.25rem',cursor:'pointer',
                  transition:'all .3s',color:'#fff',fontFamily:t.fontFamily }}>
                <AppleIcon />
                <div style={{ textAlign: lang==='ar'?'right':'left' }}>
                  <div style={{ fontSize:10,color:'#94a3b8',lineHeight:1 }}>{lang==='ar'?'تنزيل من':'Download on'}</div>
                  <div style={{ fontSize:'1rem',fontWeight:700,lineHeight:1.4 }}>App Store</div>
                </div>
              </button>
            </div>

            {/* stats */}
            <div className="hero-stats" style={{ display:'flex',gap:'2rem',paddingTop:'2rem',borderTop:'1px solid #1e293b' }}>
              {t.hero.stats.map(s => (
                <div key={s.label}>
                  <h3 style={{ fontSize:'2rem',fontWeight:800,...S.gradText }}>{s.val}</h3>
                  <p style={{ fontSize:'0.82rem',color:'#94a3b8',marginTop:2 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* hero image */}
          <div className="fade-in" style={{ position:'relative' }}>
            <div style={{ position:'absolute',inset:-2,background:S.grad,borderRadius:22,zIndex:-1,opacity:.25,filter:'blur(20px)' }} />
            <img src="/logo.jpeg" alt="AtharGPS"
              style={{ width:'100%',borderRadius:20,boxShadow:'0 25px 60px rgba(0,0,0,.5)',animation:'float 6s ease-in-out infinite' }} />
          </div>
        </div>

        {/* scroll indicator */}
        <div style={{ position:'absolute',bottom:'2rem',left:'50%',transform:'translateX(-50%)',
          display:'flex',flexDirection:'column',alignItems:'center',gap:6,color:'#94a3b8',fontSize:'0.78rem',animation:'bounce 2s ease-in-out infinite' }}>
          <span>{lang==='ar'?'تمرير':'Scroll'}</span>
          <div style={{ width:18,height:18,borderRight:'2px solid #00d4ff',borderBottom:'2px solid #00d4ff',transform:'rotate(45deg)' }} />
        </div>
      </section>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <section id="features" style={{ padding:'6rem 2rem' }}>
        <div className="fade-in" style={{ textAlign:'center',maxWidth:600,margin:'0 auto 4rem' }}>
          <span style={{ display:'inline-block',background:'rgba(0,212,255,.1)',color:'#00d4ff',padding:'0.4rem 1rem',
            borderRadius:20,fontSize:'0.85rem',fontWeight:700,marginBottom:'1rem',border:'1px solid rgba(0,212,255,.2)' }}>
            {t.features.badge}
          </span>
          <h2 className="section-h2" style={{ fontSize:'2.3rem',fontWeight:800,marginBottom:'1rem' }}>{t.features.h2}</h2>
          <p style={{ color:'#94a3b8',fontSize:'1.05rem',lineHeight:1.6 }}>{t.features.p}</p>
        </div>
        <div className="features-grid-resp" style={{ maxWidth:1100,margin:'0 auto',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1.25rem' }}>
          {t.features.items.map((f,i) => (
            <div key={i} className="fade-in feature-card-hover"
              style={{ ...S.card,padding:'1.75rem',cursor:'default',transition:'all .4s',position:'relative',overflow:'hidden' }}>
              <div style={{ position:'absolute',top:0,left:0,right:0,height:3,background:S.grad,opacity:0,transition:'opacity .3s',pointerEvents:'none' }}
                onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0} />
              <div style={{ width:52,height:52,background:'rgba(0,212,255,.1)',borderRadius:12,
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.4rem',marginBottom:'1.25rem' }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize:'1.1rem',fontWeight:700,marginBottom:'0.6rem' }}>{f.h}</h3>
              <p style={{ color:'#94a3b8',fontSize:'0.92rem',lineHeight:1.6 }}>{f.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ DASHBOARD ═══════════════ */}
      <section id="dashboard" style={{ padding:'6rem 2rem',background:'linear-gradient(180deg,#0a0e1a 0%,#0d1220 100%)' }}>
        <div className="dash-grid fade-in" style={{ maxWidth:1100,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4rem',alignItems:'center' }}>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute',inset:-3,background:S.grad,borderRadius:18,zIndex:-1,opacity:.15,filter:'blur(15px)' }} />
            <img src="/logo.jpeg" alt="Dashboard"
              style={{ width:'100%',borderRadius:16,boxShadow:'0 20px 50px rgba(0,0,0,.4)' }} />
          </div>
          <div>
            <span style={{ display:'inline-block',background:'rgba(0,212,255,.1)',color:'#00d4ff',padding:'0.4rem 1rem',
              borderRadius:20,fontSize:'0.85rem',fontWeight:700,marginBottom:'1rem',border:'1px solid rgba(0,212,255,.2)' }}>
              {t.dashboard.badge}
            </span>
            <h2 className="section-h2" style={{ fontSize:'2.3rem',fontWeight:800,marginBottom:'1.25rem' }}>{t.dashboard.h2}</h2>
            <p style={{ color:'#94a3b8',fontSize:'1.05rem',lineHeight:1.7,marginBottom:'1.75rem' }}>{t.dashboard.p}</p>
            <ul style={{ listStyle:'none',display:'flex',flexDirection:'column',gap:'0.85rem' }}>
              {t.dashboard.items.map((item,i) => (
                <li key={i} style={{ display:'flex',alignItems:'center',gap:10,color:'#94a3b8',fontSize:'0.97rem' }}>
                  <span style={{ width:24,height:24,background:'rgba(0,255,136,.1)',borderRadius:6,
                    display:'flex',alignItems:'center',justifyContent:'center',color:'#00ff88',fontSize:'0.8rem',flexShrink:0 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ═══════════════ FLEET ═══════════════ */}
      <section id="fleet" style={{ padding:'6rem 2rem' }}>
        <div className="dash-grid fade-in" style={{ maxWidth:1100,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4rem',alignItems:'center' }}>
          <div>
            <span style={{ display:'inline-block',background:'rgba(0,212,255,.1)',color:'#00d4ff',padding:'0.4rem 1rem',
              borderRadius:20,fontSize:'0.85rem',fontWeight:700,marginBottom:'1rem',border:'1px solid rgba(0,212,255,.2)' }}>
              {t.fleet.badge}
            </span>
            <h2 className="section-h2" style={{ fontSize:'2.3rem',fontWeight:800,marginBottom:'1.25rem' }}>{t.fleet.h2}</h2>
            <p style={{ color:'#94a3b8',fontSize:'1.05rem',lineHeight:1.7,marginBottom:'1.75rem' }}>{t.fleet.p}</p>
            <ul style={{ listStyle:'none',display:'flex',flexDirection:'column',gap:'0.85rem' }}>
              {t.fleet.items.map((item,i) => (
                <li key={i} style={{ display:'flex',alignItems:'center',gap:10,color:'#94a3b8',fontSize:'0.97rem' }}>
                  <span style={{ width:24,height:24,background:'rgba(0,255,136,.1)',borderRadius:6,
                    display:'flex',alignItems:'center',justifyContent:'center',color:'#00ff88',fontSize:'0.8rem',flexShrink:0 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute',inset:-3,background:S.grad,borderRadius:18,zIndex:-1,opacity:.15,filter:'blur(15px)' }} />
            <img src="/logo.jpeg" alt="Fleet"
              style={{ width:'100%',borderRadius:16,boxShadow:'0 20px 50px rgba(0,0,0,.4)' }} />
          </div>
        </div>
      </section>

      {/* ═══════════════ PRICING ═══════════════ */}
      <section id="pricing" style={{ padding:'6rem 2rem',background:'linear-gradient(180deg,#0d1220 0%,#0a0e1a 100%)' }}>
        <div className="fade-in" style={{ textAlign:'center',maxWidth:600,margin:'0 auto 4rem' }}>
          <span style={{ display:'inline-block',background:'rgba(0,212,255,.1)',color:'#00d4ff',padding:'0.4rem 1rem',
            borderRadius:20,fontSize:'0.85rem',fontWeight:700,marginBottom:'1rem',border:'1px solid rgba(0,212,255,.2)' }}>
            {t.pricing.badge}
          </span>
          <h2 className="section-h2" style={{ fontSize:'2.3rem',fontWeight:800,marginBottom:'1rem' }}>{t.pricing.h2}</h2>
          <p style={{ color:'#94a3b8',fontSize:'1.05rem',lineHeight:1.6 }}>{t.pricing.p}</p>
        </div>

        <div className="pricing-grid-resp" style={{ maxWidth:1000,margin:'0 auto',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1.25rem',alignItems:'stretch' }}>
          {t.pricing.plans.map((plan,i) => (
            <div key={i} className="fade-in popular-scale"
              style={{ ...S.card,padding:'2.25rem 1.75rem',textAlign:'center',position:'relative',
                borderColor: plan.popular ? '#00d4ff' : '#1e293b',
                background: plan.popular ? '#1a2332' : '#111827',
                transform: plan.popular ? 'scale(1.05)' : 'none',
                transition:'all .4s',display:'flex',flexDirection:'column' }}>

              {plan.popular && (
                <div style={{ position:'absolute',top:-14,left:'50%',transform:'translateX(-50%)',
                  background:S.grad,color:'#0a0e1a',padding:'0.3rem 1rem',borderRadius:20,
                  fontSize:'0.75rem',fontWeight:800,whiteSpace:'nowrap' }}>
                  {t.pricing.popular}
                </div>
              )}

              <h3 style={{ fontSize:'1.25rem',fontWeight:800,marginBottom:4 }}>{plan.name}</h3>
              <p style={{ color:'#94a3b8',fontSize:'0.88rem',marginBottom:'1.25rem' }}>{plan.sub}</p>

              <div style={{ fontSize:'3rem',fontWeight:900,marginBottom:'0.25rem',...(plan.popular ? S.gradText : {}) }}>
                {plan.price}
                <span style={{ fontSize:'1rem',fontWeight:400,color:'#94a3b8' }}> {plan.unit}</span>
              </div>

              <ul style={{ listStyle:'none',textAlign: lang==='ar'?'right':'left',margin:'1.5rem 0',
                display:'flex',flexDirection:'column',gap:'0.65rem',flex:1 }}>
                {plan.features.map((f,j) => (
                  <li key={j} style={{ display:'flex',alignItems:'center',gap:8,color:'#94a3b8',fontSize:'0.88rem',
                    flexDirection: lang==='ar'?'row-reverse':'row' }}>
                    <span style={{ color:'#00ff88',flexShrink:0 }}>✓</span> {f}
                  </li>
                ))}
              </ul>

              {/* WhatsApp button */}
              <a href={wa(plan.wa)} target="_blank" rel="noopener noreferrer" className="pricing-btn-hover"
                style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                  width:'100%',padding:'0.85rem',borderRadius:12,textDecoration:'none',
                  fontSize:'0.9rem',fontWeight:700,transition:'all .3s',marginTop:'auto',
                  ...(plan.btnClass==='primary'
                    ? { background:S.grad, color:'#0a0e1a', border:'none' }
                    : { background:'transparent', color:'#fff', border:'1px solid #1e293b' }) }}>
                <WaIcon />
                {plan.btnLabel}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ CTA ═══════════════ */}
      <section style={{ padding:'6rem 2rem',textAlign:'center',position:'relative',overflow:'hidden' }}>
        <div style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:600,height:600,borderRadius:'50%',
          background:'radial-gradient(circle,rgba(0,212,255,.09) 0%,transparent 70%)',pointerEvents:'none' }} />
        <div className="fade-in" style={{ maxWidth:650,margin:'0 auto',position:'relative',zIndex:1 }}>
          <h2 className="section-h2" style={{ fontSize:'2.3rem',fontWeight:800,marginBottom:'1rem' }}>{t.cta.h2}</h2>
          <p style={{ color:'#94a3b8',fontSize:'1.05rem',marginBottom:'2rem',lineHeight:1.6 }}>{t.cta.p}</p>
          <a href={wa(lang==='ar'?'مرحباً،%20أريد%20الاستفسار%20عن%20AtharGPS':'Hello,%20I%20want%20to%20get%20started%20with%20AtharGPS')}
            target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-flex',alignItems:'center',gap:10,background:S.grad,color:'#0a0e1a',
              padding:'1rem 2.25rem',borderRadius:12,fontWeight:700,fontSize:'1rem',textDecoration:'none',
              transition:'all .3s',boxShadow:'0 8px 25px rgba(0,212,255,.25)' }}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 14px 35px rgba(0,212,255,.4)'}}
            onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='0 8px 25px rgba(0,212,255,.25)'}}>
            <WaIcon />
            {t.cta.btnLabel}
          </a>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer style={{ padding:'4rem 2rem 2rem',borderTop:'1px solid #1e293b' }}>
        <div className="footer-grid-resp" style={{ maxWidth:1200,margin:'0 auto',display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:'2.5rem' }}>
          <div>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:'1rem' }}>
              <div style={{ width:36,height:36,borderRadius:8,overflow:'hidden',flexShrink:0 }}>
                <img src="/logo.jpeg" alt="AtharGPS" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
              </div>
              <span style={{ fontSize:'1.2rem',fontWeight:800 }}>Athar<span style={S.gradText}>GPS</span></span>
            </div>
            <p style={{ color:'#94a3b8',fontSize:'0.88rem',lineHeight:1.7,maxWidth:260 }}>{t.footer.desc}</p>
          </div>
          {t.footer.cols.map((col,i) => (
            <div key={i}>
              <h4 style={{ fontSize:'0.92rem',fontWeight:700,marginBottom:'1.25rem' }}>{col.h}</h4>
              <ul style={{ listStyle:'none',display:'flex',flexDirection:'column',gap:'0.65rem' }}>
                {col.links.map((link,j) => (
                  <li key={j}>
                    {link.action === 'store' ? (
                      <button onClick={() => setModal('play')}
                        className="nav-link-hover"
                        style={{ background:'none',border:'none',cursor:'pointer',color:'#94a3b8',
                          fontSize:'0.88rem',padding:0,transition:'color .3s',fontFamily:t.fontFamily,
                          textAlign: t.dir === 'rtl' ? 'right' : 'left' }}>
                        {link.label}
                      </button>
                    ) : (
                      <a href={link.href}
                        target={link.external ? '_blank' : '_self'}
                        rel={link.external ? 'noopener noreferrer' : undefined}
                        className="nav-link-hover"
                        style={{ color:'#94a3b8',textDecoration:'none',fontSize:'0.88rem',transition:'color .3s' }}>
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ maxWidth:1200,margin:'2.5rem auto 0',paddingTop:'1.75rem',borderTop:'1px solid #1e293b',
          display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'1rem',color:'#94a3b8',fontSize:'0.83rem' }}>
          <div style={{ display:'flex',alignItems:'center',gap:'1.5rem',flexWrap:'wrap' }}>
            <span>{t.footer.copy}</span>
            <a href="/terms" style={{ color:'#94a3b8',textDecoration:'none',fontSize:'0.83rem',transition:'color .2s' }}
              onMouseEnter={e=>e.currentTarget.style.color='#00D97E'} onMouseLeave={e=>e.currentTarget.style.color='#94a3b8'}>
              {lang === 'ar' ? 'الشروط والأحكام' : 'CGU'}
            </a>
            <a href="/privacy" style={{ color:'#94a3b8',textDecoration:'none',fontSize:'0.83rem',transition:'color .2s' }}
              onMouseEnter={e=>e.currentTarget.style.color='#00D97E'} onMouseLeave={e=>e.currentTarget.style.color='#94a3b8'}>
              {lang === 'ar' ? 'سياسة الخصوصية' : 'Confidentialité'}
            </a>
          </div>
          <div style={{ display:'flex',gap:'0.75rem' }}>
            {[['Google Play','play'],['App Store','apple']].map(([label,key]) => (
              <button key={key} onClick={() => setModal(key)}
                style={{ display:'flex',alignItems:'center',gap:7,background:'#111827',border:'1px solid #1e293b',
                  borderRadius:8,padding:'0.4rem 0.9rem',cursor:'pointer',color:'#94a3b8',fontSize:'0.8rem',
                  transition:'all .3s',fontFamily:t.fontFamily }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,212,255,.4)';e.currentTarget.style.color='#00d4ff'}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='#1e293b';e.currentTarget.style.color='#94a3b8'}}>
                {key==='play'?<PlayIcon size={14} color="currentColor"/>:<AppleIcon size={14} color="currentColor"/>}
                {label}
              </button>
            ))}
          </div>
        </div>
      </footer>

      {/* Store Modal */}
      <StoreModal store={modal} lang={lang} onClose={() => setModal(null)} />
    </div>
  )
}

/* Floating particles */
function Particles() {
  return (
    <div style={{ position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none' }}>
      {Array.from({length:25},(_,i)=>(
        <div key={i} className="particle" style={{
          left: `${Math.random()*100}%`,
          animationDuration: `${Math.random()*10+10}s`,
          animationDelay: `${Math.random()*10}s`,
          width: `${Math.random()*2+1}px`,
          height: `${Math.random()*2+1}px`,
          background: Math.random()>.5 ? '#00d4ff' : '#00ff88',
        }} />
      ))}
    </div>
  )
}
