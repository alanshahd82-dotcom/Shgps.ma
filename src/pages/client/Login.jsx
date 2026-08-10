import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Lock, Mail, MessageCircle } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import { DEFAULT_SUPPORT } from '../../config/support.js'

export default function Login() {
  const navigate = useNavigate()
  const { loginClient, lang, setLang } = useApp()
  const [email, setEmail] = useState(() => localStorage.getItem('athargps_last_email') || '')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [support, setSupport] = useState(DEFAULT_SUPPORT)

  React.useEffect(() => {
    api.settings.support().then(data => setSupport({ ...DEFAULT_SUPPORT, ...data })).catch(() => {})
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await loginClient(email, password)
      navigate('/client/home')
    } catch (err) {
      if (err.code === 'SUBSCRIPTION_EXPIRED') {
        setError(t(lang, 'subscriptionExpiredLogin'))
      } else if (err.status === 429) {
        const minutes = String(err.message).match(/(\d+)/)?.[1] || '15'
        setError(t(lang, 'loginLocked').replace('{min}', minutes))
      } else if (err.status === 401) {
        setError(t(lang, 'invalidCredentials'))
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const isAr = lang === 'ar'
  const whatsapp = `https://wa.me/${String(support.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(isAr ? 'مرحباً، أريد طلب حساب ATHAR GPS' : 'Bonjour, je souhaite demander un compte ATHAR GPS')}`

  return (
    <div
      className="min-h-screen flex flex-col overflow-x-hidden text-slate-800"
      style={{ background: 'linear-gradient(135deg, #F3F5F9 0%, #E9EDF4 100%)' }}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Top bar */}
      <div className="flex justify-between items-center px-4 pt-12 pb-4">
        <button
          onClick={() => setLang(isAr ? 'fr' : 'ar')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-primary-500 shadow-sm transition-colors hover:border-[#00D97E]/60"
        >
          {isAr ? 'FR' : 'AR'}
        </button>
        <div style={{ width: 40 }} />
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 w-full">

        {/* Logo */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 18 }}
          className="mb-10 flex flex-col items-center"
        >
          <div
            className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-[var(--ath-rs)] bg-white"
            style={{ border: '1px solid rgba(224,179,111,.55)', boxShadow: '0 0 0 5px rgba(224,179,111,.06), 0 14px 30px rgba(15,32,68,.12)' }}
          >
            <img src="/athar-gps-mark.svg" alt="ATHAR GPS" width="52" height="52" draggable={false}/>
          </div>
          <h1 className="text-2xl font-extrabold tracking-wider text-primary-500" dir="ltr">
            ATHAR <span style={{ color: 'var(--ath-teal)' }}>GPS</span>
          </h1>
          <p className="mt-1.5 text-xs tracking-normal text-slate-500">{t(lang, 'tagline')}</p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 120 }}
          className="w-full max-w-sm"
        >
          <div
            className="rounded-[var(--ath-rs)] border border-white/80 bg-white p-5 shadow-xl shadow-primary-500/10"
          >
            <h2 className="mb-5 text-center text-sm font-extrabold tracking-wide text-primary-500">
              {t(lang, 'clientLogin')}
            </h2>

            <AnimatePresence>
              {error && (
                <motion.div
                  key="err"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-4"
                >
                  <div
                    className="rounded-xl px-4 py-2.5 text-xs text-center"
                    style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', color: '#ff6b60' }}
                  >
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-500">
                  {t(lang, 'email')}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400" size={17} style={{ insetInlineStart: '1rem' }} />
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder={t(lang, 'emailPlaceholder')} required dir="ltr"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pe-4 ps-11 text-sm text-slate-800 outline-none transition-all focus:border-[#00D97E] focus:ring-2 focus:ring-[#00D97E]/20"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-500">
                  {t(lang, 'password')}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400" size={17} style={{ insetInlineStart: '1rem' }} />
                  <input
                    type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pe-11 ps-11 text-sm text-slate-800 outline-none transition-all focus:border-[#00D97E] focus:ring-2 focus:ring-[#00D97E]/20"
                  />
                  <button
                    type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute top-1/2 -translate-y-1/2 transition-colors"
                    style={{ [isAr ? 'left' : 'right']: '1rem', color: '#94a3b8' }}
                  >
                    {showPass ? <EyeOff size={17}/> : <Eye size={17}/>}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <motion.button
                type="submit" disabled={loading} whileTap={{ scale: 0.97 }}
                 className="ath-btn-p mt-2 py-4 text-sm tracking-widest transition-all hover:brightness-110 hover:shadow-lg hover:shadow-primary-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                 style={{ background: loading ? '#94a3b8' : undefined }}
              >
                {loading ? '...' : t(lang, 'loginBtn')}
              </motion.button>

              <p className="text-center text-[11px] font-semibold text-slate-400">
                🔐 اتصال مشفّر · بياناتك محمية
              </p>

              {/* Forgot password */}
              <div className="mt-3 text-center">
                <Link to="/client/forgot-password"
                  className="text-[11px] font-semibold text-slate-400 hover:text-primary-500 transition-colors">
                  {t(lang, 'forgotPassword')}
                </Link>
              </div>
            </form>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-3 text-center text-[11px] text-slate-400 leading-5 break-words">
                {isAr ? 'ليس لديك حساب؟ تواصل معنا لتفعيل اشتراكك' : 'Vous n\'avez pas de compte ? Contactez-nous pour activer votre abonnement.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <a href={whatsapp} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1 rounded-xl border border-emerald-100 bg-emerald-50 px-2 py-2.5 text-[11px] font-bold text-emerald-700 min-w-0">
                  <MessageCircle size={13} className="flex-shrink-0" />
                  <span className="truncate">WhatsApp</span>
                </a>
                <a href={`mailto:${support.email}`}
                  className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2.5 text-[11px] font-bold text-primary-500 min-w-0">
                  <Mail size={13} className="flex-shrink-0" />
                  <span className="truncate">{isAr ? 'إيميل' : 'Email'}</span>
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="pb-10 px-4 text-center">
        <p className="text-[11px] text-slate-400 break-words leading-5">
          ATHAR GPS · Fleet Intelligence 2026 ©
        </p>
      </div>
    </div>
  )
}
