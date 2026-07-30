import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, ChevronRight, Wifi, WifiOff, Zap } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'
import Carousel from '../../components/Carousel'
import MapView from '../../components/MapView'
import Logo from '../../components/Logo'

function DeviceCard({ device, onClick, lang }) {
  const isOnline = device.status === 'online'
  return (
    <motion.div
      className="flex items-center gap-3 bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 cursor-pointer active:scale-98"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
    >
      {/* Icon */}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${isOnline ? 'bg-primary-50' : 'bg-gray-100'}`}>
        {device.type === 'car' ? '🚗' : device.type === 'bike' ? '🏍️' : '🚚'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-primary-500 text-sm truncate">{device.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs font-medium ${isOnline ? 'text-emerald-500' : 'text-slate-400'}`}>
            ● {isOnline ? t(lang, 'online') : t(lang, 'offline')}
          </span>
          {isOnline && (
            <span className="text-xs text-slate-400">{device.speed} {t(lang, 'kmh')}</span>
          )}
        </div>
      </div>

      {/* Right */}
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
  // Use all devices returned by API (already filtered per user by backend)
  const clientDevices = devices
  const onlineDevices = clientDevices.filter(d => d.status === 'online')

  return (
    <div className="min-h-screen flex flex-col">
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div
          className="flex-shrink-0 pt-14 pb-4 px-4"
          style={{ background: 'linear-gradient(160deg, #0F2044 0%, #162d5e 100%)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <Logo size="sm" white />
            <button
              onClick={() => navigate('/client/alerts')}
              className="relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
            >
              <Bell size={18} className="text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
          <p className="text-white/60 text-xs">{t(lang, 'welcome')}،</p>
          <p className="text-white font-bold text-lg mt-0.5">{clientAuth?.name || ''} 👋</p>

          {/* Quick stats */}
          <div className="flex gap-3 mt-3">
            <div className="flex-1 bg-white/10 rounded-2xl px-3 py-2.5">
              <p className="text-white/60 text-[10px] font-medium">{t(lang, 'devices')}</p>
              <p className="text-white font-bold text-xl">{clientDevices.length}</p>
            </div>
            <div className="flex-1 bg-white/10 rounded-2xl px-3 py-2.5">
              <p className="text-emerald-300 text-[10px] font-medium flex items-center gap-1"><Wifi size={10} />{t(lang, 'online')}</p>
              <p className="text-white font-bold text-xl">{onlineDevices.length}</p>
            </div>
            <div className="flex-1 bg-white/10 rounded-2xl px-3 py-2.5">
              <p className="text-white/60 text-[10px] font-medium flex items-center gap-1"><Zap size={10} />{t(lang, 'todayAlerts')}</p>
              <p className="text-white font-bold text-xl">{unreadCount}</p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto mobile-scroll pb-20">
          {/* Carousel */}
          <Carousel />

          {/* Live Map */}
          <div className="mx-3 mb-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="font-bold text-primary-500 text-sm">{t(lang, 'liveMap')}</p>
              <span className="flex items-center gap-1 text-xs text-emerald-500 font-semibold">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100" style={{ height: 180 }}>
              <MapView height="100%" zoom={11} />
            </div>
          </div>

          {/* Devices list */}
          <div className="mx-3 mb-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="font-bold text-primary-500 text-sm">{t(lang, 'myDevices')}</p>
              <button
                onClick={() => navigate('/client/devices')}
                className="text-xs text-accent font-semibold flex items-center gap-0.5"
              >
                {t(lang, 'viewAll')} <ChevronRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {clientDevices.slice(0, 3).map(device => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  lang={lang}
                  onClick={() => navigate(`/client/device/${device.id}`)}
                />
              ))}
              {clientDevices.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  {lang === 'ar' ? 'لا توجد أجهزة مسجلة' : 'Aucun appareil enregistré'}
                </div>
              )}
            </div>
          </div>
        </div>

        <ClientNav />
      </div>
    </div>
  )
}
