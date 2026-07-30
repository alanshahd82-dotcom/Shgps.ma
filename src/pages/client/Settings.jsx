import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Lock, Bell, Globe, LogOut, ChevronRight, Shield, Info } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'
import Logo from '../../components/Logo'

export default function Settings() {
  const navigate = useNavigate()
  const { clientAuth, logoutClient, lang, setLang } = useApp()
  const [speedAlerts, setSpeedAlerts] = useState(true)
  const [geofenceAlerts, setGeofenceAlerts] = useState(true)
  const [batteryAlerts, setBatteryAlerts] = useState(true)

  const handleLogout = () => {
    logoutClient()
    navigate('/client/login')
  }

  const ToggleSwitch = ({ value, onChange }) => (
    <button
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full transition-all duration-300 relative ${value ? 'bg-accent' : 'bg-gray-200'}`}
    >
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${value ? (lang === 'ar' ? 'right-0.5' : 'left-6') : (lang === 'ar' ? 'right-6' : 'left-0.5')}`} />
    </button>
  )

  return (
    <div className="min-h-screen flex flex-col">
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div
          className="flex-shrink-0 pt-14 pb-6 px-5"
          style={{ background: 'linear-gradient(160deg, #0F2044 0%, #162d5e 100%)' }}
        >
          <h1 className="text-white font-bold text-xl mb-4">{t(lang, 'settingsTitle')}</h1>
          {/* Profile card */}
          <div className="bg-white/10 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-2xl font-bold text-primary-500">
              {clientAuth?.avatar || 'م'}
            </div>
            <div>
              <p className="text-white font-bold text-base">{clientAuth?.name || 'محمد العلوي'}</p>
              <p className="text-white/60 text-xs">{clientAuth?.email || 'demo@athargps.com'}</p>
              <p className="text-white/60 text-xs">{clientAuth?.phone || '+212 6 12 34 56 78'}</p>
            </div>
          </div>
        </div>

        {/* Settings sections */}
        <div className="flex-1 overflow-y-auto mobile-scroll pb-24 px-4 pt-4 space-y-4">

          {/* Language */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t(lang, 'languageSelect')}</p>
            </div>
            <div className="p-3 flex gap-2">
              {[
                { code: 'ar', label: '🇲🇦 العربية' },
                { code: 'fr', label: '🇫🇷 Français' },
              ].map(l => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                    lang === l.code
                      ? 'bg-primary-500 text-white shadow-md'
                      : 'bg-gray-50 text-slate-500 hover:bg-gray-100'
                  }`}
                >
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
              { label: t(lang, 'speedAlerts'), val: speedAlerts, set: setSpeedAlerts },
              { label: t(lang, 'geofenceAlerts'), val: geofenceAlerts, set: setGeofenceAlerts },
              { label: t(lang, 'batteryAlerts'), val: batteryAlerts, set: setBatteryAlerts },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50 last:border-0">
                <span className="text-sm font-medium text-primary-500">{item.label}</span>
                <ToggleSwitch value={item.val} onChange={item.set} />
              </div>
            ))}
          </div>

          {/* Account */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t(lang, 'profile')}</p>
            </div>
            {[
              { icon: User, label: t(lang, 'personalInfo') },
              { icon: Lock, label: t(lang, 'changePassword') },
              { icon: Shield, label: lang === 'ar' ? 'الأمان والخصوصية' : 'Sécurité et confidentialité' },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <button key={i} className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
                      <Icon size={15} className="text-primary-500" />
                    </div>
                    <span className="text-sm font-medium text-primary-500">{item.label}</span>
                  </div>
                  <ChevronRight size={15} className="text-slate-300" />
                </button>
              )
            })}
          </div>

          {/* App info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <Logo size="sm" />
              <span className="text-xs bg-primary-50 text-primary-500 font-semibold px-2 py-1 rounded-lg">v1.0.0</span>
            </div>
            <p className="text-xs text-slate-400">{lang === 'ar' ? '© 2025 AtharGPS — جميع الحقوق محفوظة' : '© 2025 AtharGPS — Tous droits réservés'}</p>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full bg-red-50 text-red-500 border border-red-100 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors active:scale-98"
          >
            <LogOut size={16} />
            {t(lang, 'logout')}
          </button>
        </div>

        <ClientNav />
      </div>
    </div>
  )
}
