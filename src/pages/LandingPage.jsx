import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */
const features = [
  { icon: '📡', title: 'تتبع حي في الوقت الفعلي',   desc: 'تابع مركباتك لحظةً بلحظة على خريطة تفاعلية بدقة عالية وسرعة فائقة.' },
  { icon: '🔒', title: 'قطع المحرك عن بُعد',         desc: 'أوقف أي مركبة فورياً عند السرقة أو الطوارئ بضغطة زر واحدة من هاتفك.' },
  { icon: '🗺️', title: 'الأسوار الجغرافية',          desc: 'حدد مناطق مسموحاً بها وتلقَّ تنبيهاً فورياً عند خروج أي مركبة عن النطاق.' },
  { icon: '⚡', title: 'تنبيهات السرعة الزائدة',     desc: 'احصل على إشعار تلقائي فور تجاوز السائق لحد السرعة الذي تحدده أنت.' },
  { icon: '📊', title: 'تقارير PDF تفصيلية',         desc: 'سجل رحلات كامل، مسافات، استهلاك الوقود — تقارير احترافية بنقرة واحدة.' },
  { icon: '👥', title: 'إدارة متعددة المستخدمين',    desc: 'أضف موظفين وحدد صلاحيات كل شخص بمرونة كاملة من لوحة تحكم موحدة.' },
]

const plans = [
  {
    name: 'الباقة الأساسية',
    nameEn: 'Basic',
    price: '30',
    badge: null,
    highlight: false,
    btnClass: 'border border-white/20 text-white hover:bg-white/10',
    waMsg: 'مرحباً،%20أريد%20الاشتراك%20في%20الباقة%20الأساسية%20(Basic).',
    features: ['تتبع حي في الوقت الفعلي', 'سجل الرحلات الكامل', 'تطبيق موبايل iOS & Android', 'دعم فني أساسي'],
  },
  {
    name: 'الباقة الاحترافية',
    nameEn: 'Professional',
    price: '70',
    badge: 'الأكثر طلباً 🔥',
    highlight: true,
    btnClass: 'bg-[#00D97E] hover:bg-emerald-400 text-[#0a1628] font-extrabold shadow-lg shadow-[#00D97E]/30',
    waMsg: 'مرحباً،%20أريد%20الاشتراك%20في%20الباقة%20الاحترافية%20(Professional).',
    features: ['كل ميزات الأساسية', 'الأسوار الجغرافية', 'تنبيهات السرعة الزائدة', 'قطع المحرك عن بُعد', 'تقارير PDF تفصيلية'],
  },
  {
    name: 'باقة الأساطيل',
    nameEn: 'Enterprise',
    price: '120',
    badge: null,
    highlight: false,
    btnClass: 'bg-[#FF9500] hover:bg-orange-400 text-white font-extrabold shadow-lg shadow-orange-500/30',
    waMsg: 'مرحباً،%20أريد%20الاشتراك%20في%20باقة%20الأساطيل%20(Enterprise).',
    features: ['كل ميزات الاحترافية', 'إدارة مستخدمين لا محدودة', 'لوحة تحكم مخصصة', 'تكامل API مفتوح', 'دعم فني ذو أولوية 24/7'],
  },
]

