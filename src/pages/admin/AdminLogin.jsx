import React, { useState } from 'react'
    import { useNavigate } from 'react-router-dom'
    import { motion } from 'framer-motion'
    import { Eye, EyeOff, Lock, Mail, Shield } from 'lucide-react'
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
      const ok = await loginAdmin(email, password)
      setLoading(false)
      if (ok) {
        navigate('/admin/dashboard', { replace: true })
      } else {
        setError(t(lang, 'invalidCredentials') || 'البريد الإلكتروني أو كلمة المرور غير صحيحة')
      }
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6"
        style={{ background:'linear-gradient(150deg,#0F2044 0%,#0a1628 60%,#0d2240 100%)' }}>
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
          className="w-full max-w-sm bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-primary-500/20 rounded-2xl flex items-center justify-center mb-4">
              <Shield size={28} className="text-primary-400" />
            </div>
            <Logo size="sm" />
            <p className="text-white/50 text-sm mt-2">{t(lang, 'adminLoginSubtitle') || 'لوحة تحكم المدير'}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail size={17} className="absolute top-1/2 -translate-y-1/2 left-4 text-slate-400" />
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-white/10 text-white placeholder-white/40 rounded-2xl pl-11 pr-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={t(lang, 'email') || 'البريد الإلكتروني'}
              />
            </div>
            <div className="relative">
              <Lock size={17} className="absolute top-1/2 -translate-y-1/2 left-4 text-slate-400" />
              <input
                type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full bg-white/10 text-white placeholder-white/40 rounded-2xl pl-11 pr-11 py-3.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={t(lang, 'password') || 'كلمة المرور'}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute top-1/2 -translate-y-1/2 right-4 text-white/40">
                {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {error && (
              <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} className="text-red-400 text-sm text-center bg-red-500/10 rounded-xl py-2 px-3">
                {error}
              </motion.p>
            )}
            <button type="submit" disabled={loading}
              className="w-full bg-primary-500 text-white font-bold py-3.5 rounded-2xl transition-all active:scale-95 disabled:opacity-60">
              {loading ? '...' : (t(lang, 'login') || 'دخول')}
            </button>
          </form>
        </motion.div>
      </div>
    )
    }
    