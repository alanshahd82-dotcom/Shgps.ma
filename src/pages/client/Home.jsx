import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, ChevronRight, Wifi, WifiOff } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import MobileFrame from '../../components/MobileFrame'
import ClientNav from '../../components/ClientNav'
import MapView from '../../components/MapView'
import Logo from '../../components/Logo'

function DeviceCard({ device, onClick, lang }) {
  const isOnline = device.status === 'online'
  return (
    <motion.div
      className="flex items-center gap-3 bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 cursor-pointer"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${isOnline ? 'bg-primary-50' : 'bg-gray-100'}`}>
        {device.type === 'car' ? '🚗' : device.type === 'bike' ? '🏍️' : '🚚'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-primary-500 text-sm truncate">{device.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-medium" style={{ color: isOnline ? '#1DBF73' : '#94A3B8' }}>
            {isOnline ? <Wifi size={10} className="inline mr-1" /> : <WifiOff size={10} className="inline mr-1" />}
            {isOnline ? t(lang, 'online') : t(lang, 'offline')}
          </span>
          {isOnline && <span className="text-xs text-slate-400">{device.speed} {t(lang, 'kmh')}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {device.battery != null && (
          <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
            🔋 {device.battery}%
          </div>
        )}
        <ChevronRight size={14} className="text-slate-300" />
      </div>
    </motion.div>
  )
}

export default function ClientHome() {
  const navigate = useNavigate()
  const { clientAuth, devices, unreadCount, lang } = useApp()
  const onlineDevices = devices.filter(d => d.status === 'online')

  return (
    <MobileFrame>
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div className="flex-shrink-0 pt-14 px-5 pb-5" style={{ background: 'linear-gradient(160deg,#0B1F3A 0%,#0d2a50 100%)' }}>
          <div className="flex items-center justify-between mb-5">
            <Logo size="sm" />
            <button onClick={() => navigate('/client/alerts')} className="relative w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Bell size={18} className="text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: '#FF3B30' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
          <p className="text-white/60 text-sm">{t(lang, 'welcome')},</p>
          <p className="text-white text-xl font-bold">{clientAuth?.name || '—'}</p>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white/10 rounded-2xl px-4 py-3 text-center">
              <p className="text-2xl font-black text-white">{devices.length}</p>
              <p className="text-white/60 text-xs">{t(lang, 'totalDevices') || 'إجمالي الأجهزة'}</p>
            </div>
            <div className="bg-white/10 rounded-2xl px-4 py-3 text-center">
              <p className="text-2xl font-black" style={{ color: '#1DBF73' }}>{onlineDevices.length}</p>
              <p className="text-white/60 text-xs">{t(lang, 'onlineDevices') || 'متصلة'}</p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto mobile-scroll pb-24 px-4 pt-4 space-y-4">
          {/* Live map */}
          {devices.length > 0 && (
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <p className="font-bold text-primary-500 text-sm">{t(lang, 'liveMap')}</p>
                <span className="text-xs font-medium" style={{ color: '#1DBF73' }}>● live</span>
              </div>
              <div className="h-40">
                <MapView devices={onlineDevices.length > 0 ? onlineDevices : devices} height="100%" />
              </div>
            </div>
          )}

          {/* Devices list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-primary-500 text-sm">{t(lang, 'myDevices')}</p>
              <button onClick={() => navigate('/client/devices')} className="text-xs font-semibold" style={{ color: '#1DBF73' }}>
                {t(lang, 'viewAll')}
              </button>
            </div>

            {devices.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
                <p className="text-4xl mb-3">📡</p>
                <p className="text-gray-400 text-sm">{lang === 'ar' ? 'لا توجد أجهزة مسجلة' : 'Aucun appareil enregistré'}</p>
                <button
                  onClick={() => navigate('/client/add-device')}
                  className="mt-3 text-sm font-semibold px-4 py-2 rounded-xl text-white"
                  style={{ background: '#1DBF73' }}>
                  {t(lang, 'addDevice')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {devices.slice(0, 5).map((device, i) => (
                  <motion.div key={device.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <DeviceCard device={device} lang={lang} onClick={() => navigate(`/client/device/${device.id}`)} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        <ClientNav />
      </div>
    </MobileFrame>
  )
}
