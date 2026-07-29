import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, MapPin, Clock, Route, Gauge, Filter } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import MobileFrame from '../../components/MobileFrame'
import ClientNav from '../../components/ClientNav'

const FILTERS = ['today', 'thisWeek', 'thisMonth', 'custom']

function dateRange(filter) {
  const now = new Date()
  switch (filter) {
    case 'today':
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), to: now.toISOString() }
    case 'thisWeek': {
      const d = new Date(now); d.setDate(d.getDate() - 7)
      return { from: d.toISOString(), to: now.toISOString() }
    }
    case 'thisMonth': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: d.toISOString(), to: now.toISOString() }
    }
    default:
      return {}
  }
}

export default function TripHistory() {
  const navigate = useNavigate()
  const { lang, devices } = useApp()
  const [trips,      setTrips]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState('thisWeek')
  const [deviceId,   setDeviceId]   = useState('')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [error,      setError]      = useState('')

  useEffect(() => { loadTrips() }, [filter, deviceId]) // eslint-disable-line

  async function loadTrips() {
    setLoading(true); setError('')
    try {
      const range  = filter === 'custom' ? { from: customFrom || undefined, to: customTo || undefined } : dateRange(filter)
      const params = { ...range }
      if (deviceId) params.deviceId = deviceId
      const data = await api.stats.trips(params)
      setTrips(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (min) => {
    if (min < 60) return `${min} ${t(lang, 'min')}`
    return `${Math.floor(min / 60)}س ${min % 60}د`
  }

  const formatTime = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { day: 'numeric', month: 'short' })
  }

  return (
    <MobileFrame>
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div className="flex-shrink-0 pt-14 px-4 pb-4" style={{ background: 'linear-gradient(160deg,#0B1F3A 0%,#0d2a50 100%)' }}>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <ArrowLeft size={18} className="text-white" />
            </button>
            <h1 className="text-white font-bold text-lg">{t(lang, 'tripHistory')}</h1>
          </div>

          {/* Device picker */}
          {devices.length > 1 && (
            <select
              value={deviceId}
              onChange={e => setDeviceId(e.target.value)}
              className="w-full bg-white/10 text-white rounded-xl px-3 py-2.5 text-sm mb-3 outline-none"
            >
              <option value="">{lang === 'ar' ? 'جميع الأجهزة' : 'Tous les appareils'}</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map(f => (
              <button key={f}
                onClick={() => setFilter(f)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${filter === f ? 'text-primary-500' : 'bg-white/10 text-white/70'}`}
                style={filter === f ? { background: '#1DBF73', color: '#fff' } : {}}>
                {t(lang, f)}
              </button>
            ))}
          </div>

          {filter === 'custom' && (
            <div className="flex gap-2 mt-3">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="flex-1 bg-white/10 text-white rounded-xl px-3 py-2 text-xs outline-none" />
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="flex-1 bg-white/10 text-white rounded-xl px-3 py-2 text-xs outline-none" />
              <button onClick={loadTrips} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: '#1DBF73' }}>
                {t(lang, 'search')}
              </button>
            </div>
          )}
        </div>

        {/* Trips list */}
        <div className="flex-1 overflow-y-auto mobile-scroll pb-24 px-4 pt-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#1DBF73', borderTopColor: 'transparent' }} />
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-12">
              <p className="text-red-400 text-sm mb-3">{error}</p>
              <button onClick={loadTrips} className="text-sm font-semibold px-4 py-2 rounded-xl text-white" style={{ background: '#1DBF73' }}>
                {t(lang, 'retry')}
              </button>
            </div>
          )}

          {!loading && !error && trips.length === 0 && (
            <div className="text-center py-16">
              <Route size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">{t(lang, 'noTrips')}</p>
            </div>
          )}

          {!loading && trips.map((trip, i) => (
            <motion.div key={trip.id || i}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-sm text-primary-500">{formatDate(trip.startTime)}</p>
                  <p className="text-xs text-gray-400">{formatTime(trip.startTime)} → {formatTime(trip.endTime)}</p>
                </div>
                <span className="text-lg font-black" style={{ color: '#1DBF73' }}>{trip.distance} {t(lang, 'km')}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-500">{formatDuration(trip.duration)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Gauge size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-500">{trip.averageSpeed} {t(lang, 'kmh')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Gauge size={12} className="text-orange-400" />
                  <span className="text-xs text-gray-500">max {trip.maxSpeed} {t(lang, 'kmh')}</span>
                </div>
              </div>
              {trip.startAddress && (
                <div className="mt-2 flex items-start gap-1.5">
                  <MapPin size={11} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-400 truncate">{trip.startAddress}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <ClientNav />
      </div>
    </MobileFrame>
  )
}
