import React, { useState } from 'react'
    import { useNavigate } from 'react-router-dom'
    import { motion } from 'framer-motion'
    import { Eye, EyeOff, Lock, Mail, ArrowLeft } from 'lucide-react'
    import { useApp } from '../../context/AppContext'
    import { t } from '../../i18n/translations'
    import Logo from '../../components/Logo'

    export default function ClientLogin() {
    const navigate = useNavigate()
    const { loginClient, lang } = useApp()
    const [email,    setEmail]    = useState('')
    const [password, setPassword] = useState('')
    const [showPass, setShowPass] = useState(false)
    const [error,    setError]    = useState('')
    const [loading,  setLoading]  = useState(false)

    const handleLogin = async (e) => {
      e.preventDefault()
      setError('')
      setLoading(true)
      const ok = await loginClient(email, password)
      setLoading(false)
      if (ok) {
        navigate('/client/home', { replace: true })
      } else {
        setError(t(lang, 'invalidCredentials') || 'البريد الإلكتروني أو كلمة المرور غير صحيحة')
      }
    }

    return (
      <div className="min-h-screen flex flex-col">
        <div className="min-h-screen flex flex-col" style={{ background:'linear-gradient(160deg,#0F2044 0%,#162d5e 100%)' }}>
          <div className="flex-shrink-0 pt-14 px-5">
            <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-sm mb-8">
              <ArrowLeft size={16} />
              <span>{t(lang, 'back') || 'رجوع'}</span>
            </button>
            <Logo size="sm" />
            <h1 className="text-white text-2xl font-black mt-6">{t(lang, 'clientLogin') || 'تسجيل الدخول'}</h1>
            <p className="text-white/50 text-sm mt-1">{t(lang, 'clientLoginSubtitle') || 'أدخل بياناتك للوصول لأجهزتك'}</p>
          </div>

          <div className="flex-1 flex flex-col justify-center px-5 pb-10">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail size={18} className="absolute top-1/2 -translate-y-1/2 left-4 text-slate-400" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full bg-white/10 text-white placeholder-white/40 rounded-2xl pl-12 pr-4 py-4 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={t(lang, 'email') || 'البريد الإلكتروني'}
                />
              </div>
              <div className="relative">
                <Lock size={18} className="absolute top-1/2 -translate-y-1/2 left-4 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full bg-white/10 text-white placeholder-white/40 rounded-2xl pl-12 pr-12 py-4 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={t(lang, 'password') || 'كلمة المرور'}
                />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute top-1/2 -translate-y-1/2 right-4 text-white/40">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {error && (
                <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} className="text-red-400 text-sm text-center bg-red-500/10 rounded-xl py-2 px-3">
                  {error}
                </motion.p>
              )}
              <button type="submit" disabled={loading}
                className="w-full bg-primary-500 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-60 mt-2">
                {loading ? '...' : (t(lang, 'login') || 'دخول')}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
    }
    