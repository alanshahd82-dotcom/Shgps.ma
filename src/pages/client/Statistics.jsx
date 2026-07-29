import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, TrendingUp, Route, Calendar } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import MobileFrame from '../../components/MobileFrame'
import ClientNav from '../../components/ClientNav'

export default function Statistics() {
  const navigate = useNavigate()
  const { lang, devices } = useApp()
  const [monthly,  setMonthly]  = useState(null)
  const [activity, setActivity] = useState([])
  const [deviceId, setDeviceId] = useState('')
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => { loadStats() }, [deviceId]) // eslint-disable-line

  async function loadStats() {
    setLoading(true); setError('')
    try {
      const params = deviceId ? { deviceId } : {}
      const [m, a] = await Promise.all([
        api.stats.monthly(params),
        api.stats.activity({ ...params, days: 7 }),
      ])
      setMonthly(m)
      setActivity(a)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white rounded-xl shadow-lg p-2 border border-gray-100 text-xs">
        <p className="font-bold text-primary-500 mb-1">{label}</p>
        <p style={{ color: '#1DBF73' }}>{payload[0]?.value} {t(lang, 'km')}</p>
      </div>
    )
  }

  return (
    <MobileFrame>
      <div className="h-full flex flex-col bg-gray-50">
        <div className="flex-shrink-0 pt-14 px-4 pb-4" style={{ background: 'linear-gradient(160deg,#0B1F3A 0%,#0d2a50 100%)' }}>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <ArrowLeft size={18} className="text-white" />
            </button>
            <h1 className="text-white font-bold text-lg">{t(lang, 'statistics')}</h1>
          </div>
          {devices.length > 1 && (
            <select value={deviceId} onChange={e => setDeviceId(e.target.value)}
              className="w-full bg-white/10 text-white rounded-xl px-3 py-2.5 text-sm outline-none">
              <option value="">{lang === 'ar' ? 'جميع الأجهزة' : 'Tous les appareils'}</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </div>

        <div className="flex-1 overflow-y-auto mobile-scroll pb-24 px-4 pt-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#1DBF73', borderTopColor: 'transparent' }} />
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-12">
              <p className="text-red-400 text-sm mb-3">{error}</p>
              <button onClick={loadStats} className="text-sm font-semibold px-4 py-2 rounded-xl text-white" style={{ background: '#1DBF73' }}>
                {t(lang, 'retry')}
              </button>
            </div>
          )}

          {!loading && !error && monthly && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} style={{ color: '#1DBF73' }} />
                    <span className="text-xs text-gray-500">{t(lang, 'monthlyKm')}</span>
                  </div>
                  <p className="text-2xl font-black text-primary-500">{monthly.totalKm}</p>
                  <p className="text-xs text-gray-400">{t(lang, 'km')}</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Route size={16} className="text-blue-500" />
                    <span className="text-xs text-gray-500">{t(lang, 'totalTrips')}</span>
                  </div>
                  <p className="text-2xl font-black text-primary-500">{monthly.totalTrips}</p>
                  <p className="text-xs text-gray-400">{lang === 'ar' ? 'رحلة' : 'trajets'}</p>
                </motion.div>
              </div>

              {monthly.mostActiveDay && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#1DBF7320' }}>
                    <Calendar size={18} style={{ color: '#1DBF73' }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{t(lang, 'mostActiveDay')}</p>
                    <p className="font-bold text-primary-500">{monthly.mostActiveDay}</p>
                  </div>
                </motion.div>
              )}

              {/* Activity chart */}
              {activity.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <p className="text-sm font-bold text-primary-500 mb-4">{t(lang, 'dailyActivity')}</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={activity} barSize={20}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="km" radius={[4, 4, 0, 0]}>
                        {activity.map((entry, i) => (
                          <Cell key={i} fill={entry.km > 0 ? '#1DBF73' : '#E2E8F0'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              )}
            </>
          )}
        </div>

        <ClientNav />
      </div>
    </MobileFrame>
  )
}
