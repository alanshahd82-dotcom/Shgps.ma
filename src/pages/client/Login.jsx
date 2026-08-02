import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'

export default function Login() {
  const navigate = useNavigate()
  const { loginClient, lang, setLang } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await loginClient(email, password)
      navigate('/client/home')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isAr = lang === 'ar'

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(160deg,#080f1f 0%,#0F2044 55%,#0a1833 100%)' }}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Top bar */}
      <div className="flex justify-between items-center px-5 pt-12 pb-4">
        <button
          onClick={() => setLang(isAr ? 'fr' : 'ar')}
          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
          style={{ border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.55)' }}
        >
          {isAr ? 'FR' : 'AR'}
        </button>
        <div style={{ width: 40 }} />
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-7">

        {/* Logo */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 18 }}
          className="mb-10 flex flex-col items-center"
        >
          <div className="relative mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute', inset: -4, borderRadius: '50%',
                background: 'conic-gradient(from 0deg, transparent 55%, #00D97E 100%)',
              }}
            />
            <div
              className="relative w-28 h-28 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg,#0F2044 0%,#162952 100%)',
                border: '2px solid rgba(0,217,126,0.45)',
                boxShadow: '0 0 50px rgba(0,217,126,0.18),inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            >
              <svg width="54" height="54" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#00D97E" opacity="0.18"/>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#00D97E" strokeWidth="1.5" fill="none"/>
                <circle cx="12" cy="9" r="3" fill="#00D97E"/>
                <path d="M9.5 4.8 Q12 2.5 14.5 4.8" stroke="#00D97E" strokeWidth="1" fill="none" opacity="0.55" strokeLinecap="round"/>
                <path d="M7.5 3.5 Q12 0.5 16.5 3.5" stroke="#00D97E" strokeWidth="0.8" fill="none" opacity="0.28" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-widest">AtharGPS</h1>
          <p className="text-xs mt-1.5 tracking-wide" style={{ color: 'rgba(255,255,255,0.38)' }}>{t(lang, 'tagline')}</p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 120 }}
          className="w-full max-w-sm"
        >
          <div
            className="rounded-3xl p-6"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <h2 className="text-white font-semibold text-center mb-5 text-sm tracking-wide">
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
                    {t(lang, 'invalidCredentials')}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-medium tracking-widest uppercase mb-2" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  {t(lang, 'email')}
                </label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={t(lang, 'emailPlaceholder')} required dir="ltr"
                  className="w-full rounded-xl px-4 py-3.5 text-white text-sm outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium tracking-widest uppercase mb-2" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  {t(lang, 'password')}
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                    className="w-full rounded-xl px-4 py-3.5 text-white text-sm outline-none transition-all"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                  />
                  <button
                    type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute top-1/2 -translate-y-1/2 transition-colors"
                    style={{ [isAr ? 'left' : 'right']: '1rem', color: 'rgba(255,255,255,0.32)' }}
                  >
                    {showPass ? <EyeOff size={17}/> : <Eye size={17}/>}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <motion.button
                type="submit" disabled={loading} whileTap={{ scale: 0.97 }}
                className="w-full py-4 rounded-xl font-bold text-white text-sm tracking-widest mt-2 transition-all disabled:opacity-50"
                style={{
                  background: loading ? 'rgba(0,217,126,0.4)' : 'linear-gradient(135deg,#00D97E 0%,#00b86a 100%)',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(0,217,126,0.38)',
                }}
              >
                {loading ? '...' : t(lang, 'loginBtn')}
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>

      <div className="pb-10 text-center">
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>© 2025 AtharGPS · Shgps.ma</p>
      </div>
    </div>
  )
}
