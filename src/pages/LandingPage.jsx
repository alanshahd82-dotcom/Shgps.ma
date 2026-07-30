import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ─────────────────────────────────────────
   DATA
───────────────────────────────────────── */
const features = [
  { icon: '📡', title: 'تتبع حي',            desc: 'موقع مركباتك لحظةً بلحظة بدقة عالية.' },
  { icon: '🔒', title: 'قطع المحرك',          desc: 'أوقف أي مركبة عن بُعد بضغطة واحدة.' },
  { icon: '🗺️', title: 'أسوار جغرافية',      desc: 'تنبيه فوري عند الخروج عن المنطقة.' },
  { icon: '⚡', title: 'تنبيهات السرعة',      desc: 'راقب السرعة وتلقَّ إشعاراً فورياً.' },
  { icon: '📊', title: 'تقارير تفصيلية',      desc: 'سجل رحلات واستهلاك وقود بـ PDF.' },
  { icon: '👥', title: 'إدارة متعددة',        desc: 'صلاحيات مرنة لكل فرد في فريقك.' },
]

const plans = [
  {
    name: 'أساسية',  nameEn: 'Basic',        price: '30',
    features: ['تتبع حي', 'سجل الرحلات', 'تطبيق موبايل', 'دعم فني'],
    btn: 'border border-white/20 text-white hover:bg-white/10',
    highlight: false,
    badge: null,
    wa: 'مرحباً،%20أريد%20الاشتراك%20في%20الباقة%20الأساسية.',
  },
  {
    name: 'احترافية', nameEn: 'Professional', price: '70',
    features: ['كل ميزات الأساسية', 'أسوار جغرافية', 'تنبيهات سرعة', 'قطع المحرك', 'تقارير PDF'],
    btn: 'bg-[#00D97E] hover:bg-emerald-400 text-[#0a1628] font-extrabold shadow-lg shadow-[#00D97E]/25',
    highlight: true,
    badge: 'الأكثر طلباً',
    wa: 'مرحباً،%20أريد%20الاشتراك%20في%20الباقة%20الاحترافية.',
  },
  {
    name: 'أساطيل',   nameEn: 'Enterprise',  price: '120',
    features: ['كل ميزات الاحترافية', 'مستخدمون غير محدودون', 'API مفتوح', 'دعم 24/7'],
    btn: 'bg-[#FF9500] hover:bg-orange-400 text-white font-extrabold shadow-lg shadow-orange-400/20',
    highlight: false,
    badge: null,
    wa: 'مرحباً،%20أريد%20الاشتراك%20في%20باقة%20الأساطيل.',
  },
]

/* ─────────────────────────────────────────
   MOTION
───────────────────────────────────────── */
const up = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
})

