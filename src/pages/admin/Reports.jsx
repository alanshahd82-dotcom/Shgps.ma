import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Download, FileText } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import AdminLayout from './AdminLayout'

export default function Reports() {
  const { lang, clientList } = useApp()
  const [report,    setReport]    = useState([])
  const [loading,   setLoading]   = useState(false)
  const [clientId,  setClientId]  = useState('')
  const [from,      setFrom]      = useState(() => { const d = new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,10) })
  const [to,        setTo]        = useState(() => new Date().toISOString().slice(0,10))
  const [generated, setGenerated] = useState(false)

  const generateReport = async () => {
    setLoading(true); setGenerated(false)
    try {
      const params = { from: from + 'T00:00:00Z', to: to + 'T23:59:59Z' }
      if (clientId) params.clientId = clientId
      const data = await api.admin.reports(params)
      setReport(data)
      setGenerated(true)
    } catch {}
    setLoading(false)
  }

  const exportCsv = () => {
    const headers = ['Device', 'Client', 'Trips', 'Total KM', 'Overspeed', 'Geofence']
    const rows = report.map(r => [r.deviceName, r.clientName, r.trips, r.totalKm, r.overSpeedEvents, r.geofenceAlerts])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `athar-gps-report-${from}-${to}.csv`; a.click()
  }

  const totals = report.reduce((acc, r) => ({
    trips:   acc.trips   + r.trips,
    totalKm: acc.totalKm + r.totalKm,
    overSpeed: acc.overSpeed + r.overSpeedEvents,
    geofence:  acc.geofence  + r.geofenceAlerts,
  }), { trips: 0, totalKm: 0, overSpeed: 0, geofence: 0 })

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-black text-primary-500 mb-6">{t(lang, 'reports')}</h1>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t(lang, 'client')}</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className="input-field text-sm">
                <option value="">{lang === 'ar' ? 'جميع العملاء' : 'Tous les clients'}</option>
                {clientList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t(lang, 'dateFrom')}</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t(lang, 'dateTo')}</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field text-sm" />
            </div>
            <button onClick={generateReport} disabled={loading}
              className="flex items-center justify-center gap-2 text-white font-bold py-2.5 rounded-xl disabled:opacity-60"
              style={{ background: '#0B1F3A' }}>
              <Search size={15} />
              {loading ? t(lang, 'loading') : t(lang, 'generateReport')}
            </button>
          </div>
        </div>

        {generated && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[
                { label: t(lang, 'totalTrips'),    value: totals.trips,     color: '#0B1F3A' },
                { label: t(lang, 'totalDistance'), value: `${totals.totalKm.toFixed(1)} km`, color: '#1DBF73' },
                { label: t(lang, 'overSpeedEvents'), value: totals.overSpeed, color: '#FF9500' },
                { label: t(lang, 'geofenceAlerts'),  value: totals.geofence,  color: '#FF3B30' },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <p className="text-2xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Export buttons */}
            <div className="flex gap-3 mb-4">
              <button onClick={exportCsv}
                className="flex items-center gap-2 text-sm font-bold text-white px-4 py-2.5 rounded-xl"
                style={{ background: '#1DBF73' }}>
                <Download size={14} />{t(lang, 'exportCsv')}
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {[t(lang, 'device'), t(lang, 'client'), t(lang, 'totalTrips'), t(lang, 'totalDistance'), t(lang, 'overSpeedEvents'), t(lang, 'geofenceAlerts')].map(h => (
                      <th key={h} className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {report.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">{t(lang, 'noData')}</td></tr>
                  )}
                  {report.map((row, i) => (
                    <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-primary-500">{row.deviceName}</td>
                      <td className="px-4 py-3 text-gray-500">{row.clientName}</td>
                      <td className="px-4 py-3 text-center font-semibold">{row.trips}</td>
                      <td className="px-4 py-3 text-center" style={{ color: '#1DBF73', fontWeight: 'bold' }}>{row.totalKm} km</td>
                      <td className="px-4 py-3 text-center" style={{ color: row.overSpeedEvents > 0 ? '#FF9500' : '#94A3B8', fontWeight: 'bold' }}>{row.overSpeedEvents}</td>
                      <td className="px-4 py-3 text-center" style={{ color: row.geofenceAlerts > 0 ? '#FF3B30' : '#94A3B8', fontWeight: 'bold' }}>{row.geofenceAlerts}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!generated && !loading && (
          <div className="text-center py-20">
            <FileText size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400">{lang === 'ar' ? 'اختر الفلاتر واضغط توليد التقرير' : 'Choisissez les filtres et générez le rapport'}</p>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
