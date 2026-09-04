import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertCircle } from 'lucide-react'
import { t } from '../../i18n/translations'
import Button from '../ui/Button'
import SubscriptionPlans from '../SubscriptionPlans'
import { VehicleTypeControl } from '../ui'

export default function AddDeviceModal({
  open,
  onClose,
  onAdd,
  lang,
  mode,
  clientList,
  clientsError,
  onRefreshClients,
  clientId,
}) {
  const isGlobal = mode === 'global'

  const initialForm = isGlobal
    ? { name: '', imei: '', type: 'bike', plate: '', clientId: '', subscriptionPlanId: '3_months' }
    : { name: '', imei: '', type: 'bike', plate: '', clientId, subscriptionPlanId: '3_months' }

  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const imeiValid = /^\d{15}$/.test(form.imei)

  const resetForm = () => isGlobal
    ? { name: '', imei: '', type: 'bike', plate: '', clientId: '', subscriptionPlanId: '3_months' }
    : { name: '', imei: '', type: 'bike', plate: '', clientId, subscriptionPlanId: '3_months' }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isGlobal) {
      if (!imeiValid) { setError(lang === 'ar' ? 'إي م ي جب أن يكون 15 رقماً' : 'IMEI doit contenir 15 chiffres'); return }
      setLoading(true); setError('')
      try {
        await onAdd({ ...form, clientId: form.clientId || null })
        setForm(resetForm())
        onClose()
      } catch (err) {
        setError(err.message || (lang === 'ar' ? 'حدث خطأ' : 'Une erreur est survenue'))
      } finally { setLoading(false) }
    } else {
      setLoading(true); setError('')
      try {
        await onAdd(form)
        setForm(resetForm())
        onClose()
      } catch (err) {
        setError(err.message || (lang === 'ar' ? 'تعذر إضافة الجهاز' : "Impossible d'ajouter l'appareil"))
      } finally { setLoading(false) }
    }
  }

  const handleClose = isGlobal ? () => { setError(''); onClose() } : onClose

  const formId = isGlobal ? 'add-device-form' : 'add-dev-form'
  const modalWidth = isGlobal ? 'md:max-w-[500px]' : 'md:max-w-[440px]'
  const modalMaxH = isGlobal ? 'max-h-[92vh] md:max-h-[88vh]' : 'max-h-[92vh]'
  const motionInitial = isGlobal ? { opacity: 0, scale: 0.95, y: 20 } : { opacity: 0, y: 20 }
  const motionAnimate = isGlobal ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 }
  const motionExit = isGlobal ? { opacity: 0, scale: 0.95, y: 10 } : { opacity: 0, y: 20 }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className={"w-full " + modalWidth + " bg-white rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col " + modalMaxH}
            initial={motionInitial} animate={motionAnimate} exit={motionExit}
            onClick={e => e.stopPropagation()}
          >
            {/* Fixed header */}
            <div className="flex-shrink-0 bg-primary-500 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <h3 className="font-bold text-white text-lg">
                {isGlobal
                  ? (lang === 'ar' ? 'إضافة جهاز جديد' : 'Ajouter un appareil')
                  : t(lang, 'addDevice')}
              </h3>
              <button onClick={handleClose} className={"w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center " + (isGlobal ? "hover:bg-white/20 transition-colors" : "")}>
                <X size={16} className="text-white" />
              </button>
            </div>

            {/* Scrollable body */}
            <form id={formId} onSubmit={handleSubmit} className={"flex-1 overflow-y-auto " + (isGlobal ? "min-h-0" : "") + " p-6 space-y-4"}>
              {error && (
                isGlobal ? (
                  <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
                  <AlertCircle size={15} /><span>{error}</span>
                  </div>
                ) : (
                  <div className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>
                )
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {lang === 'ar' ? 'اسم الجهاز' : "Nom de l'appareil"}{isGlobal ? ' *' : ''}
                </label>
                <input className="input-field text-sm" placeholder={isGlobal ? undefined : (lang === 'ar' ? 'مثال: سيارة العمتل' : 'Ex: Voiture client')} value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {isGlobal ? ('IMEI (15 ' + (lang === 'ar' ? 'رقم' : 'chiffres') + ') *') : t(lang, 'imei')}
                </label>
                <input
                  className={"input-field text-sm font-mono " + (isGlobal && form.imei && !imeiValid ? "border-red-300" : "")}
                  maxLength={15}
                  {...(isGlobal ? {} : { minLength: 15, pattern: '\\d{15}' })}
                  placeholder={isGlobal ? undefined : '358900001234567'}
                  value={form.imei}
                  onChange={e => setForm(p => ({ ...p, imei: isGlobal ? e.target.value.replace(/\D/g, '') : e.target.value.replace(/\D/g, '').slice(0, 15) }))}
                  required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {isGlobal ? (lang === 'ar' ? 'النوع' : 'Type') : (lang === 'ar' ? 'نوع المركبة' : 'Type de véhicule')}
                  </label>
                  <VehicleTypeControl value={form.type} onChange={type => setForm(p => ({ ...p, type }))} lang={lang} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t(lang, 'plate')}</label>
                  <input className="input-field text-sm uppercase font-mono" placeholder={isGlobal ? undefined : 'A 12345 XX'} value={form.plate}
                    onChange={e => setForm(p => ({ ...p, plate: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              {isGlobal && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {lang === 'ar' ? 'تعيين للعمتل' : 'Assigner au client'}
                  </label>
                  <select className="input-field text-sm" value={form.clientId}
                    onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}>
                   <option value="">
                     {clientList.length
                       ? (lang === 'ar' ? '— بدون عمتل —' : '— Sans client —')
                       : clientsError
                         ? (lang === 'ar' ? 'تعذر تحميل العملاء' : 'Impossible de charger les clients')
                         : (lang === 'ar' ? 'جارتي تحميل العملاء...' : 'Chargement des clients...')}
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
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {isGlobal
                    ? (lang === 'ar' ? 'خطة اشتراك الجهاز — دفع نقدي' : 'Forfait de l’appareil — paiement comptant')
                    : (lang === 'ar' ? 'خطة اشتراك الجهاز' : 'Forfait appareil')}
                </label>
                <SubscriptionPlans
                  value={form.subscriptionPlanId}
                  onChange={isGlobal
                    ? (subscriptionPlanId => setForm(p => ({ ...p, subscriptionPlanId })))
                    : (v => setForm(p => ({ ...p, subscriptionPlanId: v })))}
                  lang={lang} compact includeTrial />
              </div>
            </form>

            {/* Fixed footer */}
            <div className={"flex-shrink-0 px-6 pb-6 pt-3 flex gap-3 border-t border-gray-100 " + (isGlobal ? "bg-white rounded-b-3xl" : "")}>
              <button type="button" onClick={handleClose} className="flex-1 btn-secondary py-3">{t(lang, 'cancel')}</button>
              <Button type="submit" form={formId}
                disabled={isGlobal ? (loading || !form.name || !imeiValid) : loading}
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