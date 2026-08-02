import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Lock, Mail, Satellite, AlertCircle, LogOut, Phone } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'

/* ── خلفية الرادار المتحركة ───────────────────────────────────────────── */
function RadarBackground() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* شبكة أفقية وعمودية */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00D97E" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  )
}

/* ── دوائر الرادار ────────────────────────────────────────────────────── */
function RadarRings() {
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
      {[220, 160, 100].map((r, i) => (
        <motion.div
          key={r}
          className="absolute rounded-full border border-accent/20"
          style={{
            width:  r * 2,
            height: r * 2,
            top:    -r,
            left:   -r,
          }}
          animate={{ opacity: [0.15, 0.4, 0.15], scale: [1, 1.04, 1] }}
          transition={{ duration: 3.5, repeat: Infinity, delay: i * 0.8, ease: 'easeInOut' }}
        />
      ))}
      {/* نبضة مضيئة في المركز */}
      <motion.div
        className="absolute rounded-full bg-accent/30"
        style={{ width: 12, height: 12, top: -6, left: -6 }}
        animate={{ scale: [1, 2.5, 1], opacity: [0.8, 0, 0.8] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
      />
      <div className="absolute rounded-full bg-accent" style={{ width: 8, height: 8, top: -4, left: -4 }} />
    </div>
  )
}

/* ── نقاط GPS المتحركة ────────────────────────────────────────────────── */
function FloatingDots() {
  const dots = [
    { x: '15%', y: '25%', delay: 0 },
    { x: '80%', y: '18%', delay: 1.2 },
    { x: '70%', y: '72%', delay: 0.6 },
    { x: '25%', y: '68%', delay: 1.8 },
    { x: '88%', y: '45%', delay: 0.3 },
  ]
  return (
    <>
      {dots.map((d, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{ left: d.x, top: d.y }}
          animate={{ opacity: [0, 0.7, 0], scale: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, delay: d.delay, ease: 'easeInOut' }}
        >
          <div className="w-2 h-2 rounded-full bg-accent/60 relative">
            <div className="absolute -inset-1 rounded-full border border-accent/30" />
          </div>
        </motion.div>
      ))}
    </>
  )
}

/* ── حقل الإدخال ──────────────────────────────────────────────────────── */
function InputField({ icon: Icon, type, value, onChange, placeholder, autoComplete, rightSlot }) {
  const [focused, setFocused] = useState(false)
  return (
    <div
      className="relative rounded-2xl transition-all duration-300"
      style={{
        background: focused ? 'rgba(0,217,126,0.07)' : 'rgba(255,255,255,0.06)',
        border: `1.5px solid ${focused ? 'rgba(0,217,126,0.5)' : 'rgba(255,255,255,0.1)'}`,
        boxShadow: focused ? '0 0 0 4px rgba(0,217,126,0.08)' : 'none',
      }}
    >
      <Icon
        size={17}
        className="absolute top-1/2 -translate-y-1/2 transition-colors duration-300"
        style={{
          left: 18,
          color: focused ? '#00D97E' : 'rgba(255,255,255,0.35)',
        }}
      />
      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        required
        placeholder={placeholder}
        className="w-full bg-transparent text-white placeholder-white/30 py-4 text-sm outline-none"
        style={{ paddingLeft: 46, paddingRight: rightSlot ? 48 : 18 }}
      />
      {rightSlot && (
        <div className="absolute top-1/2 -translate-y-1/2 right-4">{rightSlot}</div>
      )}
    </div>
  )
}

