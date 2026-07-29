import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, X, Clock, CheckCircle, XCircle } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import AdminLayout from './AdminLayout'

const STATUS_FILTERS = ['', 'active', 'expiring', 'expired']

function RenewModal({ sub, open, onClose, onRenew, lang }) {
  const [months, setMonths] = useState(3)
  const [loading, setLoading] = useState(false)
  const handleRenew = async () => {
    setLoading(true)
    await onRenew(sub.id, { months })
    setLoading(false)
    onClose()
  }
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-96 z-50"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between" style={{ background: '#0B1F3A' }}>
                <h3 className="font-bold text-white">{t(lang, 'renew')}: {sub?.user_name}</h3>
                <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <X size={16} className="text-white" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">{t(lang, 'renewFor')}</label>
                  <div className="flex gap-2">
                    {[1, 3, 6, 12].map(m => (
                      <button key={m} onClick={() => setMonths(m)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all"
                        style={{ borderColor: months === m ? '#1DBF73' : '#E2E8F0', color: months === m ? '#fff' : '#64748B', background: months === m ? '#1DBF73' : '#fff' }}>
                        {m} {t(lang, 'months').slice(0, 2)}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleRenew} disabled={loading}
                  className="w-full text-white font-bold py-3 rounded-xl disabled:opacity-60"
                  style={{ background: '#1DBF73' }}>
                  {loading ? t(lang, 'loading') : t(lang, 'renew')}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default function Subscriptions() {
  const { lang } = useApp()
  const [subs,    setSubs]    = useState([])
  const [filter,  setFilter]  = useState('')
  const [loading, setLoading] = useState(true)
  const [selected,setSelected]= useState(null)

  const load = async () => {
    setLoading(true)
    try { setSubs(await api.admin.subscriptions(filter ? { status: filter } : {})) } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [filter]) // eslint-disable-line

  const handleRenew = async (id, data) => {
    await api.admin.renewSubscription(id, data)
    load()
  }

  const formatDate = (iso) => !iso ? '—' : new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const getStatus = (sub) => {
    if (!sub.end_date) return { label: '—', color: '#94A3B8' }
    const d  = new Date(sub.end_date)
    const now = new Date()
    if (d < now) return { label: t(lang, 'subscriptionExpired'), color: '#FF3B30' }
    const days = Math.ceil((d - now) / 86400000)
    if (days <= 7) return { label: `${days}d`, color: '#FF9500' }
    return { label: t(lang, 'subscriptionActive'), color: '#1DBF73' }
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-primary-500">{t(lang, 'subscriptions')}</h1>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: filter === f ? '#0B1F3A' : '#F1F5F9', color: filter === f ? '#fff' : '#64748B' }}>
              {f === '' ? t(lang, 'allSubscriptions') : t(lang, f === 'active' ? 'activeOnly' : f === 'expired' ? 'expiredOnly' : 'expiringSoon')}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#1DBF73', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {[t(lang, 'client'), t(lang, 'plan'), t(lang, 'startDate'), t(lang, 'endDate'), t(lang, 'deviceCount'), ''].map(h => (
                    <th key={h} className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {subs.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">{t(lang, 'noData')}</td></tr>
                )}
                {subs.map((sub, i) => {
                  const st = getStatus(sub)
                  return (
                    <motion.tr key={sub.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-primary-500">{sub.user_name}</p>
                        <p className="text-xs text-gray-400">{sub.user_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold" style={{ background: '#0B1F3A15', color: '#0B1F3A' }}>
                          {sub.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(sub.start_date)}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium" style={{ color: st.color }}>{formatDate(sub.end_date)}</span>
                        <span className="text-xs ml-2 px-1.5 py-0.5 rounded" style={{ background: st.color + '20', color: st.color }}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-primary-500">{sub.devices_used}</span>
                        <span className="text-gray-300 mx-1">/</span>
                        <span className="text-gray-400">{sub.device_limit}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelected(sub)}
                          className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-1.5 rounded-xl"
                          style={{ background: '#1DBF73' }}>
                          <RefreshCw size={11} />{t(lang, 'renew')}
                        </button>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <RenewModal sub={selected} open={!!selected} onClose={() => setSelected(null)} onRenew={handleRenew} lang={lang} />
      </div>
    </AdminLayout>
  )
}
