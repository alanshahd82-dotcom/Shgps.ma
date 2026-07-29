import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Hash, CheckCircle } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import MobileFrame from '../../components/MobileFrame'
import ClientNav from '../../components/ClientNav'

export default function DeviceOnboarding() {
  const navigate = useNavigate()
  const { lang } = useApp()
  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error,   setError]   = useState('')

  const handleActivate = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.devices.activate(code)
      setSuccess(data.device)
    } catch (err) {
      setError(err.message || t(lang, 'error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <MobileFrame>
      <div className="h-full flex flex-col bg-gray-50">
        <div className="flex-shrink-0 pt-14 px-4 pb-6" style={{ background: 'linear-gradient(160deg,#0B1F3A 0%,#0d2a50 100%)' }}>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <ArrowLeft size={18} className="text-white" />
            </button>
            <h1 className="text-white font-bold text-lg">{t(lang, 'addDevice')}</h1>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-5 pb-24 space-y-6">
          {success ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: '#1DBF7320' }}>
                <CheckCircle size={40} style={{ color: '#1DBF73' }} />
              </div>
              <p className="text-xl font-bold text-primary-500">{t(lang, 'deviceActivated')}</p>
              <p className="text-gray-500 text-sm">{success.name}</p>
              <button
                onClick={() => navigate('/client/home')}
                className="w-full text-white font-bold py-4 rounded-2xl mt-4"
                style={{ background: '#1DBF73' }}>
                {lang === 'ar' ? 'العودة للرئيسية' : 'Retour à l\'accueil'}
              </button>
            </motion.div>
          ) : (
            <>
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-4xl" style={{ background: '#0B1F3A10' }}>
                  📡
                </div>
                <h2 className="text-xl font-bold text-primary-500 mb-2">{t(lang, 'activationCode')}</h2>
                <p className="text-gray-400 text-sm">{t(lang, 'activationCodeHint')}</p>
              </div>

              <form onSubmit={handleActivate} className="space-y-4">
                <div className="relative">
                  <Hash size={18} className="absolute top-1/2 -translate-y-1/2 left-4 text-gray-400" />
                  <input
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    required maxLength={10}
                    className="w-full bg-white border border-gray-200 text-primary-500 rounded-2xl pl-12 pr-4 py-4 text-sm outline-none text-center font-bold text-lg tracking-widest shadow-sm"
                    placeholder="XXXXXX"
                  />
                </div>
                {error && (
                  <p className="text-red-400 text-sm text-center bg-red-50 rounded-xl py-2 px-3">{error}</p>
                )}
                <button type="submit" disabled={loading || code.length < 4}
                  className="w-full text-white font-bold py-4 rounded-2xl disabled:opacity-50 transition-all active:scale-95"
                  style={{ background: '#1DBF73' }}>
                  {loading ? t(lang, 'loading') : t(lang, 'activateDevice')}
                </button>
              </form>
            </>
          )}
        </div>

        <ClientNav />
      </div>
    </MobileFrame>
  )
}
