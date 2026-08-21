import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'

export default function ForgotPassword() {
  const { lang, setLang } = useApp()
  const isAr = lang === 'ar'
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.auth.forgotPassword(email)
      setSent(true)
    } catch {
      // Even on network error show generic message — don't reveal info
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  const BackArrow = isAr ? ArrowLeft : ArrowRight

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f7f8]" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top bar */}
      <div className="flex justify-between items-center px-5 pt-12 pb-4">
        <button
          onClick={() => setLang(isAr ? 'fr' : 'ar')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-600 shadow-sm"
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
          <h1 className="text-3xl font-extrabold tracking-widest text-indigo-600">ATHAR GPS</h1>
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
              {sent ? (
                <motion.div
                  key="sent"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-4"
                >
                  <div className="flex justify-center mb-4">
                    <CheckCircle size={48} className="text-emerald-500" />
                  </div>
                  <p className="text-sm text-slate-600 leading-7">
                    {t(lang, 'forgotPasswordSent')}
                  </p>
                  <Link
                    to="/client/login"
                    className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-indigo-600"
                  >
                    <BackArrow size={14} />
                    {t(lang, 'backToLogin')}
                  </Link>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h2 className="text-base font-black text-indigo-600 mb-1">
                    {t(lang, 'forgotPasswordTitle')}
                  </h2>
                  <p className="text-[11px] text-slate-400 mb-5 leading-5">
                    {t(lang, 'forgotPasswordBody')}
                  </p>

                  {error && (
                    <div className="mb-4 rounded-xl px-4 py-2.5 text-xs text-center"
                      style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', color: '#ff6b60' }}>
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="mb-2 block text-xs font-bold tracking-wide text-slate-500">
                        {t(lang, 'email')}
                      </label>
                      <div className="relative">
                        <Mail size={15} className="absolute top-1/2 -translate-y-1/2 text-slate-400"
                          style={{ [isAr ? 'right' : 'left']: '1rem' }} />
                        <input
                          type="email" value={email} onChange={e => setEmail(e.target.value)}
                          placeholder={t(lang, 'emailPlaceholder')} required dir="ltr"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 text-sm text-slate-800 outline-none transition-all focus:border-accent"
                          style={{ [isAr ? 'paddingRight' : 'paddingLeft']: '2.5rem', [isAr ? 'paddingLeft' : 'paddingRight']: '1rem' }}
                        />
                      </div>
                    </div>

                    <motion.button
                      type="submit" disabled={loading} whileTap={{ scale: 0.97 }}
                      className="w-full py-4 rounded-xl font-bold text-white text-sm tracking-widest transition-all disabled:opacity-50"
                      style={{ background: loading ? '#94a3b8' : '#17324d' }}
                    >
                      {loading ? '...' : t(lang, 'forgotPasswordBtn')}
                    </motion.button>
                  </form>

                  <div className="mt-5 text-center">
                    <Link to="/client/login"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600">
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
