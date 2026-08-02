import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, ChevronDown, Wrench, Car, AlertTriangle,
  Calendar, Gauge, FileText, X, CheckCircle
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import {
  VehicleIcon, PageHeader, Card, Section, SectionTitle,
  EmptyState, ErrorState, Spinner
} from '../../components/ui'

// ── Service type config ───────────────────────────────────────────────────────
const SERVICE_TYPES = [
  { key: 'oil_change',   ar: 'تغيير الزيت',       fr: 'Vidange',          color: '#f59e0b' },
  { key: 'tires',        ar: 'إطارات',             fr: 'Pneus',            color: '#3b82f6' },
  { key: 'brake',        ar: 'الفرامل',             fr: 'Freins',           color: '#ef4444' },
  { key: 'inspection',   ar: 'فحص دوري',            fr: 'Visite technique', color: '#22c55e' },
  { key: 'battery',      ar: 'بطارية',              fr: 'Batterie',         color: '#8b5cf6' },
  { key: 'ac',           ar: 'تكييف',               fr: 'Climatisation',    color: '#06b6d4' },
  { key: 'repair',       ar: 'إصلاح',               fr: 'Réparation',       color: '#0F2044' },
  { key: 'other',        ar: 'أخرى',                fr: 'Autre',            color: '#94a3b8' },
]

function typeInfo(key, lang) {
  const found = SERVICE_TYPES.find(s => s.key === key)
  return {
    label: found ? (lang === 'ar' ? found.ar : found.fr) : key,
    color: found?.color ?? '#94a3b8',
  }
}

