import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, ChevronDown, Wrench, AlertTriangle, Calendar, Gauge, X, Car } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import { VehicleIcon } from '../../components/ui'

const SERVICE_TYPES = [
  { key: 'oil_change', ar: 'تغيير الزيت', fr: 'Vidange', color: '#F59E0B' },
  { key: 'tires',      ar: 'إطارات',      fr: 'Pneus',  color: '#3B82F6' },
  { key: 'brake',      ar: 'الفرامل',     fr: 'Freins', color: '#FF3B30' },
  { key: 'inspection', ar: 'فحص دوري',   fr: 'Visite', color: '#00D97E' },
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
      await api.maintenance.add(deviceId, formData)
      setShowForm(false)
      setFormData({ type: 'oil_change', date: '', mileage: '', notes: '', next_mileage: '' })
      load()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm(isAr ? 'حذف السجل؟' : 'Supprimer cet enregistrement ?')) return
    try { await api.maintenance.remove(id); load() } catch (e) { alert(e.message) }
  }

  const getSvc = key => SERVICE_TYPES.find(s => s.key === key) || SERVICE_TYPES[SERVICE_TYPES.length - 1]

  return (
    <div className="min-h-screen pb-28" dir={isAr ? 'rtl' : 'ltr'}
      style={{ background: 'linear-gradient(160deg,#080f1f 0%,#0F2044 100%)' }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <h1 className="text-white font-bold text-xl">{isAr ? 'سجلات الصيانة' : 'Maintenance'}</h1>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowForm(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: '#00D97E', boxShadow: '0 4px 16px rgba(0,217,126,0.4)' }}>
          <Plus size={20} color="#0F2044"/>
        </motion.button>
      </div>

      {/* Device picker */}
      <div className="px-5 mb-4">
        <button onClick={() => setShowDevices(s => !s)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2">
            <Car size={15} style={{ color: '#00D97E' }}/>
            <span className="text-white text-sm font-medium">
              {selectedDevice?.name || (isAr ? 'اختر جهازاً' : 'Choisir appareil')}
            </span>
          </div>
          <ChevronDown size={15} style={{ color: 'rgba(255,255,255,0.4)', transform: showDevices ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
        </button>
        <AnimatePresence>
          {showDevices && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden rounded-xl mt-1"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {devices.map(d => (
                <button key={d.id} onClick={() => { setDeviceId(String(d.id)); setShowDevices(false) }}
                  className="w-full px-4 py-3 text-left text-sm"
                  style={{ color: String(d.id) === deviceId ? '#00D97E' : 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: '#00D97E', borderTopColor: 'transparent' }}/>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              <Wrench size={26} style={{ color: 'rgba(255,255,255,0.2)' }}/>
            </div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>
              {isAr ? 'لا توجد سجلات' : 'Aucun enregistrement'}
            </p>
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(0,217,126,0.12)', color: '#00D97E', border: '1px solid rgba(0,217,126,0.25)' }}>
              {isAr ? '+ إضافة سجل' : '+ Ajouter'}
            </button>
          </div>
        ) : logs.map((log, i) => {
          const svc = getSvc(log.type)
          const isDue = log.next_mileage && log.current_mileage && log.next_mileage - log.current_mileage < 500
          return (
            <motion.div key={log.id || i}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="p-4 rounded-2xl"
              style={{ background: isDue ? 'rgba(255,149,0,0.08)' : 'rgba(255,255,255,0.05)',
                       border: '1px solid ' + (isDue ? 'rgba(255,149,0,0.25)' : 'rgba(255,255,255,0.08)') }}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: svc.color + '1a' }}>
                  <Wrench size={19} style={{ color: svc.color }}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-white font-semibold text-sm">{svc[isAr ? 'ar' : 'fr']}</p>
                    <button onClick={() => handleDelete(log.id)} className="p-1">
                      <Trash2 size={14} style={{ color: 'rgba(255,59,48,0.6)' }}/>
                    </button>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {log.date && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
                        <Calendar size={11}/>{log.date}
                      </span>
                    )}
                    {log.mileage && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
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
                  {log.notes && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{log.notes}</p>}
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
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setShowForm(false)}/>
            <motion.div className="relative w-full rounded-t-3xl p-5"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{ background: '#0e1f3d', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-bold text-base">{isAr ? 'إضافة سجل صيانة' : 'Ajouter maintenance'}</h3>
                <button onClick={() => setShowForm(false)}><X size={20} style={{ color: 'rgba(255,255,255,0.4)' }}/></button>
              </div>
              <form onSubmit={handleAdd} className="space-y-3">
                {/* Service type grid */}
                <div className="grid grid-cols-4 gap-2 mb-1">
                  {SERVICE_TYPES.map(svc => (
                    <button key={svc.key} type="button" onClick={() => setFormData(f => ({ ...f, type: svc.key }))}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl text-[10px] font-medium transition-all"
                      style={formData.type === svc.key
                        ? { background: svc.color + '22', border: '1.5px solid ' + svc.color, color: svc.color }
                        : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>
                      <Wrench size={14} style={{ color: formData.type === svc.key ? svc.color : 'rgba(255,255,255,0.3)' }}/>
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
                    <label className="block text-xs mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>{field.label}</label>
                    <input type={field.type} value={formData[field.key]} onChange={e => setFormData(f => ({ ...f, [field.key]: e.target.value }))}
                      className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}/>
                  </div>
                ))}
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>{isAr ? 'ملاحظات' : 'Notes'}</label>
                  <textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2}
                    className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}/>
                </div>
                <motion.button type="submit" disabled={saving} whileTap={{ scale: 0.97 }}
                  className="w-full py-3.5 rounded-xl font-bold text-white text-sm disabled:opacity-50"
                  style={{ background: saving ? 'rgba(0,217,126,0.4)' : 'linear-gradient(135deg,#00D97E,#00b86a)', boxShadow: '0 4px 16px rgba(0,217,126,0.3)' }}>
                  {saving ? '...' : (isAr ? 'حفظ' : 'Enregistrer')}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ClientNav/>
    </div>
  )
}
