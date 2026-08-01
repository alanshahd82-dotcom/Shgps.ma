import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Plus, Cpu, Battery, Signal, Wifi, WifiOff, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'
import MapView from '../../components/MapView'

function AddDeviceModal({ open, onClose, onAdd, clientId, lang }) {
  const [form, setForm] = useState({ name: '', imei: '', type: 'car', plate: '', clientId })

  const handleSubmit = (e) => {
    e.preventDefault()
    onAdd(form)
    setForm({ name: '', imei: '', type: 'car', plate: '', clientId })
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full md:max-w-[440px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] md:max-h-[88vh]"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Fixed header */}
            <div className="flex-shrink-0 bg-primary-500 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <h3 className="font-bold text-white text-lg">{t(lang, 'addDevice')}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <X size={16} className="text-white" />
              </button>
            </div>

            {/* Scrollable body */}
            <form id="add-device-detail-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {lang === 'ar' ? 'اسم الجهاز' : 'Nom de l\'appareil'}
                </label>
                <input
                  className="input-field text-sm"
                  placeholder={lang === 'ar' ? 'مثال: سيارة العميل' : 'Ex: Voiture client'}
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t(lang, 'imei')}</label>
                <input
                  className="input-field text-sm font-mono"
                  placeholder="358900001234567"
                  value={form.imei}
                  onChange={e => setForm(p => ({ ...p, imei: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {lang === 'ar' ? 'نوع المركبة' : 'Type de véhicule'}
                  </label>
                  <select
                    className="input-field text-sm"
                    value={form.type}
                    onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  >
                    <option value="car">{lang === 'ar' ? '🚗 سيارة' : '🚗 Voiture'}</option>
                    <option value="bike">{lang === 'ar' ? '🏍️ دراجة' : '🏍️ Moto'}</option>
                    <option value="truck">{lang === 'ar' ? '🚚 شاحنة' : '🚚 Camion'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t(lang, 'plate')}</label>
                  <input
                    className="input-field text-sm uppercase font-mono"
                    placeholder="A 12345 XX"
                    value={form.plate}
                    onChange={e => setForm(p => ({ ...p, plate: e.target.value.toUpperCase() }))}
                  />
                </div>
              </div>
            </form>

            {/* Fixed footer – always visible */}
            <div className="flex-shrink-0 px-6 pb-6 pt-3 flex gap-3 border-t border-gray-100 bg-white rounded-b-3xl">
              <button type="button" onClick={onClose} className="flex-1 btn-secondary py-3">{t(lang, 'cancel')}</button>
              <button type="submit" form="add-device-detail-form" className="flex-1 btn-primary py-3">{t(lang, 'add')}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { clientList, devices, addDevice, lang } = useApp()
  const client = clientList.find(c => String(c.id) === String(id))
  const clientDevices = devices.filter(d => String(d.clientId) === String(id) || String(d.user_id) === String(id))
  const [showAdd, setShowAdd] = useState(false)

  if (!client) {
    return (
      <AdminLayout>
        <div className="p-6 text-center text-slate-400">
          <p>{lang === 'ar' ? 'العميل غير موجود' : 'Client introuvable'}</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Back button + header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/admin/clients')}
            className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:bg-gray-50"
          >
            <ChevronLeft size={18} className="text-primary-500" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-primary-500">{client.name}</h1>
            <p className="text-slate-400 text-sm">{client.email} · {client.city}</p>
          </div>
          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
            client.subscription === 'Enterprise' ? 'bg-purple-100 text-purple-600' :
            client.subscription === 'Pro' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
          }`}>
            {client.subscription}
          </span>
        </div>

        {/* Client info card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-primary-200">
              {client.avatar}
            </div>
            <div>
              <p className="font-bold text-primary-500 text-lg">{client.name}</p>
              <p className="text-slate-400 text-sm">{client.email}</p>
              <p className="text-slate-400 text-sm">{client.phone}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: lang === 'ar' ? 'الأجهزة' : 'Appareils', val: clientDevices.length },
              { label: lang === 'ar' ? 'متصل' : 'Connectés', val: clientDevices.filter(d => d.status === 'online').length },
              { label: lang === 'ar' ? 'تاريخ الانضمام' : 'Adhésion', val: client.joinDate },
            ].map((s, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-primary-500">{s.val}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Map */}
        {clientDevices.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-primary-500">{lang === 'ar' ? 'خريطة الأجهزة' : 'Carte des appareils'}</h3>
            </div>
            <div style={{ height: 240 }}>
              <MapView clientId={id} height="100%" zoom={10} />
            </div>
          </div>
        )}

        {/* Devices */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-primary-500">
              {lang === 'ar' ? 'الأجهزة المرتبطة' : 'Appareils associés'} ({clientDevices.length})
            </h3>
            <button onClick={() => setShowAdd(true)} className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5">
              <Plus size={14} />
              {t(lang, 'addDevice')}
            </button>
          </div>

          {clientDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Cpu size={32} className="mb-2 opacity-30" />
              <p className="text-sm">{lang === 'ar' ? 'لا توجد أجهزة' : 'Aucun appareil'}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {clientDevices.map((device, i) => (
                <motion.div
                  key={device.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${device.status === 'online' ? 'bg-primary-50' : 'bg-gray-100'}`}>
                    {device.type === 'car' ? '🚗' : device.type === 'bike' ? '🏍️' : '🚚'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary-500 text-sm">{device.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{device.imei}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs">
                      <Battery size={12} className={device.battery < 30 ? 'text-red-500' : 'text-slate-400'} />
                      <span className={device.battery < 30 ? 'text-red-500 font-semibold' : 'text-slate-400'}>{device.battery}%</span>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                      device.status === 'online' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {device.status === 'online' ? <span className="flex items-center gap-1"><Wifi size={10}/>{t(lang, 'online')}</span> : <span className="flex items-center gap-1"><WifiOff size={10}/>{t(lang, 'offline')}</span>}
                    </span>
                    {device.status === 'online' && (
                      <span className="text-xs font-bold text-primary-500">{device.speed} km/h</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddDeviceModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={addDevice}
        clientId={id}
        lang={lang}
      />
    </AdminLayout>
  )
}
