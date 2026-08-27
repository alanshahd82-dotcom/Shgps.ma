import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, Mail, Shield, Loader2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import Logo from '../../components/Logo'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { loginAdmin, lang } = useApp()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const ok = await loginAdmin(email, password)
      if (ok) navigate('/admin/dashboard', { replace: true })
    } catch {
      setError(t(lang, 'invalidCredentials') || 'البريد الإلكتروني أو كلمة المرور غير صحيحة')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center overflow-hidden p-4"
      style={{
        background: 'linear-gradient(135deg, #F3F5F9 0%, #E9EDF4 100%)',
      }}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #1d4ed8 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #1d4ed8 0%, transparent 60%)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm"
      >
        {/* Card */}
        <div
          className="overflow-hidden rounded-[var(--ath-rs)] border border-white/80 bg-white shadow-xl shadow-primary-500/10"
          style={{
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Top accent bar */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #1d4ed8, #0F2044, #1d4ed8)' }} />

          {/* Header */}
            <div className="px-8 pb-6 pt-8 text-center">
            {/* Shield icon */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: 'spring', damping: 14, stiffness: 200 }}
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[var(--ath-r)]"
              style={{
                background: 'rgba(29, 78, 216,.10)',
                border: '1px solid rgba(29, 78, 216,.25)',
                boxShadow: '0 0 30px rgba(29, 78, 216,.12)',
              }}
            >
              <Shield size={30} style={{ color: '#1e40af' }} />
            </motion.div>

            {/* Logo */}
            <div className="flex justify-center mb-2">
              <Logo size="md" />
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {lang === 'ar' ? 'لوحة تحكم المسؤول' : 'Panneau d\'administration'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="px-8 pb-8 space-y-4">
            {/* Email field */}
            <div className="relative">
              <Mail
                size={16}
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400"
                style={{
                  insetInlineStart: '1rem',
                  color: '#94a3b8',
                }}
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none transition-all duration-200 focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/20"
                style={{
                  paddingBlock: '0.875rem',
                  paddingInlineStart: '2.75rem',
                  paddingInlineEnd: '1rem',
                }}
                placeholder={t(lang, 'email') || 'البريد الإلكتروني'}
                onFocus={e => {
                   e.target.style.borderColor = 'rgba(29, 78, 216,.65)'
                   e.target.style.boxShadow = '0 0 0 3px rgba(29, 78, 216,.12)'
                }}
                onBlur={e => {
                   e.target.style.borderColor = '#e2e8f0'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Password field */}
            <div className="relative">
              <Lock
                size={16}
                className="pointer-events-none absolute top-1/2 -translate-y-1/2"
                style={{
                  insetInlineStart: '1rem',
                  color: '#94a3b8',
                }}
              />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none transition-all duration-200 focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/20"
                style={{
                  paddingBlock: '0.875rem',
                  paddingInlineStart: '2.75rem',
                  paddingInlineEnd: '2.75rem',
                }}
                placeholder={t(lang, 'password') || 'كلمة المرور'}
                onFocus={e => {
                   e.target.style.borderColor = 'rgba(29, 78, 216,.65)'
                   e.target.style.boxShadow = '0 0 0 3px rgba(29, 78, 216,.12)'
                }}
                onBlur={e => {
                   e.target.style.borderColor = '#e2e8f0'
                  e.target.style.boxShadow = 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute top-1/2 -translate-y-1/2 transition-colors"
                style={{
                  insetInlineEnd: '1rem',
                  color: '#94a3b8',
                }}
                 onMouseEnter={e => e.currentTarget.style.color = '#475569'}
                 onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: '#fca5a5',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
               className="ath-btn-p flex w-full items-center justify-center gap-2 rounded-xl text-sm transition-all duration-200 hover:brightness-110 hover:shadow-lg hover:shadow-primary-500/15 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                 background: loading ? '#94a3b8' : undefined,
                paddingBlock: '0.875rem',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{lang === 'ar' ? 'جارٍ الدخول...' : 'Connexion...'}</span>
                </>
              ) : (
                <span>{t(lang, 'login') || 'تسجيل الدخول'}</span>
              )}
            </button>

            {/* Divider note */}
            <p
              className="text-center text-xs pt-1"
              style={{ color: '#94a3b8' }}
            >
              {lang === 'ar'
                ? 'هذه اللوحة مخصصة للمسؤولين فقط'
                : 'Accès réservé aux administrateurs'}
            </p>
          </form>
        </div>

        {/* Version badge */}
         <p className="mt-4 text-center text-xs text-slate-400">
          ATHAR GPS · Admin Panel
        </p>
      </motion.div>
    </div>
  )
}
