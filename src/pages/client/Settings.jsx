import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Lock, Globe, Moon, Bell, Volume2, LogOut, Eye, EyeOff,
  Users, Plus, Trash2, X, CheckCircle, Info
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import ConfirmModal  from '../../components/ConfirmModal'

const TABS = [
  { key: 'profile',   Icon: User,  ar: 'الملف',       fr: 'Profil'      },
  { key: 'password',  Icon: Lock,  ar: 'كلمة المرور', fr: 'Mot de passe'},
  { key: 'appear',    Icon: Moon,  ar: 'المظهر',       fr: 'Apparence'   },
  { key: 'subusers',  Icon: Users, ar: 'المستخدمون',  fr: 'Utilisateurs' },
]

function Toggle({ checked, onChange, isAr = false }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`relative inline-flex items-center flex-shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-indigo-600' : 'bg-slate-200'}`}
      style={{ width: 46, height: 26 }}>
      <span className="inline-block w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? `translateX(${isAr ? -20 : 20}px)` : 'translateX(2px)' }}/>
    </button>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  )
}

function DarkInput({ value, onChange, type = 'text', placeholder = '' }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all"
    />
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { clientAuth, logoutClient, lang, setLang, darkMode, toggleDarkMode, pushEnabled, requestPushPermission, disablePush, wsConnected, updateUserInContext } = useApp()
  const [tab, setTab] = useState('profile')
  const isAr = lang === 'ar'

  const [name, setName]   = useState(clientAuth?.name || '')
  const [email, setEmail] = useState(clientAuth?.email || '')
  const [profMsg, setProfMsg] = useState('')
  const [savingProf, setSavingProf] = useState(false)

  const [curPass, setCurPass]   = useState('')
  const [newPass, setNewPass]   = useState('')
  const [confPass, setConfPass] = useState('')
  const [showP, setShowP]       = useState(false)
  const [passMsg, setPassMsg]   = useState('')
  const [savingPass, setSavingPass] = useState(false)

  const [subUsers, setSubUsers]     = useState([])
  const [loadingSub, setLoadingSub] = useState(false)
  const [showAdd, setShowAdd]       = useState(false)
  const [newUser, setNewUser]       = useState({ name:'', email:'', password:'', role:'viewer' })
  const [savingSub, setSavingSub]   = useState(false)
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', danger: false, onConfirm: () => {} })

  const openConfirm = ({ title, message, danger = false, onConfirm }) =>
    setConfirmModal({ open: true, title, message, danger, onConfirm })
  const closeConfirm = () => setConfirmModal(m => ({ ...m, open: false }))

  const [subErr, setSubErr] = useState('')
  const [subLoadErr, setSubLoadErr] = useState('')
  const showSubErr = (msg) => { setSubErr(msg); setTimeout(() => setSubErr(''), 4000) }
  const [speedLimit, setSpeedLimit] = useState(() => {
    const stored = Number(localStorage.getItem('athargps_speed_limit'))
    return Number.isFinite(stored) && stored >= 30 && stored <= 160 ? stored : 80
  })
  const [settingsMsg, setSettingsMsg] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('athargps_sound') !== 'false')
  const safeSubUsers = Array.isArray(subUsers) ? subUsers : []

  useEffect(() => {
    if (tab === 'subusers') loadSubUsers()
  }, [tab])

  async function loadSubUsers() {
    setLoadingSub(true); setSubLoadErr('')
    try {
      const result = await api.subUsers.list()
      setSubUsers(Array.isArray(result) ? result : [])
    }
    catch { setSubLoadErr(isAr ? 'تعذّر تحميل المستخدمين. حاول مرة أخرى.' : 'Impossible de charger les utilisateurs. Réessayez.') }
    finally { setLoadingSub(false) }
  }

  async function saveProfile(e) {
    e.preventDefault(); setSavingProf(true); setProfMsg('')
    try {
      const result = await api.auth.updateProfile({ name, email })
      if (result?.user) {
        updateUserInContext(result.user)
        setName(result.user.name || name)
        setEmail(result.user.email || email)
      }
      setProfMsg(isAr ? 'تم الحفظ ✓' : 'Enregistré ✓')
    } catch (err) { setProfMsg(err?.message || (isAr ? 'تعذّر الحفظ' : 'Enregistrement impossible')) }
    finally { setSavingProf(false) }
  }

  async function savePassword(e) {
    e.preventDefault(); setPassMsg('')
    if (newPass !== confPass) { setPassMsg(isAr ? 'كلمتا المرور لا تتطابقان' : 'Les mots de passe ne correspondent pas'); return }
    if (newPass.length < 8) { setPassMsg(isAr ? 'كلمة المرور قصيرة جداً (8 أحرف)' : 'Mot de passe trop court (8 car.)'); return }
    setSavingPass(true)
    try {
      await api.auth.changePassword(curPass, newPass)
      setPassMsg(isAr ? 'تم التغيير ✓' : 'Modifié ✓')
      setCurPass(''); setNewPass(''); setConfPass('')
    } catch (err) { setPassMsg(err?.message || (isAr ? 'تعذّر تغيير كلمة المرور' : 'Modification impossible')) }
    finally { setSavingPass(false) }
  }

  async function addSubUser(e) {
    e.preventDefault(); setSavingSub(true)
    try {
      await api.subUsers.create(newUser)
      setShowAdd(false); setNewUser({ name:'', email:'', password:'', role:'viewer' }); loadSubUsers()
    } catch (err) { showSubErr(err?.message || (isAr ? 'تعذّرت الإضافة' : 'Ajout impossible')) }
    finally { setSavingSub(false) }
  }

  async function removeSubUser(id) {
    openConfirm({
      title:     isAr ? 'حذف المستخدم' : "Supprimer l'utilisateur",
      message:   isAr ? 'هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.'
                      : 'Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.',
      danger:    true,
      onConfirm: async () => {
        closeConfirm()
        try { await api.subUsers.remove(id); loadSubUsers() } catch (e) { showSubErr(e?.message || (isAr ? 'تعذّر الحذف' : 'Suppression impossible')) }
      },
    })
  }

  async function handleLogout() {
    openConfirm({
      title:     isAr ? 'تسجيل الخروج' : 'Déconnexion',
      message:   isAr
        ? 'هل تريد تسجيل الخروج من ATHAR GPS؟ ستحتاج إلى كلمة المرور عند الدخول مرة أخرى.'
        : "Voulez-vous vous déconnecter d'ATHAR GPS ? Vous devrez saisir votre mot de passe pour revenir.",
      danger:    false,
      onConfirm: async () => {
        closeConfirm()
        await logoutClient()
        navigate('/client/login')
      },
    })
  }

  function saveAppearance() {
    localStorage.setItem('athargps_speed_limit', String(speedLimit))
    localStorage.setItem('athargps_sound', String(soundEnabled))
    setSettingsMsg(isAr ? 'تم حفظ الإعدادات ✓' : 'Paramètres enregistrés ✓')
    setTimeout(() => setSettingsMsg(''), 3000)
  }

  const inputStyle = { background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a' }
  const cardStyle  = { background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(15,23,42,.04)' }

  return (
    <div className="client-app min-h-screen bg-[#F5F6F8] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />

      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-indigo-600">
          {isAr ? 'تخصيص التجربة' : 'Personnalisez votre expérience'}
        </p>
        <h1 className="text-slate-900 font-extrabold text-xl mt-1">{t(lang,'settings')}</h1>
      </div>

      {/* Tab bar */}
      <div className="relative mb-1">
      <div className="flex gap-2 px-5 pb-4 overflow-x-auto" style={{ scrollbarWidth:'none', paddingInlineEnd: 28, scrollPaddingInline: 20 }}>
        {TABS.map(({ key, Icon, ar, fr }) => {
          const active = tab === key
          return (
            <motion.button key={key} whileTap={{ scale:0.94 }} onClick={() => setTab(key)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold transition-all"
              style={active
                ? { background:'#4f46e5', color:'#ffffff', border:'1px solid #4f46e5' }
                : { background:'#ffffff', color:'#64748b', border:'1px solid #e2e8f0' }}>
              <Icon size={12}/>{isAr ? ar : fr}
            </motion.button>
          )
        })}
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-7"
         style={{ [isAr ? 'left' : 'right']: 0, background: isAr ? 'linear-gradient(to right, #F5F6F8, transparent)' : 'linear-gradient(to left, #F5F6F8, transparent)' }}/>
      </div>

      <div className="px-5 space-y-4">
        {/* ── PROFILE ── */}
        {tab === 'profile' && (
          <motion.form key="prof" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} onSubmit={saveProfile}
            className="space-y-4 p-5 rounded-2xl" style={cardStyle}>
            <Field label={t(lang,'profile')}>
              <DarkInput value={name} onChange={e => setName(e.target.value)}/>
            </Field>
            <Field label={t(lang,'email')}>
              <DarkInput value={email} onChange={e => setEmail(e.target.value)} type="email"/>
            </Field>
            {email !== (clientAuth?.email || '') && (
              <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)' }}>
                <Info size={14} className="text-amber-500 flex-shrink-0 mt-0.5"/>
                <p className="text-xs text-amber-400 leading-relaxed">
                  {isAr ? 'تغيير البريد الإلكتروني سيؤثر على تسجيل الدخول. تأكد من صحة البريد قبل الحفظ.' : "Modifier l'email affectera votre connexion. Vérifiez l'adresse avant d'enregistrer."}
                </p>
              </div>
            )}
            {profMsg && <p className={`text-xs text-center ${profMsg.includes('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{profMsg}</p>}
            <motion.button type="submit" disabled={savingProf} whileTap={{ scale:0.97 }}
               className="w-full rounded-xl bg-indigo-600 py-3.5 font-bold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-indigo-700" aria-busy={savingProf}>
              {savingProf && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"/>}
              {savingProf ? (isAr?'جارٍ الحفظ...':'Enregistrement...') : t(lang,'save')}
            </motion.button>
          </motion.form>
        )}

        {/* ── PASSWORD ── */}
        {tab === 'password' && (
          <motion.form key="pass" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} onSubmit={savePassword}
            className="space-y-4 p-5 rounded-2xl" style={cardStyle}>
            {[
              { label: t(lang,'currentPassword'), val: curPass, set: setCurPass },
              { label: t(lang,'newPassword'),     val: newPass, set: setNewPass },
              { label: t(lang,'confirmPassword'), val: confPass, set: setConfPass },
            ].map((f,i) => (
              <Field key={i} label={f.label}>
                <div className="relative">
                  <input type={showP ? 'text' : 'password'} value={f.val} onChange={e => f.set(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-slate-900 text-sm outline-none"
                    style={{ ...inputStyle, paddingRight: isAr ? undefined : '3rem', paddingLeft: isAr ? '3rem' : undefined }}/>
                  {i === 0 && (
                    <button type="button" onClick={() => setShowP(p => !p)}
                      className="absolute top-1/2 -translate-y-1/2"
                       style={{ [isAr?'left':'right']:'1rem', color: '#64748b' }}>
                      {showP ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  )}
                </div>
              </Field>
            ))}
            {passMsg && <p className={`text-xs text-center ${passMsg.includes('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{passMsg}</p>}
            <motion.button type="submit" disabled={savingPass} whileTap={{ scale:0.97 }}
               className="w-full rounded-xl bg-indigo-600 py-3.5 font-bold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-indigo-700" aria-busy={savingPass}>
              {savingPass && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"/>}
              {savingPass ? (isAr?'جارٍ التغيير...':'Modification...') : (isAr ? 'تغيير كلمة المرور' : 'Changer le mot de passe')}
            </motion.button>
          </motion.form>
        )}

        {/* ── APPEARANCE ── */}
        {tab === 'appear' && (
          <motion.div key="appear" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }}
            className="space-y-4" >
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" style={{ padding: 0, overflow: 'hidden' }}>
            {[
              { Icon: Globe, label: isAr ? 'اللغة' : 'Langue', ctrl: (
                <div className="flex gap-2">
                  {['ar','fr'].map(l => (
                    <button key={l} onClick={() => setLang(l)}
                      className="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                      style={lang===l
                        ? { background:'#4f46e5', color:'#ffffff' }
                        : { background:'#f8fafc', color:'#64748b', border:'1px solid #e2e8f0' }}>
                      {l === 'ar' ? 'العربية' : 'Français'}
                    </button>
                  ))}
                </div>
              )},
               { Icon: Moon, label: isAr ? 'الوضع الداكن' : 'Mode sombre', ctrl: <Toggle checked={!!darkMode} isAr={isAr} onChange={toggleDarkMode}/> },
               { Icon: Bell, label: isAr ? 'الإشعارات الفورية' : 'Notifications push', ctrl: <Toggle checked={!!pushEnabled} isAr={isAr} onChange={v => v ? requestPushPermission() : disablePush()}/> },
               { Icon: Volume2, label: isAr ? 'تنبيه صوتي' : 'Alerte sonore', ctrl: <Toggle checked={soundEnabled} isAr={isAr} onChange={setSoundEnabled}/> },
            ].map(({ Icon, label, ctrl }, i, rows) => (
              <div key={i} className="flex items-center justify-between gap-4 px-4 py-4"
                style={{ borderBottom: i < rows.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-50">
                    <Icon size={16} className="text-indigo-600"/>
                  </span>
                  <span className="text-sm font-bold text-slate-900">{label}</span>
                </div>
                {ctrl}
              </div>
            ))}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-extrabold text-slate-900">{isAr ? 'حد السرعة' : 'Limite de vitesse'}</p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {isAr ? 'تنبيه عند تجاوز السرعة المحددة' : 'Alerte lorsque la vitesse est dépassée'}
                  </p>
                </div>
                <span className="ath-badge bg-indigo-50 text-indigo-600">
                  {speedLimit} {isAr ? 'كم/س' : 'km/h'}
                </span>
              </div>
              <div className="relative pt-2">
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(148,180,215,.14)' }}>
                  <div className="h-full rounded-full bg-indigo-600" style={{ width: `${((speedLimit - 30) / 130) * 100}%` }}/>
                </div>
                <input type="range" min="30" max="160" step="5" value={speedLimit}
                  onChange={e => setSpeedLimit(Number(e.target.value))}
                  aria-label={isAr ? 'حد السرعة' : 'Limite de vitesse'}
                  className="absolute inset-x-0 top-0 w-full opacity-0 cursor-pointer" style={{ height: 24 }}/>
                <div className="mt-2 flex justify-between text-[9px] text-slate-500">
                  <span>30 {isAr ? 'كم/س' : 'km/h'}</span>
                  <span>160 {isAr ? 'كم/س' : 'km/h'}</span>
                </div>
              </div>
            </div>

            {settingsMsg && (
              <p className="text-center text-xs font-bold text-indigo-600">{settingsMsg}</p>
            )}
            <motion.button type="button" whileTap={{ scale: .97 }} onClick={saveAppearance}
              className="ath-btn-solid flex items-center justify-center gap-2">
              <CheckCircle size={16}/>
              {isAr ? 'حفظ الإعدادات' : 'Enregistrer les paramètres'}
            </motion.button>
          </motion.div>
        )}

        {/* ── SUB-USERS ── */}
        {tab === 'subusers' && (
          <motion.div key="sub" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold tracking-wide uppercase text-slate-500">
                {isAr ? 'المستخدمون الفرعيون' : 'Sous-utilisateurs'}
              </p>
               <motion.button whileTap={{ scale:0.9 }} onClick={() => setShowAdd(true)}
                  className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600">
                <Plus size={13}/>{isAr ? 'إضافة' : 'Ajouter'}
              </motion.button>
            </div>

            {loadingSub ? (
              <div className="flex justify-center py-8">
                <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor:'#d9ad62', borderTopColor:'transparent' }}/>
              </div>
            ) : subLoadErr ? (
              <div className="p-5 rounded-2xl text-center" style={cardStyle}>
                <p className="text-xs text-red-400 mb-3">{subLoadErr}</p>
                  <button onClick={loadSubUsers}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">
                  {isAr?'إعادة المحاولة':'Réessayer'}
                </button>
              </div>
            ) : safeSubUsers.length === 0 ? (
              <div className="p-6 rounded-2xl text-center" style={cardStyle}>
                <Users size={28} className="mx-auto mb-2 text-slate-300"/>
                <p className="text-sm text-slate-500">{isAr ? 'لا يوجد مستخدمون فرعيون' : 'Aucun sous-utilisateur'}</p>
              </div>
            ) : safeSubUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-4 rounded-2xl" style={cardStyle}>
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50">
                  <span className="text-sm font-bold text-indigo-600">{(u.name||'?')[0].toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 font-bold text-sm truncate">{u.name}</p>
                  <p className="truncate text-xs text-slate-500">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                   <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-600">{u.role || 'viewer'}</span>
                  <button onClick={() => removeSubUser(u.id)}><Trash2 size={14} style={{ color:'rgba(255,59,48,0.6)' }}/></button>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Logout */}
        <motion.button whileTap={{ scale:0.97 }} onClick={handleLogout}
          className="w-full py-3.5 rounded-xl font-semibold text-sm mt-4"
          style={{ background:'rgba(255,59,48,0.1)', color:'#FF3B30', border:'1px solid rgba(255,59,48,0.2)' }}>
          {t(lang,'logout')}
        </motion.button>
      </div>

      {/* Add sub-user sheet */}
      <AnimatePresence>
        {showAdd && (
          <motion.div className="fixed inset-0 z-50 flex items-end" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            <div className="absolute inset-0" style={{ background:'rgba(0,0,0,0.7)' }} onClick={() => setShowAdd(false)}/>
            <motion.div
              initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }} transition={{ type:'spring', stiffness:300, damping:30 }}
               className="relative w-full rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-slate-900 font-extrabold text-base">{isAr ? 'إضافة مستخدم' : 'Ajouter utilisateur'}</h3>
                <button onClick={() => setShowAdd(false)} aria-label={isAr ? 'إغلاق' : 'Fermer'}>
                  <X size={20} className="text-slate-500"/>
                </button>
              </div>
              <form onSubmit={addSubUser} className="space-y-3">
                {[
                  { key:'name',     label: isAr?'الاسم':'Nom',              type:'text'     },
                  { key:'email',    label: isAr?'البريد الإلكتروني':'Email', type:'email'    },
                  { key:'password', label: isAr?'كلمة المرور':'Mot de passe', type:'password'},
                ].map(f => (
                  <div key={f.key}>
                    <label className="mb-1 block text-xs font-bold text-slate-500">{f.label}</label>
                    <input type={f.type} value={newUser[f.key]} onChange={e => setNewUser(u => ({ ...u, [f.key]:e.target.value }))}
                      className="w-full rounded-xl px-4 py-3 text-slate-900 text-sm outline-none"
                      style={inputStyle}/>
                  </div>
                ))}
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">{isAr?'الدور':'Rôle'}</label>
                  <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role:e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-slate-900 text-sm outline-none"
                    style={inputStyle}>
                    <option value="viewer">{isAr?'مشاهد':'Lecteur'}</option>
                    <option value="manager">{isAr?'مدير':'Manager'}</option>
                    <option value="reports">{isAr?'تقارير فقط':'Rapports uniquement'}</option>
                    <option value="alerts">{isAr?'تنبيهات فقط':'Alertes uniquement'}</option>
                  </select>
                </div>
                <motion.button type="submit" disabled={savingSub} whileTap={{ scale:0.97 }}
                   className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white">
                  {savingSub ? '...' : (isAr?'إضافة':'Ajouter')}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {subErr && (
        <div className="fixed bottom-24 left-4 right-4 z-50 rounded-2xl px-4 py-3 text-sm font-medium text-center shadow-lg"
          style={{ background:'rgba(255,59,48,0.15)', border:'1px solid rgba(255,59,48,0.3)', color:'#FF6B60' }}>
          {subErr}
        </div>
      )}
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
      />
      <ClientNav/>
    </div>
  )
}