/* ── مكوّن الصفحة الرئيسي ─────────────────────────────────────────────── */
/* ── شاشة انتهاء الاشتراك ───────────────────────────────────────────────── */
function ExpiredScreen({ lang, onLogout }) {
  const isAr = lang === 'ar'
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6"
      style={{ background: 'linear-gradient(160deg,#0F2044 0%,#162d5e 100%)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/15 border-2 border-red-500/30 flex items-center justify-center mx-auto mb-6">
          <Lock size={32} className="text-red-400" strokeWidth={1.5} />
        </div>
        <h2 className="text-white font-black text-2xl mb-2">
          {isAr ? 'انتهت صلاحية اشتراكك' : 'Abonnement expiré'}
        </h2>
        <p className="text-white/50 text-sm mb-8 leading-relaxed">
          {isAr ? 'للتجديد، تواصل مع المسؤول:' : 'Pour renouveler, contactez l\'administrateur :'}
        </p>
        <div className="space-y-3 mb-8">
          <a href="tel:+212600000000"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-white/80 text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <Phone size={15} className="text-accent" />
            {isAr ? 'اتصل بنا' : 'Appelez-nous'}
          </a>
          <a href="mailto:admin@shgps.ma"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-white/80 text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <Mail size={15} className="text-accent" />
            admin@shgps.ma
          </a>
        </div>
        <button onClick={onLogout}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-red-400 font-bold text-sm"
          style={{ background: 'rgba(255,59,48,0.10)', border: '1px solid rgba(255,59,48,0.20)' }}>
          <LogOut size={16} />
          {isAr ? 'تسجيل خروج' : 'Se déconnecter'}
        </button>
      </motion.div>
    </div>
  )
}

export default function ClientLogin() {
  const navigate    = useNavigate()
  const { loginClient, lang, setLang, subscriptionExpired, setSubscriptionExpired, logoutClient } = useApp()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [shake,    setShake]    = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await loginClient(email, password)
      // If subscription is expired loginClient sets subscriptionExpired=true and returns early
      if (data?.user?.expiryDate) {
        const daysLeft = Math.ceil((new Date(data.user.expiryDate) - new Date()) / 86400000)
        if (daysLeft <= 0 || data.user.isActive === false) {
          setLoading(false)
          return // ExpiredScreen renders via subscriptionExpired state
        }
      }
      navigate('/client/home', { replace: true })
    } catch {
      setLoading(false)
      setError(t(lang, 'invalidCredentials') || 'البريد الإلكتروني أو كلمة المرور غير صحيحة')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  const isRtl = lang === 'ar'

  // ── Show expired subscription screen ──────────────────────────────────────
  if (subscriptionExpired) {
    return <ExpiredScreen lang={lang} onLogout={() => { logoutClient(); setSubscriptionExpired(false) }} />
  }

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col overflow-hidden relative"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{ background: 'linear-gradient(170deg, #071629 0%, #0F2044 50%, #0d2850 100%)' }}
    >
      {/* ── الخلفية ── */}
      <RadarBackground />
      <FloatingDots />

      {/* ── الرأس ── */}
      <div className="relative z-10 flex items-center justify-end px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-2">
        {/* اختيار اللغة */}
        <div
          className="flex items-center rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)' }}
        >
          {['ar', 'fr'].map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-200"
              style={{
                color:      lang === l ? '#071629' : 'rgba(255,255,255,0.45)',
                background: lang === l ? '#00D97E' : 'transparent',
              }}
            >
              {l}
            </button>
          ))}
        </div>

      </div>

      {/* ── منطقة الرادار العلوية ── */}
      <div className="relative z-10 flex justify-center mt-6" style={{ height: 110 }}>
        <RadarRings />
      </div>

      {/* ── اللوغو والعنوان ── */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center px-6 mt-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="flex flex-col items-center gap-1 mb-4">
          <div className="flex items-end gap-0.5" dir="ltr">
            <span className="font-black text-4xl text-white tracking-tight leading-none">Athar</span>
            <span className="font-black text-4xl leading-none" style={{ color: '#00D97E' }}>GPS</span>
          </div>
          <span
            className="text-[11px] font-semibold tracking-[0.22em] uppercase mt-1"
            style={{ color: 'rgba(0,217,126,0.55)', letterSpacing: '0.22em' }}
          >
            Système de Suivi GPS
          </span>
        </div>

        <h1 className="text-white text-xl font-black">
          {t(lang, 'clientLogin') || 'تسجيل دخول العميل'}
        </h1>
        <p className="text-white/40 text-sm mt-1.5">
          {t(lang, 'clientLoginSubtitle') || 'أدخل بياناتك للوصول لأجهزتك'}
        </p>
      </motion.div>

      {/* ── البطاقة الرئيسية ── */}
      <motion.div
        className="relative z-10 mx-5 mt-8 flex-1 flex flex-col"
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
      >
        <motion.div
          animate={shake ? { x: [-6, 6, -5, 5, -3, 3, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            background:    'rgba(255,255,255,0.04)',
            border:        '1px solid rgba(255,255,255,0.09)',
            borderRadius:  28,
            backdropFilter:'blur(20px)',
            padding:       '28px 24px 24px',
          }}
        >
          <form onSubmit={handleLogin} className="space-y-4">
            {/* البريد */}
            <InputField
              icon={Mail}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t(lang, 'emailPlaceholder') || 'example@email.com'}
              autoComplete="email"
            />

            {/* كلمة المرور */}
            <InputField
              icon={Lock}
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t(lang, 'passwordPlaceholder') || '••••••••'}
              autoComplete="current-password"
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              }
            />

            {/* رسالة الخطأ */}
            <AnimatePresence>
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,59,48,0.12)', border: '1px solid rgba(255,59,48,0.25)' }}
                >
                  <AlertCircle size={15} className="text-red-400 flex-shrink-0" />
                  <span className="text-red-400 text-sm">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* زر الدخول */}
            <motion.button
              type="submit"
              disabled={loading || !email || !password}
              whileTap={{ scale: 0.97 }}
              className="w-full font-black text-sm tracking-wide py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 mt-2"
              style={{
                background: loading || !email || !password
                  ? 'rgba(0,217,126,0.3)'
                  : 'linear-gradient(135deg, #00D97E 0%, #00b868 100%)',
                color:      loading || !email || !password ? 'rgba(255,255,255,0.4)' : '#071629',
                boxShadow:  !loading && email && password
                  ? '0 8px 24px rgba(0,217,126,0.35), 0 2px 8px rgba(0,217,126,0.2)'
                  : 'none',
              }}
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 rounded-full border-2 border-transparent"
                  style={{ borderTopColor: '#071629' }}
                />
              ) : (
                <>
                  <Satellite size={16} />
                  <span>{t(lang, 'loginBtn') || (isRtl ? 'دخول' : 'Se connecter')}</span>
                </>
              )}
            </motion.button>
          </form>
        </motion.div>

      </motion.div>

      {/* ── تذييل ── */}
      <div className="relative z-10 text-center pb-8 pt-4">
        <p className="text-xs text-white/20">© 2025 AtharGPS · Powered by Shgps.ma</p>
      </div>
    </div>
  )
}
