import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

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
      'قطع المحرك عن بعد',
      'إدارة مستخدمين متعددة',
      'دعم فني ذو أولوية',
    ],
    btnLabel: 'تواصل معنا',
    btnClass: 'bg-[#FF9500] hover:bg-orange-400 text-white font-extrabold shadow-lg shadow-orange-500/30',
    waLink: 'https://wa.me/212618846582?text=مرحباً،%20أريد%20الاشتراك%20في%20باقة%20الأساطيل%20(Enterprise).',
    highlight: false,
  },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center"
      style={{ background: 'linear-gradient(150deg, #0F2044 0%, #0a1628 60%, #0d2240 100%)' }}
    >
      {/* Animated background rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[200, 380, 560].map((size, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-white/5"
            style={{ top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: size, height: size }}
          />
        ))}
      </div>

      {/* ── Hero / Demo Selector ── */}
      <div className="relative z-10 flex flex-col items-center justify-center pt-20 pb-16 px-6 w-full max-w-4xl">
        {/* Logo */}
        <div className="text-center mb-12">
          <svg width={80} height={80} viewBox="0 0 48 48" fill="none" className="mx-auto mb-4">
            <rect width="48" height="48" rx="14" fill="rgba(255,255,255,0.08)" />
            <path d="M24 8C17.373 8 12 13.373 12 20C12 28.5 24 42 24 42C24 42 36 28.5 36 20C36 13.373 30.627 8 24 8Z" fill="#00D97E" />
            <circle cx="24" cy="20" r="4.5" fill="#0F2044" />
          </svg>
          <h1 className="text-4xl font-extrabold text-white">
            Shgps<span className="text-accent">.ma</span>
          </h1>
          <p className="text-white/50 text-sm mt-2 font-medium tracking-widest uppercase">GPS Tracking Pro</p>
        </div>

        {/* Demo cards */}
        <div className="flex flex-col md:flex-row gap-5 w-full">
          <button
            onClick={() => navigate('/client')}
            className="flex-1 bg-white/5 border border-white/10 hover:border-accent/50 hover:bg-white/10 rounded-3xl p-7 text-right transition-all duration-300 group backdrop-blur-sm"
          >
            <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center mb-5 group-hover:bg-accent/30 transition-colors">
              <span className="text-3xl">📱</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">تطبيق العميل</h3>
            <p className="text-white/50 text-sm leading-relaxed">
              واجهة موبايل لتتبع الأجهزة، تحريك المحرك عن بعد، السياج الجغرافي، والتنبيهات.
            </p>
            <div className="mt-5 flex items-center gap-2 text-accent font-semibold text-sm">
              <span>عرض التطبيق</span>
              <span className="text-lg">←</span>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/login')}
            className="flex-1 bg-white/5 border border-white/10 hover:border-blue-300/30 hover:bg-white/10 rounded-3xl p-7 text-right transition-all duration-300 group backdrop-blur-sm"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-300/20 flex items-center justify-center mb-5 group-hover:bg-blue-300/30 transition-colors">
              <span className="text-3xl">🖥️</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">لوحة تحكم Admin</h3>
            <p className="text-white/50 text-sm leading-relaxed">
              لوحة ويب لإدارة العملاء والأجهزة، الخريطة الشاملة، والإحصائيات.
            </p>
            <div className="mt-5 flex items-center gap-2 text-white/60 font-semibold text-sm group-hover:text-white/80 transition-colors">
              <span>عرض اللوحة</span>
              <span className="text-lg">←</span>
            </div>
          </button>
        </div>

        <p className="mt-8 text-white/30 text-xs">
          جميع البيانات وهمية للعرض التقديمي فقط
        </p>
      </div>

      {/* ── Pricing Section ── */}
      <div className="relative z-10 w-full max-w-5xl px-6 pb-20">
        {/* Section header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-block text-accent text-sm font-bold tracking-widest uppercase mb-3">
            💎 الباقات والأسعار
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
            اختر الباقة المناسبة لك
          </h2>
          <p className="text-white/40 mt-3 text-sm max-w-md mx-auto leading-relaxed">
            جميع الباقات تشمل دعماً فنياً عبر واتساب وتحديثات مجانية مستمرة
          </p>
        </motion.div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.nameEn}
              className={`relative rounded-3xl p-6 flex flex-col transition-all duration-300 ${
                plan.highlight
                  ? 'bg-gradient-to-b from-white/12 to-white/5 border-2 border-accent/60 shadow-2xl shadow-accent/10'
                  : 'bg-white/5 border border-white/10'
              }`}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-4 right-1/2 translate-x-1/2">
                  <span className={`px-4 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap shadow-lg ${plan.badgeColor}`}>
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan name & price */}
              <div className="mb-5 text-right">
                <h3 className="text-white font-bold text-lg mb-1">{plan.name}</h3>
                <div className="flex items-end gap-1 justify-end">
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                  <span className="text-white/50 text-sm mb-1.5">درهم / شهر</span>
                </div>
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-white/10 mb-5" />

              {/* Features list */}
              <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-center gap-2.5 text-right flex-row-reverse">
                    <span className="text-accent text-base flex-shrink-0">✓</span>
                    <span className="text-white/80 text-sm leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
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
        </div>

        {/* Bottom note */}
        <motion.p
          className="text-center text-white/25 text-xs mt-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          لا توجد رسوم تثبيت · إلغاء الاشتراك في أي وقت · الدفع شهري
        </motion.p>
      </div>
    </div>
  )
}
