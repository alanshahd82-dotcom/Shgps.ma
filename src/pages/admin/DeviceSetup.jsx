import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu, CheckCircle2, AlertCircle, Copy, ChevronRight, ChevronLeft,
  Wifi, User, MapPin, Check, RefreshCw, Loader2, X
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import AdminLayout from './AdminLayout'
import SubscriptionPlans from '../../components/SubscriptionPlans'

// ── Device Type Cards ─────────────────────────────────────────────────────
const DEVICE_TYPES = [
  { id: 'gt06',      label: 'GT06 / GL300',    icon: '📡', protocols: ['gt06'], color: '#3B82F6', desc: 'Concox, Meitrack, Coban' },
  { id: 'wanway',    label: 'WanWay GS900 / GT06', icon: '🛰', protocols: ['gt06'], color: '#8B5CF6', desc: 'GS900 firmware on port 5023' },
  { id: 'teltonika', label: 'Teltonika FMB',   icon: '⚡',  protocols: ['teltonika'], color: '#10B981', desc: 'FMB920 / FMB140 / FMC003' },
  { id: 'coban',     label: 'Coban GPS303',    icon: '📶',  protocols: ['gt06'], color: '#F59E0B', desc: 'GPS303G / GPS103 series' },
  { id: 'generic',   label: 'Generic / Other', icon: '🔧',  protocols: ['osmand'], color: '#6B7280', desc: 'Any NMEA / OsmAnd device' },
]

const APN_LIST = [
  { label: 'IAM (Maroc Telecom)', apn: 'www.iamgprs1.ma', user: '', pass: '' },
  { label: 'Orange Maroc',        apn: 'gprs',    user: '',    pass: '' },
  { label: 'Inwi',                apn: 'www.inwi.ma', user: '', pass: '' },
  { label: 'Méditel / Orange',    apn: 'internet',user: '',    pass: '' },
  { label: 'Custom APN',          apn: '',        user: '',    pass: '', custom: true },
]

