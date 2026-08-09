import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Lock, Globe, Moon, Bell, LogOut, Eye, EyeOff,
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

function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="relative inline-flex items-center flex-shrink-0 rounded-full transition-colors duration-200"
      style={{ width: 44, height: 24, background: checked ? '#38d39f' : 'rgba(255,255,255,0.15)' }}>
      <span className="inline-block w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}/>
    </button>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold tracking-wide mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</label>
      {children}
    </div>
  )
}

function DarkInput({ value, onChange, type = 'text', placeholder = '' }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none transition-all"
      style={{ background: 'rgba(7,17,31,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#ffffff' }}
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

  useEffect(() => {
    if (tab === 'subusers') loadSubUsers()
  }, [tab])

  async function loadSubUsers() {
    setLoadingSub(true); setSubLoadErr('')
    try { setSubUsers((await api.subUsers.list()) || []) }
    catch (e) { setSubLoadErr(isAr ? 'تعذّر تحميل المستخدمين. حاول مرة أخرى.' : 'Impossible de charger les utilisateurs. Réessayez.') }
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
    } catch (err) { setProfMsg(err.message) }
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
    } catch (err) { setPassMsg(err.message) }
    finally { setSavingPass(false) }
  }

  async function addSubUser(e) {
    e.preventDefault(); setSavingSub(true)
    try {
      await api.subUsers.create(newUser)
      setShowAdd(false); setNewUser({ name:'', email:'', password:'', role:'viewer' }); loadSubUsers()
    } catch (err) { showSubErr(err.message) }
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
        try { await api.subUsers.remove(id); loadSubUsers() } catch (e) { showSubErr(e.message) }
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

  const inputStyle = { background: 'rgba(7,17,31,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#ffffff' }
  const cardStyle  = { background: 'rgba(14,32,53,0.85)', border: '1px solid rgba(255,255,255,0.08)' }

  return (
    <div className="client-app min-h-screen bg-[#07111f] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />

      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-white font-extrabold text-xl">{t(lang,'settings')}</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5 px-5 pb-4 overflow-x-auto" style={{ scrollbarWidth:'none' }}>
        {TABS.map(({ key, Icon, ar, fr }) => {
          const active = tab === key
          return (
            <motion.button key={key} whileTap={{ scale:0.94 }} onClick={() => setTab(key)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all"
              style={active
                ? { background:'#38d39f', color:'#07111f' }
                : { background:'rgba(14,32,53,0.85)', color:'rgba(255,255,255,0.6)', border:'1px solid rgba(255,255,255,0.08)' }}>
              <Icon size={12}/>{isAr ? ar : fr}
            </motion.button>
          )
        })}
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
              className="w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background:'#38d39f', color:'#07111f' }} aria-busy={savingProf}>
              {savingProf && <span className="w-4 h-4 rounded-full border-2 border-[#07111f] border-t-transparent animate-spin"/>}
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
                    className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none"
                    style={{ ...inputStyle, paddingRight: isAr ? undefined : '3rem', paddingLeft: isAr ? '3rem' : undefined }}/>
                  {i === 0 && (
                    <button type="button" onClick={() => setShowP(p => !p)}
                      className="absolute top-1/2 -translate-y-1/2"
                      style={{ [isAr?'left':'right']:'1rem', color: 'rgba(255,255,255,0.4)' }}>
                      {showP ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  )}
                </div>
              </Field>
            ))}
            {passMsg && <p className={`text-xs text-center ${passMsg.includes('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{passMsg}</p>}
            <motion.button type="submit" disabled={savingPass} whileTap={{ scale:0.97 }}
              className="w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background:'#38d39f', color:'#07111f' }} aria-busy={savingPass}>
              {savingPass && <span className="w-4 h-4 rounded-full border-2 border-[#07111f] border-t-transparent animate-spin"/>}
              {savingPass ? (isAr?'جارٍ التغيير...':'Modification...') : (isAr ? 'تغيير كلمة المرور' : 'Changer le mot de passe')}
            </motion.button>
          </motion.form>
        )}

        {/* ── APPEARANCE ── */}
        {tab === 'appear' && (
          <motion.div key="appear" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }}
            className="space-y-3 p-5 rounded-2xl" style={cardStyle}>
            {[
              { Icon: Globe, label: isAr ? 'اللغة' : 'Langue', ctrl: (
                <div className="flex gap-2">
                  {['ar','fr'].map(l => (
                    <button key={l} onClick={() => setLang(l)}
                      className="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                      style={lang===l
                        ? { background:'#38d39f', color:'#07111f' }
                        : { background:'rgba(7,17,31,0.6)', color:'rgba(255,255,255,0.6)', border:'1px solid rgba(255,255,255,0.1)' }}>
                      {l === 'ar' ? 'العربية' : 'Français'}
                    </button>
                  ))}
                </div>
              )},
              { Icon: Moon, label: isAr ? 'الوضع الليلي' : 'Mode sombre', ctrl: <Toggle checked={!!darkMode} onChange={toggleDarkMode}/> },
              { Icon: Bell, label: isAr ? 'الإشعارات' : 'Notifications', ctrl: <Toggle checked={!!pushEnabled} onChange={v => v ? requestPushPermission() : disablePush()}/> },
            ].map(({ Icon, label, ctrl }, i) => (
              <div key={i} className="flex items-center justify-between py-2"
                style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div className="flex items-center gap-2.5">
                  <Icon size={16} style={{ color: 'rgba(255,255,255,0.45)' }}/>
                  <span className="text-white text-sm">{label}</span>
                </div>
                {ctrl}
              </div>
            ))}
          </motion.div>
        )}

        {/* ── SUB-USERS ── */}
        {tab === 'subusers' && (
          <motion.div key="sub" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold tracking-wide uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {isAr ? 'المستخدمون الفرعيون' : 'Sous-utilisateurs'}
              </p>
              <motion.button whileTap={{ scale:0.9 }} onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background:'rgba(56,211,159,0.12)', color:'#38d39f', border:'1px solid rgba(56,211,159,0.3)' }}>
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
                  className="text-xs font-bold px-4 py-2 rounded-xl"
                  style={{ background:'#38d39f', color:'#07111f' }}>
                  {isAr?'إعادة المحاولة':'Réessayer'}
                </button>
              </div>
            ) : subUsers.length === 0 ? (
              <div className="p-6 rounded-2xl text-center" style={cardStyle}>
                <Users size={28} className="mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.2)' }}/>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{isAr ? 'لا يوجد مستخدمون فرعيون' : 'Aucun sous-utilisateur'}</p>
              </div>
            ) : subUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-4 rounded-2xl" style={cardStyle}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background:'rgba(56,211,159,0.1)' }}>
                  <span className="text-sm font-bold" style={{ color: '#38d39f' }}>{(u.name||'?')[0].toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{u.name}</p>
                  <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
                    style={{ background:'rgba(56,211,159,0.1)', color:'#38d39f' }}>{u.role || 'viewer'}</span>
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
              className="relative w-full rounded-t-3xl p-5"
              style={{ background:'#0e2035', border:'1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-extrabold text-base">{isAr ? 'إضافة مستخدم' : 'Ajouter utilisateur'}</h3>
                <button onClick={() => setShowAdd(false)} aria-label={isAr ? 'إغلاق' : 'Fermer'}>
                  <X size={20} style={{ color: 'rgba(255,255,255,0.5)' }}/>
                </button>
              </div>
              <form onSubmit={addSubUser} className="space-y-3">
                {[
                  { key:'name',     label: isAr?'الاسم':'Nom',              type:'text'     },
                  { key:'email',    label: isAr?'البريد الإلكتروني':'Email', type:'email'    },
                  { key:'password', label: isAr?'كلمة المرور':'Mot de passe', type:'password'},
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs mb-1 font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>{f.label}</label>
                    <input type={f.type} value={newUser[f.key]} onChange={e => setNewUser(u => ({ ...u, [f.key]:e.target.value }))}
                      className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none"
                      style={inputStyle}/>
                  </div>
                ))}
                <div>
                  <label className="block text-xs mb-1 font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>{isAr?'الدور':'Rôle'}</label>
                  <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role:e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none"
                    style={inputStyle}>
                    <option value="viewer">{isAr?'مشاهد':'Lecteur'}</option>
                    <option value="manager">{isAr?'مدير':'Manager'}</option>
                    <option value="reports">{isAr?'تقارير فقط':'Rapports uniquement'}</option>
                    <option value="alerts">{isAr?'تنبيهات فقط':'Alertes uniquement'}</option>
                  </select>
                </div>
                <motion.button type="submit" disabled={savingSub} whileTap={{ scale:0.97 }}
                  className="w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-50"
                  style={{ background:'#38d39f', color:'#07111f' }}>
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
