import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Wrench, Plus, AlertCircle, CheckCircle, Trash2, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import ConfirmModal from '../../components/ConfirmModal'

const TYPES_AR = [
  { value: 'oil', label: 'تغيير الزيت' },
  { value: 'tires', label: 'تغيير الإطارات' },
  { value: 'brakes', label: 'فرامل' },
  { value: 'battery', label: 'بطارية' },
  { value: 'filter', label: 'فلتر الهواء' },
  { value: 'other', label: 'أخرى' },
]
const TYPES_FR = [
  { value: 'oil', label: 'Vidange huile' },
  { value: 'tires', label: 'Changement pneus' },
  { value: 'brakes', label: 'Freins' },
  { value: 'battery', label: 'Batterie' },
  { value: 'filter', label: 'Filtre à air' },
  { value: 'other', label: 'Autre' },
]

function typeLabel(type, lang) {
  const list = lang === 'ar' ? TYPES_AR : TYPES_FR
  return list.find(t => t.value === type)?.label || type
}

function MaintenanceBadge({ log, device, lang }) {
  const isAr = lang === 'ar'
  if (!log.next_due_mileage || !device) return null
  const current = device.totalDistance || 0
  const diff = log.next_due_mileage - current
  if (diff > 500) return null
  const urgent = diff <= 0
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${urgent ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
      <AlertCircle size={10} />
      {urgent
        ? (isAr ? 'متأخر!' : 'En retard!')
        : (isAr ? `${diff} كم متبق` : `${diff} km restants`)}
    </span>
  )
}

