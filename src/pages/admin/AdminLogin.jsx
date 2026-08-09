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
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0F2044 45%, #0d2a50 100%)',
      }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #00D97E 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #00D97E 0%, transparent 60%)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm"
      >
        {/* Card */}
        <div
          className="rounded-3xl overflow-hidden shadow-2xl"
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {/* Top accent bar */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #00D97E, #0F2044, #00D97E)' }} />

          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center">
            {/* Shield icon */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: 'spring', damping: 14, stiffness: 200 }}
              className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(0,217,126,0.2) 0%, rgba(0,217,126,0.05) 100%)',
                border: '1px solid rgba(0,217,126,0.3)',
                boxShadow: '0 0 30px rgba(0,217,126,0.15)',
              }}
            >
              <Shield size={30} className="text-accent" style={{ color: '#00D97E' }} />
            </motion.div>

            {/* Logo */}
            <div className="flex justify-center mb-2">
              <Logo size="md" white />
            </div>

            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {lang === 'ar' ? 'لوحة تحكم المسؤول' : 'Panneau d\'administration'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="px-8 pb-8 space-y-4">
            {/* Email field */}
            <div className="relative">
              <Mail
                size={16}
                className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                style={{
                  insetInlineStart: '1rem',
                  color: 'rgba(255,255,255,0.35)',
                }}
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-2xl text-sm outline-none transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white',
                  paddingBlock: '0.875rem',
                  paddingInlineStart: '2.75rem',
                  paddingInlineEnd: '1rem',
                }}
                placeholder={t(lang, 'email') || 'البريد الإلكتروني'}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(0,217,126,0.5)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(0,217,126,0.1)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.12)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Password field */}
            <div className="relative">
              <Lock
                size={16}
                className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  insetInlineStart: '1rem',
                  color: 'rgba(255,255,255,0.35)',
                }}
              />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-2xl text-sm outline-none transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white',
                  paddingBlock: '0.875rem',
                  paddingInlineStart: '2.75rem',
                  paddingInlineEnd: '2.75rem',
                }}
                placeholder={t(lang, 'password') || 'كلمة المرور'}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(0,217,126,0.5)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(0,217,126,0.1)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.12)'
                  e.target.style.boxShadow = 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? 'إخفاء كلمة المرور / Masquer' : 'إظهار كلمة المرور / Afficher'}
                className="absolute top-1/2 -translate-y-1/2 transition-colors"
                style={{
                  insetInlineEnd: '1rem',
                  color: 'rgba(255,255,255,0.35)',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
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
              className="w-full rounded-2xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              style={{
                background: loading ? 'rgba(0,217,126,0.6)' : '#00D97E',
                color: '#0F2044',
                paddingBlock: '0.875rem',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(0,217,126,0.3)',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#00c471' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#00D97E' }}
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
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              {lang === 'ar'
                ? 'هذه اللوحة مخصصة للمسؤولين فقط'
                : 'Accès réservé aux administrateurs'}
            </p>
          </form>
        </div>

        {/* Version badge */}
        <p className="text-center mt-4 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          ATHAR GPS · Admin Panel
        </p>
      </motion.div>
    </div>
  )
}
