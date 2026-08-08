import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Plus, Cpu, Battery, Signal, Wifi, WifiOff, X, CalendarDays, RefreshCw, PauseCircle, PlayCircle, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'
import MapView from '../../components/MapView'
import SubscriptionPlans from '../../components/SubscriptionPlans'
import SubscriptionBadge from '../../components/SubscriptionBadge'
import SubscriptionRenewalModal from '../../components/SubscriptionRenewalModal'
import Button from '../../components/ui/Button'

function AddDeviceModal({ open, onClose, onAdd, clientId, client, lang }) {
  const [form, setForm] = useState({ name: '', imei: '', type: 'car', plate: '', clientId, subscriptionPlanId: '3_months' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await onAdd(form)
       setForm({ name: '', imei: '', type: 'car', plate: '', clientId, subscriptionPlanId: '3_months' })
      onClose()
    } catch (err) {
      setError(err.message || (lang === 'ar' ? 'تعذر إضافة الجهاز' : 'Impossible d’ajouter l’appareil'))
    } finally { setLoading(false) }
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
              {error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
                  <span>{error}</span>
                </div>
              )}
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
                  onChange={e => setForm(p => ({ ...p, imei: e.target.value.replace(/\D/g, '').slice(0, 15) }))}
                  maxLength={15}
                  minLength={15}
                  pattern="\d{15}"
                  title={lang === 'ar' ? 'IMEI يجب أن يكون 15 رقماً' : 'IMEI doit contenir exactement 15 chiffres'}
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
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{lang === 'ar' ? 'خطة اشتراك الجهاز — دفع نقدي' : 'Forfait appareil — paiement comptant'}</label>
                <SubscriptionPlans value={form.subscriptionPlanId} onChange={subscriptionPlanId => setForm(p => ({ ...p, subscriptionPlanId }))} lang={lang} compact includeTrial />
              </div>
            </form>

            {/* Fixed footer – always visible */}
            <div className="flex-shrink-0 px-6 pb-6 pt-3 flex gap-3 border-t border-gray-100 bg-white rounded-b-3xl">
              <button type="button" onClick={onClose} className="flex-1 btn-secondary py-3">{t(lang, 'cancel')}</button>
              <Button type="submit" form="add-device-detail-form" disabled={loading} variant="primary" className="flex-1 py-3">{loading ? '...' : t(lang, 'add')}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ─── Subscription Section ────────────────────────────────────────────────── */
function SubscriptionSection({ client, lang, onUpdate }) {
  const isAr = lang === 'ar'
  const [showRenew, setShowRenew] = useState(false)
  const [renewForm, setRenewForm] = useState({ expiryDate: '', plan: client?.subscription || 'Basic', maxDevices: client?.maxDevices || 5 })
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [suspending, setSuspending] = useState(false)
  const [error, setError] = useState('')

  const expiry = client?.expiryDate ? new Date(client.expiryDate) : null
  const daysLeft = expiry ? Math.ceil((expiry - new Date()) / 86400000) : null
  const isExpired = daysLeft !== null && daysLeft <= 0
  const isSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30
  const isActive = client?.isActive !== false

  const barPct = daysLeft === null ? 100
    : isExpired ? 0
    : Math.min(100, Math.round((daysLeft / 365) * 100))

  const barColor = isExpired ? '#ef4444' : isSoon ? '#f97316' : '#00D97E'
  const statusBadge = isExpired
    ? <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-red-100 text-red-600">🔴 {isAr ? 'منتهي' : 'Expiré'}</span>
    : isSoon
      ? <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-orange-100 text-orange-600 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{daysLeft} {isAr ? 'يوم' : 'j'}</span>
      : !isActive
        ? <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500">⏸ {isAr ? 'موقوف' : 'Suspendu'}</span>
        : <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-600">✓ {isAr ? 'نشط' : 'Actif'}</span>

  const handleRenew = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.clients.updateSubscription(client.id, {
        expiryDate: renewForm.expiryDate,
        plan: renewForm.plan,
        maxDevices: Number(renewForm.maxDevices),
        isActive: true,
      })
      setSavedOk(true); setShowRenew(false)
      onUpdate && onUpdate()
      setTimeout(() => setSavedOk(false), 2000)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const toggleActive = async () => {
    setSuspending(true)
    try {
      await api.clients.updateSubscription(client.id, { isActive: isActive ? false : true })
      onUpdate && onUpdate()
    } catch {}
    finally { setSuspending(false) }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-primary-500" />
          <h3 className="font-bold text-primary-500 text-sm">{isAr ? 'الاشتراك' : 'Abonnement'}</h3>
          {statusBadge}
          {savedOk && <CheckCircle2 size={14} className="text-emerald-500" />}
        </div>
        <div className="flex gap-2">
          {isActive
            ? <button onClick={toggleActive} disabled={suspending}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 disabled:opacity-50">
                <PauseCircle size={13} />{isAr ? 'تعليق' : 'Suspendre'}
              </button>
            : <button onClick={toggleActive} disabled={suspending}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50">
                <PlayCircle size={13} />{isAr ? 'تفعيل' : 'Activer'}
              </button>
          }
          <button onClick={() => setShowRenew(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-primary-50 text-primary-500 hover:bg-primary-100">
            <RefreshCw size={13} />{isAr ? 'تجديد' : 'Renouveler'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: isAr ? 'الباقة' : 'Forfait', val: client?.subscription || 'Basic' },
          { label: isAr ? 'الأجهزة' : 'Appareils', val: `${client?.devicesCount ?? 0}/${Math.max(1, Number(client?.maxDevices) || 5)}` },
          { label: isAr ? 'الانتهاء' : 'Expiration', val: expiry ? expiry.toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR') : '—' },
        ].map((s, i) => (
          <div key={i} className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-sm font-black text-primary-500">{s.val}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {daysLeft !== null && (
        <div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ backgroundColor: barColor }}
              initial={{ width: 0 }} animate={{ width: `${barPct}%` }} transition={{ duration: 0.6 }} />
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            {isExpired
              ? (isAr ? 'الاشتراك منتهي' : 'Abonnement expiré')
              : `${daysLeft} ${isAr ? 'يوم متبقي' : 'jours restants'}`}
          </p>
        </div>
      )}

      {/* Renew Modal */}
      <AnimatePresence>
        {showRenew && (
          <motion.div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center md:p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowRenew(false)}>
            <motion.div className="w-full md:max-w-[420px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 bg-primary-500">
                <div className="flex items-center gap-2">
                  <RefreshCw size={16} className="text-white" />
                  <h3 className="font-bold text-white">{isAr ? 'تجديد الاشتراك' : 'Renouveler l\'abonnement'}</h3>
                </div>
                <button onClick={() => setShowRenew(false)} className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center">
                  <X size={14} className="text-white" />
                </button>
              </div>
              <form onSubmit={handleRenew} className="p-5 space-y-4">
                {error && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl border border-red-100"><AlertCircle size={14}/>{error}</div>}
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">{isAr ? 'تاريخ الانتهاء الجديد' : 'Nouvelle date d\'expiration'}</label>
                  <input type="date" required min={new Date().toISOString().split('T')[0]}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    value={renewForm.expiryDate} onChange={e => setRenewForm(p => ({ ...p, expiryDate: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1.5">{isAr ? 'الباقة' : 'Forfait'}</label>
                    <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                      value={renewForm.plan} onChange={e => setRenewForm(p => ({ ...p, plan: e.target.value }))}>
                      <option value="Basic">Basic</option>
                      <option value="Pro">Pro</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1.5">{isAr ? 'عدد الأجهزة' : 'Max appareils'}</label>
                    <input type="number" min="1" max="50" required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                      value={renewForm.maxDevices} onChange={e => setRenewForm(p => ({ ...p, maxDevices: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowRenew(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-slate-500">
                    {isAr ? 'إلغاء' : 'Annuler'}
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
                    {saving ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />{isAr ? 'حفظ...' : 'Enreg...'}</> : <><CheckCircle2 size={14}/>{isAr ? 'حفظ' : 'Enregistrer'}</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { clientList, devices, addDevice, lang, refreshDevices, refreshClients } = useApp()
  const client = clientList.find(c => String(c.id) === String(id))
  const clientDevices = devices.filter(d => String(d.clientId) === String(id) || String(d.user_id) === String(id))
  const [showAdd, setShowAdd] = useState(false)
  const [renewDevice, setRenewDevice] = useState(null)

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

        {/* Subscription Section */}
        <SubscriptionSection client={client} lang={lang} onUpdate={refreshClients} />

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
             <Button
               onClick={() => setShowAdd(true)}
               disabled={clientDevices.length >= Math.max(1, Number(client.maxDevices) || 5)}
               variant="primary" size="sm"
             >
              <Plus size={14} />
              {t(lang, 'addDevice')}
            </Button>
          </div>
           {clientDevices.length >= Math.max(1, Number(client.maxDevices) || 5) && (
             <div className="mx-5 mt-4 flex items-start gap-2 bg-orange-50 border border-orange-100 text-orange-700 rounded-xl px-4 py-3 text-sm">
               <span>{lang === 'ar'
                 ? `تم الوصول إلى حد الأجهزة (${clientDevices.length}/${Math.max(1, Number(client.maxDevices) || 5)}). عدّل الاشتراك لزيادة الحد.`
                 : `La limite d’appareils est atteinte (${clientDevices.length}/${Math.max(1, Number(client.maxDevices) || 5)}). Modifiez l’abonnement pour augmenter la limite.`}</span>
             </div>
           )}

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
                    <SubscriptionBadge device={device} lang={lang} />
                    <button
                      onClick={() => setRenewDevice(device)}
                      className="text-xs font-bold px-2.5 py-1 rounded-xl bg-primary-50 text-primary-500 hover:bg-primary-100"
                    >
                      {lang === 'ar' ? 'تجديد' : 'Renouveler'}
                    </button>
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
        client={client}
        lang={lang}
      />
      <SubscriptionRenewalModal
        open={!!renewDevice}
        device={renewDevice}
        lang={lang}
        onClose={() => setRenewDevice(null)}
        onSaved={async result => {
          setRenewDevice(current => current ? { ...current, ...result } : current)
          await refreshDevices?.()
        }}
      />
    </AdminLayout>
  )
}
