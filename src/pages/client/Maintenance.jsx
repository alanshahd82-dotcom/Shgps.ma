import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, ChevronDown, Wrench, AlertTriangle, Calendar, Gauge, X, Car } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import ConfirmModal  from '../../components/ConfirmModal'
import { VehicleIcon } from '../../components/ui'

const SERVICE_TYPES = [
  { key: 'oil_change', ar: 'تغيير الزيت', fr: 'Vidange', color: '#F59E0B' },
  { key: 'tires',      ar: 'إطارات',      fr: 'Pneus',  color: '#3B82F6' },
  { key: 'brake',      ar: 'الفرامل',     fr: 'Freins', color: '#FF3B30' },
   { key: 'inspection', ar: 'فحص دوري',   fr: 'Visite', color: '#4f46e5' },
  { key: 'battery',    ar: 'بطارية',      fr: 'Batterie', color: '#8b5cf6' },
  { key: 'ac',         ar: 'تكييف',       fr: 'Clim',   color: '#06b6d4' },
  { key: 'oil_filter', ar: 'فلتر زيت',   fr: 'Filtre à huile', color: '#F59E0B' },
  { key: 'other',      ar: 'أخرى',        fr: 'Autre',  color: '#6b7280' },
]

export default function Maintenance() {
  const { devices, lang } = useApp()
  const [deviceId, setDeviceId]     = useState('')
  const [logs, setLogs]             = useState([])
  const [loading, setLoading]       = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [showDevices, setShowDevices] = useState(false)
  const [formData, setFormData]     = useState({ type: 'oil_change', date: '', mileage: '', notes: '', next_mileage: '' })
  const [saving, setSaving]         = useState(false)
  const [confirmOpen, setConfirmOpen]     = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [opErr, setOpErr]               = useState('')
  const showOpErr = (msg) => { setOpErr(msg); setTimeout(() => setOpErr(''), 4000) }
  const isAr = lang === 'ar'

  const selectedDevice = devices.find(d => String(d.id) === String(deviceId))

  useEffect(() => {
    if (devices.length && !deviceId) setDeviceId(String(devices[0].id))
  }, [devices])

  const load = useCallback(async () => {
    if (!deviceId) return
    setLoading(true)
    try {
      const data = await api.maintenance.list(deviceId)
      setLogs(Array.isArray(data) ? data : data.logs || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [deviceId])

  useEffect(() => { load() }, [load])

  async function handleAdd(e) {
    e.preventDefault(); setSaving(true)
    try {
      await api.maintenance.add({ ...formData, deviceId })
      setShowForm(false)
      setFormData({ type: 'oil_change', date: '', mileage: '', notes: '', next_mileage: '' })
      load()
    } catch (e) { showOpErr(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    setPendingDeleteId(id)
    setConfirmOpen(true)
  }

  async function confirmDelete() {
    setConfirmOpen(false)
    try { await api.maintenance.remove(pendingDeleteId); load() } catch (e) { showOpErr(e.message) }
    setPendingDeleteId(null)
  }

  const getSvc = key => SERVICE_TYPES.find(s => s.key === key) || SERVICE_TYPES[SERVICE_TYPES.length - 1]

  return (
    <div className="client-app min-h-dvh bg-[#F5F6F8] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <h1 className="text-indigo-600 font-extrabold text-xl">{isAr ? 'سجلات الصيانة' : 'Maintenance'}</h1>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowForm(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700">
          <Plus size={20} color="white"/>
        </motion.button>
      </div>

      {/* Device picker */}
      <div className="px-5 mb-4">
        <button onClick={() => setShowDevices(s => !s)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2">
             <Car size={15} className="text-indigo-600"/>
             <span className="text-slate-800 text-sm font-bold">
              {selectedDevice?.name || (isAr ? 'اختر جهازاً' : 'Choisir appareil')}
            </span>
          </div>
          <ChevronDown size={15} className="text-slate-400" style={{ transform: showDevices ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
        </button>
        <AnimatePresence>
          {showDevices && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {devices.map(d => (
                <button key={d.id} onClick={() => { setDeviceId(String(d.id)); setShowDevices(false) }}
                  className={`w-full border-b border-slate-100 px-4 py-3 text-left text-sm ${String(d.id) === deviceId ? 'text-indigo-600' : 'text-slate-600'}`}>
                  {d.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Logs */}
      <div className="px-4 space-y-2.5">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: '#e4b56b', borderTopColor: 'transparent' }}/>
          </div>
        ) : logs.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white">
              <Wrench size={26} className="text-slate-300"/>
            </div>
            <p className="text-sm text-slate-500">
              {isAr ? 'لا توجد سجلات' : 'Aucun enregistrement'}
            </p>
            <button onClick={() => setShowForm(true)}
               className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-600">
              {isAr ? '+ إضافة سجل' : '+ Ajouter'}
            </button>
          </div>
        ) : logs.map((log, i) => {
          const svc = getSvc(log.type)
          const isDue = log.next_mileage && log.current_mileage && log.next_mileage - log.current_mileage < 500
          return (
            <motion.div key={log.id || i}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
               style={{ background: isDue ? '#fffaf0' : '#ffffff',
                        border: '1px solid ' + (isDue ? '#ead8b4' : '#e2e8f0') }}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: svc.color + '1a' }}>
                  <Wrench size={19} style={{ color: svc.color }}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-slate-800 font-bold text-sm">{svc[isAr ? 'ar' : 'fr']}</p>
                    <button onClick={() => handleDelete(log.id)} className="p-1">
                      <Trash2 size={14} style={{ color: 'rgba(255,59,48,0.6)' }}/>
                    </button>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {log.date && (
                       <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Calendar size={11}/>{log.date}
                      </span>
                    )}
                    {log.mileage && (
                       <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Gauge size={11}/>{log.mileage} km
                      </span>
                    )}
                  </div>
                  {isDue && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <AlertTriangle size={11} style={{ color: '#FF9500' }}/>
                      <span className="text-[10px] font-semibold" style={{ color: '#FF9500' }}>
                        {isAr ? 'موعد الصيانة قريب' : 'Entretien bientôt dû'}
                      </span>
                    </div>
                  )}
                  {log.notes && <p className="text-xs mt-1 text-slate-500">{log.notes}</p>}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Add form sheet */}
      <AnimatePresence>
        {showForm && (
          <motion.div className="fixed inset-0 z-50 flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0" style={{ background: 'rgba(15,23,42,0.4)' }} onClick={() => setShowForm(false)}/>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative w-full rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-indigo-600 font-extrabold text-base">{isAr ? 'إضافة سجل صيانة' : 'Ajouter maintenance'}</h3>
                <button onClick={() => setShowForm(false)} aria-label={isAr ? 'إغلاق' : 'Fermer'}><X size={20} className="text-slate-400"/></button>
              </div>
              <form onSubmit={handleAdd} className="space-y-3">
                {/* Service type grid */}
                <div className="grid grid-cols-4 gap-2 mb-1">
                  {SERVICE_TYPES.map(svc => (
                    <button key={svc.key} type="button" onClick={() => setFormData(f => ({ ...f, type: svc.key }))}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl text-[10px] font-medium transition-all"
                      style={formData.type === svc.key
                        ? { background: svc.color + '22', border: '1.5px solid ' + svc.color, color: svc.color }
                        : { background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b' }}>
                      <Wrench size={14} style={{ color: formData.type === svc.key ? svc.color : '#94a3b8' }}/>
                      {svc[isAr ? 'ar' : 'fr']}
                    </button>
                  ))}
                </div>
                {[
                  { key: 'date', type: 'date', label: isAr ? 'التاريخ' : 'Date' },
                  { key: 'mileage', type: 'number', label: isAr ? 'العداد (كم)' : 'Kilométrage (km)' },
                  { key: 'next_mileage', type: 'number', label: isAr ? 'الصيانة القادمة (كم)' : 'Prochain entretien (km)' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs mb-1 font-bold text-slate-500">{field.label}</label>
                    <input type={field.type} value={formData[field.key]} onChange={e => setFormData(f => ({ ...f, [field.key]: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 text-sm outline-none focus:border-accent"/>
                  </div>
                ))}
                <div>
                  <label className="block text-xs mb-1 font-bold text-slate-500">{isAr ? 'ملاحظات' : 'Notes'}</label>
                  <textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 text-sm outline-none focus:border-accent"/>
                </div>
                <motion.button type="submit" disabled={saving} whileTap={{ scale: 0.97 }}
                   className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50"
                   style={{ background: saving ? '#94a3b8' : undefined }}>
                  {saving ? '...' : (isAr ? 'حفظ' : 'Enregistrer')}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {opErr && (
        <div className="fixed bottom-24 left-4 right-4 z-50 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-600 text-sm font-medium text-center shadow-lg">
          {opErr}
        </div>
      )}
      <ConfirmModal
        open={confirmOpen}
        title={isAr ? 'حذف السجل' : "Supprimer l'enregistrement"}
        message={isAr ? 'هل أنت متأكد من حذف سجل الصيانة هذا؟' : 'Êtes-vous sûr de vouloir supprimer cet enregistrement ?'}
        danger
        onConfirm={confirmDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDeleteId(null) }}
      />
      <ClientNav/>
    </div>
  )
}
