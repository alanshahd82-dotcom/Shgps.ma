import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const features = [
  {
    icon: '📡',
    title: 'تتبع حي في الوقت الفعلي',
    desc: 'تابع موقع مركباتك لحظةً بلحظة على خريطة تفاعلية بدقة عالية.',
  },
  {
    icon: '🔒',
    title: 'قطع المحرك عن بُعد',
    desc: 'أوقف المركبة فوراً عند السرقة أو الطوارئ بضغطة زر واحدة.',
  },
  {
    icon: '🗺️',
    title: 'الأسوار الجغرافية',
    desc: 'حدد مناطق مسموحاً بها وتلقَّ تنبيهاً فور خروج أي مركبة عن النطاق.',
  },
  {
    icon: '⚡',
    title: 'تنبيهات السرعة الزائدة',
    desc: 'احصل على إشعار فوري عند تجاوز السائق لحد السرعة المحدد.',
  },
  {
    icon: '📊',
    title: 'تقارير PDF تفصيلية',
    desc: 'استعرض سجل الرحلات والمسافات واستهلاك الوقود بتقارير احترافية.',
  },
  {
    icon: '👥',
    title: 'إدارة متعددة المستخدمين',
    desc: 'أضف موظفين وحدد صلاحيات كل شخص بمرونة كاملة.',
  },
]

