import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Battery, Signal, Wifi, WifiOff, Filter } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'

function timeAgo(iso, lang) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return t(lang, 'just_now')
  if (diff < 60) return `${diff}m`
  return `${Math.floor(diff / 60)}h`
}

export default function AllDevices() {
  const { devices, clientList, lang } = useApp()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = devices.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.plate?.toLowerCase().includes(search.toLowerCase()) ||
      d.imei?.includes(search)
    const matchStatus = statusFilter === 'all' || d.status === statusFilter
    return matchSearch && matchStatus
  })

  const getClient = (clientId) => clientList.find(c => c.id === clientId)

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-primary-500">{t(lang, 'allDevices')}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{devices.length} {lang === 'ar' ? 'جهاز' : 'appareils'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-xs font-bold px-3 py-2 rounded-xl">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              {devices.filter(d => d.status === 'online').length} {lang === 'ar' ? 'متصل' : 'connectés'}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 left-4 text-slate-400" />
            <input
              className="input-field pl-11 bg-white shadow-sm"
              placeholder={t(lang, 'search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {[
              { val: 'all', label: lang === 'ar' ? 'الكل' : 'Tous' },
              { val: 'online', label: lang === 'ar' ? 'متصل' : 'Connecté' },
              { val: 'offline', label: lang === 'ar' ? 'غير متصل' : 'Déconnecté' },
            ].map(f => (
              <button
                key={f.val}
                onClick={() => setStatusFilter(f.val)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  statusFilter === f.val
                    ? 'bg-primary-500 text-white shadow-md shadow-primary-200'
                    : 'bg-white border border-gray-200 text-slate-500 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {[
                    lang === 'ar' ? 'الجهاز' : 'Appareil',
                    lang === 'ar' ? 'العميل' : 'Client',
                    lang === 'ar' ? 'اللوحة' : 'Immatriculation',
                    t(lang, 'status'),
                    t(lang, 'speed'),
                    t(lang, 'battery'),
                    t(lang, 'signal'),
                    lang === 'ar' ? 'آخر تحديث' : 'Dernière MAJ',
                  ].map(h => (
                    <th key={h} className="text-right px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((device, i) => {
                  const client = getClient(device.clientId)
                  const isOnline = device.status === 'online'
                  return (
                    <motion.tr
                      key={device.id}
                      className="hover:bg-gray-50/50 transition-colors"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${isOnline ? 'bg-primary-50' : 'bg-gray-100'}`}>
                            {device.type === 'car' ? '🚗' : device.type === 'bike' ? '🏍️' : '🚚'}
                          </div>
                          <div>
                            <p className="font-semibold text-primary-500 text-sm">{device.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{device.imei}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center text-xs font-bold text-primary-500">
                            {client?.avatar || '?'}
                          </div>
                          <span className="text-sm text-slate-600">{client?.name || '-'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{device.plate}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`flex items-center gap-1.5 text-xs font-semibold w-fit px-2.5 py-1 rounded-full ${
                          isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                          {isOnline ? t(lang, 'online') : t(lang, 'offline')}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-bold text-primary-500">
                          {isOnline ? `${device.speed} km/h` : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${device.battery < 30 ? 'bg-red-500' : device.battery < 60 ? 'bg-orange-400' : 'bg-accent'}`}
                              style={{ width: `${device.battery}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold ${device.battery < 30 ? 'text-red-500' : 'text-slate-500'}`}>
                            {device.battery}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4].map(bar => (
                            <div
                              key={bar}
                              className="w-1.5 rounded-sm"
                              style={{
                                height: 4 + bar * 3,
                                background: bar <= device.signal ? '#0F2044' : '#E2E8F0'
                              }}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-slate-400">{timeAgo(device.lastUpdate, lang)}</span>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-gray-50">
            {filtered.map((device, i) => {
              const client = getClient(device.clientId)
              const isOnline = device.status === 'online'
              return (
                <motion.div
                  key={device.id}
                  className="p-4 flex items-center gap-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${isOnline ? 'bg-primary-50' : 'bg-gray-100'}`}>
                    {device.type === 'car' ? '🚗' : device.type === 'bike' ? '🏍️' : '🚚'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary-500 text-sm truncate">{device.name}</p>
                    <p className="text-xs text-slate-400">{client?.name} · {device.plate}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-medium ${isOnline ? 'text-emerald-500' : 'text-gray-400'}`}>
                        ● {isOnline ? t(lang, 'online') : t(lang, 'offline')}
                      </span>
                      <span className="text-xs text-slate-400">🔋 {device.battery}%</span>
                      {isOnline && <span className="text-xs text-primary-500 font-bold">{device.speed} km/h</span>}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <p className="text-sm">{t(lang, 'noData')}</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
