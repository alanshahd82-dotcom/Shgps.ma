import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Check, Smartphone, Wifi, Server,
  MessageSquare, Copy, CheckCheck, Info, Zap
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import ClientNav from '../../components/ClientNav'

const DEVICE_TYPES = [
  { value: 'wanway', label: 'WanWay / TK Series', emoji: '📡' },
  { value: 'concox', label: 'Concox / GT06N',     emoji: '📟' },
  { value: 'teltonika', label: 'Teltonika FMB',   emoji: '🔧' },
  { value: 'other',   label: 'Autre / أخرى',      emoji: '📦' },
]
const CARRIERS = [
  { value: 'iam',    label: 'Maroc Telecom (IAM)', apn: 'internet.iam.net' },
  { value: 'orange', label: 'Orange Maroc',         apn: 'internet' },
  { value: 'inwi',   label: 'inwi',                 apn: 'inwi.net' },
  { value: 'custom', label: 'Personnalisé',          apn: '' },
]

function buildCommands({ deviceType, carrier, apn, server, port, pass }) {
  const p = pass || '0000'
  const s = server || 'tracker.example.com'
  const pt = port || '5055'
  const a = apn || 'internet'

  if (deviceType === 'teltonika') {
    return [
      { label: 'APN',    cmd: `setparam 2001:${a}` },
      { label: 'Server', cmd: `setparam 2004:${s};2005:${pt}` },
    ]
  }
  // GT06 / WanWay / Concox similar protocol
  return [
    { label: 'Password reset', cmd: `PASSWORD,${p},123456#` },
    { label: 'APN',            cmd: `APN,${p},${a}#` },
    { label: 'Server IP',      cmd: `ADMINIP,${p},${s},${pt}#` },
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

// ── Step components ───────────────────────────────────────────────────────────
function StepDeviceType({ value, onChange, lang }) {
  const isAr = lang === 'ar'
  return (
    <div className="space-y-3">
      <h2 className="text-white font-bold text-base">
        {isAr ? 'نوع الجهاز' : 'Type d\'appareil'}
      </h2>
      <p className="text-slate-400 text-xs">
        {isAr ? 'اختر نوع جهاز التتبع الخاص بك' : 'Sélectionnez le type de votre tracker GPS'}
      </p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {DEVICE_TYPES.map(dt => (
          <button key={dt.value} onClick={() => onChange(dt.value)}
            className={`p-4 rounded-2xl border-2 text-left transition-all active:scale-97 ${
              value === dt.value
                ? 'border-accent bg-accent/10'
                : 'border-slate-700 bg-slate-800/60 hover:border-slate-600'
            }`}>
            <div className="text-2xl mb-2">{dt.emoji}</div>
            <p className={`text-sm font-bold ${value === dt.value ? 'text-accent' : 'text-slate-300'}`}>
              {dt.label}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

function StepNetwork({ carrier, setCarrier, customApn, setCustomApn, lang }) {
  const isAr = lang === 'ar'
  const selected = CARRIERS.find(c => c.value === carrier)
  return (
    <div className="space-y-3">
      <h2 className="text-white font-bold text-base">
        {isAr ? 'شبكة الاتصال' : 'Réseau mobile'}
      </h2>
      <p className="text-slate-400 text-xs">
        {isAr ? 'اختر شبكة الجوال لشريحة الجهاز' : 'Choisissez l\'opérateur de la carte SIM du tracker'}
      </p>
      <div className="space-y-2 mt-2">
        {CARRIERS.map(c => (
          <button key={c.value} onClick={() => setCarrier(c.value)}
            className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${
              carrier === c.value
                ? 'border-accent bg-accent/10'
                : 'border-slate-700 bg-slate-800/60'
            }`}>
            <div>
              <p className={`text-sm font-bold ${carrier === c.value ? 'text-accent' : 'text-slate-300'}`}>{c.label}</p>
              {c.apn && <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{c.apn}</p>}
            </div>
            {carrier === c.value && <Check size={16} className="text-accent" />}
          </button>
        ))}
      </div>
      {carrier === 'custom' && (
        <input type="text" placeholder="APN personnalisé" value={customApn}
          onChange={e => setCustomApn(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent placeholder:text-slate-600 mt-2" />
      )}
      <div className="flex gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
        <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-300/80">
          {isAr
            ? 'تأكد من أن شريحة الجهاز تدعم GPRS وخطة البيانات مفعّلة'
            : 'Vérifiez que la SIM supporte GPRS et que le forfait data est actif'}
        </p>
      </div>
    </div>
  )
}

function StepServer({ server, setServer, port, setPort, pass, setPass, lang }) {
  const isAr = lang === 'ar'
  return (
    <div className="space-y-3">
      <h2 className="text-white font-bold text-base">
        {isAr ? 'إعدادات الخادم' : 'Paramètres serveur'}
      </h2>
      <p className="text-slate-400 text-xs">
        {isAr ? 'أدخل بيانات خادم Traccar الخاص بك' : 'Entrez les données de votre serveur Traccar'}
      </p>
      <div className="space-y-2 mt-2">
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">{isAr ? 'عنوان الخادم (IP أو Domain)' : 'Adresse du serveur'}</label>
          <input type="text" placeholder="tracker.yourdomain.com" value={server}
            onChange={e => setServer(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent placeholder:text-slate-600" />
        </div>
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">{isAr ? 'المنفذ' : 'Port'}</label>
          <input type="number" placeholder="5055" value={port}
            onChange={e => setPort(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent placeholder:text-slate-600" />
        </div>
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">
            {isAr ? 'كلمة سر الجهاز (افتراضي: 0000)' : 'Mot de passe appareil (défaut: 0000)'}
          </label>
          <input type="text" placeholder="0000" value={pass}
            onChange={e => setPass(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent placeholder:text-slate-600" />
        </div>
      </div>
    </div>
  )
}

function StepCommands({ commands, lang }) {
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
    <div className="space-y-3">
      <h2 className="text-white font-bold text-base">
        {isAr ? 'أوامر SMS' : 'Commandes SMS'}
      </h2>
      <p className="text-slate-400 text-xs leading-relaxed">
        {isAr
          ? 'أرسل هذه الأوامر بالترتيب إلى رقم شريحة الجهاز عبر SMS وانتظر رد التأكيد'
          : 'Envoyez ces commandes dans l\'ordre au numéro SIM du tracker par SMS et attendez la confirmation'}
      </p>
      <div className="space-y-2 mt-2">
        {commands.map((c, i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-800 border border-slate-700/60 rounded-xl p-3">
            <div className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-slate-400">{i + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-500 mb-0.5">{c.label}</p>
              <p className="text-xs font-mono text-accent truncate">{c.cmd}</p>
            </div>
            <button onClick={() => handleCopy(c.cmd, i)}
              className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 active:scale-90 transition-transform">
              {copied[i]
                ? <CheckCheck size={12} className="text-accent" />
                : <Copy size={12} className="text-slate-400" />
              }
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
      <div className="flex gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
        <Zap size={14} className="text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-emerald-300/80 leading-relaxed">
          {isAr
            ? 'بعد إرسال الأوامر، يبدأ الجهاز بالإرسال خلال 2-5 دقائق. تحقق من لوحة التحكم.'
            : 'Après envoi, le tracker commence à émettre dans 2-5 minutes. Vérifiez le tableau de bord.'}
        </p>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const STEPS = ['device', 'network', 'server', 'commands']

export default function DeviceWizard() {
  const navigate = useNavigate()
  const { lang } = useApp()
  const isAr = lang === 'ar'

  const [step, setStep]           = useState(0)
  const [deviceType, setDeviceType] = useState('wanway')
  const [carrier, setCarrier]     = useState('iam')
  const [customApn, setCustomApn] = useState('')
  const [server, setServer]       = useState('')
  const [port, setPort]           = useState('5055')
  const [pass, setPass]           = useState('0000')

  const selectedCarrier = CARRIERS.find(c => c.value === carrier)
  const apn = carrier === 'custom' ? customApn : selectedCarrier?.apn || ''

  const commands = buildCommands({ deviceType, carrier, apn, server, port, pass })

  const canNext = () => {
    if (step === 0) return !!deviceType
    if (step === 1) return !!carrier && (carrier !== 'custom' || !!customApn.trim())
    if (step === 2) return !!server.trim()
    return true
  }

  const stepLabels = isAr
    ? ['نوع الجهاز', 'الشبكة', 'الخادم', 'الأوامر']
    : ['Appareil', 'Réseau', 'Serveur', 'Commandes']

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: 'linear-gradient(180deg,#0d1b33 0%,#0a1225 100%)' }}>
      {/* Header */}
      <div className="pt-14 px-4 pb-4" style={{ background: 'linear-gradient(160deg,#0F2044 0%,#162d5e 100%)' }}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => step === 0 ? navigate(-1) : setStep(s => s - 1)}
            className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <ChevronLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="text-white text-lg font-bold leading-tight">
              {isAr ? 'معالج إضافة الجهاز' : 'Assistant d\'installation'}
            </h1>
            <p className="text-blue-200/60 text-xs">
              {stepLabels[step]} · {step + 1}/{STEPS.length}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-accent' : 'bg-white/15'}`} />
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
            {step === 0 && <StepDeviceType value={deviceType} onChange={setDeviceType} lang={lang} />}
            {step === 1 && <StepNetwork carrier={carrier} setCarrier={setCarrier} customApn={customApn} setCustomApn={setCustomApn} lang={lang} />}
            {step === 2 && <StepServer server={server} setServer={setServer} port={port} setPort={setPort} pass={pass} setPass={setPass} lang={lang} />}
            {step === 3 && <StepCommands commands={commands} lang={lang} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav buttons */}
      <div className="fixed inset-x-0 bottom-20 px-4 pb-2">
        <div className="bg-slate-900/95 backdrop-blur-sm rounded-2xl p-3 border border-slate-700/40 flex gap-2">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex-none py-3 px-5 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm flex items-center gap-1.5 active:scale-95 transition-transform">
              <ChevronLeft size={15} />
              {isAr ? 'رجوع' : 'Retour'}
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={() => canNext() && setStep(s => s + 1)} disabled={!canNext()}
              className="flex-1 py-3 bg-accent text-slate-900 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95 transition-transform">
              {isAr ? 'التالي' : 'Suivant'}
              <ChevronRight size={15} />
            </button>
          ) : (
            <button onClick={() => navigate('/client/devices')}
              className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
              <Check size={15} />
              {isAr ? 'إنهاء' : 'Terminer'}
            </button>
          )}
        </div>
      </div>

      <ClientNav />
    </div>
  )
}
