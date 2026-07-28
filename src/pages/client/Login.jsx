import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, Mail, ArrowLeft } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import MobileFrame from '../../components/MobileFrame'
import Logo from '../../components/Logo'
import { DEMO_CLIENT } from '../../data/mockData'

export default function ClientLogin() {
  const navigate = useNavigate()
  const { loginClient, lang } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    const ok = loginClient(email, password)
    setLoading(false)
    if (ok) {
      navigate('/client/home')
    } else {
      setError(lang === 'ar' ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Email ou mot de passe incorrect')
    }
  }

  const fillDemo = () => {
    setEmail(DEMO_CLIENT.email)
    setPassword(DEMO_CLIENT.password)
    setError('')
  }

  return (
    <MobileFrame>
      <div
        className="h-full flex flex-col overflow-auto"
        style={{ background: 'linear-gradient(160deg, #0F2044 0%, #0a1628 50%, #0d2240 100%)' }}
      >
        {/* Top area */}
        <div className="pt-16 pb-8 px-6 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Logo size="lg" white />
          </motion.div>
          <motion.p
            className="mt-3 text-white/60 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {lang === 'ar' ? 'تتبع مركباتك أينما كنت' : 'Suivez vos véhicules partout'}
          </motion.p>
        </div>

        {/* Form card */}
        <motion.div
          className="flex-1 bg-white rounded-t-[32px] px-6 pt-8 pb-6"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: 'spring', damping: 20 }}
        >
          <h2 className="text-2xl font-bold text-primary-500 mb-1">{t(lang, 'login')}</h2>
          <p className="text-slate-400 text-sm mb-7">
            {lang === 'ar' ? 'أدخل بياناتك للمتابعة' : 'Entrez vos identifiants pour continuer'}
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t(lang, 'email')}</label>
              <div className="relative">
                <Mail size={16} className="absolute top-1/2 -translate-y-1/2 text-slate-400" style={{ [lang === 'ar' ? 'right' : 'left']: 14 }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t(lang, 'emailPlaceholder')}
                  className="input-field text-sm"
                  style={{ [lang === 'ar' ? 'paddingRight' : 'paddingLeft']: 40 }}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t(lang, 'password')}</label>
              <div className="relative">
                <Lock size={16} className="absolute top-1/2 -translate-y-1/2 text-slate-400" style={{ [lang === 'ar' ? 'right' : 'left']: 14 }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t(lang, 'passwordPlaceholder')}
                  className="input-field text-sm"
                  style={{ [lang === 'ar' ? 'paddingRight' : 'paddingLeft']: 40, [lang === 'ar' ? 'paddingLeft' : 'paddingRight']: 40 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  style={{ [lang === 'ar' ? 'left' : 'right']: 14 }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.p
                className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-xl"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.p>
            )}

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-primary-500 text-sm shadow-lg transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #00D97E 0%, #00B366 100%)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {lang === 'ar' ? 'جاري الدخول...' : 'Connexion...'}
                </span>
              ) : t(lang, 'loginBtn')}
            </button>
          </form>

          {/* Demo hint */}
          <div
            className="mt-5 p-3 rounded-2xl border border-accent/20 bg-accent/5 cursor-pointer"
            onClick={fillDemo}
          >
            <p className="text-xs font-semibold text-accent mb-1">💡 {t(lang, 'demoHint')}</p>
            <p className="text-xs text-slate-400">📧 {DEMO_CLIENT.email}</p>
            <p className="text-xs text-slate-400">🔑 {DEMO_CLIENT.password}</p>
          </div>

          {/* Admin link */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/admin/login')}
              className="text-xs text-slate-400 hover:text-primary-500 flex items-center gap-1 mx-auto"
            >
              <ArrowLeft size={12} />
              {t(lang, 'adminLogin')}
            </button>
          </div>
        </motion.div>
      </div>
    </MobileFrame>
  )
}
