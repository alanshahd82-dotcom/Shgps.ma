import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Battery, Wifi, WifiOff, Plus, X, AlertCircle,
  RefreshCw, CheckCircle2, AlertTriangle
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'

function timeAgo(iso, lang) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return t(lang, 'just_now')
  if (diff < 60) return `${diff}m`
  return `${Math.floor(diff / 60)}h`
}

function AddDeviceModal({ open, onClose, onAdd, clientList, lang }) {
  const [form, setForm] = useState({ name: '', imei: '', type: 'car', plate: '', clientId: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const imeiValid = /^\d{15}$/.test(form.imei)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!imeiValid) { setError(lang === 'ar' ? 'IMEI يجب أن يكون 15 رقماً' : 'IMEI doit contenir 15 chiffres'); return }
    setLoading(true); setError('')
    try {
      await onAdd({ ...form, clientId: form.clientId || null })
      setForm({ name: '', imei: '', type: 'car', plate: '', clientId: '' })
      onClose()
    } catch (err) {
      setError(err.message || (lang === 'ar' ? 'حدث خطأ' : 'Une erreur est survenue'))
    } finally { setLoading(false) }
  }

  const handleClose = () => { setError(''); onClose() }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="w-full md:max-w-[500px] flex flex-col"
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] md:max-h-[90vh]">
              <div className="bg-primary-500 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <h3 className="font-bold text-white text-lg">
                  {lang === 'ar' ? 'إضافة جهاز جديد' : 'Ajouter un appareil'}
                </h3>
                <button onClick={handleClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                  <X size={16} className="text-white" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 min-h-0">
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
                      <AlertCircle size={15} /><span>{error}</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      {lang === 'ar' ? 'اسم الجهاز' : "Nom de l'appareil"} *
                    </label>
                    <input className="input-field text-sm" value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">IMEI (15 {lang === 'ar' ? 'رقم' : 'chiffres'}) *</label>
                    <input className={`input-field text-sm font-mono ${form.imei && !imeiValid ? 'border-red-300' : ''}`}
                      maxLength={15} value={form.imei}
                      onChange={e => setForm(p => ({ ...p, imei: e.target.value.replace(/\D/g, '') }))} required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">{lang === 'ar' ? 'النوع' : 'Type'}</label>
                      <select className="input-field text-sm" value={form.type}
                        onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                        <option value="car">{lang === 'ar' ? 'سيارة' : 'Voiture'}</option>
                        <option value="bike">{lang === 'ar' ? 'دراجة' : 'Moto'}</option>
                        <option value="truck">{lang === 'ar' ? 'شاحنة' : 'Camion'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">{t(lang, 'plate')}</label>
                      <input className="input-field text-sm" value={form.plate}
                        onChange={e => setForm(p => ({ ...p, plate: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      {lang === 'ar' ? 'تعيين للعميل' : 'Assigner au client'}
                    </label>
                    <select className="input-field text-sm" value={form.clientId}
                      onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}>
                      <option value="">{lang === 'ar' ? '— بدون عميل —' : '— Sans client —'}</option>
                      {clientList.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={handleClose} className="flex-1 btn-secondary py-3">{t(lang, 'cancel')}</button>
                    <button type="submit" disabled={loading || !form.name || !imeiValid}
                      className="flex-1 btn-primary py-3 disabled:opacity-50">
                      {loading ? '...' : t(lang, 'add')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SyncResultModal({ open, onClose, result, lang }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full md:max-w-[460px] flex flex-col"
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] md:max-h-[90vh]">
              <div className="bg-teal-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <RefreshCw size={18} className="text-white" />
                  <h3 className="font-bold text-white">
                    {lang === 'ar' ? 'نتيجة المزامنة' : 'Résultat de la synchronisation'}
                  </h3>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <X size={16} className="text-white" />
                </button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-emerald-600">{result?.synced ?? 0}</p>
                    <p className="text-xs text-emerald-500 font-semibold mt-1">
                      {lang === 'ar' ? 'متزامن' : 'Synchronisé'}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-orange-600">{result?.notInLocal?.length ?? 0}</p>
                    <p className="text-xs text-orange-500 font-semibold mt-1">
                      {lang === 'ar' ? 'في Traccar فقط' : 'Traccar uniquement'}
                    </p>
                  </div>
                </div>
                {result?.notInLocal?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">
                      {lang === 'ar' ? 'أجهزة في Traccar بدون مقابل في النظام:' : 'Appareils Traccar sans correspondance locale:'}
                    </p>
                    <div className="bg-orange-50 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">
                      {result.notInLocal.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <AlertTriangle size={11} className="text-orange-400 flex-shrink-0" />
                          <span className="text-orange-700 font-mono">{d.uniqueId}</span>
                          <span className="text-orange-500">— {d.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result?.notInTraccar?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">
                      {lang === 'ar' ? 'أجهزة في النظام بدون مقابل في Traccar:' : 'Appareils locaux sans correspondance Traccar:'}
                    </p>
                    <div className="bg-slate-50 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">
                      {result.notInTraccar.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <AlertCircle size={11} className="text-slate-400 flex-shrink-0" />
                          <span className="text-slate-600 font-mono">{d.imei}</span>
                          <span className="text-slate-400">— {d.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result?.notInLocal?.length === 0 && result?.notInTraccar?.length === 0 && (
                  <div className="flex items-center justify-center gap-2 py-4 text-emerald-600">
                    <CheckCircle2 size={24} />
                    <span className="font-semibold">{lang === 'ar' ? 'كل شيء متزامن!' : 'Tout est synchronisé!'}</span>
                  </div>
                )}
                <button onClick={onClose} className="w-full btn-primary py-3">{t(lang, 'close')}</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function AllDevices() {
  const { devices, clientList, addDeviceDirect, lang } = useApp()
  const [search, setSearch]     = useState('')
  const [showAdd, setShowAdd]   = useState(false)
  const [syncing, setSyncing]   = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  const filtered = devices.filter(d =>
    !search ||
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.imei?.toLowerCase().includes(search.toLowerCase()) ||
    d.plate?.toLowerCase().includes(search.toLowerCase())
  )

  const getClient = (clientId) => clientList.find(c => c.id === clientId)

  async function handleSync() {
    setSyncing(true)
    try {
      const result = await api.admin.traccarSync()
      setSyncResult(result)
    } catch (err) {
      setSyncResult({ error: err.message })
    } finally { setSyncing(false) }
  }

  return (
    <AdminLayout>
      <SyncResultModal
        open={!!syncResult}
        onClose={() => setSyncResult(null)}
        result={syncResult}
        lang={lang}
      />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-primary-500">{t(lang, 'allDevices')}</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {devices.length} {lang === 'ar' ? 'جهاز مسجّل' : 'appareil(s) enregistré(s)'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 bg-teal-50 text-teal-700 border border-teal-200 font-semibold px-4 py-2.5 rounded-xl hover:bg-teal-100 transition-colors text-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing
                ? (lang === 'ar' ? 'مزامنة...' : 'Sync...')
                : (lang === 'ar' ? 'مزامنة Traccar' : 'Sync Traccar')}
            </button>
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={16} />
              {t(lang, 'addDevice')}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-4 text-slate-400" />
          <input className="input-field ps-10" placeholder={t(lang, 'search')}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-gray-100">
                <tr>
                  {[t(lang,'device'), 'IMEI', t(lang,'plate'), lang === 'ar' ? 'العميل' : 'Client',
                    t(lang,'speed'), t(lang,'battery'), t(lang,'status'), t(lang,'lastUpdate')].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-start text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">{t(lang, 'noData')}</td></tr>
                )}
                {filtered.map((device, i) => {
                  const client   = getClient(device.clientId || device.user_id)
                  const isOnline = device.status === 'online'
                  return (
                    <motion.tr key={device.id}
                      className="hover:bg-slate-50 transition-colors"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${isOnline ? 'bg-primary-50' : 'bg-gray-100'}`}>
                            {device.type === 'car' ? '🚗' : device.type === 'bike' ? '🏍️' : '🚚'}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-primary-500">{device.name}</p>
                            <p className="text-[10px] text-slate-400">{device.type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{device.imei || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{device.plate || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{client?.name || (lang === 'ar' ? 'غير مسند' : 'Non assigné')}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-primary-500">
                        {isOnline ? `${device.speed ?? 0} km/h` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {device.battery != null
                          ? <span className="text-xs font-medium text-slate-600">🔋 {device.battery}%</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {isOnline
                            ? <><Wifi size={12} className="text-emerald-500" /><span className="text-xs font-bold text-emerald-600">{t(lang, 'online')}</span></>
                            : <><WifiOff size={12} className="text-slate-400" /><span className="text-xs text-slate-400">{t(lang, 'offline')}</span></>
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{timeAgo(device.lastUpdate, lang)}</td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="lg:hidden divide-y divide-gray-50">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">{t(lang, 'noData')}</div>
            )}
            {filtered.map((device, i) => {
              const client   = getClient(device.clientId || device.user_id)
              const isOnline = device.status === 'online'
              return (
                <motion.div key={device.id} className="p-4 flex items-center gap-3"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${isOnline ? 'bg-primary-50' : 'bg-gray-100'}`}>
                    {device.type === 'car' ? '🚗' : device.type === 'bike' ? '🏍️' : '🚚'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary-500 text-sm truncate">{device.name}</p>
                    <p className="text-xs text-slate-400">{client?.name || '—'} · {device.plate || '—'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-medium ${isOnline ? 'text-emerald-500' : 'text-gray-400'}`}>
                        ● {isOnline ? t(lang, 'online') : t(lang, 'offline')}
                      </span>
                      {device.battery != null && <span className="text-xs text-slate-400">🔋 {device.battery}%</span>}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      <AddDeviceModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={addDeviceDirect}
        clientList={clientList}
        lang={lang}
      />
    </AdminLayout>
  )
}
