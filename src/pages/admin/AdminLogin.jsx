import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, Mail, ArrowLeft, Shield } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import Logo from '../../components/Logo'
import { DEMO_ADMIN } from '../../data/mockData'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { loginAdmin, lang } = useApp()
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
    const ok = loginAdmin(email, password)
    setLoading(false)
    if (ok) {
      navigate('/admin/dashboard')
    } else {
      setError(lang === 'ar' ? 'بيانات الدخول غير صحيحة' : 'Identifiants incorrects')
    }
  }

  const fillDemo = () => {
    setEmail(DEMO_ADMIN.email)
    setPassword(DEMO_ADMIN.password)
    setError('')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(150deg, #0F2044 0%, #0a1628 60%, #0d2240 100%)' }}
    >
      {/* Background rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[300, 500, 700].map((size, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-accent/5"
            style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: size, height: size }}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.8 }}
          />
        ))}
      </div>

      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Top banner */}
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-8 text-center">
            <div className="flex justify-center mb-4">
              <Logo size="lg" white />
            </div>
            <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-semibold px-3 py-1.5 rounded-full">
              <Shield size={12} />
              {lang === 'ar' ? 'لوحة التحكم — Admin' : 'Tableau de bord — Admin'}
            </div>
          </div>

          {/* Form */}
          <div className="p-8">
            <h2 className="text-2xl font-bold text-primary-500 mb-1">{t(lang, 'login')}</h2>
            <p className="text-slate-400 text-sm mb-6">
              {lang === 'ar' ? 'وصول خاص بمديري النظام' : 'Accès réservé aux administrateurs'}
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t(lang, 'email')}</label>
                <div className="relative">
                  <Mail size={15} className="absolute top-1/2 -translate-y-1/2 left-3.5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t(lang, 'emailPlaceholder')}
                    className="input-field pl-10"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t(lang, 'password')}</label>
                <div className="relative">
                  <Lock size={15} className="absolute top-1/2 -translate-y-1/2 left-3.5 text-slate-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t(lang, 'passwordPlaceholder')}
                    className="input-field pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute top-1/2 -translate-y-1/2 right-3.5 text-slate-400"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-xl">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl font-bold text-white bg-primary-500 hover:bg-primary-600 transition-all active:scale-95 shadow-lg shadow-primary-500/20"
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
              className="mt-4 p-3 rounded-2xl border border-accent/20 bg-accent/5 cursor-pointer"
              onClick={fillDemo}
            >
              <p className="text-xs font-semibold text-accent mb-1">💡 {t(lang, 'demoHint')}</p>
              <p className="text-xs text-slate-400">📧 {DEMO_ADMIN.email}</p>
              <p className="text-xs text-slate-400">🔑 {DEMO_ADMIN.password}</p>
            </div>

            <button
              onClick={() => navigate('/client/login')}
              className="mt-4 text-xs text-slate-400 hover:text-primary-500 flex items-center gap-1 mx-auto"
            >
              <ArrowLeft size={12} />
              {lang === 'ar' ? 'العودة لتطبيق العميل' : 'Retour à l\'app client'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
