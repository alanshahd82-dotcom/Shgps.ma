import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'

export default function ResetPassword() {
  const { lang, setLang } = useApp()
  const isAr = lang === 'ar'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [showConf, setShowConf]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [success, setSuccess]       = useState(false)
  const [error, setError]           = useState('')

  const BackArrow = isAr ? ArrowLeft : ArrowRight

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError(isAr ? 'كلمة المرور يجب أن لا تقل عن 8 أحرف.' : 'Le mot de passe doit comporter au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError(isAr ? 'كلمتا المرور غير متطابقتين.' : 'Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    try {
      await api.auth.resetPassword(token, password)
      setSuccess(true)
      setTimeout(() => navigate('/client/login'), 3000)
    } catch (err) {
      if (err.code === 'TOKEN_INVALID' || err.status === 400) {
        setError(t(lang, 'resetTokenInvalid'))
      } else {
        setError(err.message || (isAr ? 'حدث خطأ. حاول مجدداً.' : 'Une erreur est survenue.'))
      }
    } finally {
      setLoading(false)
    }
  }

  // No token in URL
  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f7f8] px-7" dir={isAr ? 'rtl' : 'ltr'}>
        <AlertTriangle size={48} className="text-amber-400 mb-4" />
        <p className="text-sm text-slate-600 mb-4">{t(lang, 'resetTokenInvalid')}</p>
        <Link to="/client/forgot-password" className="text-xs font-bold text-primary-500">
          {t(lang, 'forgotPassword')}
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f7f8]" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top bar */}
      <div className="flex justify-between items-center px-5 pt-12 pb-4">
        <button
          onClick={() => setLang(isAr ? 'fr' : 'ar')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-primary-500 shadow-sm"
        >
          {isAr ? 'FR' : 'AR'}
        </button>
        <div style={{ width: 40 }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-7">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 18 }}
          className="mb-10 flex flex-col items-center"
        >
          <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-md">
            <img src="/athar-gps-mark.svg" alt="ATHAR GPS" width="52" height="52" draggable={false} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-widest text-primary-500">ATHAR GPS</h1>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 120 }}
          className="w-full max-w-sm"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-primary-500/5">
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-4"
                >
                  <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
                  <p className="text-sm text-slate-600 leading-7">
                    {t(lang, 'resetPasswordSuccess')}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2">
                    {isAr ? 'سيتم توجيهك تلقائياً...' : 'Redirection automatique...'}
                  </p>
                  <Link to="/client/login"
                    className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-primary-500">
                    <BackArrow size={13} />
                    {t(lang, 'backToLogin')}
                  </Link>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h2 className="text-base font-black text-primary-500 mb-1">
                    {t(lang, 'resetPasswordTitle')}
                  </h2>
                  <p className="text-[11px] text-slate-400 mb-5 leading-5">
                    {t(lang, 'resetPasswordBody')}
                  </p>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-4"
                      >
                        <div className="rounded-xl px-4 py-2.5 text-xs text-center"
                          style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', color: '#ff6b60' }}>
                          {error}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* New password */}
                    <div>
                      <label className="mb-2 block text-xs font-bold tracking-wide text-slate-500">
                        {t(lang, 'password')}
                      </label>
                      <div className="relative">
                        <input
                          type={showPass ? 'text' : 'password'} value={password}
                          onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition-all focus:border-accent"
                        />
                        <button type="button" onClick={() => setShowPass(p => !p)}
                          className="absolute top-1/2 -translate-y-1/2 transition-colors"
                          style={{ [isAr ? 'left' : 'right']: '1rem', color: '#94a3b8' }}>
                          {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm password */}
                    <div>
                      <label className="mb-2 block text-xs font-bold tracking-wide text-slate-500">
                        {t(lang, 'confirmPassword')}
                      </label>
                      <div className="relative">
                        <input
                          type={showConf ? 'text' : 'password'} value={confirm}
                          onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition-all focus:border-accent"
                        />
                        <button type="button" onClick={() => setShowConf(p => !p)}
                          className="absolute top-1/2 -translate-y-1/2 transition-colors"
                          style={{ [isAr ? 'left' : 'right']: '1rem', color: '#94a3b8' }}>
                          {showConf ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>

                    <motion.button
                      type="submit" disabled={loading} whileTap={{ scale: 0.97 }}
                      className="w-full py-4 rounded-xl font-bold text-white text-sm tracking-widest transition-all disabled:opacity-50"
                      style={{ background: loading ? '#94a3b8' : '#17324d' }}
                    >
                      {loading ? '...' : t(lang, 'resetPasswordBtn')}
                    </motion.button>
                  </form>

                  <div className="mt-5 text-center">
                    <Link to="/client/login"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-500">
                      <BackArrow size={13} />
                      {t(lang, 'backToLogin')}
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      <div className="pb-10 text-center">
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} ATHAR GPS · Fleet intelligence</p>
      </div>
    </div>
  )
}
