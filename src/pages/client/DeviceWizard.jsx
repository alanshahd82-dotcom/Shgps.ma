import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Check, Smartphone,
  Copy, CheckCheck, Zap, AlertCircle
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'

const DEVICE_TYPES = [
  { value: 'wanway',    label: 'WanWay GS900 / GT06', emoji: '📡' },
  { value: 'concox',   label: 'Concox / GT06N',      emoji: '📟' },
  { value: 'teltonika', label: 'Teltonika FMB',       emoji: '🔧' },
  { value: 'other',    label: 'Autre / أخرى',         emoji: '📦' },
]
const CARRIERS = [
  { value: 'iam',    label: 'Maroc Telecom (IAM)', apn: 'www.iamgprs1.ma' },
  { value: 'orange', label: 'Orange Maroc',         apn: 'internet' },
  { value: 'inwi',   label: 'inwi',                 apn: 'www.inwi.ma' },
]

const TRACCAR_HOST = import.meta.env.VITE_TRACCAR_HOST || '64.226.103.251'
// This GS900 firmware reports and accepts the GT06-compatible listener on 5023.
const GS900_PORT = import.meta.env.VITE_GS900_PORT || '5023'
const TELTONIKA_PORT = import.meta.env.VITE_TELTONIKA_PORT || '5027'

function buildCommands({ deviceType, apn }) {
  const s  = TRACCAR_HOST
  const p  = '0000'
  const a  = apn || 'internet'
  if (deviceType === 'teltonika') {
    return [
      { label: 'APN',    cmd: `setparam 2001:${a}` },
      { label: 'Server', cmd: `setparam 2004:${s};2005:${TELTONIKA_PORT}` },
    ]
  }
  if (deviceType === 'wanway') {
    return [
      { label: 'APN', cmd: `APN,${a}#` },
      { label: 'Server', cmd: `SERVER,1,${s},${GS900_PORT},0#` },
      { label: 'Upload while stopped', cmd: 'STA_SENDGPS_I#' },
      { label: 'Upload interval', cmd: 'TIMER,10,10#' },
      { label: 'Status check', cmd: 'STATUS#' },
      { label: 'Server check', cmd: 'SERVER#' },
      { label: 'Network check', cmd: 'GPRSSET#' },
      { label: 'Location check', cmd: 'WHERE#' },
      { label: 'Stopped upload check', cmd: 'STA_SENDGPS#' },
    ]
  }
  return [
    { label: 'Password reset', cmd: `PASSWORD,${p},123456#` },
    { label: 'APN',            cmd: `APN,${p},${a}#` },
    { label: 'Server IP',      cmd: `ADMINIP,${p},${s},5055#` },
    { label: 'GPRS ON',        cmd: `GPRS,${p}#` },
    { label: 'Interval',       cmd: `INTERVAL,${p},10#` },
    { label: 'Status check',   cmd: `STATUS#` },
  ]
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = text; document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
    })
  } else {
    const ta = document.createElement('textarea')
    ta.value = text; document.body.appendChild(ta); ta.select()
    document.execCommand('copy'); document.body.removeChild(ta)
  }
}

