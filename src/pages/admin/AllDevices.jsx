import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Wifi, WifiOff, Plus, X, AlertCircle,
  RefreshCw, CheckCircle2, AlertTriangle, Trash2
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'
import ConfirmModal from '../../components/ConfirmModal'
import SubscriptionPlans from '../../components/SubscriptionPlans'
import SubscriptionBadge from '../../components/SubscriptionBadge'
import SubscriptionRenewalModal from '../../components/SubscriptionRenewalModal'
import Button from '../../components/ui/Button'
import { VehicleIcon, VehicleTypeControl } from '../../components/ui'

function timeAgo(iso, lang) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return t(lang, 'just_now')
  if (diff < 60) return `${diff}m`
  return `${Math.floor(diff / 60)}h`
}

function AddDeviceModal({ open, onClose, onAdd, clientList, lang, clientsError, onRefreshClients }) {
  const [form, setForm] = useState({ name: '', imei: '', type: 'bike', plate: '', clientId: '', subscriptionPlanId: '3_months' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const imeiValid = /^\d{15}$/.test(form.imei)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!imeiValid) { setError(lang === 'ar' ? 'IMEI يجب أن يكون 15 رقماً' : 'IMEI doit contenir 15 chiffres'); return }
    setLoading(true); setError('')
    try {
      await onAdd({ ...form, clientId: form.clientId || null })
      setForm({ name: '', imei: '', type: 'bike', plate: '', clientId: '', subscriptionPlanId: '3_months' })
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
            className="w-full md:max-w-[500px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] md:max-h-[88vh]"
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Fixed header */}
            <div className="flex-shrink-0 bg-primary-500 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <h3 className="font-bold text-white text-lg">
                {lang === 'ar' ? 'إضافة جهاز جديد' : 'Ajouter un appareil'}
              </h3>
              <button onClick={handleClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <X size={16} className="text-white" />
              </button>
            </div>

            {/* Scrollable body */}
            <form id="add-device-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
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
                   <VehicleTypeControl value={form.type} onChange={type => setForm(p => ({ ...p, type }))} lang={lang} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t(lang, 'plate')}</label>
                  <input className="input-field text-sm uppercase font-mono" value={form.plate}
                    onChange={e => setForm(p => ({ ...p, plate: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {lang === 'ar' ? 'تعيين للعميل' : 'Assigner au client'}
                </label>
                <select className="input-field text-sm" value={form.clientId}
                  onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}>
                   <option value="">
                     {clientList.length
                       ? (lang === 'ar' ? '— بدون عميل —' : '— Sans client —')
                       : clientsError
                         ? (lang === 'ar' ? 'تعذر تحميل العملاء' : 'Impossible de charger les clients')
                         : (lang === 'ar' ? 'جاري تحميل العملاء...' : 'Chargement des clients...')}
                   </option>
                  {clientList.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                 {clientsError && (
                   <button
                     type="button"
                     onClick={onRefreshClients}
                     className="mt-1 text-[11px] font-semibold text-primary-500 underline"
                   >
                     {lang === 'ar' ? 'إعادة المحاولة' : 'Réessayer'}
                   </button>
                 )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{lang === 'ar' ? 'خطة اشتراك الجهاز — دفع نقدي' : 'Forfait de l’appareil — paiement comptant'}</label>
                <SubscriptionPlans value={form.subscriptionPlanId} onChange={subscriptionPlanId => setForm(p => ({ ...p, subscriptionPlanId }))} lang={lang} compact includeTrial />
              </div>
            </form>

            {/* Fixed footer – always visible */}
            <div className="flex-shrink-0 px-6 pb-6 pt-3 flex gap-3 border-t border-gray-100 bg-white rounded-b-3xl">
              <button type="button" onClick={handleClose} className="flex-1 btn-secondary py-3">{t(lang, 'cancel')}</button>
              <Button type="submit" form="add-device-form" disabled={loading || !form.name || !imeiValid}
                variant="primary" className="flex-1 py-3">
                {loading ? '...' : t(lang, 'add')}
              </Button>
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
            className="w-full md:max-w-[460px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-y-auto max-h-[92vh] md:max-h-[88vh]"
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-teal-600 px-6 py-4 flex items-center justify-between z-10">
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
              <div className="p-6 space-y-4">
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
                <Button onClick={onClose} variant="primary" className="w-full py-3">{t(lang, 'close')}</Button>
              </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function AllDevices() {
  const { devices, clientList, addDeviceDirect, deleteDevice, lang, clientsError, refreshClients } = useApp()
  const [search, setSearch]         = useState('')
  const [showAdd, setShowAdd]       = useState(false)
  const [syncing, setSyncing]       = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [toDelete, setToDelete]     = useState(null)
  const [renewDevice, setRenewDevice] = useState(null)
  const [deleting, setDeleting]     = useState(false)

  useEffect(() => {
    if (showAdd && !clientList.length) refreshClients?.()
    // Load the clients when this modal is opened, without refetching on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdd])

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try { await deleteDevice(toDelete.id) } catch {}
    setDeleting(false)
    setToDelete(null)
  }

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

      <ConfirmModal
        open={!!toDelete}
        title={lang === 'ar' ? 'حذف الجهاز' : 'Supprimer l\'appareil'}
        message={lang === 'ar'
          ? `هل أنت متأكد من حذف "${toDelete?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
          : `Supprimer "${toDelete?.name}" ? Cette action est irréversible.`}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        lang={lang}
        loading={deleting}
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
            <Button onClick={() => setShowAdd(true)} variant="primary" className="text-sm">
              <Plus size={16} />
              {t(lang, 'addDevice')}
            </Button>
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
                    t(lang,'speed'), t(lang,'battery'), t(lang,'status'), lang === 'ar' ? 'اشتراك الجهاز' : 'Abonnement appareil', t(lang,'lastUpdate'),
                    lang === 'ar' ? 'إجراءات' : 'Actions'].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-start text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400 text-sm">{t(lang, 'noData')}</td></tr>
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
                            <VehicleIcon type={device.type} iconSize={16} />
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
                      <td className="px-4 py-3"><SubscriptionBadge device={device} lang={lang} /></td>
                      <td className="px-4 py-3 text-xs text-slate-400">{timeAgo(device.lastUpdate, lang)}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setRenewDevice(device)}
                            className="px-2.5 h-8 rounded-lg bg-primary-50 text-primary-500 text-[10px] font-bold hover:bg-primary-100"
                            title={lang === 'ar' ? 'تجديد الاشتراك نقداً' : 'Renouveler comptant'}
                          >
                            {lang === 'ar' ? 'تجديد' : 'Renouv.'}
                          </button>
                          <button
                            onClick={() => setToDelete(device)}
                            className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                            title={lang === 'ar' ? 'حذف الجهاز' : 'Supprimer'}
                          >
                            <Trash2 size={14} className="text-red-500" />
                          </button>
                        </div>
                      </td>
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
                    <VehicleIcon type={device.type} iconSize={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary-500 text-sm truncate">{device.name}</p>
                    <p className="text-xs text-slate-400">{client?.name || '—'} · {device.plate || '—'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-medium ${isOnline ? 'text-emerald-500' : 'text-gray-400'}`}>
                        ● {isOnline ? t(lang, 'online') : t(lang, 'offline')}
                      </span>
                      {device.battery != null && <span className="text-xs text-slate-400">🔋 {device.battery}%</span>}
                      <SubscriptionBadge device={device} lang={lang} />
                    </div>
                  </div>
                  <button
                    onClick={() => setRenewDevice(device)}
                    className="px-2.5 py-2 rounded-xl bg-primary-50 text-primary-500 text-[10px] font-bold flex-shrink-0"
                  >
                    {lang === 'ar' ? 'تجديد' : 'Renouv.'}
                  </button>
                  <button
                    onClick={() => setToDelete(device)}
                    className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={15} className="text-red-500" />
                  </button>
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
        clientsError={clientsError}
        onRefreshClients={refreshClients}
      />
      <SubscriptionRenewalModal
        open={!!renewDevice}
        device={renewDevice}
        lang={lang}
        onClose={() => setRenewDevice(null)}
        onSaved={() => {
          setRenewDevice(null)
          window.location.reload()
        }}
      />
    </AdminLayout>
  )
}