const plans = [
  {
    name: 'الباقة الأساسية',
    nameEn: 'Basic',
    price: '30',
    badge: null,
    badgeColor: null,
    features: [
      'تتبع حي في الوقت الفعلي',
      'سجل الرحلات',
      'تطبيق موبايل',
      'دعم فني أساسي',
    ],
    btnLabel: 'اشترك الآن',
    btnClass: 'bg-white/10 hover:bg-white/20 text-white border border-white/20',
    waLink: 'https://wa.me/212618846582?text=مرحباً،%20أريد%20الاشتراك%20في%20الباقة%20الأساسية%20(Basic).',
    highlight: false,
  },
  {
    name: 'الباقة الاحترافية',
    nameEn: 'Professional',
    price: '70',
    badge: 'الأكثر طلباً 🔥',
    badgeColor: 'bg-accent text-primary-900',
    features: [
      'كل ميزات الباقة الأساسية',
      'الأسوار الجغرافية (Geofencing)',
      'تنبيهات السرعة الزائدة',
      'قطع المحرك عن بُعد',
      'تقارير PDF تفصيلية',
    ],
    btnLabel: 'اشترك الآن',
    btnClass: 'bg-accent hover:bg-emerald-400 text-primary-900 font-extrabold shadow-lg shadow-accent/30',
    waLink: 'https://wa.me/212618846582?text=مرحباً،%20أريد%20الاشتراك%20في%20الباقة%20الاحترافية%20(Professional).',
    highlight: true,
  },
  {
    name: 'باقة الأساطيل',
    nameEn: 'Enterprise',
    price: '120',
    badge: null,
    badgeColor: null,
    features: [
      'كل ميزات الباقة الاحترافية',
      'إدارة مستخدمين متعددة',
      'لوحة تحكم مخصصة',
      'تكامل API مفتوح',
      'دعم فني ذو أولوية 24/7',
    ],
    btnLabel: 'تواصل معنا',
    btnClass: 'bg-[#FF9500] hover:bg-orange-400 text-white font-extrabold shadow-lg shadow-orange-500/30',
    waLink: 'https://wa.me/212618846582?text=مرحباً،%20أريد%20الاشتراك%20في%20باقة%20الأساطيل%20(Enterprise).',
    highlight: false,
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } }),
}

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center font-sans"
      style={{ background: 'linear-gradient(150deg, #0F2044 0%, #0a1628 60%, #0d2240 100%)' }}
    >
      {/* Decorative background rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        {[220, 420, 620].map((size, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-white/[0.04]"
            style={{
              top: '30%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              width: size,
              height: size,
            }}
          />
        ))}
      </div>

      {/* ═══════════════════════════════════════
          HERO
      ═══════════════════════════════════════ */}
      <div className="relative z-10 flex flex-col items-center pt-16 pb-10 px-6 w-full max-w-3xl text-center">
        {/* Logo mark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <svg width={72} height={72} viewBox="0 0 48 48" fill="none" className="mx-auto mb-3">
            <rect width="48" height="48" rx="14" fill="rgba(255,255,255,0.07)" />
            <path
              d="M24 8C17.373 8 12 13.373 12 20C12 28.5 24 42 24 42C24 42 36 28.5 36 20C36 13.373 30.627 8 24 8Z"
              fill="#00D97E"
            />
            <circle cx="24" cy="20" r="4.5" fill="#0F2044" />
          </svg>
          <h1 className="text-5xl font-extrabold text-white tracking-tight">
            Shgps<span className="text-[#00D97E]">.ma</span>
          </h1>
          <p className="text-white/40 text-xs mt-2 tracking-widest uppercase">GPS Tracking Pro — Morocco</p>
        </motion.div>

        {/* "Under Development" badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="inline-flex items-center gap-2 bg-[#00D97E]/10 border border-[#00D97E]/30 rounded-full px-5 py-2 mb-6"
        >
          <span className="w-2 h-2 rounded-full bg-[#00D97E] animate-pulse" />
          <span className="text-[#00D97E] text-sm font-semibold">قيد التطوير المتقدم — سيُطلق قريباً</span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-2xl md:text-3xl font-bold text-white leading-snug mb-4"
        >
          تحكم في أسطولك بذكاء
          <br />
          <span className="text-[#00D97E]">من أي مكان، في أي وقت</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="text-white/50 text-sm leading-relaxed max-w-lg"
        >
          منصة متكاملة لتتبع المركبات والأساطيل في المغرب، تجمع بين الدقة والأمان وسهولة الاستخدام.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 mt-8"
        >
          <a
            href="https://wa.me/212618846582?text=مرحباً،%20أريد%20الاستفسار%20عن%20منصة%20Shgps.ma"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#00D97E] hover:bg-emerald-400 active:scale-95 transition-all text-[#0a1628] font-extrabold px-7 py-3.5 rounded-2xl text-sm shadow-lg shadow-[#00D97E]/25"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            تواصل معنا عبر واتساب
          </a>
          <button
            onClick={() => navigate('/client')}
            className="flex items-center justify-center gap-2 bg-white/8 hover:bg-white/14 border border-white/15 active:scale-95 transition-all text-white font-semibold px-7 py-3.5 rounded-2xl text-sm backdrop-blur-sm"
          >
            <span>دخول التطبيق</span>
            <span className="text-[#00D97E]">←</span>
          </button>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════
          FEATURES
      ═══════════════════════════════════════ */}
      <div className="relative z-10 w-full max-w-4xl px-6 pb-16">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="text-center mb-10"
        >
          <motion.h3
            variants={fadeUp}
            className="text-xl font-bold text-white mb-2"
          >
            كل ما تحتاجه لإدارة أسطولك
          </motion.h3>
          <motion.p variants={fadeUp} className="text-white/40 text-sm">
            ميزات متكاملة مصممة لاحتياجات الشركات المغربية
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              custom={i}
              className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 text-right hover:border-[#00D97E]/25 hover:bg-white/[0.07] transition-all duration-300"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h4 className="text-white font-bold text-sm mb-1.5">{f.title}</h4>
              <p className="text-white/45 text-xs leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════
          PRICING PLANS
      ═══════════════════════════════════════ */}
      <div className="relative z-10 w-full max-w-4xl px-6 pb-20">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="text-center mb-10"
        >
          <motion.h3 variants={fadeUp} className="text-xl font-bold text-white mb-2">
            باقات الاشتراك
          </motion.h3>
          <motion.p variants={fadeUp} className="text-white/40 text-sm">
            ابدأ مجاناً واترقَّ في أي وقت — لا رسوم تثبيت، إلغاء في أي وقت
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5"
        >
          {plans.map((plan, i) => (
            <motion.div
              key={plan.nameEn}
              variants={fadeUp}
              custom={i}
              className={`relative flex flex-col rounded-3xl p-6 border transition-all duration-300
                ${plan.highlight
                  ? 'bg-white/[0.09] border-[#00D97E]/40 shadow-xl shadow-[#00D97E]/10'
                  : 'bg-white/[0.04] border-white/[0.08] hover:border-white/20'
                }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className={`absolute -top-3 right-5 text-xs font-bold px-3 py-1 rounded-full ${plan.badgeColor}`}>
                  {plan.badge}
                </div>
              )}

              {/* Plan header */}
              <div className="mb-5 text-right">
                <p className="text-white/40 text-xs mb-1">{plan.nameEn}</p>
                <h3 className="text-white font-bold text-base mb-3">{plan.name}</h3>
                <div className="flex items-end gap-1 justify-end">
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                  <span className="text-white/40 text-sm mb-1.5">درهم / شهر</span>
                </div>
              </div>

              <div className="w-full h-px bg-white/[0.08] mb-5" />

              {/* Features */}
              <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2.5 text-right flex-row-reverse">
                    <span className="text-[#00D97E] text-sm flex-shrink-0 mt-0.5">✓</span>
                    <span className="text-white/70 text-sm leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <a
                href={plan.waLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full py-3.5 rounded-2xl text-sm font-bold text-center transition-all active:scale-95 block ${plan.btnClass}`}
              >
                {plan.btnLabel}
              </a>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center text-white/20 text-xs mt-10"
        >
          لا توجد رسوم تثبيت &nbsp;·&nbsp; إلغاء الاشتراك في أي وقت &nbsp;·&nbsp; الدفع شهري
        </motion.p>
      </div>

      {/* ═══════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════ */}
      <div className="relative z-10 w-full border-t border-white/[0.06] py-6 px-6 text-center">
        <p className="text-white/25 text-xs">
          © {new Date().getFullYear()} Shgps.ma — جميع الحقوق محفوظة
          &nbsp;·&nbsp;
          <a href="https://wa.me/212618846582" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">
            الدعم الفني
          </a>
        </p>
      </div>
    </div>
  )
}