function getSmsCommands(deviceId, apn, user, pass, phone) {
  const cmds = {
    gt06:      [`APN,${apn},${user},${pass}#`, `SERVER,1,64.226.103.251,5023,0#`, `TIMER,1,1#`, `GPRS#`],
    // This GS900 firmware reports the GT06-compatible SERVER format and port.
    // APN and SERVER are separate; the remaining commands are read-only checks.
    wanway:    [`APN,${apn}#`, `SERVER,1,64.226.103.251,5023,0#`, 'TIMER,10,10#', 'STA_SENDGPS_I#', 'STATUS#', 'SERVER#', 'GPRSSET#', 'WHERE#', 'STA_SENDGPS#'],
    teltonika: [`  setparam 2001:${apn};2002:${user};2003:${pass}`, `  setparam 2004:64.226.103.251;2005:5023`],
    coban:     [`begin${phone || ''}`, `apn${phone || ''} ${apn}`, `gprs${phone || ''}`, `adminip${phone || ''} 64.226.103.251 5023`],
    generic:   [`Server: 64.226.103.251`, `Port: 5055 (OsmAnd HTTP)`, `Device ID: ${deviceId || 'imei'}`],
  }
  return cmds[deviceId] || cmds.generic
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }
  return (
    <button onClick={copy}
      className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${copied ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

// ── Stepper ────────────────────────────────────────────────────────────────
const STEPS = ['النوع', 'البيانات', 'بطاقة SIM', 'العميل', 'الاتصال', 'تأكيد']

function Stepper({ step }) {
  return (
    <div className="flex items-center justify-between px-2 mb-8">
      {STEPS.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-primary-500 text-white ring-2 ring-primary-200' : 'bg-slate-100 text-slate-400'
            }`}>
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span className={`text-[9px] font-semibold hidden sm:block ${i === step ? 'text-primary-500' : 'text-slate-400'}`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 transition-all ${i < step ? 'bg-emerald-400' : 'bg-slate-100'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function DeviceSetup() {
  const navigate  = useNavigate()
  const { clientList, lang, loadDevices } = useApp()
  const isAr = lang === 'ar'

  const [step, setStep]               = useState(0)
  const [deviceType, setDeviceType]   = useState(null)
  const [imei, setImei]               = useState('')
  const [imeiValid, setImeiValid]     = useState(null)
  const [name, setName]               = useState('')
  const [plate, setPlate]             = useState('')
  const [vehicleType, setVehicleType] = useState('car')
  const [apnIndex, setApnIndex]       = useState(0)
  const [customApn, setCustomApn]     = useState({ apn: '', user: '', pass: '' })
  const [simPhone, setSimPhone]       = useState('')
   const [testStatus, setTestStatus]   = useState(null) // null | 'checking' | 'found' | 'registered' | 'not_found'
  const [testData, setTestData]       = useState(null)
  const [clientId, setClientId]       = useState('')
  const [subscriptionPlanId, setSubscriptionPlanId] = useState('3_months')
  const [saving, setSaving]           = useState(false)
  const [savedDevice, setSavedDevice] = useState(null)
  const [error, setError]             = useState('')
  const pollRef = useRef(null)

  // IMEI validation
  const validateImei = (v) => {
    const clean = v.replace(/\D/g, '')
    setImei(clean)
    if (clean.length === 15) setImeiValid(/^\d{15}$/.test(clean))
    else setImeiValid(null)
  }

  // APN data
  const apnData = APN_LIST[apnIndex]?.custom ? customApn : APN_LIST[apnIndex]

  // SMS commands
  const smsCommands = deviceType ? getSmsCommands(deviceType.id, apnData.apn, apnData.user, apnData.pass, simPhone) : []

  // Step 4: connection test — the device is registered before this step.
  const startConnectionTest = async () => {
    setTestStatus('checking')
    setTestData(null)
    let attempts = 0
    let finished = false
    clearInterval(pollRef.current)
    const poll = async () => {
      if (finished) return
      try {
        const res = await api.devices.testConnection(imei)
        if (res.online) {
          finished = true
          setTestStatus('found')
          setTestData(res)
          clearInterval(pollRef.current)
        } else if (res.found || res.registered) {
          // The device exists in the system, but Traccar has not received
          // a live position/online packet yet. This is different from
          // "device not registered" and is common while GPS is still off.
          finished = true
          setTestStatus('registered')
          setTestData(res)
          clearInterval(pollRef.current)
        } else {
          attempts++
          if (attempts >= 10) {
            finished = true
            setTestStatus('not_found')
            clearInterval(pollRef.current)
          }
        }
      } catch {
        attempts++
        if (attempts >= 10) {
          finished = true
          setTestStatus('not_found')
          clearInterval(pollRef.current)
        }
      }
    }
    await poll()
    if (!finished) pollRef.current = setInterval(poll, 3000)
  }

  // Step 4→5: save device, then let the next step test the registered device.
  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      const device = await api.devices.create({
        name: name || `${deviceType?.label} ${imei.slice(-4)}`,
        imei,
        type: vehicleType,
        plate,
        clientId: clientId || undefined,
        subscriptionPlanId,
      })
      setSavedDevice(device)
      setTestStatus(null)
      setTestData(null)
      setStep(4)
      loadDevices()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const canNext = () => {
    if (step === 0) return !!deviceType
    if (step === 1) return imeiValid && name.trim()
    if (step === 2) return true
    if (step === 3) return true
    if (step === 4) return true
    return false
  }

  const goNext = () => {
    if (step === 3) { handleSave(); return }
    if (step === 4) { setStep(5); return }
    setStep(s => s + 1)
  }

  return (
    <AdminLayout>
      <div className="p-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/admin')}
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
            <ChevronLeft size={16} className="text-primary-500" />
          </button>
          <div>
            <h1 className="text-xl font-black text-primary-500">{isAr ? 'تركيب جهاز جديد' : 'Installer un appareil'}</h1>
            <p className="text-slate-400 text-xs">{isAr ? 'معالج التركيب خطوة بخطوة' : 'Assistant d\'installation pas à pas'}</p>
          </div>
        </div>

        <Stepper step={step} />

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18 }}>

            {/* ── Step 0: Device Type ── */}
            {step === 0 && (
              <div>
                <h2 className="font-black text-primary-500 text-lg mb-1">{isAr ? 'اختر نوع الجهاز' : 'Choisir le type d\'appareil'}</h2>
                <p className="text-slate-400 text-sm mb-5">{isAr ? 'حدد موديل جهاز التتبع' : 'Sélectionnez le modèle du traceur'}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {DEVICE_TYPES.map(dt => (
                    <button key={dt.id} onClick={() => setDeviceType(dt)}
                      className={`rounded-2xl p-4 text-start transition-all border-2 ${deviceType?.id === dt.id
                        ? 'border-primary-500 bg-primary-50 shadow-md'
                        : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}>
                      <div className="text-3xl mb-2">{dt.icon}</div>
                      <p className="font-bold text-sm text-primary-500">{dt.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{dt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 1: Vehicle Data ── */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-black text-primary-500 text-lg mb-1">{isAr ? 'بيانات الجهاز والمركبة' : 'Données appareil & véhicule'}</h2>
                  <p className="text-slate-400 text-sm mb-5">{isAr ? 'أدخل IMEI واسم المركبة' : 'Entrez l\'IMEI et le nom du véhicule'}</p>
                </div>
                {/* IMEI */}
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">IMEI (15 {isAr ? 'رقماً' : 'chiffres'})</label>
                  <div className="relative">
                    <input type="tel" maxLength={15} value={imei} onChange={e => validateImei(e.target.value)}
                      placeholder="864...123456789"
                      className={`w-full border-2 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none transition-all ${
                        imeiValid === true  ? 'border-emerald-400 bg-emerald-50' :
                        imeiValid === false ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-primary-300'}`} />
                    {imeiValid !== null && (
                      <span className="absolute top-3 end-3">
                        {imeiValid ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-red-500" />}
                      </span>
                    )}
                  </div>
                  {imei.length > 0 && imei.length < 15 && (
                    <p className="text-xs text-slate-400 mt-1">{imei.length}/15</p>
                  )}
                </div>
                {/* Name */}
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">{isAr ? 'اسم المركبة' : 'Nom du véhicule'}</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder={isAr ? 'مثال: سيارة محمد' : 'Ex: Camion livraison'}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-300" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Plate */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1.5">{isAr ? 'لوحة الترقيم' : 'Plaque'}</label>
                    <input type="text" value={plate} onChange={e => setPlate(e.target.value)}
                      placeholder="12345-A-1"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-300" />
                  </div>
                  {/* Vehicle type */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1.5">{isAr ? 'النوع' : 'Type'}</label>
                    <select value={vehicleType} onChange={e => setVehicleType(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-primary-300">
                      <option value="car">{isAr ? 'سيارة' : 'Voiture'}</option>
                      <option value="truck">{isAr ? 'شاحنة' : 'Camion'}</option>
                      <option value="motorcycle">{isAr ? 'دراجة نارية' : 'Moto'}</option>
                      <option value="bus">{isAr ? 'حافلة' : 'Bus'}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: SIM / APN ── */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-black text-primary-500 text-lg mb-1">{isAr ? 'إعداد بطاقة SIM' : 'Configuration SIM'}</h2>
                <p className="text-slate-400 text-sm mb-5">{isAr ? 'اختر مشغل الشبكة وأرسل الأوامر' : 'Choisissez l\'opérateur et envoyez les commandes'}</p>

                {/* SIM phone */}
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">{isAr ? 'رقم SIM الجهاز' : 'N° SIM de l\'appareil'}</label>
                  <input type="tel" value={simPhone} onChange={e => setSimPhone(e.target.value)}
                    placeholder="+212600000000"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-300" />
                </div>

                {/* APN selector */}
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-2">{isAr ? 'مشغل الشبكة / APN' : 'Opérateur / APN'}</label>
                  <div className="space-y-2">
                    {APN_LIST.map((apn, i) => (
                      <button key={i} onClick={() => setApnIndex(i)}
                        className={`w-full text-start px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                          apnIndex === i ? 'border-primary-400 bg-primary-50 text-primary-600' : 'border-gray-100 bg-white text-slate-600 hover:border-gray-200'}`}>
                        {apn.label}
                        {!apn.custom && <span className="text-xs text-slate-400 font-normal ms-2">APN: {apn.apn}</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom APN fields */}
                {APN_LIST[apnIndex]?.custom && (
                  <div className="grid grid-cols-3 gap-2">
                    {['apn', 'user', 'pass'].map(f => (
                      <div key={f}>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">{f.toUpperCase()}</label>
                        <input type="text" value={customApn[f]} onChange={e => setCustomApn(p => ({ ...p, [f]: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary-300" />
                      </div>
                    ))}
                  </div>
                )}

                {/* SMS Commands */}
                <div className="bg-slate-900 rounded-2xl p-4">
                  <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">{isAr ? 'أوامر SMS' : 'Commandes SMS'}</p>
                  <div className="space-y-2">
                    {smsCommands.map((cmd, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <code className="flex-1 text-emerald-400 text-xs font-mono bg-slate-800 px-3 py-2 rounded-xl overflow-auto">{cmd}</code>
                        <CopyBtn text={cmd} />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-3">{isAr ? '* أرسل كل أمر كرسالة SMS مستقلة. هذا الإصدار من GS900 يستخدم 5023 وصيغة SERVER,1.' : '* Envoyez chaque commande comme SMS séparé. Ce firmware GS900 utilise le port 5023 et le format SERVER,1.'}</p>
                </div>
              </div>
            )}

            {/* ── Step 3: Assign Client ── */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="font-black text-primary-500 text-lg mb-1">{isAr ? 'تعيين للعميل' : 'Assigner au client'}</h2>
                <p className="text-slate-400 text-sm mb-5">{isAr ? 'اختر عميلاً أو اترك فارغاً (غير مخصص)' : 'Choisissez un client ou laissez vide (non assigné)'}</p>

                <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Cpu size={14} className="text-primary-400" />
                    <span className="text-xs font-bold text-primary-500">{name}</span>
                  </div>
                  <p className="text-xs text-slate-400">IMEI: {imei} · {deviceType?.label}</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-2">{isAr ? 'العميل' : 'Client'}</label>
                  <select value={clientId} onChange={e => setClientId(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-300">
                    <option value="">{isAr ? '— غير مخصص —' : '— Non assigné —'}</option>
                    {(clientList || []).map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-2">{isAr ? 'خطة اشتراك الجهاز — دفع نقدي' : 'Forfait appareil — paiement comptant'}</label>
                  <SubscriptionPlans value={subscriptionPlanId} onChange={setSubscriptionPlanId} lang={lang} includeTrial />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl border border-red-100">
                    <AlertCircle size={14} />{error}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 4: Connection Test ── */}
            {step === 4 && (
              <div className="text-center py-4">
                <h2 className="font-black text-primary-500 text-lg mb-1">{isAr ? 'اختبار الاتصال' : 'Test de connexion'}</h2>
                <p className="text-slate-400 text-sm mb-8">{isAr ? 'تأكد أن الجهاز يتواصل مع الخادم' : 'Vérifiez que l\'appareil communique avec le serveur'}</p>

                {testStatus === null && (
                  <div className="space-y-4">
                    <div className="w-24 h-24 rounded-full bg-primary-50 flex items-center justify-center mx-auto">
                      <Wifi size={40} className="text-primary-400" />
                    </div>
                    <button onClick={startConnectionTest}
                      className="mx-auto flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-primary-500 text-white font-bold text-sm shadow-lg shadow-primary-200">
                      <RefreshCw size={16} />
                      {isAr ? 'بدء الاختبار (30 ث)' : 'Lancer le test (30s)'}
                    </button>
                    <p className="text-xs text-slate-400 mt-2">{isAr ? 'IMEI: ' : 'IMEI : '}{imei}</p>
                  </div>
                )}

                {testStatus === 'checking' && (
                  <div className="space-y-4">
                    <div className="w-24 h-24 rounded-full bg-primary-50 flex items-center justify-center mx-auto">
                      <Loader2 size={40} className="text-primary-400 animate-spin" />
                    </div>
                    <p className="text-primary-500 font-bold">{isAr ? 'جاري البحث عن الجهاز...' : 'Recherche de l\'appareil...'}</p>
                    <p className="text-xs text-slate-400">{isAr ? 'قد يستغرق حتى 30 ثانية' : 'Peut prendre jusqu\'à 30 secondes'}</p>
                  </div>
                )}

                {testStatus === 'found' && (
                  <div className="space-y-4">
                    <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                      <CheckCircle2 size={40} className="text-emerald-500" />
                    </div>
                    <p className="text-emerald-600 font-black text-lg">{isAr ? '✅ الجهاز متصل!' : '✅ Appareil connecté !'}</p>
                    {testData?.lastUpdate && (
                      <p className="text-xs text-slate-400">
                        {isAr ? 'آخر إشارة: ' : 'Dernier signal : '}
                        {new Date(testData.lastUpdate).toLocaleString(isAr ? 'ar-MA' : 'fr-FR')}
                      </p>
                    )}
                  </div>
                )}

                {testStatus === 'registered' && (
                  <div className="space-y-4">
                    <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                      <Wifi size={40} className="text-amber-500" />
                    </div>
                    <p className="text-amber-600 font-black text-lg">
                      {isAr ? 'تم تسجيل الجهاز، بانتظار أول إشارة' : 'Appareil enregistré, en attente du premier signal'}
                    </p>
                    <p className="text-xs text-slate-500 text-center max-w-sm mx-auto">
                      {testData?.traccarRegistered
                        ? (isAr
                          ? 'ظهر الجهاز في Traccar، لكنه لم يرسل موقعاً صالحاً بعد. شغّل بيانات SIM واتركه في مكان مفتوح حتى يثبت GPS.'
                          : 'L’appareil apparaît dans Traccar, mais n’a pas encore envoyé de position valide. Activez les données SIM et placez-le à ciel ouvert pour obtenir le GPS.')
                        : (isAr
                          ? 'تم حفظ الجهاز في النظام، لكن لم يظهر اتصال منه في Traccar بعد. أعد إرسال APN وSERVER، وتأكد من GPRS ومن المنفذ 5023.'
                          : 'L’appareil est enregistré dans l’application, mais Traccar n’a pas encore reçu sa connexion. Renvoyez APN et SERVER et vérifiez GPRS et le port 5023.')}
                    </p>
                    {testData?.lastUpdate && (
                      <p className="text-xs text-slate-400">
                        {isAr ? 'آخر اتصال معروف: ' : 'Dernière communication connue : '}
                        {new Date(testData.lastUpdate).toLocaleString(isAr ? 'ar-MA' : 'fr-FR')}
                      </p>
                    )}
                    <button onClick={startConnectionTest}
                      className="mx-auto flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold">
                      <RefreshCw size={14} />
                      {isAr ? 'إعادة الفحص' : 'Vérifier à nouveau'}
                    </button>
                  </div>
                )}

                {testStatus === 'not_found' && (
                  <div className="space-y-4">
                    <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                      <AlertCircle size={40} className="text-red-400" />
                    </div>
                    <p className="text-red-500 font-black">{isAr ? 'لم يتصل الجهاز بعد' : 'Appareil non détecté'}</p>
                    <p className="text-xs text-slate-400 text-center">{isAr ? 'تأكد من إرسال أوامر SMS وبطاقة SIM نشطة' : 'Vérifiez les commandes SMS et que la SIM est active'}</p>
                    <button onClick={startConnectionTest}
                      className="mx-auto flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold">
                      <RefreshCw size={14} />
                      {isAr ? 'إعادة المحاولة' : 'Réessayer'}
                    </button>
                  </div>
                )}

                <div className="mt-6 text-xs text-slate-300 text-center">
                  {isAr ? 'يمكن تخطي هذه الخطوة والمتابعة' : 'Vous pouvez ignorer cette étape et continuer'}
                </div>
              </div>
            )}

            {/* ── Step 5: Confirmation ── */}
            {step === 5 && savedDevice && (
              <div className="text-center py-4">
                <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={48} className="text-emerald-500" />
                </div>
                <h2 className="font-black text-primary-500 text-xl mb-2">{isAr ? 'تم التركيب بنجاح! 🎉' : 'Installation réussie ! 🎉'}</h2>
                <p className="text-slate-400 text-sm mb-6">{isAr ? 'تم حفظ الجهاز وربطه بالنظام' : 'L\'appareil a été enregistré et lié au système'}</p>

                <div className="bg-slate-50 rounded-2xl p-4 text-start mb-6">
                  {[
                    { label: isAr ? 'الاسم' : 'Nom', val: savedDevice.name },
                    { label: 'IMEI', val: savedDevice.imei },
                    { label: isAr ? 'النوع' : 'Type', val: deviceType?.label },
                    { label: isAr ? 'الأجهزة' : 'Plaque', val: plate || '—' },
                    { label: isAr ? 'العميل' : 'Client', val: (clientList || []).find(c => String(c.id) === String(clientId))?.name || (isAr ? 'غير محدد' : 'Non assigné') },
                    { label: isAr ? 'الاشتراك' : 'Abonnement', val: savedDevice.subscriptionPlanId || subscriptionPlanId },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <span className="text-xs text-slate-400">{row.label}</span>
                      <span className="text-xs font-bold text-primary-500">{row.val}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => navigate('/admin/devices')}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary-500 text-white font-bold text-sm shadow-lg shadow-primary-200">
                    <MapPin size={16} />
                    {isAr ? 'رؤية الخريطة' : 'Voir la carte'}
                  </button>
                   <button onClick={() => { setStep(0); setDeviceType(null); setImei(''); setImeiValid(null); setName(''); setPlate(''); setClientId(''); setSubscriptionPlanId('3_months'); setTestStatus(null); setTestData(null); setSavedDevice(null); setError('') }}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white border-2 border-gray-200 text-slate-600 font-bold text-sm hover:bg-gray-50">
                    <Cpu size={16} />
                    {isAr ? 'إضافة جهاز آخر' : 'Ajouter un autre'}
                  </button>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* ── Navigation Buttons ── */}
        {step < 5 && (
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100">
            <button onClick={() => step === 0 ? navigate('/admin') : setStep(s => s - 1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-slate-600 text-sm font-semibold hover:bg-gray-50">
              <ChevronLeft size={16} />
              {isAr ? 'رجوع' : 'Retour'}
            </button>

            <button onClick={goNext} disabled={!canNext() || saving}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                canNext() && !saving
                  ? 'bg-primary-500 text-white shadow-md shadow-primary-200 hover:bg-primary-600'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
              {saving
                ? <><Loader2 size={15} className="animate-spin" />{isAr ? 'جاري الحفظ...' : 'Enregistrement...'}</>
                : step === 4
                  ? <><CheckCircle2 size={15} />{isAr ? 'حفظ الجهاز' : 'Enregistrer'}</>
                  : <>{isAr ? 'التالي' : 'Suivant'}<ChevronRight size={16} /></>
              }
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