// ── Log card ──────────────────────────────────────────────────────────────────
function LogCard({ log, lang, onDelete, index }) {
  const isAr = lang === 'ar'
  const info = typeInfo(log.type, lang)
  const date = log.date
    ? new Date(log.date).toLocaleDateString(isAr ? 'ar-MA' : 'fr-MA')
    : '—'
  const isDue = log.next_due_mileage && log.mileage
    && (log.next_due_mileage - log.mileage) < 500

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
      className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden"
    >
      <div className="h-1" style={{ background: info.color }} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center"
            style={{ background: `${info.color}18` }}
          >
            <Wrench size={16} style={{ color: info.color }} strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-primary-500 dark:text-white text-sm">{info.label}</p>
              {isDue && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-[9px] font-bold">
                  <AlertTriangle size={9} />
                  {isAr ? 'موعد قريب' : 'Bientôt'}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <Calendar size={10} strokeWidth={2} />
                {date}
              </span>
              {log.mileage != null && (
                <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <Gauge size={10} strokeWidth={2} />
                  {log.mileage.toLocaleString()} {t(lang, 'km')}
                </span>
              )}
              {log.next_due_mileage != null && (
                <span className="flex items-center gap-1 text-[11px] text-accent font-semibold">
                  <Gauge size={10} strokeWidth={2} />
                  {isAr ? 'موعد: ' : 'Prochain: '}
                  {log.next_due_mileage.toLocaleString()} {t(lang, 'km')}
                </span>
              )}
            </div>
            {log.note && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed">{log.note}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
          >
            <Trash2 size={13} className="text-red-500" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Add form sheet ─────────────────────────────────────────────────────────────
function AddForm({ lang, devices, onSave, onClose }) {
  const isAr = lang === 'ar'
  const [form, setForm] = useState({
    deviceId:       devices[0]?.id ? String(devices[0].id) : '',
    type:           'oil_change',
    date:           new Date().toISOString().slice(0, 10),
    mileage:        '',
    nextDueMileage: '',
    note:           '',
  })
  const [saving, setSaving]   = useState(false)
  const [err,    setErr]      = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.deviceId || !form.type || !form.date) {
      setErr(isAr ? 'يرجى ملء الحقول المطلوبة' : 'Champs obligatoires manquants'); return
    }
    setSaving(true); setErr('')
    try {
      await onSave({
        deviceId:       form.deviceId,
        type:           form.type,
        date:           form.date,
        mileage:        form.mileage ? Number(form.mileage)        : null,
        nextDueMileage: form.nextDueMileage ? Number(form.nextDueMileage) : null,
        note:           form.note || null,
      })
    } catch (ex) { setErr(ex.message) }
    finally { setSaving(false) }
  }

  const inputCls = 'w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm text-primary-500 dark:text-white placeholder-slate-400 outline-none focus:border-accent transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Scrim */}
      <div className="flex-1 bg-black/40" onClick={onClose} />
      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-white dark:bg-slate-900 rounded-t-3xl px-4 pb-8 pt-4 shadow-2xl"
        style={{ maxHeight: '88dvh', overflowY: 'auto' }}
      >
        {/* Handle */}
        <div className="w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto mb-4" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-primary-500 dark:text-white text-base">
            {t(lang, 'add_maintenance_log')}
          </h2>
          <button onClick={onClose} className="text-slate-400"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Device */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              {t(lang, 'device')} *
            </label>
            <select value={form.deviceId} onChange={e => set('deviceId', e.target.value)}
              className={inputCls}>
              {devices.map(d => (
                <option key={d.id} value={String(d.id)}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Service type */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              {isAr ? 'نوع الخدمة' : 'Type de service'} *
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {SERVICE_TYPES.map(st => (
                <button key={st.key} type="button"
                  onClick={() => set('type', st.key)}
                  className="py-2 rounded-xl text-[10px] font-semibold text-center transition-all"
                  style={{
                    background: form.type === st.key ? st.color : `${st.color}12`,
                    color:      form.type === st.key ? 'white' : st.color,
                    border:     form.type === st.key ? '1px solid transparent' : `1px solid ${st.color}30`,
                  }}
                >
                  {isAr ? st.ar : st.fr}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              {isAr ? 'التاريخ' : 'Date'} *
            </label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
          </div>

          {/* Mileage row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                {isAr ? 'العداد الحالي (كم)' : 'Kilométrage actuel'}
              </label>
              <input type="number" value={form.mileage} onChange={e => set('mileage', e.target.value)}
                placeholder="150000" min="0" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                {isAr ? 'الموعد القادم (كم)' : 'Prochain (km)'}
              </label>
              <input type="number" value={form.nextDueMileage} onChange={e => set('nextDueMileage', e.target.value)}
                placeholder="155000" min="0" className={inputCls} />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              {isAr ? 'ملاحظة' : 'Note'} ({isAr ? 'اختياري' : 'optionnel'})
            </label>
            <textarea value={form.note} onChange={e => set('note', e.target.value)}
              rows={2} placeholder={isAr ? 'وصف الصيانة...' : 'Description…'}
              className={`${inputCls} resize-none`} />
          </div>

          {err && <p className="text-xs text-red-500 text-center">{err}</p>}

          <button type="submit" disabled={saving}
            className="w-full py-3.5 bg-accent text-slate-900 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60">
            {saving
              ? <><div className="w-4 h-4 border-2 border-slate-900/40 border-t-slate-900 rounded-full animate-spin" />{isAr ? 'جاري الحفظ...' : 'Enregistrement...'}</>
              : <><CheckCircle size={16} />{t(lang, 'save')}</>
            }
          </button>
        </form>
      </motion.div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Maintenance() {
  const { devices, lang } = useApp()
  const isAr = lang === 'ar'

  const [selectedId, setSelectedId]   = useState('')
  const [logs,       setLogs]         = useState([])
  const [loading,    setLoading]      = useState(false)
  const [error,      setError]        = useState(null)
  const [showAdd,    setShowAdd]      = useState(false)
  const [deleting,   setDeleting]     = useState(null)
  const [toast,      setToast]        = useState('')

  const selectedDevice = devices.find(d => String(d.id) === String(selectedId))

  const loadLogs = useCallback(async () => {
    if (!selectedId) return
    setLoading(true); setError(null)
    try { setLogs(await api.maintenance.list(selectedId)) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [selectedId])

  useEffect(() => { loadLogs() }, [loadLogs])
  useEffect(() => {
    if (!selectedId && devices.length > 0) setSelectedId(String(devices[0].id))
  }, [devices]) // eslint-disable-line

  const handleAdd = async (data) => {
    const created = await api.maintenance.add(data)
    setLogs(prev => [created, ...prev])
    setShowAdd(false)
    showToast(isAr ? 'تم إضافة السجل' : 'Entrée ajoutée')
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await api.maintenance.remove(id)
      setLogs(prev => prev.filter(l => l.id !== id))
      showToast(isAr ? 'تم الحذف' : 'Supprimé')
    } catch { /* ignore */ }
    finally { setDeleting(null) }
  }

  const showToast = (msg) => {
    setToast(msg); setTimeout(() => setToast(''), 2500)
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50 dark:bg-slate-900">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <PageHeader>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-xl">{t(lang, 'maintenance')}</h1>
            <p className="text-white/50 text-xs mt-0.5">
              {logs.length} {isAr ? 'سجل صيانة' : 'entrée(s)'}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="w-9 h-9 rounded-full bg-accent flex items-center justify-center active:scale-90 transition-transform"
            aria-label={t(lang, 'add_maintenance_log')}
          >
            <Plus size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
        </div>
      </PageHeader>

      {/* ── Device selector ─────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {devices.map(d => (
            <button key={d.id} type="button"
              onClick={() => setSelectedId(String(d.id))}
              className="flex items-center gap-2 px-3 py-2 rounded-2xl text-[11px] font-semibold flex-shrink-0 transition-all"
              style={{
                background: String(d.id) === selectedId ? '#0F2044'       : 'rgba(255,255,255,0.9)',
                color:      String(d.id) === selectedId ? 'white'         : '#64748b',
                border:     String(d.id) === selectedId ? '1px solid transparent' : '1px solid #e2e8f0',
              }}
            >
              <VehicleIcon type={d.type} iconSize={10} className="opacity-80" />
              {d.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-2 space-y-3">
        {!selectedId ? (
          <EmptyState icon={Car} title={isAr ? 'اختر مركبة' : 'Choisissez un véhicule'} />
        ) : loading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : error ? (
          <ErrorState message={error} onRetry={loadLogs} lang={lang} />
        ) : logs.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={t(lang, 'noMaintenanceLogs')}
            subtitle={isAr
              ? 'أضف أول سجل صيانة لتتبع تاريخ الخدمة'
              : 'Ajoutez la première entrée pour suivre l\'historique d\'entretien'}
            action={
              <button
                onClick={() => setShowAdd(true)}
                className="px-5 py-2.5 bg-accent text-slate-900 rounded-xl text-sm font-bold active:scale-95 transition-transform"
              >
                {t(lang, 'add_maintenance_log')}
              </button>
            }
          />
        ) : (
          <AnimatePresence>
            {logs.map((log, i) => (
              <LogCard
                key={log.id}
                log={log}
                lang={lang}
                index={i}
                onDelete={() => handleDelete(log.id)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── Add sheet ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <AddForm lang={lang} devices={devices} onSave={handleAdd} onClose={() => setShowAdd(false)} />
        )}
      </AnimatePresence>

      {/* ── Toast ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 inset-x-4 bg-primary-500 text-white rounded-2xl px-4 py-3 text-center text-sm font-semibold shadow-xl z-50"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <ClientNav />
    </div>
  )
}