// ── Step 0: Device Info ───────────────────────────────────────────────────────
function StepInfo({ state, setState, lang }) {
  const isAr = lang === 'ar'
  const isIMEIValid = /^\d{15}$/.test(state.imei.trim())
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-primary-500 font-extrabold text-base">
          {isAr ? 'معلومات الجهاز' : 'Informations de l\'appareil'}
        </h2>
        <p className="text-slate-500 text-xs mt-1">
          {isAr ? 'أدخل بيانات الجهاز واختر شبكة الجوال' : 'Entrez les données du tracker et choisissez l\'opérateur'}
        </p>
      </div>

      {/* Device type */}
      <div>
         <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">
          {isAr ? 'نوع الجهاز' : 'Type d\'appareil'}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {DEVICE_TYPES.map(dt => (
            <button key={dt.value} type="button" onClick={() => setState(s => ({ ...s, deviceType: dt.value }))}
              className={`p-3 rounded-xl border-2 text-left transition-all active:scale-97 ${
                state.deviceType === dt.value
                  ? 'border-accent bg-accent/10'
                   : 'border-slate-200 bg-white hover:border-slate-300'
              }`}>
              <div className="text-xl mb-1">{dt.emoji}</div>
               <p className={`text-xs font-bold ${state.deviceType === dt.value ? 'text-primary-500' : 'text-slate-600'}`}>
                {dt.label}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* IMEI */}
      <div>
         <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">IMEI</label>
        <div className="relative">
          <input
            type="tel"
            maxLength={15}
            value={state.imei}
            onChange={e => setState(s => ({ ...s, imei: e.target.value.replace(/\D/g, '').slice(0, 15) }))}
            placeholder="358900001234567"
             className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 font-mono text-sm focus:outline-none focus:border-accent pr-10"
          />
          {state.imei.length > 0 && (
            <span className="absolute right-3 top-3 text-lg">
              {isIMEIValid ? '✅' : '⬜'}
            </span>
          )}
        </div>
        <p className="text-slate-500 text-[11px] mt-1">
          {isAr ? `${state.imei.length}/15 رقم` : `${state.imei.length}/15 chiffres`}
        </p>
      </div>

      {/* Vehicle name */}
      <div>
         <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
          {isAr ? 'اسم المركبة' : 'Nom du véhicule'}
        </label>
        <input
          value={state.vehicleName}
          onChange={e => setState(s => ({ ...s, vehicleName: e.target.value }))}
          placeholder={isAr ? 'مثال: سيارة الشركة' : 'Ex: Voiture société'}
           className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-accent"
        />
      </div>

      {/* Plate */}
      <div>
         <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
          {isAr ? 'رقم اللوحة' : 'Plaque d\'immatriculation'}
        </label>
        <input
          value={state.plate}
          onChange={e => setState(s => ({ ...s, plate: e.target.value.toUpperCase() }))}
          placeholder="A 12345 XX"
           className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 font-mono text-sm uppercase focus:outline-none focus:border-accent"
        />
      </div>

      {/* Carrier */}
      <div>
         <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">
          {isAr ? 'شبكة الجوال' : 'Opérateur mobile'}
        </label>
        <div className="space-y-2">
          {CARRIERS.map(c => (
            <button key={c.value} type="button" onClick={() => setState(s => ({ ...s, carrier: c.value }))}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                state.carrier === c.value
                  ? 'border-accent bg-accent/10'
                   : 'border-slate-200 bg-white'
              }`}>
              <div className="text-left">
                 <p className={`text-sm font-bold ${state.carrier === c.value ? 'text-primary-500' : 'text-slate-700'}`}>{c.label}</p>
                <p className="text-[10px] text-slate-500 font-mono">{c.apn}</p>
              </div>
              {state.carrier === c.value && <Check size={16} className="text-accent" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Step 1: Commands + Save ───────────────────────────────────────────────────
function StepCommands({ commands, lang, onSave, saving, saveError }) {
  const isAr = lang === 'ar'
  const [copied, setCopied] = useState({})
  const [allCopied, setAllCopied] = useState(false)

  const handleCopy = (cmd, i) => {
    copyText(cmd)
    setCopied(prev => ({ ...prev, [i]: true }))
    setTimeout(() => setCopied(prev => ({ ...prev, [i]: false })), 2000)
  }
  const handleCopyAll = () => {
    copyText(commands.map(c => c.cmd).join('\n'))
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 2500)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-primary-500 font-extrabold text-base">
          {isAr ? 'أوامر إعداد الجهاز' : 'Commandes de configuration'}
        </h2>
         <p className="text-slate-500 text-xs mt-1 leading-relaxed">
          {isAr
             ? 'أرسل كل أمر كرسالة SMS مستقلة بالترتيب. في GS900 انتظر APN_OK وSERVER_OK قبل الفحوصات، ثم احفظ الجهاز'
            : 'Envoyez ces commandes dans l\'ordre au numéro SIM du tracker par SMS, puis enregistrez'}
        </p>
      </div>

      <div className="space-y-2">
        {commands.map((c, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary-50">
              <span className="text-[10px] font-bold text-primary-500">{i + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-500 mb-0.5">{c.label}</p>
              <p className="truncate text-xs font-mono text-primary-500">{c.cmd}</p>
            </div>
            <button onClick={() => handleCopy(c.cmd, i)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 active:scale-90 transition-transform">
              {copied[i]
                ? <CheckCheck size={12} className="text-accent" />
                : <Copy size={12} className="text-slate-500" />}
            </button>
          </div>
        ))}
      </div>

      <button onClick={handleCopyAll}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-slate-900 font-bold text-sm active:scale-95 transition-transform">
        {allCopied ? <CheckCheck size={15} /> : <Copy size={15} />}
        {allCopied
          ? (isAr ? 'تم النسخ!' : 'Copié!')
          : (isAr ? 'نسخ كل الأوامر' : 'Copier toutes les commandes')}
      </button>

      <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <Zap size={14} className="mt-0.5 shrink-0 text-emerald-600" />
        <p className="text-[11px] leading-relaxed text-emerald-700">
          {isAr
             ? 'لا توجد في دليل GS900 رسالة واحدة موثقة لكل الإعدادات. أرسل كل أمر SMS مستقلاً وانتظر الرد قبل التالي.'
             : 'Le manuel GS900 ne documente pas une seule SMS pour toute la configuration. Envoyez chaque commande séparément et attendez la réponse.'}
        </p>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
          <AlertCircle size={14} className="shrink-0 text-danger" />
          <p className="text-xs text-danger">{saveError}</p>
        </div>
      )}

      <button
        onClick={onSave}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 py-3.5 text-sm font-bold text-white active:scale-95 transition-transform disabled:opacity-60"
      >
        <Check size={15} />
        {saving
          ? (isAr ? 'جاري الحفظ...' : 'Enregistrement...')
          : (isAr ? '✅ حفظ الجهاز' : '✅ Enregistrer l\'appareil')}
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const STEPS = ['info', 'commands']

export default function DeviceWizard() {
  const navigate = useNavigate()
  const { lang } = useApp()
  const isAr = lang === 'ar'

  const [step, setStep] = useState(0)
  const [state, setState] = useState({
    deviceType: 'wanway',
    imei: '',
    vehicleName: '',
    plate: '',
    carrier: 'iam',
  })
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState(null)

  const selectedCarrier = CARRIERS.find(c => c.value === state.carrier)
  const apn = selectedCarrier?.apn || 'internet'
  const commands = buildCommands({ deviceType: state.deviceType, apn })

  const canNext = () => {
    if (step === 0) return /^\d{15}$/.test(state.imei.trim()) && state.vehicleName.trim().length > 0
    return true
  }

  const stepLabels = isAr
    ? ['معلومات الجهاز', 'أوامر الإعداد']
    : ['Informations', 'Configuration']

  const handleSave = async () => {
    setSaving(true); setSaveError(null)
    try {
      await api.devices.clientAdd({
        name:  state.vehicleName.trim(),
        imei:  state.imei.trim(),
        type:  state.deviceType,
        plate: state.plate.trim() || null,
      })
      navigate('/client/devices')
    } catch (e) {
      setSaveError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="client-app flex min-h-[100dvh] flex-col bg-[#f5f7f8]">
      <ClientHeader />
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 pb-4 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => step === 0 ? navigate(-1) : setStep(s => s - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <ChevronLeft size={18} className="text-primary-500" />
          </button>
          <div>
            <h1 className="text-primary-500 text-lg font-extrabold leading-tight">
              {isAr ? 'إضافة جهاز تتبع' : 'Ajouter un tracker'}
            </h1>
            <p className="text-slate-500 text-xs">
              {stepLabels[step]} · {step + 1}/{STEPS.length}
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-accent' : 'bg-slate-200'}`} />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-32">
        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, x: isAr ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isAr ? 20 : -20 }}
            transition={{ duration: 0.2 }}>
            {step === 0 && <StepInfo state={state} setState={setState} lang={lang} />}
            {step === 1 && <StepCommands commands={commands} lang={lang} onSave={handleSave} saving={saving} saveError={saveError} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav buttons — only on step 0 */}
      {step === 0 && (
        <div className="fixed inset-x-0 bottom-20 px-4 pb-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
            <button
              onClick={() => canNext() && setStep(1)}
              disabled={!canNext()}
              className="w-full py-3 bg-accent text-slate-900 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95 transition-transform"
            >
              {isAr ? 'التالي — أوامر الإعداد' : 'Suivant — Commandes'}
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      <ClientNav />
    </div>
  )
}
