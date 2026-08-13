import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Eye, EyeOff, Shield, CheckCircle2, XCircle } from 'lucide-react'
import { api } from '../api/index.js'
import { t } from '../i18n/translations'

function Rule({ ok, label }) {
  return (
    <div className={`flex items-center gap-2 text-xs font-medium transition-colors ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>
      {ok ? <CheckCircle2 size={13} className="text-emerald-500" /> : <XCircle size={13} className="text-slate-300" />}
      {label}
    </div>
  )
}

export default function ForcePasswordModal({ lang, onSuccess }) {
  const [current, setCurrent]   = useState('')
  const [next, setNext]         = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showC, setShowC]       = useState(false)
  const [showN, setShowN]       = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const rules = {
    length:  next.length >= 8,
    upper:   /[A-Z]/.test(next),
    digit:   /\d/.test(next),
    symbol:  /[!@#$%^&*()\-_=+{};:',.<>?/\\|`~]/.test(next),
    match:   next.length > 0 && next === confirm,
  }
  const allOk = Object.values(rules).every(Boolean)

  const ruleLabels = {
    length: lang === 'ar' ? '8 أحرف على الأقل' : 'Au moins 8 caractères',
    upper:  lang === 'ar' ? 'حرف كبير واحد' : 'Une lettre majuscule',
    digit:  lang === 'ar' ? 'رقم واحد' : 'Un chiffre',
    symbol: lang === 'ar' ? 'رمز خاص (!@#...)' : 'Un caractère spécial (!@#...)',
    match:  lang === 'ar' ? 'كلمتا السر متطابقتان' : 'Les mots de passe correspondent',
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!allOk) return
    setLoading(true); setError('')
    try {
      await api.auth.changePassword(current, next)
      onSuccess()
    } catch (err) {
      if (err.message === 'WRONG_CURRENT') {
        setError(lang === 'ar' ? 'كلمة المرور الحالية غير صحيحة' : 'Mot de passe actuel incorrect')
      } else if (err.message === 'WEAK_PASSWORD') {
        setError(lang === 'ar' ? 'كلمة المرور ضعيفة' : 'Mot de passe trop faible')
      } else {
        setError(lang === 'ar' ? 'حدث خطأ. حاول مجدداً.' : 'Une erreur est survenue.')
      }
    } finally { setLoading(false) }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ background: 'rgba(15,32,68,0.85)', backdropFilter: 'blur(8px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, scale: 0.93, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
        >
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-primary-500 to-primary-600 px-6 pt-8 pb-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3">
                <Shield size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-white mb-1">
                {lang === 'ar' ? 'تغيير كلمة المرور مطلوب' : 'Changement de mot de passe requis'}
              </h2>
              <p className="text-white/70 text-sm">
                {lang === 'ar'
                  ? 'يجب عليك تعيين كلمة مرور جديدة قبل المتابعة'
                  : 'Vous devez définir un nouveau mot de passe pour continuer'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl text-center">
                  {error}
                </div>
              )}

              {/* Current password */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">
                  {lang === 'ar' ? 'كلمة المرور الحالية' : 'Mot de passe actuel'}
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400" />
                  <input
                    type={showC ? 'text' : 'password'}
                    className="input-field ps-10 pe-10 text-sm"
                    value={current}
                    onChange={e => setCurrent(e.target.value)}
                    required
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowC(p => !p)}
                    className="absolute top-1/2 -translate-y-1/2 end-3.5 text-slate-400 hover:text-slate-600">
                    {showC ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">
                  {lang === 'ar' ? 'كلمة المرور الجديدة' : 'Nouveau mot de passe'}
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400" />
                  <input
                    type={showN ? 'text' : 'password'}
                    className="input-field ps-10 pe-10 text-sm"
                    value={next}
                    onChange={e => setNext(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowN(p => !p)}
                    className="absolute top-1/2 -translate-y-1/2 end-3.5 text-slate-400 hover:text-slate-600">
                    {showN ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">
                  {lang === 'ar' ? 'تأكيد كلمة المرور' : 'Confirmer le mot de passe'}
                </label>
                <input
                  type="password"
                  className="input-field text-sm"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>

              {/* Rules */}
              {next.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-3 grid grid-cols-2 gap-1.5">
                  {Object.entries(ruleLabels).map(([k, label]) => (
                    <Rule key={k} ok={rules[k]} label={label} />
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={!allOk || loading}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${
                  allOk && !loading
                    ? 'bg-accent text-primary-500 hover:bg-accent-300 shadow-lg shadow-accent/20'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {loading
                  ? (lang === 'ar' ? 'جاري الحفظ...' : 'Enregistrement...')
                  : (lang === 'ar' ? 'حفظ كلمة المرور' : 'Enregistrer')}
              </button>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
