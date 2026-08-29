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
  const { loginClient, lang, setLang, authBootstrapError } = useApp()
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
      style={{ background: '#F5F6F8' }}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Top bar */}
      <div className="flex justify-between items-center px-4 pt-12 pb-4">
        <button
          onClick={() => setLang(isAr ? 'fr' : 'ar')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-600 shadow-sm transition-colors hover:border-indigo-500/60"
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
            <img src="/athar-gps-mark.png" alt="ATHAR GPS" width="52" height="52" draggable={false}/>
          </div>
          <h1 className="text-2xl font-extrabold tracking-wider text-indigo-600" dir="ltr">
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
            <h2 className="mb-5 text-center text-sm font-extrabold tracking-wide text-indigo-600">
              {t(lang, 'clientLogin')}
            </h2>

            {authBootstrapError && (
              <div
                className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800"
                role="status"
              >
                <span>
                  {isAr
                    ? 'تعذر الاتصال مؤقتاً. يمكنك المحاولة مرة أخرى.'
                    : 'Connexion temporairement indisponible. Réessayez.'}
                </span>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="shrink-0 font-extrabold underline underline-offset-2"
                >
                  {isAr ? 'إعادة المحاولة' : 'Réessayer'}
                </button>
              </div>
            )}

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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pe-4 ps-11 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pe-11 ps-11 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
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
                 className="mt-2 w-full rounded-xl bg-indigo-600 py-4 text-sm font-extrabold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                 style={{ background: loading ? '#94a3b8' : undefined }}
              >
                {loading ? '...' : t(lang, 'loginBtn')}
              </motion.button>

              <p className="text-center text-[11px] font-semibold text-slate-400">
                {isAr ? 'اتصال مشفّر · بياناتك محمية' : 'Connexion chiffrée · données protégées'}
              </p>

              {/* Forgot password */}
              <div className="mt-3 text-center">
                <Link to="/client/forgot-password"
                  className="text-[11px] font-semibold text-slate-400 hover:text-indigo-600 transition-colors">
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
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-2 py-2.5 text-[11px] font-bold text-white min-w-0 shadow-sm hover:brightness-110">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.464 3.488"/></svg>
                  <span className="truncate">WhatsApp</span>
                </a>
                <a href={`mailto:${support.email}`}
                  className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2.5 text-[11px] font-bold text-indigo-600 min-w-0">
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
