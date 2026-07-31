import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Lock, Bell, Globe, LogOut, ChevronRight, Shield, Eye, EyeOff,
  CheckCircle2, XCircle, Save, X
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'
import Logo from '../../components/Logo'

function ToggleSwitch({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full transition-all duration-300 relative ${value ? 'bg-accent' : 'bg-gray-200'}`}
    >
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${
        value ? 'left-6' : 'left-0.5'
      }`} />
    </button>
  )
}

function EditProfileModal({ open, onClose, currentName, currentPhone, lang, onSaved }) {
  const [name, setName]   = useState(currentName || '')
  const [phone, setPhone] = useState(currentPhone || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await api.auth.updateProfile({ name, phone })
      onSaved({ name, phone })
      onClose()
    } catch {
      setError(lang === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'Erreur lors de la sauvegarde')
    } finally { setSaving(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} />
          <motion.div
            className="fixed inset-x-4 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[420px] z-50"
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
          >
            <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-primary-500 text-lg">{t(lang, 'personalInfo')}</h3>
                <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                  <X size={16} className="text-slate-400" />
                </button>
              </div>
              {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t(lang, 'name')}</label>
                  <input className="input-field text-sm" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t(lang, 'phone')}</label>
                  <input className="input-field text-sm" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <button type="submit" disabled={saving}
                  className="w-full btn-primary py-3 flex items-center justify-center gap-2">
                  <Save size={15} />
                  {saving ? (lang === 'ar' ? 'جاري الحفظ...' : 'Enregistrement...') : t(lang, 'save')}
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function ChangePasswordModal({ open, onClose, lang }) {
  const [current, setCurrent] = useState('')
  const [next, setNext]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [showC, setShowC]     = useState(false)
  const [showN, setShowN]     = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)

  const rules = {
    length:  next.length >= 8,
    upper:   /[A-Z]/.test(next),
    digit:   /\d/.test(next),
    symbol:  /[!@#$%^&*()\-_=+{};:',.<>?/\\|`~]/.test(next),
    match:   next.length > 0 && next === confirm,
  }
  const allOk = Object.values(rules).every(Boolean)

  async function handleSave(e) {
    e.preventDefault()
    if (!allOk) return
    setSaving(true); setError('')
    try {
      await api.auth.changePassword(current, next)
      setSuccess(true)
      setTimeout(() => { setSuccess(false); onClose(); setCurrent(''); setNext(''); setConfirm('') }, 1500)
    } catch (err) {
      if (err.message === 'WRONG_CURRENT')
        setError(lang === 'ar' ? 'كلمة المرور الحالية غير صحيحة' : 'Mot de passe actuel incorrect')
      else if (err.message === 'WEAK_PASSWORD')
        setError(lang === 'ar' ? 'كلمة المرور ضعيفة جداً' : 'Mot de passe trop faible')
      else
        setError(lang === 'ar' ? 'حدث خطأ' : 'Une erreur est survenue')
    } finally { setSaving(false) }
  }

  const ruleLabels = {
    length: lang === 'ar' ? '8 أحرف على الأقل' : 'Au moins 8 caractères',
    upper:  lang === 'ar' ? 'حرف كبير' : 'Majuscule',
    digit:  lang === 'ar' ? 'رقم' : 'Chiffre',
    symbol: lang === 'ar' ? 'رمز خاص' : 'Caractère spécial',
    match:  lang === 'ar' ? 'متطابقتان' : 'Identiques',
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} />
          <motion.div
            className="fixed inset-x-4 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[420px] z-50"
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
          >
            <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-primary-500 text-lg">{t(lang, 'changePassword')}</h3>
                <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                  <X size={16} className="text-slate-400" />
                </button>
              </div>
              {success && (
                <div className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 py-3 rounded-xl mb-3">
                  <CheckCircle2 size={16} />
                  <span className="text-sm font-semibold">
                    {lang === 'ar' ? 'تم تغيير كلمة المرور' : 'Mot de passe modifié'}
                  </span>
                </div>
              )}
              {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}
              {!success && (
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      {lang === 'ar' ? 'كلمة المرور الحالية' : 'Actuel'}
                    </label>
                    <div className="relative">
                      <input type={showC ? 'text' : 'password'} className="input-field text-sm pe-10"
                        value={current} onChange={e => setCurrent(e.target.value)} required />
                      <button type="button" onClick={() => setShowC(p => !p)}
                        className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400">
                        {showC ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      {lang === 'ar' ? 'كلمة المرور الجديدة' : 'Nouveau'}
                    </label>
                    <div className="relative">
                      <input type={showN ? 'text' : 'password'} className="input-field text-sm pe-10"
                        value={next} onChange={e => setNext(e.target.value)} required />
                      <button type="button" onClick={() => setShowN(p => !p)}
                        className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400">
                        {showN ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      {lang === 'ar' ? 'تأكيد' : 'Confirmer'}
                    </label>
                    <input type="password" className="input-field text-sm" value={confirm}
                      onChange={e => setConfirm(e.target.value)} required />
                  </div>
                  {next.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-50 rounded-xl p-3">
                      {Object.entries(ruleLabels).map(([k, label]) => (
                        <div key={k} className={`flex items-center gap-1.5 text-xs ${rules[k] ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {rules[k] ? <CheckCircle2 size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-slate-300" />}
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="submit" disabled={!allOk || saving}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                      allOk && !saving ? 'btn-primary' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}>
                    {saving ? (lang === 'ar' ? 'جاري الحفظ...' : 'Enregistrement...') : t(lang, 'save')}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { clientAuth, logoutClient, lang, setLang, updateUserInContext } = useApp()
  const [speedAlerts, setSpeedAlerts]         = useState(true)
  const [geofenceAlerts, setGeofenceAlerts]   = useState(true)
  const [batteryAlerts, setBatteryAlerts]     = useState(true)
  const [savingSettings, setSavingSettings]   = useState(false)
  const [settingsSaved, setSettingsSaved]     = useState(false)

  // Load saved notification preferences from backend
  useEffect(() => {
    api.auth.me().then(user => {
      const n = user?.notifications
      if (!n) return
      if (n.speedAlerts    != null) setSpeedAlerts(!!n.speedAlerts)
      if (n.geofenceAlerts != null) setGeofenceAlerts(!!n.geofenceAlerts)
      if (n.batteryAlerts  != null) setBatteryAlerts(!!n.batteryAlerts)
    }).catch(() => { /* use defaults */ })
  }, []) // eslint-disable-line
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showChangePwd, setShowChangePwd]     = useState(false)
  const [profile, setProfile] = useState({
    name:  clientAuth?.name  || '',
    phone: clientAuth?.phone || '',
  })

  const handleLogout = () => {
    logoutClient()
    navigate('/client/login')
  }

  async function saveSettings() {
    setSavingSettings(true)
    try {
      await api.auth.updateProfile({
        notifications: { speedAlerts, geofenceAlerts, batteryAlerts },
      })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2500)
    } catch {
      // silent — preferences already applied locally
    } finally {
      setSavingSettings(false)
    }
  }

  function handleProfileSaved(data) {
    setProfile(prev => ({ ...prev, ...data }))
    if (updateUserInContext) updateUserInContext(data)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <EditProfileModal
        open={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        currentName={profile.name}
        currentPhone={profile.phone}
        lang={lang}
        onSaved={handleProfileSaved}
      />
      <ChangePasswordModal
        open={showChangePwd}
        onClose={() => setShowChangePwd(false)}
        lang={lang}
      />

      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div className="flex-shrink-0 pt-14 pb-6 px-5"
          style={{ background: 'linear-gradient(160deg, #0F2044 0%, #162d5e 100%)' }}>
          <h1 className="text-white font-bold text-xl mb-4">{t(lang, 'settingsTitle')}</h1>
          <div className="bg-white/10 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-2xl font-bold text-primary-500">
              {profile.name?.[0] || clientAuth?.avatar || 'م'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-base truncate">{profile.name || clientAuth?.name || ''}</p>
              <p className="text-white/60 text-xs truncate">{clientAuth?.email || ''}</p>
              <p className="text-white/60 text-xs">{profile.phone || clientAuth?.phone || ''}</p>
            </div>
            <button
              onClick={() => setShowEditProfile(true)}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <User size={15} className="text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mobile-scroll pb-24 px-4 pt-4 space-y-4">
          {/* Language */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t(lang, 'languageSelect')}</p>
            </div>
            <div className="p-3 flex gap-2">
              {[{ code: 'ar', label: '🇲🇦 العربية' }, { code: 'fr', label: '🇫🇷 Français' }].map(l => (
                <button key={l.code} onClick={() => setLang(l.code)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                    lang === l.code ? 'bg-primary-500 text-white shadow-md' : 'bg-gray-50 text-slate-500 hover:bg-gray-100'
                  }`}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t(lang, 'notifications')}</p>
            </div>
            {[
              { label: t(lang, 'speedAlerts'),    val: speedAlerts,    set: setSpeedAlerts },
              { label: t(lang, 'geofenceAlerts'), val: geofenceAlerts, set: setGeofenceAlerts },
              { label: t(lang, 'batteryAlerts'),  val: batteryAlerts,  set: setBatteryAlerts },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50 last:border-0">
                <span className="text-sm font-medium text-primary-500">{item.label}</span>
                <ToggleSwitch value={item.val} onChange={item.set} />
              </div>
            ))}
            <div className="px-4 py-3">
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="w-full py-2.5 rounded-xl bg-primary-500 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
              >
                <Save size={14} />
                {savingSettings
                  ? (lang === 'ar' ? 'جاري الحفظ...' : 'Enregistrement...')
                  : settingsSaved
                    ? (lang === 'ar' ? '✅ تم الحفظ' : '✅ Enregistré')
                    : t(lang, 'save')}
              </button>
            </div>
          </div>

          {/* Account */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t(lang, 'profile')}</p>
            </div>
            <button onClick={() => setShowEditProfile(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
                  <User size={15} className="text-primary-500" />
                </div>
                <span className="text-sm font-medium text-primary-500">{t(lang, 'personalInfo')}</span>
              </div>
              <ChevronRight size={15} className="text-slate-300" />
            </button>
            <button onClick={() => setShowChangePwd(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Lock size={15} className="text-primary-500" />
                </div>
                <span className="text-sm font-medium text-primary-500">{t(lang, 'changePassword')}</span>
              </div>
              <ChevronRight size={15} className="text-slate-300" />
            </button>
          </div>

          {/* App info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <Logo size="sm" />
              <span className="text-xs bg-primary-50 text-primary-500 font-semibold px-2 py-1 rounded-lg">v1.1.0</span>
            </div>
            <p className="text-xs text-slate-400">
              {lang === 'ar' ? '© 2025 AtharGPS — جميع الحقوق محفوظة' : '© 2025 AtharGPS — Tous droits réservés'}
            </p>
          </div>

          <button onClick={handleLogout}
            className="w-full bg-red-50 text-red-500 border border-red-100 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors active:scale-98">
            <LogOut size={16} />
            {t(lang, 'logout')}
          </button>
        </div>

        <ClientNav />
      </div>
    </div>
  )
}