/* ── Add Modal ─────────────────────────────────────────────── */
function AddModal({ open, onClose, onAdd, devices, lang }) {
  const isAr = lang === 'ar'
  const types = isAr ? TYPES_AR : TYPES_FR
  const [form, setForm] = useState({ deviceId: devices[0]?.id || '', type: 'oil', note: '', mileage: '', date: new Date().toISOString().split('T')[0], nextDueMileage: '' })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.deviceId) return setErr(isAr ? 'اختر الجهاز' : 'Sélectionnez un appareil')
    setLoading(true); setErr(null)
    try {
      await onAdd(form)
      onClose()
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  if (!open) return null
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-lg bg-slate-900 rounded-t-3xl p-5 pb-10"
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-base">{isAr ? 'إضافة سجل صيانة' : 'Ajouter un entretien'}</h2>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center"><X size={14} className="text-slate-300" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <select value={form.deviceId} onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-accent">
              {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-accent">
              {types.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
            </select>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-accent" />
            <input type="number" placeholder={isAr ? 'المسافة الحالية (كم)' : 'Kilométrage actuel'} value={form.mileage}
              onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-accent placeholder:text-slate-500" />
            <input type="number" placeholder={isAr ? 'الكيلومتر القادم (اختياري)' : 'Prochain km (optionnel)'} value={form.nextDueMileage}
              onChange={e => setForm(f => ({ ...f, nextDueMileage: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-accent placeholder:text-slate-500" />
            <textarea rows={2} placeholder={isAr ? 'ملاحظة (اختياري)' : 'Note (optionnel)'} value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-accent placeholder:text-slate-500 resize-none" />
            {err && <p className="text-red-400 text-xs">{err}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-accent text-slate-900 rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-transform">
              {loading ? (isAr ? 'جاري الحفظ...' : 'Enregistrement...') : (isAr ? 'حفظ' : 'Enregistrer')}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ── Main ─────────────────────────────────────────────────────── */
export default function Maintenance() {
  const navigate = useNavigate()
  const { devices, lang } = useApp()
  const isAr = lang === 'ar'
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filterDevice, setFilterDevice] = useState('all')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const loadLogs = async () => {
    setLoading(true)
    try {
      const all = await Promise.all(
        devices.map(d => api.maintenance.list(d.id).catch(() => []))
      )
      setLogs(all.flat())
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadLogs() }, []) // eslint-disable-line

  const handleAdd = async (form) => {
    await api.maintenance.add(form)
    await loadLogs()
  }

  const handleDelete = async () => {
    if (!confirmDeleteId) return
    try {
      await api.maintenance.remove(confirmDeleteId)
      setLogs(prev => prev.filter(l => l.id !== confirmDeleteId))
    } catch { /* silent */ } finally {
      setConfirmDeleteId(null)
    }
  }

  const filtered = filterDevice === 'all' ? logs : logs.filter(l => String(l.device_id) === filterDevice)

  const deviceById = (id) => devices.find(d => String(d.id) === String(id))

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg,#0d1b33 0%,#0a1225 100%)' }}>
      {/* Header */}
      <div className="pt-14 px-4 pb-4" style={{ background: 'linear-gradient(160deg,#0F2044 0%,#162d5e 100%)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <ChevronLeft size={18} className="text-white" />
            </button>
            <div>
              <h1 className="text-white text-lg font-bold leading-tight">{isAr ? 'الصيانة' : 'Maintenance'}</h1>
              <p className="text-blue-200/70 text-xs">{isAr ? 'سجّل وتابع صيانة مركباتك' : 'Suivez l\'entretien de vos véhicules'}</p>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/25 active:scale-95 transition-transform">
            <Plus size={18} className="text-slate-900 font-bold" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4 space-y-3">
        {/* Filter */}
        {devices.length > 1 && (
          <select value={filterDevice} onChange={e => setFilterDevice(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-accent">
            <option value="all">{isAr ? 'جميع الأجهزة' : 'Tous les appareils'}</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}

        {loading ? (
          <div className="text-center text-slate-500 py-16">{t(lang, 'loading')}</div>
        ) : filtered.length === 0 ? (
          <motion.div className="text-center py-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <Wrench size={28} className="text-slate-600" />
            </div>
            <p className="text-slate-400 text-sm">{isAr ? 'لا توجد سجلات صيانة بعد' : 'Aucun entretien enregistré'}</p>
            <button onClick={() => setShowAdd(true)}
              className="mt-4 px-4 py-2 bg-accent text-slate-900 rounded-xl text-sm font-bold active:scale-95 transition-transform">
              {isAr ? 'إضافة أول سجل' : 'Ajouter le premier'}
            </button>
          </motion.div>
        ) : (
          filtered.map((log, i) => {
            const dev = deviceById(log.device_id)
            return (
              <motion.div key={log.id}
                className="bg-slate-800/70 rounded-2xl p-4 border border-slate-700/40"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                      <Wrench size={16} className="text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight">{typeLabel(log.type, lang)}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{dev?.name || `#${log.device_id}`} · {new Date(log.date).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA')}</p>
                    </div>
                  </div>
                  <button onClick={() => setConfirmDeleteId(log.id)} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 active:scale-90 transition-transform">
                    <Trash2 size={13} className="text-red-400" />
                  </button>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2 items-center">
                  {log.mileage && (
                    <span className="text-[11px] bg-slate-700/60 text-slate-400 px-2 py-0.5 rounded-full">
                      {log.mileage.toLocaleString()} km
                    </span>
                  )}
                  {log.next_due_mileage && (
                    <span className="text-[11px] bg-slate-700/60 text-slate-400 px-2 py-0.5 rounded-full">
                      {isAr ? 'القادم:' : 'Prochain:'} {log.next_due_mileage.toLocaleString()} km
                    </span>
                  )}
                  <MaintenanceBadge log={log} device={dev} lang={lang} />
                </div>
                {log.note && <p className="text-[12px] text-slate-400 mt-2 leading-relaxed">{log.note}</p>}
              </motion.div>
            )
          })
        )}
      </div>

      <AddModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd} devices={devices} lang={lang} />
      <ConfirmModal
        open={!!confirmDeleteId}
        title={isAr ? 'حذف سجل الصيانة' : 'Supprimer l\'entretien'}
        message={isAr ? 'هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.' : 'Êtes-vous sûr de vouloir supprimer cet entretien ? Cette action est irréversible.'}
        confirmLabel={isAr ? 'حذف' : 'Supprimer'}
        cancelLabel={isAr ? 'إلغاء' : 'Annuler'}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
        danger
      />
      <ClientNav />
    </div>
  )
}
