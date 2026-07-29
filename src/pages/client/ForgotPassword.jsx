import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, ArrowLeft } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import MobileFrame from '../../components/MobileFrame'
import Logo from '../../components/Logo'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const { lang } = useApp()
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.auth.forgotPassword(email)
      setSuccess(true)
    } catch (err) {
      setError(err.message || t(lang, 'error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <MobileFrame>
      <div className="h-full flex flex-col" style={{ background: 'linear-gradient(160deg,#0B1F3A 0%,#0d2a50 100%)' }}>
        <div className="flex-shrink-0 pt-14 px-5">
          <button onClick={() => navigate('/client/login')} className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-8">
            <ArrowLeft size={16} /><span>{t(lang, 'back')}</span>
          </button>
          <Logo size="sm" />
          <h1 className="text-white text-2xl font-black mt-6">{t(lang, 'forgotPasswordTitle')}</h1>
          <p className="text-white/50 text-sm mt-1">{t(lang, 'forgotPasswordSubtitle')}</p>
        </div>

        <div className="flex-1 flex flex-col justify-center px-5 pb-10">
          {success ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-3xl"
                style={{ background: '#1DBF7320' }}>✉️</div>
              <p className="text-white font-bold text-lg">{t(lang, 'otpSent')}</p>
              <button
                onClick={() => navigate('/client/reset-password', { state: { email } })}
                className="w-full text-white font-bold py-4 rounded-2xl"
                style={{ background: '#1DBF73' }}>
                {t(lang, 'resetPassword')}
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail size={18} className="absolute top-1/2 -translate-y-1/2 left-4 text-slate-400" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full bg-white/10 text-white placeholder-white/40 rounded-2xl pl-12 pr-4 py-4 text-sm outline-none"
                  placeholder={t(lang, 'email')}
                />
              </div>
              {error && (
                <p className="text-red-400 text-sm text-center bg-red-500/10 rounded-xl py-2 px-3">{error}</p>
              )}
              <button type="submit" disabled={loading}
                className="w-full text-white font-bold py-4 rounded-2xl disabled:opacity-60"
                style={{ background: '#1DBF73' }}>
                {loading ? t(lang, 'loading') : t(lang, 'sendOtp')}
              </button>
            </form>
          )}
        </div>
      </div>
    </MobileFrame>
  )
}
