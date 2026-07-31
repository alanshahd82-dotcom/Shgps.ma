import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Trash2, ChevronRight, User, Phone, MapPin, X, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'
import ConfirmModal from '../../components/ConfirmModal'

function AddClientModal({ open, onClose, onAdd, lang }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', city: '', subscription: 'Basic' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await onAdd({ ...form, avatar: form.name[0] || '?' })
      setForm({ name: '', email: '', password: '', phone: '', city: '', subscription: 'Basic' })
      onClose()
    } catch (err) {
      setError(err.message || (lang === 'ar' ? 'حدث خطأ' : 'Une erreur est survenue'))
    } finally { setLoading(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed inset-x-3 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[520px] z-50"
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
          >
            <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] md:max-h-[88vh]">
              {/* Sticky header */}
              <div className="bg-primary-500 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
                    <User size={14} className="text-white" />
                  </div>
                  <h3 className="font-bold text-white text-base">{t(lang, 'addClient')}</h3>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center">
                  <X size={16} className="text-white" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1">
                {error && (
                  <div className="mx-6 mt-4 flex items-center gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
                    <AlertCircle size={15} className="flex-shrink-0" /> {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  {/* Name + City */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                        {t(lang, 'name')} <span className="text-red-400">*</span>
                      </label>
                      <input
                        className="input-field text-sm"
                        value={form.name}
                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        placeholder={lang === 'ar' ? 'الاسم الكامل' : 'Nom complet'}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t(lang, 'city')}</label>
                      <input
                        className="input-field text-sm"
                        value={form.city}
                        onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                        placeholder={lang === 'ar' ? 'المدينة' : 'Ville'}
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                      <span className="flex items-center gap-1">
                        <Phone size={11} />
                        {t(lang, 'phone')}
                      </span>
                    </label>
                    <input
                      className="input-field text-sm"
                      value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder={lang === 'ar' ? '06XXXXXXXX' : '06XXXXXXXX'}
                      type="tel"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                      {t(lang, 'email')} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      className="input-field text-sm"
                      value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="exemple@email.com"
                      required
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                      {t(lang, 'password')} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="password"
                      className="input-field text-sm"
                      value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      {lang === 'ar'
                        ? 'سيُطلب من العميل تغيير كلمة المرور عند أول تسجيل دخول'
                        : 'Le client devra changer ce mot de passe à la première connexion'}
                    </p>
                  </div>

                  {/* Subscription */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                      {t(lang, 'subscription')} <span className="text-red-400">*</span>
                    </label>
                    <select
                      className="input-field text-sm"
                      value={form.subscription}
                      onChange={e => setForm(p => ({ ...p, subscription: e.target.value }))}
                    >
                      <option value="Basic">Basic</option>
                      <option value="Pro">Pro</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>

                  {/* Info box */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2.5">
                    <CheckCircle2 size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-600 leading-relaxed">
                      {lang === 'ar'
                        ? 'بعد إنشاء الحساب، يستطيع العميل تسجيل الدخول مباشرة عبر تطبيق العميل بالبريد وكلمة المرور المُدخلة.'
                        : 'Après création, le client peut se connecter directement via l\'app client avec ces identifiants.'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 btn-secondary py-3 text-sm"
                    >
                      {t(lang, 'cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 btn-primary py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                          </svg>
                          <span>{lang === 'ar' ? 'جارٍ الإنشاء...' : 'Création...'}</span>
                        </>
                      ) : (
                        <span>{t(lang, 'add')}</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function ResetPasswordModal({ open, onClose, client, lang }) {
  const [pwd, setPwd]         = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await api.clients.resetPassword(client.id, pwd)
      setDone(true)
      setTimeout(() => { setDone(false); setPwd(''); onClose() }, 1500)
    } catch (err) {
      setError(err.message || (lang === 'ar' ? 'حدث خطأ' : 'Erreur'))
    } finally { setLoading(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed inset-x-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[400px] z-50"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          >
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="bg-orange-500 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound size={18} className="text-white" />
                  <h3 className="font-bold text-white">
                    {lang === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Réinitialiser le mot de passe'}
                  </h3>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <X size={16} className="text-white" />
                </button>
              </div>
              <div className="p-6">
                {done ? (
                  <div className="flex flex-col items-center py-4 gap-3 text-emerald-600">
                    <CheckCircle2 size={40} />
                    <p className="font-semibold">{lang === 'ar' ? 'تم إعادة التعيين' : 'Réinitialisé'}</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-500 mb-4">
                      {lang === 'ar' ? `كلمة مرور جديدة للعميل: ${client?.name}` : `Nouveau mot de passe pour: ${client?.name}`}
                    </p>
                    {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">
                          {lang === 'ar' ? 'كلمة المرور الجديدة' : 'Nouveau mot de passe'}
                        </label>
                        <input type="password" className="input-field text-sm" value={pwd}
                          onChange={e => setPwd(e.target.value)} required minLength={6}
                          placeholder="••••••••" />
                      </div>
                      <p className="text-xs text-slate-400">
                        {lang === 'ar' ? 'سيُطلب من العميل تغيير كلمة المرور عند تسجيل الدخول.' : 'Le client devra changer son mot de passe lors de la prochaine connexion.'}
                      </p>
                      <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 btn-secondary py-2.5 text-sm">
                          {t(lang, 'cancel')}
                        </button>
                        <button type="submit" disabled={loading || !pwd}
                          className="flex-1 bg-orange-500 text-white font-bold py-2.5 rounded-xl hover:bg-orange-600 transition-colors text-sm disabled:opacity-50">
                          {loading ? '...' : (lang === 'ar' ? 'تعيين' : 'Appliquer')}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default function Clients() {
  const navigate = useNavigate()
  const { clientList, addClient, deleteClient, lang } = useApp()
  const [search, setSearch]       = useState('')
  const [showAdd, setShowAdd]     = useState(false)
  const [toDelete, setToDelete]   = useState(null)
  const [resetTarget, setReset]   = useState(null)

  const filtered = clientList.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async () => {
    if (!toDelete) return
    try { await deleteClient(toDelete.id) } catch {}
    setToDelete(null)
  }

  const subColors = { Basic: 'bg-slate-100 text-slate-600', Pro: 'bg-blue-50 text-blue-600', Enterprise: 'bg-amber-50 text-amber-700' }

  return (
    <AdminLayout>
      <AddClientModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={addClient} lang={lang} />
      <ResetPasswordModal open={!!resetTarget} onClose={() => setReset(null)} client={resetTarget} lang={lang} />
      <ConfirmModal
        open={!!toDelete}
        title={lang === 'ar' ? 'حذف العميل' : 'Supprimer le client'}
        message={lang === 'ar' ? `هل أنت متأكد من حذف "${toDelete?.name}"؟` : `Supprimer "${toDelete?.name}" ?`}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        lang={lang}
      />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-primary-500">{t(lang, 'clientsList')}</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {clientList.length} {lang === 'ar' ? 'عميل مسجّل' : 'client(s) enregistré(s)'}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} />
            {t(lang, 'addClient')}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-4 text-slate-400" />
          <input
            className="input-field ps-10"
            placeholder={t(lang, 'search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-gray-100">
                <tr>
                  {[t(lang, 'name'), t(lang, 'email'), t(lang, 'phone'), t(lang, 'subscription'), t(lang, 'devices'), t(lang, 'status'), t(lang, 'actions')].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-start text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">{t(lang, 'noData')}</td></tr>
                )}
                {filtered.map((client, i) => (
                  <motion.tr key={client.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => navigate(`/admin/clients/${client.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center font-bold text-primary-500 text-sm">
                          {client.avatar || client.name?.[0] || '?'}
                        </div>
                        <span className="font-semibold text-sm text-primary-500">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{client.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{client.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${subColors[client.subscription] || subColors.Basic}`}>
                        {client.subscription}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-primary-500">{client.devicesCount}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${client.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                        {client.status === 'active' ? t(lang, 'active') : t(lang, 'inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setReset(client)}
                          className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center hover:bg-orange-100 transition-colors"
                          title={lang === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Réinitialiser MDP'}
                        >
                          <KeyRound size={14} className="text-orange-500" />
                        </button>
                        <button
                          onClick={() => setToDelete(client)}
                          className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/clients/${client.id}`)}
                          className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center hover:bg-primary-100 transition-colors"
                        >
                          <ChevronRight size={14} className="text-primary-500" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-50">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">{t(lang, 'noData')}</div>
            )}
            {filtered.map((client, i) => (
              <motion.div key={client.id}
                className="p-4 hover:bg-slate-50 transition-colors"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3" onClick={() => navigate(`/admin/clients/${client.id}`)}>
                    <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center font-bold text-primary-500">
                      {client.avatar || client.name?.[0]}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-primary-500">{client.name}</p>
                      <p className="text-xs text-slate-400">{client.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setReset(client)}
                      className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                      <KeyRound size={14} className="text-orange-500" />
                    </button>
                    <button onClick={() => setToDelete(client)}
                      className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 ps-13">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${subColors[client.subscription] || subColors.Basic}`}>
                    {client.subscription}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {client.devicesCount} {lang === 'ar' ? 'جهاز' : 'appareils'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
