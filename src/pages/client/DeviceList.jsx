import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, Battery, Signal, Clock } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'

function timeAgo(iso, lang) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return t(lang, 'just_now')
  if (diff < 60) return `${diff} ${t(lang, 'minutes')}`
  return `${Math.floor(diff / 60)} ${t(lang, 'hours')}`
}

export default function DeviceList() {
  const navigate = useNavigate()
  // Backend already returns only the current user's devices
  const { devices, lang } = useApp()

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div
          className="flex-shrink-0 pt-14 pb-5 px-5"
          style={{ background: 'linear-gradient(160deg, #0F2044 0%, #162d5e 100%)' }}
        >
          <h1 className="text-white font-bold text-xl">{t(lang, 'myDevices')}</h1>
          <p className="text-white/50 text-xs mt-1">{devices.length} {lang === 'ar' ? 'جهاز مسجل' : 'appareils enregistrés'}</p>
        </div>

        {/* Devices */}
        <div className="flex-1 overflow-y-auto mobile-scroll pb-24 pt-3 px-4 space-y-3">
          {devices.length === 0 && (
            <div className="text-center py-16 text-slate-400 text-sm">
              {lang === 'ar' ? 'لا توجد أجهزة مسجلة' : 'Aucun appareil enregistré'}
            </div>
          )}
          {devices.map((device, i) => {
            const isOnline = device.status === 'online'
            return (
              <motion.div
                key={device.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer active:scale-99"
                onClick={() => navigate(`/client/device/${device.id}`)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Top bar */}
                <div className={`h-1.5 ${isOnline ? 'bg-gradient-to-r from-emerald-400 to-accent' : 'bg-gray-200'}`} />

                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${isOnline ? 'bg-primary-50' : 'bg-gray-100'}`}>
                        {device.type === 'car' ? '🚗' : device.type === 'bike' ? '🏍️' : '🚚'}
                      </div>
                      <div>
                        <p className="font-bold text-primary-500 text-sm">{device.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{device.plate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                        {isOnline ? t(lang, 'online') : t(lang, 'offline')}
                      </span>
                      <ChevronRight size={16} className="text-slate-300" />
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex items-center gap-1.5">
                      <Battery size={13} className={device.battery != null && device.battery < 30 ? 'text-red-500' : 'text-slate-400'} />
                      <span className={`text-xs font-semibold ${device.battery != null && device.battery < 30 ? 'text-red-500' : 'text-slate-600'}`}>
                        {device.battery != null ? `${device.battery}%` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Signal size={13} className="text-slate-400" />
                      <span className="text-xs font-semibold text-slate-600">
                        {device.signal != null ? `${device.signal}/4` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} className="text-slate-400" />
                      <span className="text-xs text-slate-400">{timeAgo(device.lastUpdate, lang)}</span>
                    </div>
                  </div>

                  {/* Speed (online only) */}
                  {isOnline && (
                    <div className="mt-3 bg-primary-50 rounded-xl px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-primary-400">{t(lang, 'speed')}</span>
                      <span className="text-sm font-bold text-primary-500">{device.speed} {t(lang, 'kmh')}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        <ClientNav />
      </div>
    </div>
  )
}
