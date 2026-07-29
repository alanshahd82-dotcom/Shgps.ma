import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CreditCard, Calendar, Cpu, RefreshCw } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import MobileFrame from '../../components/MobileFrame'
import ClientNav from '../../components/ClientNav'

export default function Subscription() {
  const navigate = useNavigate()
  const { lang } = useApp()
  const [sub,     setSub]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    api.subscription.get()
      .then(setSub)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const daysLeft = sub?.end_date
    ? Math.max(0, Math.ceil((new Date(sub.end_date) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0

  const isExpired      = sub?.end_date && new Date(sub.end_date) < new Date()
  const isExpiringSoon = !isExpired && daysLeft <= 7

  const statusLabel = isExpired ? t(lang, 'subscriptionExpired')
    : isExpiringSoon ? t(lang, 'subscriptionExpiringSoon')
    : t(lang, 'subscriptionActive')

  const statusColor = isExpired ? '#FF3B30' : isExpiringSoon ? '#FF9500' : '#1DBF73'

  const devicePct = sub ? Math.min(100, (sub.devices_used / sub.device_limit) * 100) : 0

  const formatDate = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <MobileFrame>
      <div className="h-full flex flex-col bg-gray-50">
        <div className="flex-shrink-0 pt-14 px-4 pb-5" style={{ background: 'linear-gradient(160deg,#0B1F3A 0%,#0d2a50 100%)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <ArrowLeft size={18} className="text-white" />
            </button>
            <h1 className="text-white font-bold text-lg">{t(lang, 'mySubscription')}</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mobile-scroll pb-24 px-4 pt-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#1DBF73', borderTopColor: 'transparent' }} />
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-12">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {!loading && sub && (
            <>
              {/* Plan card */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg,#0B1F3A,#1a3a6e)' }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-white/60 text-xs mb-1">{t(lang, 'currentPlan')}</p>
                    <p className="text-2xl font-black">{sub.plan}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: statusColor + '30', color: statusColor }}>
                    {statusLabel}
                  </span>
                </div>

                {/* Days left bar */}
                {sub.end_date && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-white/60 mb-1">
                      <span>{t(lang, 'expiry')}: {formatDate(sub.end_date)}</span>
                      {!isExpired && <span style={{ color: statusColor }}>{daysLeft} {t(lang, 'daysLeft')}</span>}
                    </div>
                    <div className="h-1.5 rounded-full bg-white/20">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, 100 - (daysLeft / 30 * 100))}%`, background: statusColor }} />
                    </div>
                  </div>
                )}

                {/* Devices */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-white/60 mb-1">
                    <span>{t(lang, 'devicesUsed')}</span>
                    <span>{sub.devices_used} / {sub.device_limit}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/20">
                    <div className="h-1.5 rounded-full" style={{ width: `${devicePct}%`, background: devicePct >= 90 ? '#FF3B30' : '#1DBF73' }} />
                  </div>
                </div>
              </motion.div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <Calendar size={18} className="text-primary-500 mb-2" />
                  <p className="text-xs text-gray-400 mb-0.5">{t(lang, 'startDate')}</p>
                  <p className="font-semibold text-sm text-primary-500">{formatDate(sub.start_date)}</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <Cpu size={18} className="text-primary-500 mb-2" />
                  <p className="text-xs text-gray-400 mb-0.5">{t(lang, 'devicesAllowed')}</p>
                  <p className="font-semibold text-sm text-primary-500">{sub.device_limit} {lang === 'ar' ? 'جهاز' : 'appareils'}</p>
                </motion.div>
              </div>

              {/* Renew button */}
              <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                className="w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl"
                style={{ background: '#1DBF73' }}>
                <RefreshCw size={16} />
                {t(lang, 'renewSubscription')}
              </motion.button>
              <p className="text-center text-xs text-gray-400">
                {lang === 'ar' ? 'للتجديد تواصل مع الدعم: support@athar-gps.ma' : 'Pour renouveler: support@athar-gps.ma'}
              </p>
            </>
          )}
        </div>

        <ClientNav />
      </div>
    </MobileFrame>
  )
}
