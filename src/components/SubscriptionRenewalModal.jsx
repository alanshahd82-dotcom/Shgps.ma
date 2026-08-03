import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, RefreshCw, X, AlertCircle } from 'lucide-react'
import { api } from '../api/index.js'
import SubscriptionPlans from './SubscriptionPlans'

export default function SubscriptionRenewalModal({ open, device, lang = 'ar', onClose, onSaved }) {
  const isAr = lang === 'ar'
  const [planId, setPlanId] = useState(device?.subscriptionPlanId || '3_months')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  React.useEffect(() => {
    if (open) {
      setPlanId(device?.subscriptionPlanId || '3_months')
      setError('')
    }
  }, [open, device?.id, device?.subscriptionPlanId])

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await api.devices.renewSubscription(device.id, planId)
      onSaved?.(result)
      onClose?.()
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر تجديد الاشتراك' : 'Impossible de renouveler'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 bg-black/50 z-[60] flex items-end md:items-center justify-center md:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="w-full md:max-w-[520px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 bg-primary-500">
              <div className="flex items-center gap-2">
                <RefreshCw size={16} className="text-white" />
                <h3 className="font-bold text-white">{isAr ? 'تجديد اشتراك الجهاز' : 'Renouveler l’abonnement'}</h3>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center">
                <X size={14} className="text-white" />
              </button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-4">
              <div>
                <p className="font-bold text-primary-500 text-sm">{device?.name}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{device?.imei}</p>
              </div>
              {error && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl border border-red-100"><AlertCircle size={14} />{error}</div>}
              <div>
                <label className="text-xs font-bold text-slate-500">{isAr ? 'اختر الخطة — الدفع نقداً' : 'Choisissez le forfait — paiement comptant'}</label>
                <SubscriptionPlans value={planId} onChange={setPlanId} lang={lang} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-slate-500">
                  {isAr ? 'إلغاء' : 'Annuler'}
                </button>
                <button type="submit" disabled={saving || !planId} className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
                  {saving ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />{isAr ? 'جاري الحفظ...' : 'Enregistrement...'}</> : <><CheckCircle2 size={14} />{isAr ? 'تأكيد التجديد' : 'Confirmer'}</>}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}