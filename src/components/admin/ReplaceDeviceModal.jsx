import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Repeat, X } from 'lucide-react'
import { api } from '../../api/index.js'

// Replaces the physical tracker of an existing vehicle: the vehicle keeps its
// name, plate, client, subscription and history; only the tracker (IMEI) changes.
export default function ReplaceDeviceModal({ open, device, lang = 'ar', onClose, onDone }) {
  const isAr = lang !== 'fr'
  const [imei, setImei] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (open) { setImei(''); setPhone(''); setError(''); setDone(false); setSaving(false) }
  }, [open, device?.id])

  const valid = /^\d{15}$/.test(imei) && imei !== device?.imei

  const explain = err => {
    const message = String(err?.message || '')
    if (/already/i.test(message)) return isAr ? 'رقم IMEI هذا مسجّل مسبقاً لجهاز آخر.' : 'Cet IMEI est déjà enregistré pour un autre appareil.'
    if (/15 digits/i.test(message)) return isAr ? 'يجب أن يتكوّن IMEI من 15 رقماً.' : "L'IMEI doit comporter 15 chiffres."
    if (/same as the current/i.test(message)) return isAr ? 'هذا هو نفس رقم الجهاز الحالي.' : "C'est le même IMEI que l'appareil actuel."
    if (/tracking service/i.test(message)) return isAr ? 'تعذّر تحديث خدمة التتبع. لم يتغيّر شيء، حاول لاحقاً.' : "Le service de suivi n'a pas pu être mis à jour. Rien n'a changé, réessayez plus tard."
    return isAr ? 'تعذّر استبدال الجهاز. لم يتغيّر شيء.' : "Impossible de remplacer l'appareil. Rien n'a changé."
  }

  const submit = async event => {
    event.preventDefault()
    if (!valid || saving) return
    setSaving(true); setError('')
    try {
      await api.devices.replace(device.id, { imei, phone: phone.trim() || null })
      setDone(true)
      await onDone?.()
    } catch (err) {
      setError(explain(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 md:items-center md:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div dir={isAr ? 'rtl' : 'ltr'} className="w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl md:max-w-[460px] md:rounded-3xl"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between bg-primary-500 px-5 py-4">
              <div className="flex items-center gap-2">
                <Repeat size={16} className="text-white" />
                <h3 className="font-bold text-white">{isAr ? 'استبدال جهاز التتبع' : "Remplacer l'appareil de suivi"}</h3>
              </div>
              <button type="button" onClick={onClose} aria-label={isAr ? 'إغلاق' : 'Fermer'} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">
                <X size={15} className="text-white" />
              </button>
            </div>

            {done ? (
              <div className="p-7 text-center">
                <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
                <p className="mt-3 text-base font-bold text-primary-500">{isAr ? 'تم استبدال الجهاز' : 'Appareil remplacé'}</p>
                <p className="mt-1 text-xs text-slate-500">{isAr ? 'المركبة تحتفظ باسمها واشتراكها وسجلها. سيظهر الجهاز الجديد متصلاً عند أول إشارة منه.' : "Le véhicule garde son nom, son abonnement et son historique. Le nouvel appareil apparaîtra en ligne dès son premier signal."}</p>
                <button type="button" onClick={onClose} className="mt-5 w-full rounded-xl bg-primary-500 py-3 text-sm font-bold text-white">{isAr ? 'إغلاق' : 'Fermer'}</button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4 p-5">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-sm font-bold text-primary-500">{device?.name}</p>
                  <p dir="ltr" className="mt-0.5 text-xs text-slate-400">{isAr ? 'الجهاز الحالي: ' : 'Appareil actuel : '}<span className="font-mono">{device?.imei}</span></p>
                </div>
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-5 text-amber-800">
                  {isAr ? 'سيتوقف الجهاز القديم عن العمل مع هذه المركبة. تبقى المركبة باسمها ولوحتها وعميلها واشتراكها وسجل رحلاتها.' : "L'ancien appareil ne sera plus lié à ce véhicule. Le véhicule garde son nom, sa plaque, son client, son abonnement et son historique de trajets."}
                </p>
                {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600"><AlertCircle size={14} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-500">{isAr ? 'IMEI الجهاز الجديد (15 رقماً)' : 'IMEI du nouvel appareil (15 chiffres)'}</span>
                  <input dir="ltr" inputMode="numeric" maxLength={15} value={imei} onChange={event => setImei(event.target.value.replace(/\D/g, ''))}
                    placeholder="865190075236599" className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  <span className="mt-1 block text-[11px] text-slate-400">{imei.length}/15</span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-500">{isAr ? 'رقم شريحة الجهاز الجديد (اختياري)' : 'Numéro SIM du nouvel appareil (facultatif)'}</span>
                  <input dir="ltr" inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-slate-500">{isAr ? 'إلغاء' : 'Annuler'}</button>
                  <button type="submit" disabled={!valid || saving} className="flex-1 rounded-xl bg-primary-500 py-3 text-sm font-bold text-white disabled:opacity-40">
                    <span>{saving ? (isAr ? 'جاري الاستبدال...' : 'Remplacement...') : (isAr ? 'استبدال الجهاز' : "Remplacer l'appareil")}</span>
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
