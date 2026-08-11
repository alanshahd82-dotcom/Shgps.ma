import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserCog, Plus, Pencil, Trash2, X, CheckCircle2, AlertCircle,
  Eye, EyeOff, Users, Cpu, Shield, ShieldOff, ShieldCheck,
  ChevronRight, Loader2, ToggleLeft, ToggleRight, Key,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import AdminLayout from './AdminLayout'
import Button from '../../components/ui/Button'

const PERM_LABELS = {
  add_clients:      { ar: 'إضافة عملاء',        fr: 'Ajouter clients'    },
  add_devices:      { ar: 'إضافة أجهزة',         fr: 'Ajouter appareils' },
  view_reports:     { ar: 'تقارير',              fr: 'Rapports'          },
  view_map:         { ar: 'الخريطة العامة',       fr: 'Carte globale'     },
  view_alerts:      { ar: 'التنبيهات',           fr: 'Alertes'           },
  device_setup:     { ar: 'إعداد الأجهزة',       fr: 'Config. appareils' },
  support_settings: { ar: 'بيانات الدعم',        fr: 'Support'           },
}

function PermToggle({ perm, value, onChange, lang }) {
  const label = PERM_LABELS[perm]?.[lang] || perm
  return (
    <button
      type="button"
      onClick={() => onChange(perm, !value)}
      className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all ${
        value ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <span className={`text-xs font-semibold ${value ? 'text-emerald-700' : 'text-slate-400'}`}>{label}</span>
      {value
        ? <ToggleRight size={18} className="text-emerald-500 flex-shrink-0"/>
        : <ToggleLeft  size={18} className="text-slate-300 flex-shrink-0"/>}
    </button>
  )
}

/* ─── Create / Edit modal ───────────────────────────────────────────────────── */
function SubAdminModal({ open, onClose, onSaved, editing, lang, clientList }) {
  const isAr = lang === 'ar'
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    adminPermissions: {
      add_clients: true, add_devices: true, view_reports: true,
      view_map: true, view_alerts: true, device_setup: false, support_settings: false,
    }
  })
  const [showPass,    setShowPass]    = useState(false)
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [tab,         setTab]         = useState('info') // 'info' | 'perms' | 'clients'
  const [selectedClients, setSelectedClients] = useState([])

  useEffect(() => {
    if (editing) {
      setForm(f => ({
        ...f,
        name: editing.name || '',
        email: editing.email || '',
        password: '', confirmPassword: '',
        adminPermissions: editing.admin_permissions || f.adminPermissions,
      }))
      setSelectedClients(editing.assignedClientIds || [])
    } else {
      setForm({ name: '', email: '', password: '', confirmPassword: '',
        adminPermissions: { add_clients: true, add_devices: true, view_reports: true, view_map: true, view_alerts: true, device_setup: false, support_settings: false }
      })
      setSelectedClients([])
    }
    setError(''); setTab('info')
  }, [editing, open])

  const togglePerm  = (perm, val) => setForm(f => ({ ...f, adminPermissions: { ...f.adminPermissions, [perm]: val } }))
  const toggleClient = (id) => setSelectedClients(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    if (!editing && form.password !== form.confirmPassword) {
      setError(isAr ? 'كلمات المرور غير متطابقة' : 'Les mots de passe ne correspondent pas')
      return setLoading(false)
    }
    try {
      let savedId = editing?.id
      if (editing) {
        const patch = { name: form.name, adminPermissions: form.adminPermissions }
        if (form.password) patch.password = form.password
        await api.subAdmins.update(editing.id, patch)
      } else {
        const created = await api.subAdmins.create({
          name: form.name, email: form.email, password: form.password,
          adminPermissions: form.adminPermissions,
        })
        savedId = created.id
      }
      // Save client assignments
      await api.subAdmins.assignClients(savedId, selectedClients)
      onSaved(); onClose()
    } catch (err) {
      setError(err.message || (isAr ? 'حدث خطأ' : 'Une erreur est survenue'))
    } finally { setLoading(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="w-full md:max-w-[500px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col max-h-[90vh]"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex-shrink-0 bg-primary-500 px-6 py-4 flex items-center justify-between rounded-t-3xl md:rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <UserCog size={18} className="text-white"/>
                </div>
                <h3 className="font-bold text-white text-lg">
                  {editing
                    ? (isAr ? 'تعديل مسؤول فرعي' : 'Modifier sous-admin')
                    : (isAr ? 'مسؤول فرعي جديد' : 'Nouveau sous-admin')}
                </h3>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20">
                <X size={16} className="text-white"/>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex-shrink-0 flex border-b border-gray-100">
              {[
                { key: 'info',    label: isAr ? 'بيانات'      : 'Infos'         },
                { key: 'perms',   label: isAr ? 'الصلاحيات'  : 'Permissions'    },
                { key: 'clients', label: isAr ? 'العملاء'    : 'Clients'        },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors ${tab === t.key ? 'border-primary-500 text-primary-500' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <form id="sa-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-100">
                  <AlertCircle size={14}/>{error}
                </div>
              )}

              {/* Info tab */}
              {tab === 'info' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{isAr ? 'الاسم الكامل' : 'Nom complet'}</label>
                    <input className="input-field text-sm" placeholder={isAr ? 'مثال: أحمد الإدريسي' : 'Ex: Ahmed Idrissi'}
                      value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
                    <input type="email" className={`input-field text-sm ${editing ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      placeholder="sub@athargps.com" value={form.email} readOnly={!!editing}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required={!editing} />
                    {editing && <p className="text-[10px] text-slate-400 mt-1">{isAr ? 'لا يمكن تغيير البريد' : 'Email non modifiable'}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      {editing ? (isAr ? 'كلمة مرور جديدة (اختياري)' : 'Nouveau mot de passe (optionnel)') : (isAr ? 'كلمة المرور' : 'Mot de passe')}
                    </label>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} className="input-field text-sm pr-10"
                        placeholder={editing ? '••••••••' : isAr ? '8 أحرف على الأقل' : '8 caractères minimum'}
                        value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        required={!editing} minLength={editing ? 0 : 8} />
                      <button type="button" onClick={() => setShowPass(p => !p)}
                        className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                        {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                      </button>
                    </div>
                  </div>
                  {form.password && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">{isAr ? 'تأكيد كلمة المرور' : 'Confirmer mot de passe'}</label>
                      <input type={showPass ? 'text' : 'password'} className="input-field text-sm"
                        placeholder="••••••••" value={form.confirmPassword}
                        onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} />
                    </div>
                  )}
                </div>
              )}

              {/* Permissions tab */}
              {tab === 'perms' && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 mb-3">
                    {isAr ? 'حدد ما يمكن لهذا المسؤول الفرعي رؤيته وفعله.' : 'Définissez ce que ce sous-admin peut voir et faire.'}
                  </p>
                  {Object.keys(PERM_LABELS).map(perm => (
                    <PermToggle key={perm} perm={perm} value={!!form.adminPermissions[perm]} onChange={togglePerm} lang={lang} />
                  ))}
                </div>
              )}

              {/* Clients tab */}
              {tab === 'clients' && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 mb-3">
                    {isAr ? 'اختر العملاء الذين يمكن لهذا المسؤول رؤيتهم وإدارتهم.' : 'Sélectionnez les clients que ce sous-admin peut gérer.'}
                  </p>
                  <p className="text-xs font-bold text-primary-500 mb-2">{selectedClients.length} {isAr ? 'محدد' : 'sélectionné(s)'}</p>
                  {clientList.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">{isAr ? 'لا يوجد عملاء بعد' : 'Aucun client'}</p>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {clientList.map(client => {
                        const checked = selectedClients.includes(client.id)
                        return (
                          <button key={client.id} type="button" onClick={() => toggleClient(client.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                              checked ? 'border-primary-200 bg-primary-50' : 'border-gray-100 bg-white hover:border-gray-200'
                            }`}>
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              checked ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                            }`}>
                              {checked && <CheckCircle2 size={12} className="text-white"/>}
                            </div>
                            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-500 font-bold text-xs flex-shrink-0">
                              {client.avatar || client.name?.[0]}
                            </div>
                            <div className="flex-1 text-right min-w-0">
                              <p className="text-xs font-semibold text-primary-500 truncate">{client.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">{client.email}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 flex-shrink-0">{client.devicesCount || 0} {isAr ? 'جهاز' : 'app.'}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </form>

            {/* Footer */}
            <div className="flex-shrink-0 px-5 pb-5 pt-3 flex gap-3 border-t border-gray-100">
              <button type="button" onClick={onClose} className="flex-1 btn-secondary py-3 text-sm">{isAr ? 'إلغاء' : 'Annuler'}</button>
              <Button type="submit" form="sa-form" disabled={loading} variant="primary" className="flex-1 py-3 text-sm">
                {loading ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}
                {loading ? '...' : (editing ? (isAr ? 'حفظ' : 'Enregistrer') : (isAr ? 'إنشاء' : 'Créer'))}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ─── Confirm delete modal ──────────────────────────────────────────────────── */
function ConfirmDelete({ open, name, onConfirm, onClose, lang }) {
  const isAr = lang === 'ar'
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm flex items-center justify-center p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6"
            initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
            onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500"/>
            </div>
            <h3 className="font-bold text-primary-500 text-center text-lg mb-2">{isAr ? 'حذف المسؤول الفرعي' : 'Supprimer sous-admin'}</h3>
            <p className="text-slate-400 text-sm text-center mb-6">
              {isAr ? `هل أنت متأكد من حذف "${name}"؟ لا يمكن التراجع.` : `Supprimer "${name}" ? Action irréversible.`}
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 btn-secondary py-3 text-sm">{isAr ? 'إلغاء' : 'Annuler'}</button>
              <button onClick={onConfirm} className="flex-1 bg-red-500 text-white font-bold py-3 rounded-2xl text-sm hover:bg-red-600 transition-colors">{isAr ? 'حذف' : 'Supprimer'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ─── Main page ─────────────────────────────────────────────────────────────── */
export default function SubAdmins() {
  const { lang, clientList } = useApp()
  const isAr = lang === 'ar'

  const [subAdmins,     setSubAdmins]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [showModal,     setShowModal]     = useState(false)
  const [editing,       setEditing]       = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await api.subAdmins.list()
      // fetch assigned clients for each sub-admin
      const enriched = await Promise.all(data.map(async sa => {
        try {
          const clients = await api.subAdmins.getClients(sa.id)
          return { ...sa, assignedClientIds: clients.map(c => c.id), assignedClients: clients.length }
        } catch { return { ...sa, assignedClientIds: [], assignedClients: 0 } }
      }))
      setSubAdmins(enriched)
    } catch (e) {
      setError(e.message || (isAr ? 'تعذر التحميل' : 'Chargement échoué'))
    } finally { setLoading(false) }
  }, [isAr])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await api.subAdmins.delete(confirmDelete.id)
      setConfirmDelete(null)
      load()
    } catch (e) { setError(e.message) }
  }

  const openEdit = (sa) => { setEditing(sa); setShowModal(true) }
  const openCreate = () => { setEditing(null); setShowModal(true) }

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-primary-500">{isAr ? 'المسؤولون الفرعيون' : 'Sous-administrateurs'}</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {isAr ? 'أنشئ حسابات بصلاحيات محدودة لفريقك' : 'Créez des comptes avec permissions limitées pour votre équipe'}
            </p>
          </div>
          <Button onClick={openCreate} variant="primary">
            <Plus size={15}/>{isAr ? 'مسؤول فرعي جديد' : 'Nouveau sous-admin'}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-2xl mb-4 text-sm">
            <AlertCircle size={14}/>{error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-300">
            <Loader2 size={28} className="animate-spin"/>
          </div>
        )}

        {/* Empty */}
        {!loading && subAdmins.length === 0 && !error && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="w-20 h-20 rounded-3xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <UserCog size={32} className="text-primary-300"/>
            </div>
            <h3 className="font-bold text-primary-500 text-lg mb-2">
              {isAr ? 'لا يوجد مسؤولون فرعيون بعد' : 'Aucun sous-administrateur'}
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              {isAr ? 'أنشئ حسابات لفريقك بصلاحيات تحكمها أنت' : 'Créez des comptes pour votre équipe avec des permissions contrôlées'}
            </p>
            <Button onClick={openCreate} variant="primary"><Plus size={14}/>{isAr ? 'إنشاء أول مسؤول' : 'Créer le premier'}</Button>
          </div>
        )}

        {/* List */}
        {!loading && subAdmins.length > 0 && (
          <div className="space-y-3">
            {subAdmins.map((sa, i) => {
              const perms  = sa.admin_permissions || {}
              const active = perms.add_clients || perms.add_devices || perms.view_map || perms.view_alerts
              return (
                <motion.div key={sa.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-md shadow-primary-200">
                      {sa.avatar || sa.name?.[0] || '?'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-primary-500 truncate">{sa.name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sa.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                          {sa.is_active ? (isAr ? 'نشط' : 'Actif') : (isAr ? 'موقوف' : 'Désactivé')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-3">{sa.email}</p>

                      {/* Stats */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="flex items-center gap-1 text-xs bg-primary-50 text-primary-500 px-2.5 py-1 rounded-xl font-semibold">
                          <Users size={11}/>{sa.assigned_clients || sa.assignedClients || 0} {isAr ? 'عميل' : 'client(s)'}
                        </span>
                        <span className="flex items-center gap-1 text-xs bg-gray-50 text-slate-500 px-2.5 py-1 rounded-xl font-semibold">
                          <Shield size={11}/>
                          {Object.values(perms).filter(Boolean).length}/{Object.keys(PERM_LABELS).length} {isAr ? 'صلاحية' : 'permission(s)'}
                        </span>
                      </div>

                      {/* Permission badges */}
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(PERM_LABELS).map(([perm, labels]) => (
                          <span key={perm}
                            className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${
                              perms[perm] ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-300 line-through'
                            }`}>
                            {labels[lang]}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button onClick={() => openEdit(sa)}
                        className="w-9 h-9 rounded-xl bg-primary-50 text-primary-500 flex items-center justify-center hover:bg-primary-100 transition-colors">
                        <Pencil size={14}/>
                      </button>
                      <button onClick={() => setConfirmDelete(sa)}
                        className="w-9 h-9 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <SubAdminModal
        open={showModal} lang={lang} clientList={clientList}
        editing={editing}
        onClose={() => { setShowModal(false); setEditing(null) }}
        onSaved={load}
      />

      <ConfirmDelete
        open={!!confirmDelete} name={confirmDelete?.name} lang={lang}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </AdminLayout>
  )
}