/* ─────────────────────────────────────────────
   ANIMATION VARIANTS
───────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.09, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  }),
}

/* ─────────────────────────────────────────────
   STORE MODAL
───────────────────────────────────────────── */
function StoreModal({ store, onClose }) {
  return (
    <AnimatePresence>
      {store && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative bg-[#0d1f3c] border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/8 hover:bg-white/15 text-white/60 hover:text-white transition-all text-lg"
            >
              ×
            </button>

            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-[#00D97E]/10 border border-[#00D97E]/25 flex items-center justify-center">
              <span className="text-4xl">{store === 'play' ? '▶' : ''}</span>
              {store === 'play' ? (
                <svg viewBox="0 0 24 24" className="w-10 h-10 text-[#00D97E]" fill="currentColor">
                  <path d="M3.18 23.76a2.5 2.5 0 001.24-.33l.07-.04 13.84-8.01-3.99-4-11.16 12.38zm-1.72-20.3C1.17 3.9 1 4.48 1 5.14v13.72c0 .66.17 1.24.46 1.68l.08.1L14.02 8.16l-12.56-4.7zm17.37 4.24l-3.57-2.07-4.43 4.43 4.43 4.43 3.61-2.09a2.58 2.58 0 000-4.7zM4.42.57l-.07-.04A2.5 2.5 0 001.9.53L14.02 8.16 18.01 4.17 4.42.57z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-10 h-10 text-[#00D97E]" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              )}
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-1.5 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-400 text-xs font-semibold">قيد الإنجاز</span>
            </div>

            <h3 className="text-white text-xl font-extrabold mb-3">
              {store === 'play' ? 'Google Play' : 'App Store'}
            </h3>

            <p className="text-white/60 text-sm leading-relaxed mb-6">
              تطبيق <span className="text-white font-bold">AtharGPS</span> يمر حالياً بمرحلة التطوير المتقدم
              وسيكون متاحاً للتنزيل قريباً على منصة{' '}
              <span className="text-[#00D97E] font-semibold">
                {store === 'play' ? 'Google Play' : 'App Store'}
              </span>.
            </p>

            <p className="text-white/40 text-xs leading-relaxed mb-7">
              سجّل اهتمامك عبر واتساب وسنُخطرك فور إطلاق التطبيق رسمياً.
            </p>

            <a
              href="https://wa.me/212618846582?text=مرحباً،%20أريد%20أن%20أكون%20أول%20من%20يحصل%20على%20تطبيق%20AtharGPS%20عند%20إطلاقه."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-[#00D97E] hover:bg-emerald-400 active:scale-95 transition-all text-[#0a1628] font-extrabold py-3.5 rounded-2xl text-sm"
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

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function LandingPage() {
  const [storeModal, setStoreModal] = useState(null)

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center font-sans overflow-x-hidden"
      style={{ background: 'linear-gradient(160deg, #0c1a35 0%, #0a1628 55%, #0d2240 100%)' }}
    >
      {/* ── Decorative glow ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,217,126,0.07) 0%, transparent 65%)' }} />
      </div>

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section className="relative z-10 w-full max-w-3xl px-6 pt-16 pb-12 flex flex-col items-center text-center">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-7"
        >
          <div className="w-28 h-28 mx-auto mb-5 rounded-3xl overflow-hidden shadow-2xl shadow-[#00D97E]/20 ring-1 ring-white/10">
            <img
              src="/logo.jpeg"
              alt="AtharGPS Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-5xl font-black tracking-tight">
            <span className="text-white">Athar</span>
            <span className="text-[#00D97E]">GPS</span>
          </h1>
          <p className="text-white/40 text-xs mt-2 tracking-widest uppercase">
            نظام تتبع الأسطول الذكي — المغرب
          </p>
        </motion.div>

        {/* "Under development" pill */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-2 bg-[#00D97E]/10 border border-[#00D97E]/30 rounded-full px-5 py-2 mb-7"
        >
          <span className="w-2 h-2 rounded-full bg-[#00D97E] animate-pulse" />
          <span className="text-[#00D97E] text-sm font-semibold">قيد التطوير المتقدم — الإطلاق قريباً</span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.55 }}
          className="text-2xl md:text-4xl font-extrabold text-white leading-tight mb-4"
        >
          تحكم في أسطولك بذكاء
          <br />
          <span className="text-[#00D97E]">من أي مكان، في أي وقت</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="text-white/50 text-sm md:text-base leading-relaxed max-w-xl mb-10"
        >
          منصة متكاملة لتتبع المركبات وإدارة الأسطول في المغرب — دقيقة، آمنة، وسهلة الاستخدام.
        </motion.p>

        {/* ── App Store Buttons ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="flex flex-col sm:flex-row gap-4 w-full justify-center"
        >
          {/* Google Play */}
          <button
            onClick={() => setStoreModal('play')}
            className="flex items-center gap-3 bg-white/[0.06] hover:bg-white/[0.11] border border-white/15 hover:border-[#00D97E]/40 active:scale-95 transition-all rounded-2xl px-6 py-3.5 w-full sm:w-auto justify-center backdrop-blur-sm group"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7 flex-shrink-0 text-white group-hover:text-[#00D97E] transition-colors" fill="currentColor">
              <path d="M3.18 23.76a2.5 2.5 0 001.24-.33l.07-.04 13.84-8.01-3.99-4-11.16 12.38zm-1.72-20.3C1.17 3.9 1 4.48 1 5.14v13.72c0 .66.17 1.24.46 1.68l.08.1L14.02 8.16l-12.56-4.7zm17.37 4.24l-3.57-2.07-4.43 4.43 4.43 4.43 3.61-2.09a2.58 2.58 0 000-4.7zM4.42.57l-.07-.04A2.5 2.5 0 001.9.53L14.02 8.16 18.01 4.17 4.42.57z"/>
            </svg>
            <div className="text-right">
              <p className="text-white/40 text-[10px] leading-none">تنزيل من</p>
              <p className="text-white font-bold text-base leading-tight">Google Play</p>
            </div>
          </button>

          {/* App Store */}
          <button
            onClick={() => setStoreModal('apple')}
            className="flex items-center gap-3 bg-white/[0.06] hover:bg-white/[0.11] border border-white/15 hover:border-[#00D97E]/40 active:scale-95 transition-all rounded-2xl px-6 py-3.5 w-full sm:w-auto justify-center backdrop-blur-sm group"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7 flex-shrink-0 text-white group-hover:text-[#00D97E] transition-colors" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <div className="text-right">
              <p className="text-white/40 text-[10px] leading-none">تنزيل من</p>
              <p className="text-white font-bold text-base leading-tight">App Store</p>
            </div>
          </button>
        </motion.div>

        {/* WhatsApp CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-5"
        >
          <a
            href="https://wa.me/212618846582?text=مرحباً،%20أريد%20الاستفسار%20عن%20منصة%20AtharGPS"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-white/40 hover:text-[#00D97E] text-sm transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            تواصل معنا عبر واتساب
          </a>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════ */}
      <section className="relative z-10 w-full max-w-4xl px-6 pb-20">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={{ hidden: {}, show: {} }}
          className="text-center mb-10"
        >
          <motion.p variants={fadeUp} className="text-[#00D97E] text-xs font-bold tracking-widest uppercase mb-2">
            ما يقدمه التطبيق
          </motion.p>
          <motion.h3 variants={fadeUp} className="text-2xl font-extrabold text-white mb-2">
            كل ما تحتاجه لإدارة أسطولك
          </motion.h3>
          <motion.p variants={fadeUp} className="text-white/40 text-sm max-w-md mx-auto">
            ميزات متكاملة مصممة خصيصاً لاحتياجات الشركات والأفراد في المغرب
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          variants={{ hidden: {}, show: {} }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              custom={i}
              className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 text-right
                         hover:border-[#00D97E]/30 hover:bg-white/[0.06] transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#00D97E]/10 border border-[#00D97E]/20 flex items-center justify-center text-2xl mb-4 group-hover:bg-[#00D97E]/15 transition-colors">
                {f.icon}
              </div>
              <h4 className="text-white font-bold text-sm mb-2">{f.title}</h4>
              <p className="text-white/40 text-xs leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════
          DIVIDER
      ══════════════════════════════════════════ */}
      <div className="relative z-10 w-full max-w-4xl px-6 mb-16">
        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* ══════════════════════════════════════════
          PRICING
      ══════════════════════════════════════════ */}
      <section className="relative z-10 w-full max-w-4xl px-6 pb-20">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={{ hidden: {}, show: {} }}
          className="text-center mb-10"
        >
          <motion.p variants={fadeUp} className="text-[#00D97E] text-xs font-bold tracking-widest uppercase mb-2">
            باقات الاشتراك
          </motion.p>
          <motion.h3 variants={fadeUp} className="text-2xl font-extrabold text-white mb-2">
            اختر الباقة المناسبة لك
          </motion.h3>
          <motion.p variants={fadeUp} className="text-white/40 text-sm">
            لا رسوم تثبيت — إلغاء الاشتراك في أي وقت — الدفع شهري
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          variants={{ hidden: {}, show: {} }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5"
        >
          {plans.map((plan, i) => (
            <motion.div
              key={plan.nameEn}
              variants={fadeUp}
              custom={i}
              className={`relative flex flex-col rounded-3xl p-6 border transition-all duration-300
                ${plan.highlight
                  ? 'bg-white/[0.07] border-[#00D97E]/45 shadow-2xl shadow-[#00D97E]/10 scale-[1.02]'
                  : 'bg-white/[0.03] border-white/[0.07] hover:border-white/15'
                }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 right-5 bg-[#00D97E] text-[#0a1628] text-xs font-extrabold px-4 py-1 rounded-full shadow-lg shadow-[#00D97E]/30">
                  {plan.badge}
                </div>
              )}

              <div className="mb-5 text-right">
                <p className="text-white/30 text-xs mb-1">{plan.nameEn}</p>
                <h3 className="text-white font-extrabold text-lg mb-3">{plan.name}</h3>
                <div className="flex items-end gap-1 justify-end">
                  <span className="text-5xl font-black text-white">{plan.price}</span>
                  <span className="text-white/35 text-sm mb-1.5">درهم / شهر</span>
                </div>
              </div>

              <div className="w-full h-px bg-white/[0.07] mb-5" />

              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map(feat => (
                  <li key={feat} className="flex items-start gap-2.5 flex-row-reverse">
                    <span className="w-4 h-4 rounded-full bg-[#00D97E]/15 border border-[#00D97E]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[#00D97E] text-[9px]">✓</span>
                    </span>
                    <span className="text-white/65 text-sm leading-snug">{feat}</span>
                  </li>
                ))}
              </ul>

              <a
                href={`https://wa.me/212618846582?text=${plan.waMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full py-3.5 rounded-2xl text-sm text-center transition-all active:scale-95 block ${plan.btnClass}`}
              >
                اشترك عبر واتساب
              </a>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className="relative z-10 w-full border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-white/10">
              <img src="/logo.jpeg" alt="AtharGPS" className="w-full h-full object-cover" />
            </div>
            <span className="text-white/50 text-sm font-bold">
              Athar<span className="text-[#00D97E]">GPS</span>
            </span>
          </div>
          <p className="text-white/20 text-xs text-center">
            © {new Date().getFullYear()} AtharGPS — جميع الحقوق محفوظة
          </p>
          <a
            href="https://wa.me/212618846582"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/30 hover:text-[#00D97E] text-xs transition-colors"
          >
            الدعم الفني
          </a>
        </div>
      </footer>

      {/* Store Modal */}
      <StoreModal store={storeModal} onClose={() => setStoreModal(null)} />
    </div>
  )
}
