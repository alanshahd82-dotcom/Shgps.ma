import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Wifi, WifiOff } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'
import MapView from '../../components/MapView'

export default function GlobalMap() {
  const { devices, clientList, lang } = useApp()
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
  const online = devices.filter(d => d.status === 'online')
  const offline = devices.filter(d => d.status !== 'online')

  const getClient = (clientId) => clientList.find(c => c.id === clientId)

  return (
    <AdminLayout>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] lg:h-screen">
        {/* Sidebar */}
        <div className="lg:w-72 flex-shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-gray-100 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10">
            <h2 className="font-bold text-primary-500">{t(lang, 'globalMap')}</h2>
            <div className="flex gap-3 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                {online.length} {lang === 'ar' ? 'متصل' : 'en ligne'}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold">
                <span className="w-2 h-2 bg-gray-300 rounded-full" />
                {offline.length} {lang === 'ar' ? 'غير متصل' : 'hors ligne'}
              </div>
            </div>
          </div>

          {/* Device list */}
          <div className="p-3 space-y-1">
            {devices.map(device => {
              const client = getClient(device.clientId)
              const isOnline = device.status === 'online'
              const isSelected = selectedDeviceId === device.id
              return (
                <motion.button
                  key={device.id}
                  onClick={() => setSelectedDeviceId(isSelected ? null : device.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-primary-500 text-white'
                      : 'hover:bg-gray-50 text-primary-500'
                  }`}
                  whileTap={{ scale: 0.97 }}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                    isSelected ? 'bg-white/15' : isOnline ? 'bg-primary-50' : 'bg-gray-100'
                  }`}>
                    {device.type === 'car' ? '🚗' : device.type === 'bike' ? '🏍️' : '🚚'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-primary-500'}`}>
                      {device.name}
                    </p>
                    <p className={`text-[10px] truncate ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                      {client?.name}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    {isOnline
                      ? <Wifi size={12} className={isSelected ? 'text-emerald-300' : 'text-emerald-500'} />
                      : <WifiOff size={12} className={isSelected ? 'text-white/50' : 'text-gray-300'} />
                    }
                    {isOnline && (
                      <span className={`text-[9px] font-bold ${isSelected ? 'text-white/80' : 'text-primary-400'}`}>
                        {device.speed} km/h
                      </span>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {/* Live badge */}
          <div className="absolute top-4 right-4 z-20 glass rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-primary-500">{t(lang, 'liveTracking')}</span>
          </div>

          <MapView
            showAllDevices={!selectedDeviceId}
            deviceId={selectedDeviceId}
            height="100%"
            zoom={selectedDeviceId ? 14 : 6}
          />
        </div>
      </div>
    </AdminLayout>
  )
}
