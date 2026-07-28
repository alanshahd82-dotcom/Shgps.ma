import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Trash2, ChevronRight, User, Phone, MapPin, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'
import ConfirmModal from '../../components/ConfirmModal'

function AddClientModal({ open, onClose, onAdd, lang }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: '', subscription: 'Basic' })

  const handleSubmit = (e) => {
    e.preventDefault()
    onAdd({ ...form, avatar: form.name[0] || '?' })
    setForm({ name: '', email: '', phone: '', city: '', subscription: 'Basic' })
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] z-50"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
          >
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="bg-primary-500 px-6 py-4 flex items-center justify-between">
                <h3 className="font-bold text-white text-lg">{t(lang, 'addClient')}</h3>
                <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <X size={16} className="text-white" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t(lang, 'name')}</label>
                    <input
                      className="input-field text-sm"
                      placeholder={lang === 'ar' ? 'الاسم الكامل' : 'Nom complet'}
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t(lang, 'city')}</label>
                    <input
                      className="input-field text-sm"
                      placeholder={lang === 'ar' ? 'المدينة' : 'Ville'}
                      value={form.city}
                      onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t(lang, 'email')}</label>
                  <input
                    type="email"
                    className="input-field text-sm"
                    placeholder="email@example.com"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t(lang, 'phone')}</label>
                  <input
                    className="input-field text-sm"
                    placeholder="+212 6 XX XX XX XX"
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t(lang, 'subscription')}</label>
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
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={onClose} className="flex-1 btn-secondary py-3">{t(lang, 'cancel')}</button>
                  <button type="submit" className="flex-1 btn-primary py-3">{t(lang, 'add')}</button>
                </div>
              </form>
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
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const filtered = clientList.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.city?.includes(search)
  )

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-primary-500">{t(lang, 'clientsList')}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{clientList.length} {lang === 'ar' ? 'عميل مسجل' : 'clients enregistrés'}</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 py-2.5">
            <Plus size={16} />
            {t(lang, 'addClient')}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 left-4 text-slate-400" />
          <input
            className="input-field pl-11 bg-white shadow-sm"
            placeholder={t(lang, 'search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Clients grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((client, i) => (
            <motion.div
              key={client.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/admin/clients/${client.id}`)}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-200">
                      {client.avatar}
                    </div>
                    <div>
                      <p className="font-bold text-primary-500">{client.name}</p>
                      <p className="text-xs text-slate-400">{client.email}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                    client.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {client.status === 'active' ? t(lang, 'active') : t(lang, 'inactive')}
                  </span>
                </div>

                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Phone size={11} />
                    <span>{client.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <MapPin size={11} />
                    <span>{client.city}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary-50 rounded-xl px-3 py-1.5">
                      <p className="text-[10px] text-primary-400">{lang === 'ar' ? 'الأجهزة' : 'Appareils'}</p>
                      <p className="text-sm font-bold text-primary-500">{client.devicesCount}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-lg font-semibold ${
                      client.subscription === 'Enterprise' ? 'bg-purple-100 text-purple-600' :
                      client.subscription === 'Pro' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {client.subscription}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(client.id) }}
                      className="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-accent transition-colors" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AddClientModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={addClient} lang={lang} />

      <ConfirmModal
        open={!!deleteTarget}
        title={lang === 'ar' ? 'حذف العميل' : 'Supprimer le client'}
        message={lang === 'ar' ? 'هل أنت متأكد من حذف هذا العميل؟ سيتم حذف جميع بياناته.' : 'Voulez-vous vraiment supprimer ce client ? Toutes ses données seront effacées.'}
        confirmLabel={t(lang, 'delete')}
        cancelLabel={t(lang, 'cancel')}
        onConfirm={() => { deleteClient(deleteTarget); setDeleteTarget(null) }}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </AdminLayout>
  )
}
