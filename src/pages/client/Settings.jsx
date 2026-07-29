import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Lock, Bell, Globe, LogOut, ChevronRight, Phone } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import MobileFrame from '../../components/MobileFrame'
import ClientNav from '../../components/ClientNav'

function ToggleSwitch({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      className="w-12 h-6 rounded-full transition-all duration-300 relative"
      style={{ background: value ? '#1DBF73' : '#E2E8F0' }}>
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${value ? 'right-0.5' : 'left-0.5'}`} />
    </button>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { clientAuth, logoutClient, lang, setLang } = useApp()

  const [speedAlerts,    setSpeedAlerts]    = useState(clientAuth?.alertSettings?.speed    ?? true)
  const [geofenceAlerts, setGeofenceAlerts] = useState(clientAuth?.alertSettings?.geofence ?? true)
  const [batteryAlerts,  setBatteryAlerts]  = useState(clientAuth?.alertSettings?.battery  ?? true)
  const [alertSaving,    setAlertSaving]    = useState(false)
  const [alertSaved,     setAlertSaved]     = useState(false)

  const [pwForm,    setPwForm]    = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError,   setPwError]   = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  const [phone,       setPhone]       = useState(clientAuth?.phone || '')
  const [phoneLoading,setPhoneLoading]= useState(false)
  const [phoneSaved,  setPhoneSaved]  = useState(false)

  const saveAlerts = async () => {
    setAlertSaving(true)
    try {
      await api.auth.updateSettings({ speed: speedAlerts, geofence: geofenceAlerts, battery: batteryAlerts })
      setAlertSaved(true)
      setTimeout(() => setAlertSaved(false), 2000)
    } catch {}
    setAlertSaving(false)
  }

  const changePassword = async (e) => {
    e.preventDefault()
    setPwError('')
    if (pwForm.newPassword !== pwForm.confirmPassword) return setPwError(t(lang, 'passwordMismatch'))
    setPwLoading(true)
    try {
      await api.auth.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
      setPwSuccess(true)
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setPwSuccess(false), 3000)
    } catch (err) { setPwError(err.message) }
    setPwLoading(false)
  }

  const savePhone = async () => {
    setPhoneLoading(true)
    try {
      await api.auth.updatePhone(phone)
      setPhoneSaved(true)
      setTimeout(() => setPhoneSaved(false), 2000)
    } catch {}
    setPhoneLoading(false)
  }

  const handleLogout = () => { logoutClient(); navigate('/client/login') }

  return (
    <MobileFrame>
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div className="flex-shrink-0 pt-14 pb-6 px-5" style={{ background: 'linear-gradient(160deg,#0B1F3A 0%,#0d2a50 100%)' }}>
          <h1 className="text-white font-bold text-xl mb-4">{t(lang, 'settingsTitle')}</h1>
          <div className="bg-white/10 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-primary-500"
              style={{ background: '#1DBF73' }}>
              {clientAuth?.avatar || '?'}
            </div>
            <div>
              <p className="text-white font-bold text-base">{clientAuth?.name || '—'}</p>
              <p className="text-white/60 text-xs">{clientAuth?.email || '—'}</p>
              <p className="text-white/60 text-xs">{clientAuth?.phone || '—'}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mobile-scroll pb-24 px-4 pt-4 space-y-4">
          {/* Language */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t(lang, 'languageSelect')}</p>
            </div>
            <div className="p-2 flex gap-2">
              {['ar', 'fr'].map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{ background: lang === l ? '#0B1F3A' : 'transparent', color: lang === l ? '#fff' : '#64748B' }}>
                  {l === 'ar' ? t(lang, 'arabic') : t(lang, 'french')}
                </button>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t(lang, 'alertsSection')}</p>
            </div>
            {[
              { label: t(lang, 'speedAlert'),    value: speedAlerts,    set: setSpeedAlerts },
              { label: t(lang, 'geofenceAlert'),  value: geofenceAlerts, set: setGeofenceAlerts },
              { label: t(lang, 'batteryAlert'),   value: batteryAlerts,  set: setBatteryAlerts },
            ].map(({ label, value, set }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <Bell size={16} className="text-primary-500" />
                  <span className="text-sm text-gray-700">{label}</span>
                </div>
                <ToggleSwitch value={value} onChange={set} />
              </div>
            ))}
            <div className="px-4 py-3">
              <button onClick={saveAlerts} disabled={alertSaving}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{ background: alertSaved ? '#1DBF73' : '#0B1F3A' }}>
                {alertSaved ? '✓ ' + t(lang, 'settingsSaved') : alertSaving ? t(lang, 'loading') : t(lang, 'saveSettings')}
              </button>
            </div>
          </div>

          {/* Edit Phone */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t(lang, 'editPhone')}</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative">
                <Phone size={16} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-primary-500"
                  placeholder="+212 6 XX XX XX XX" />
              </div>
              <button onClick={savePhone} disabled={phoneLoading}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{ background: phoneSaved ? '#1DBF73' : '#0B1F3A' }}>
                {phoneSaved ? '✓ ' + t(lang, 'settingsSaved') : phoneLoading ? t(lang, 'loading') : t(lang, 'save')}
              </button>
            </div>
          </div>

          {/* Change Password */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t(lang, 'changePassword')}</p>
            </div>
            <form onSubmit={changePassword} className="p-4 space-y-3">
              {[
                { key: 'currentPassword', placeholder: t(lang, 'currentPassword') },
                { key: 'newPassword',     placeholder: t(lang, 'newPassword') },
                { key: 'confirmPassword', placeholder: t(lang, 'confirmPassword') },
              ].map(({ key, placeholder }) => (
                <div key={key} className="relative">
                  <Lock size={14} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
                  <input type="password" value={pwForm[key]}
                    onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                    required className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:border-primary-500"
                    placeholder={placeholder} />
                </div>
              ))}
              {pwError   && <p className="text-red-400 text-xs bg-red-50 rounded-xl px-3 py-2">{pwError}</p>}
              {pwSuccess  && <p className="text-xs bg-emerald-50 rounded-xl px-3 py-2" style={{ color: '#1DBF73' }}>{t(lang, 'passwordChanged')}</p>}
              <button type="submit" disabled={pwLoading}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{ background: '#0B1F3A' }}>
                {pwLoading ? t(lang, 'loading') : t(lang, 'changePassword')}
              </button>
            </form>
          </div>

          {/* Logout */}
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-white rounded-2xl px-4 py-4 shadow-sm border border-gray-100 text-red-500 font-semibold text-sm">
            <LogOut size={16} />
            {t(lang, 'logout')}
          </button>
        </div>

        <ClientNav />
      </div>
    </MobileFrame>
  )
}
