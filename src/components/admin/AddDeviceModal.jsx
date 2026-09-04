import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, AlertCircle, Smartphone, Phone, CheckCircle2, Hash, CalendarDays,
  User2, SlidersHorizontal, AlertTriangle, Plus
} from 'lucide-react'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
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
  onSuccess,
}) {
  const isGlobal = mode === 'global'
  const isQuickAdd = mode === 'quick-add'
  const isAr = lang === 'ar'

  // ── Global / client-scoped state (UNCHANGED) ──
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

  // ── Quick-add state (NEW — self-contained) ──
  const [qaImei, setQaImei] = useState('')
  const [qaPhone, setQaPhone] = useState('')
  const [qaExpanded, setQaExpanded] = useState(false)
  const [qaClientId, setQaClientId] = useState('')
  const [qaMaxDev, setQaMaxDev] = useState('1')
  const [qaExpires, setQaExpires] = useState('')
  const [qaSubscriptionPlanId, setQaSubscriptionPlanId] = useState('3_months')
  const [qaSearch, setQaSearch] = useState('')
  const [qaDone, setQaDone] = useState(null)

  const qaFiltered = (clientList || []).filter(c =>
    c.name?.toLowerCase().includes(qaSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(qaSearch.toLowerCase())
  ).slice(0, 6)

  const qaSelectedClient = (clientList || []).find(c => String(c.id) === String(qaClientId))

  const qaReset = () => {
    setQaImei(''); setQaPhone(''); setQaClientId(''); setQaMaxDev('1')
    setQaExpires(''); setQaSubscriptionPlanId('3_months'); setQaSearch(''); setError(''); setQaDone(null); setQaExpanded(false)
  }

  const qaHandleClose = () => { qaReset(); onClose() }

  const qaHandleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const result = await api.devices.quickAdd({
        imei:      qaImei.trim(),
        phone:     qaPhone.trim() || null,
        clientId:  qaClientId ? Number(qaClientId) : null,
        maxDevices: qaClientId ? Number(qaMaxDev) : null,
        expiresAt:  qaClientId ? (qaExpires || null) : null,
        subscriptionPlanId: qaSubscriptionPlanId,
      })
      setQaDone(result)
      if (onSuccess) onSuccess(result)
    } catch (err) {
      setError(err.message || (isAr ? 'حدث خطأ' : 'Erreur'))
    } finally { setLoading(false) }
  }

  // ── Submit (global / client-scoped — UNCHANGED) ──
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isGlobal) {
      if (!imeiValid) { setError(isAr ? 'إ م ت ج ب أن تكون 15 رقماً' : 'IMEI doit contenir 15 chiffres'); return }
      setLoading(true); setError('')
      try {
        await onAdd({ ...form, clientId: form.clientId || null })
        setForm(resetForm())
        onClose()
      } catch (err) {
        setError(err.message || (isAr ? 'حدث خطأ' : 'Une erreur est survenue'))
      } finally { setLoading(false) }
    } else {
      setLoading(true); setError('')
      try {
        await onAdd(form)
        setForm(resetForm())
        onClose()
      } catch (err) {
        setError(err.message || (isAr ? 'تعذر إضافة الجهاز' : "Impossible d'ajouter l'appareil"))
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

  // ════════════════════════════════════════════════════════════════════════════
  // QUICK-ADD MODE — self-contained render
  // ════════════════════════════════════════════════════════════════════════════
  if (isQuickAdd) {
    return (
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={qaHandleClose}
          >
            <motion.div
              className="w-full md:max-w-[440px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 bg-primary-500">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                    <Smartphone size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">
                      {isAr ? 'إضافة جهاز' : 'Ajouter un appareil'}
                    </h3>
                    <p className="text-white/60 text-[11px]">
                      {isAr ? 'حقلان فقط — سريع وبسيط' : 'Deux champs seulement'}
                    </p>
                  </div>
                </div>
                <button onClick={qaHandleClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20">
                  <X size={16} className="text-white" />
                </button>
              </div>

              {/* ── Success ── */}
              {qaDone ? (
                <div className="p-7 text-center">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 size={28} className="text-green-500" />
                  </div>
                  <h4 className="font-bold text-primary-500 text-base mb-0.5">
                    {isAr ? 'تم تسجيل الجهاز ✓' : 'Appareil enregistré ✓'}
                  </h4>
                  <p className="text-slate-500 text-sm mb-0.5">{qaDone.name}</p>
                  <p className="text-slate-400 text-xs font-mono mb-1">{qaDone.imei}</p>
                  {qaDone.phone && (
                    <p className="text-slate-400 text-xs mb-4 flex items-center gap-1.5 justify-center"><Phone size={12} />{qaDone.phone}</p>
                  )}
                  {!qaDone.clientId && (
                    <p className="text-xs text-amber-500 bg-amber-50 rounded-xl px-3 py-2 mb-4">
                      <><AlertTriangle size={13} className="inline me-1 shrink-0" />{isAr ? 'الجهاز غير مربوط بعمتل — يمكن ربطه لاحقاً من قائمة الأجهزة' : 'Appareil non assigné — à lier depuis la liste'}</>
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button onClick={qaHandleClose}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-slate-500 hover:bg-gray-50">
                      {isAr ? 'إغلاق' : 'Fermer'}
                    </button>
                    <button onClick={qaReset}
                      className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-bold hover:bg-primary-600">
                      {isAr ? '+ جهاز آخر' : '+ Autre'}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={qaHandleSubmit} className="p-5 space-y-3.5">

                  {error && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* ① IMEI — required */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1.5">
                      <Smartphone size={11} />
                      {isAr ? 'معرّف الجهاز — IMEI' : 'Identifiant — IMEI'}
                      <span className="text-red-400 text-[10px] font-normal ml-1">{isAr ? '(إلزامي)' : '(requis)'}</span>
                    </label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-300"
                      placeholder="865190075236599"
                      inputMode="numeric"
                      value={qaImei}
                      maxLength={15}
                      onChange={e => setQaImei(e.target.value.replace(/\D/g, ''))}
                      required
                    />
                    <div className="flex justify-between mt-1 px-0.5">
                      {qaImei.length > 0 && qaImei.length < 15
                        ? <p className="text-[11px] text-amber-500">{qaImei.length}/15</p>
                        : qaImei.length === 15
                          ? <p className="text-[11px] text-green-500">✓ {isAr ? 'صحيح' : 'Valide'}</p>
                          : <span />
                      }
                    </div>
                  </div>

                  {/* ② Phone — required */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1.5">
                      <Phone size={14} className="shrink-0" />
                      {isAr ? 'رقم الهاتف (شريحة الجهاز)' : 'Numéro de téléphone (SIM)'}
                      <span className="text-red-400 text-[10px] font-normal ml-1">{isAr ? '(إلزامي)' : '(requis)'}</span>
                    </label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300"
                      placeholder={isAr ? '0698324394' : '+2126XXXXXXXX'}
                      inputMode="tel"
                      value={qaPhone}
                      onChange={e => setQaPhone(e.target.value)}
                      required
                    />
                  </div>

                  {/* ── Optional section toggle ── */}
                  <button
                    type="button"
                    onClick={() => setQaExpanded(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs font-semibold text-slate-400 hover:bg-slate-100 transition-colors"
                  >
                    <span className="flex items-center gap-1.5"><SlidersHorizontal size={13} /><span>{isAr ? 'إعدادات إضافية (اختياري)' : 'Options supplémentaires (facultatif)'}</span></span>
                    <motion.span animate={{ rotate: qaExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>▾</motion.span>
                  </button>

                  {/* ── Optional fields ── */}
                  <AnimatePresence>
                    {qaExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden space-y-3"
                      >
                        {/* Client */}
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1.5">
                            <User2 size={11} />
                            {isAr ? 'ربط بعمتل' : 'Assigner à un client'}
                          </label>
                          {qaSelectedClient ? (
                            <div className="flex items-center justify-between border border-primary-300 bg-primary-50 rounded-xl px-3 py-2">
                              <div>
                                <p className="text-sm font-bold text-primary-500">{qaSelectedClient.name}</p>
                                <p className="text-xs text-slate-400">{qaSelectedClient.email}</p>
                              </div>
                              <button type="button" onClick={() => { setQaClientId(''); setQaSearch('') }}
                                className="text-slate-400 hover:text-red-400"><X size={14} /></button>
                            </div>
                          ) : (
                            <div className="relative">
                              <input
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                placeholder={isAr ? 'اسم العميل...' : 'Nom du client...'}
                                value={qaSearch}
                                onChange={e => setQaSearch(e.target.value)}
                                autoComplete="off"
                              />
                              {qaSearch && qaFiltered.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                                  {qaFiltered.map(c => (
                                    <button key={c.id} type="button"
                                      onClick={() => { setQaClientId(String(c.id)); setQaSearch('') }}
                                      className="w-full text-left px-3 py-2 hover:bg-primary-50 border-b border-gray-50 last:border-0">
                                      <p className="text-sm font-semibold text-primary-500">{c.name}</p>
                                      <p className="text-[11px] text-slate-400">{c.email}</p>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {qaSearch && !qaFiltered.length && (
                                <p className="mt-1 text-[11px] text-slate-400">
                                  {isAr ? 'لا توجد عامل مطابق' : 'Aucun client correspondant'}
                                </p>
                              )}
                            </div>
                          )}
                          {!clientList?.length && (
                            <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                              <span className={clientsError ? 'text-red-500' : 'text-slate-400'}>
                                {clientsError
                                  ? (isAr ? 'تعذر تحميل قائمة العملاء' : 'Impossible de charger les clients')
                                  : (isAr ? 'جاري تحميل العملاء...' : 'Chargement des clients...')}
                              </span>
                              {clientsError && (
                                <button type="button" onClick={onRefreshClients} className="font-semibold text-primary-500 underline">
                                  {isAr ? 'إعادة المحاولة' : 'Réessayer'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Max devices + Expiry — only if client selected */}
                        {qaClientId && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="flex items-center gap-1 text-xs font-bold text-slate-500 mb-1.5">
                                <Hash size={10} />{isAr ? 'عدد الأجهزة' : 'Max appareils'}
                              </label>
                              <input type="number" min="1" max="50"
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                value={qaMaxDev} onChange={e => setQaMaxDev(e.target.value)} />
                            </div>
                            <div>
                              <label className="flex items-center gap-1 text-xs font-bold text-slate-500 mb-1.5">
                                <CalendarDays size={10} />{isAr ? 'تاريخ الانتهاء' : 'Expiration'}
                              </label>
                              <input type="date"
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                value={qaExpires} min={new Date().toISOString().split('T')[0]}
                                onChange={e => setQaExpires(e.target.value)} />
                            </div>
                          </div>
                        )}
                        <div>
                          <label className="flex items-center gap-1 text-xs font-bold text-slate-500 mb-1.5">
                            <CalendarDays size={10} />{isAr ? 'خطة اشتراك الجهاز — دفع نقدي' : 'Forfait appareil — paiement comptant'}
                          </label>
                          <SubscriptionPlans value={qaSubscriptionPlanId} onChange={setQaSubscriptionPlanId} lang={lang} compact includeTrial />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading || qaImei.length !== 15 || !qaPhone.trim()}
                    className="w-full py-3.5 rounded-xl bg-primary-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-primary-600 active:scale-[0.98] transition-all"
                  >
                    {loading
                      ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{isAr ? 'جاري الإضافة...' : 'Ajout...'}</>
                      : <><Plus size={16} />{isAr ? 'إضافة الجهاز' : 'Ajouter l\'appareil'}</>}
                  </button>

                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GLOBAL / CLIENT-SCOPED MODE — UNCHANGED
  // ════════════════════════════════════════════════════════════════════════════
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
                  ? (isAr ? 'إضافة جهاز جديد' : 'Ajouter un appareil')
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
                  {isAr ? 'اسم الجهاز' : "Nom de l'appareil"}{isGlobal ? ' *' : ''}
                </label>
                <input className="input-field text-sm" placeholder={isGlobal ? undefined : (isAr ? 'مثال: سيارة العمتل' : 'Ex: Voiture client')} value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {isGlobal ? ('IMEI (15 ' + (isAr ? 'رقم' : 'chiffres') + ') *') : t(lang, 'imei')}
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
                    {isGlobal ? (isAr ? 'النوع' : 'Type') : (isAr ? 'نوع المركبة' : 'Type de véhicule')}
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
                    {isAr ? 'تعيين للعمتل' : 'Assigner au client'}
                  </label>
                  <select className="input-field text-sm" value={form.clientId}
                    onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}>
                   <option value="">
                     {clientList.length
                       ? (isAr ? '— بدون عمتل —' : '— Sans client —')
                       : clientsError
                         ? (isAr ? 'تعذر تحميل العملاء' : 'Impossible de charger les clients')
                         : (isAr ? 'جاري تحميل العملاء...' : 'Chargement des clients...')}
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
                     {isAr ? 'إعادة المحاولة' : 'Réessayer'}
                   </button>
                 )}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {isGlobal
                    ? (isAr ? 'خطة اشتراك الجهاز — دفع نقدي' : 'Forfait de l’appareil — paiement comptant')
                    : (isAr ? 'خطة اشتراك الجهاز' : 'Forfait appareil')}
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