/* ─────────────────────────────────────────
   STORE MODAL
───────────────────────────────────────── */
function StoreModal({ store, onClose }) {
  const isPlay = store === 'play'
  return (
    <AnimatePresence>
      {store && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-sm bg-[#0d1f3c] border border-white/10 rounded-3xl p-8 text-center shadow-2xl"
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            {/* close */}
            <button onClick={onClose}
              className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 text-white/50 hover:text-white transition-all text-lg flex items-center justify-center">
              ×
            </button>

            {/* icon */}
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#00D97E]/10 border border-[#00D97E]/20 flex items-center justify-center">
              {isPlay ? (
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#00D97E]" fill="currentColor">
                  <path d="M3.18 23.76a2.5 2.5 0 001.24-.33l.07-.04 13.84-8.01-3.99-4-11.16 12.38zm-1.72-20.3C1.17 3.9 1 4.48 1 5.14v13.72c0 .66.17 1.24.46 1.68l.08.1L14.02 8.16l-12.56-4.7zm17.37 4.24l-3.57-2.07-4.43 4.43 4.43 4.43 3.61-2.09a2.58 2.58 0 000-4.7zM4.42.57l-.07-.04A2.5 2.5 0 001.9.53L14.02 8.16 18.01 4.17 4.42.57z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#00D97E]" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              )}
            </div>

            {/* status pill */}
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-400/25 rounded-full px-4 py-1.5 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-400 text-xs font-semibold">قريباً</span>
            </div>

            <h3 className="text-white text-xl font-black mb-2">
              {isPlay ? 'Google Play' : 'App Store'}
            </h3>
            <p className="text-white/50 text-sm leading-relaxed mb-7">
              التطبيق في مرحلة التطوير المتقدم.<br />
              سجّل اهتمامك وسنُخطرك فور الإطلاق.
            </p>

            <a
              href={`https://wa.me/212618846582?text=مرحباً،%20أريد%20أن%20أكون%20أول%20من%20يحصل%20على%20AtharGPS%20عند%20إطلاقه%20على%20${isPlay ? 'Google%20Play' : 'App%20Store'}.`}
              target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-[#00D97E] hover:bg-emerald-400 active:scale-95 transition-all text-[#0a1628] font-bold py-3.5 rounded-2xl text-sm"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              أبلغني عند الإطلاق
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ─────────────────────────────────────────
   MAIN
───────────────────────────────────────── */
export default function LandingPage() {
  const [modal, setModal] = useState(null)

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif", background: 'linear-gradient(170deg,#0c1d38 0%,#0a1628 50%,#0c1f3a 100%)', minHeight: '100vh' }}>

      {/* ── Ambient glow ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div style={{ position:'absolute', top:'-10%', left:'50%', transform:'translateX(-50%)',
          width:700, height:700, borderRadius:'50%',
          background:'radial-gradient(circle, rgba(0,217,126,0.06) 0%, transparent 60%)' }} />
      </div>

      {/* ══════════════════════════════
          HERO
      ══════════════════════════════ */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-16 max-w-2xl mx-auto">

        {/* Logo */}
        <motion.div {...up(0)} className="mb-6">
          <div className="w-24 h-24 mx-auto mb-4 rounded-[22px] overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/10">
            <img src="/logo.jpeg" alt="AtharGPS" className="w-full h-full object-cover" />
          </div>
        </motion.div>

        {/* Status pill */}
        <motion.div {...up(0.1)} className="inline-flex items-center gap-2 bg-[#00D97E]/10 border border-[#00D97E]/25 rounded-full px-5 py-2 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00D97E] animate-pulse" />
          <span className="text-[#00D97E] text-xs font-semibold tracking-wide">قيد التطوير — الإطلاق قريباً</span>
        </motion.div>

        {/* Headline — short & punchy */}
        <motion.h1 {...up(0.15)} className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
          تتبع أسطولك<br />
          <span className="text-[#00D97E]">بضغطة واحدة</span>
        </motion.h1>

        <motion.p {...up(0.2)} className="text-white/45 text-base leading-relaxed max-w-sm mb-10">
          منصة GPS ذكية للمركبات والأساطيل في المغرب.
        </motion.p>

        {/* Store Buttons */}
        <motion.div {...up(0.25)} className="flex flex-col sm:flex-row gap-3 w-full justify-center">

          {/* Google Play */}
          <button onClick={() => setModal('play')}
            className="flex items-center gap-3 bg-white/[0.05] hover:bg-white/[0.1] border border-white/12 hover:border-[#00D97E]/35 active:scale-[0.97] transition-all duration-200 rounded-2xl px-5 py-3 w-full sm:w-44 group">
            <svg viewBox="0 0 24 24" className="w-7 h-7 flex-shrink-0 text-white/70 group-hover:text-[#00D97E] transition-colors" fill="currentColor">
              <path d="M3.18 23.76a2.5 2.5 0 001.24-.33l.07-.04 13.84-8.01-3.99-4-11.16 12.38zm-1.72-20.3C1.17 3.9 1 4.48 1 5.14v13.72c0 .66.17 1.24.46 1.68l.08.1L14.02 8.16l-12.56-4.7zm17.37 4.24l-3.57-2.07-4.43 4.43 4.43 4.43 3.61-2.09a2.58 2.58 0 000-4.7zM4.42.57l-.07-.04A2.5 2.5 0 001.9.53L14.02 8.16 18.01 4.17 4.42.57z"/>
            </svg>
            <div className="text-right">
              <p className="text-white/35 text-[10px] leading-none mb-0.5">تنزيل من</p>
              <p className="text-white font-bold text-sm">Google Play</p>
            </div>
          </button>

          {/* App Store */}
          <button onClick={() => setModal('apple')}
            className="flex items-center gap-3 bg-white/[0.05] hover:bg-white/[0.1] border border-white/12 hover:border-[#00D97E]/35 active:scale-[0.97] transition-all duration-200 rounded-2xl px-5 py-3 w-full sm:w-44 group">
            <svg viewBox="0 0 24 24" className="w-7 h-7 flex-shrink-0 text-white/70 group-hover:text-[#00D97E] transition-colors" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <div className="text-right">
              <p className="text-white/35 text-[10px] leading-none mb-0.5">تنزيل من</p>
              <p className="text-white font-bold text-sm">App Store</p>
            </div>
          </button>

        </motion.div>
      </section>

      {/* ══════════════════════════════
          FEATURES  (2-col grid)
      ══════════════════════════════ */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pb-20">
        <motion.h2 {...up(0)} className="text-center text-xl font-black text-white mb-2">ما يقدمه التطبيق</motion.h2>
        <motion.p {...up(0.05)} className="text-center text-white/35 text-sm mb-10">كل ما تحتاجه لإدارة مركباتك في مكان واحد</motion.p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {features.map((f, i) => (
            <motion.div key={f.title} {...up(i * 0.06)}
              className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 text-right hover:border-[#00D97E]/25 hover:bg-white/[0.055] transition-all duration-300 group cursor-default">
              <div className="w-10 h-10 rounded-xl bg-[#00D97E]/10 flex items-center justify-center text-xl mb-3 group-hover:bg-[#00D97E]/18 transition-colors">
                {f.icon}
              </div>
              <h4 className="text-white font-bold text-sm mb-1">{f.title}</h4>
              <p className="text-white/35 text-xs leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          PRICING
      ══════════════════════════════ */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pb-24">
        <motion.h2 {...up(0)} className="text-center text-xl font-black text-white mb-2">باقات الاشتراك</motion.h2>
        <motion.p {...up(0.05)} className="text-center text-white/35 text-sm mb-10">لا رسوم تثبيت · إلغاء في أي وقت · دفع شهري</motion.p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p, i) => (
            <motion.div key={p.nameEn} {...up(i * 0.08)}
              className={`relative flex flex-col rounded-3xl p-5 border transition-all duration-300
                ${p.highlight
                  ? 'bg-white/[0.07] border-[#00D97E]/40 shadow-xl shadow-[#00D97E]/8 md:scale-[1.03]'
                  : 'bg-white/[0.03] border-white/[0.07] hover:border-white/15'}`}>

              {p.badge && (
                <span className="absolute -top-3 right-4 bg-[#00D97E] text-[#0a1628] text-[11px] font-extrabold px-3 py-0.5 rounded-full">
                  {p.badge}
                </span>
              )}

              <p className="text-white/30 text-xs mb-0.5">{p.nameEn}</p>
              <h3 className="text-white font-black text-lg mb-3">{p.name}</h3>

              <div className="flex items-end gap-1 mb-4">
                <span className="text-4xl font-black text-white leading-none">{p.price}</span>
                <span className="text-white/30 text-xs mb-1">درهم/شهر</span>
              </div>

              <div className="w-full h-px bg-white/[0.07] mb-4" />

              <ul className="flex flex-col gap-2 mb-6 flex-1">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2 flex-row-reverse">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#00D97E]/15 border border-[#00D97E]/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#00D97E] text-[8px] leading-none">✓</span>
                    </span>
                    <span className="text-white/60 text-xs">{f}</span>
                  </li>
                ))}
              </ul>

              <a href={`https://wa.me/212618846582?text=${p.wa}`}
                target="_blank" rel="noopener noreferrer"
                className={`block w-full py-3 rounded-xl text-sm text-center transition-all active:scale-95 ${p.btn}`}>
                اشترك الآن
              </a>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          CTA STRIP
      ══════════════════════════════ */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pb-20">
        <motion.div {...up(0)}
          className="flex flex-col sm:flex-row items-center justify-between gap-5 bg-white/[0.04] border border-white/[0.08] rounded-3xl px-7 py-6">
          <div className="text-right">
            <h3 className="text-white font-black text-lg leading-snug">هل لديك سؤال؟</h3>
            <p className="text-white/40 text-sm mt-1">نحن هنا للمساعدة — تواصل معنا مباشرة</p>
          </div>
          <a
            href="https://wa.me/212618846582?text=مرحباً،%20أريد%20الاستفسار%20عن%20AtharGPS"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#00D97E] hover:bg-emerald-400 active:scale-95 transition-all text-[#0a1628] font-bold px-6 py-3 rounded-2xl text-sm flex-shrink-0 shadow-lg shadow-[#00D97E]/20">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            واتساب
          </a>
        </motion.div>
      </section>

      {/* ══════════════════════════════
          FOOTER
      ══════════════════════════════ */}
      <footer className="relative z-10 border-t border-white/[0.06] py-6 px-6">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden ring-1 ring-white/10 flex-shrink-0">
              <img src="/logo.jpeg" alt="AtharGPS" className="w-full h-full object-cover" />
            </div>
            <span className="text-white/40 text-sm font-bold">Athar<span className="text-[#00D97E]">GPS</span></span>
          </div>
          <p className="text-white/20 text-xs">© {new Date().getFullYear()} AtharGPS · جميع الحقوق محفوظة</p>
          <a href="https://wa.me/212618846582" target="_blank" rel="noopener noreferrer"
            className="text-white/25 hover:text-[#00D97E] text-xs transition-colors">الدعم الفني</a>
        </div>
      </footer>

      <StoreModal store={modal} onClose={() => setModal(null)} />
    </div>
  )
}
