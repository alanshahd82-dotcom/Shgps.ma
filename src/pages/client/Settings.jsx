import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Lock, Globe, Moon, Bell, Shield, LogOut, ChevronRight,
  CheckCircle, Eye, EyeOff, Wifi, WifiOff, Users, Plus, Trash2,
  X, AlertTriangle, Info
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import { PageHeader, Card, Section, SectionTitle } from '../../components/ui'

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className="relative inline-flex items-center flex-shrink-0 rounded-full transition-colors duration-200"
      style={{
        width: 44, height: 24,
        background: checked ? '#00D97E' : '#e2e8f0',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        className="inline-block w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  )
}

// ── Tab button ────────────────────────────────────────────────────────────────
function TabBtn({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl flex-shrink-0 text-[10px] font-semibold transition-all"
      style={{
        background: active ? 'rgba(15,32,68,0.08)' : 'transparent',
        color:      active ? '#0F2044' : '#94a3b8',
      }}
    >
      <Icon size={16} strokeWidth={active ? 2.5 : 1.8} />
      {label}
    </button>
  )
}

// ── Row item ──────────────────────────────────────────────────────────────────
function SettingRow({ icon: Icon, iconColor = '#0F2044', label, sublabel, right, onClick }) {
  const base = 'flex items-center gap-3 py-3.5 px-4'
  const cls  = onClick ? `${base} cursor-pointer active:bg-gray-50 dark:active:bg-slate-700 transition-colors` : base
  return (
    <div className={cls} onClick={onClick}>
      <div
        className="w-9 h-9 rounded-2xl flex-shrink-0 flex items-center justify-center"
        style={{ background: `${iconColor}15` }}
      >
        <Icon size={17} style={{ color: iconColor }} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary-500 dark:text-white">{label}</p>
        {sublabel && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sublabel}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-gray-100 dark:bg-slate-700 mx-4" />
}

// ══ Profile tab ═══════════════════════════════════════════════════════════════
function ProfileTab({ lang, clientAuth, updateUserInContext }) {
  const isAr = lang === 'ar'
  const [form,    setForm]    = useState({ name: clientAuth?.name || '', phone: clientAuth?.phone || '' })
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState(false)
  const [err,     setErr]     = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setErr(isAr ? 'الاسم مطلوب' : 'Nom requis'); return }
    setSaving(true); setErr('')
    try {
      await api.auth.updateProfile({ name: form.name.trim(), phone: form.phone.trim() })
      updateUserInContext({ name: form.name.trim(), phone: form.phone.trim() })
      setSuccess(true); setTimeout(() => setSuccess(false), 2500)
    } catch (ex) { setErr(ex.message) }
    finally { setSaving(false) }
  }

  const inputCls = 'w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-sm text-primary-500 dark:text-white placeholder-slate-400 outline-none focus:border-accent transition-colors'

  return (
    <form onSubmit={handleSave} className="space-y-4 px-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{t(lang, 'name')}</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder={isAr ? 'اسمك الكامل' : 'Nom complet'} className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{t(lang, 'email')}</label>
        <input value={clientAuth?.email || ''} disabled className={`${inputCls} opacity-50 cursor-not-allowed`} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{t(lang, 'phone')}</label>
        <input value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" placeholder="+212 6xx xxxxxx" dir="ltr" className={inputCls} />
      </div>
      {err     && <p className="text-xs text-red-500">{err}</p>}
      {success && <p className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold"><CheckCircle size={13} />{t(lang, 'success')}</p>}
      <button type="submit" disabled={saving}
        className="w-full py-3.5 bg-accent text-slate-900 rounded-2xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-60">
        {saving ? (isAr ? 'جاري الحفظ...' : 'Enregistrement…') : t(lang, 'save')}
      </button>
    </form>
  )
}

// ══ Password tab ══════════════════════════════════════════════════════════════
function PasswordTab({ lang }) {
  const isAr = lang === 'ar'
  const [form,    setForm]    = useState({ current: '', newPwd: '', confirm: '' })
  const [show,    setShow]    = useState({ current: false, new: false, confirm: false })
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState(false)
  const [err,     setErr]     = useState('')
  const set  = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const flip = (k)    => setShow(p => ({ ...p, [k]: !p[k] }))

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.current || !form.newPwd || !form.confirm) { setErr(isAr ? 'جميع الحقول مطلوبة' : 'Tous les champs requis'); return }
    if (form.newPwd.length < 8) { setErr(isAr ? 'يجب أن تكون 8 أحرف على الأقل' : 'Minimum 8 caractères'); return }
    if (form.newPwd !== form.confirm) { setErr(isAr ? 'كلمتا المرور غير متطابقتين' : 'Mots de passe différents'); return }
    setSaving(true); setErr('')
    try {
      await api.auth.changePassword(form.current, form.newPwd)
      setSuccess(true); setForm({ current: '', newPwd: '', confirm: '' })
      setTimeout(() => setSuccess(false), 3000)
    } catch (ex) { setErr(isAr ? 'كلمة المرور الحالية غير صحيحة' : 'Mot de passe actuel incorrect') }
    finally { setSaving(false) }
  }

  const inputCls = 'flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-sm text-primary-500 dark:text-white placeholder-slate-400 outline-none focus:border-accent transition-colors'

  const PwdField = ({ fkey, label, showKey }) => (
    <div>
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input type={show[showKey] ? 'text' : 'password'} value={form[fkey]}
          onChange={e => set(fkey, e.target.value)} className={inputCls}
          placeholder="••••••••" autoComplete={fkey === 'current' ? 'current-password' : 'new-password'} />
        <button type="button" onClick={() => flip(showKey)} tabIndex={-1}
          className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-slate-700 flex items-center justify-center text-slate-400">
          {show[showKey] ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  )

  return (
    <form onSubmit={handleSave} className="space-y-4 px-4">
      <PwdField fkey="current" label={t(lang, 'currentPassword')} showKey="current" />
      <PwdField fkey="newPwd"  label={t(lang, 'newPassword')}     showKey="new"     />
      <PwdField fkey="confirm" label={t(lang, 'confirmPassword')} showKey="confirm" />
      {err     && <p className="text-xs text-red-500">{err}</p>}
      {success && <p className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold"><CheckCircle size={13} />{t(lang, 'passwordChanged')}</p>}
      <button type="submit" disabled={saving}
        className="w-full py-3.5 bg-accent text-slate-900 rounded-2xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-60">
        {saving ? (isAr ? 'جاري الحفظ...' : 'Enregistrement…') : t(lang, 'save')}
      </button>
    </form>
  )
}

// ══ Appearance & Language tab ═════════════════════════════════════════════════
function AppearanceTab({ lang, setLang, darkMode, toggleDarkMode, pushEnabled, requestPushPermission, disablePush, wsConnected }) {
  const isAr = lang === 'ar'
  const [pushLoading, setPushLoading] = useState(false)

  const handlePushToggle = async (val) => {
    if (!val) { disablePush(); return }
    setPushLoading(true)
    const result = await requestPushPermission()
    setPushLoading(false)
    if (result === 'denied') alert(isAr ? 'تم رفض إذن الإشعارات من إعدادات المتصفح' : 'Permission refusée dans les paramètres du navigateur')
  }

  return (
    <div className="space-y-2">
      <Card className="!p-0 overflow-hidden">
        <SettingRow
          icon={Moon} iconColor="#6366f1"
          label={t(lang, 'darkMode')}
          sublabel={t(lang, 'darkModeDesc')}
          right={<Toggle checked={darkMode} onChange={toggleDarkMode} />}
        />
        <Divider />
        <SettingRow
          icon={Bell} iconColor="#f59e0b"
          label={t(lang, 'enablePush')}
          sublabel={pushEnabled
            ? (isAr ? 'الإشعارات مفعّلة' : 'Notifications activées')
            : (isAr ? 'ستصلك تنبيهات فورية' : 'Notifications en temps réel')}
          right={<Toggle checked={pushEnabled} onChange={handlePushToggle} disabled={pushLoading} />}
        />
        <Divider />
        <SettingRow
          icon={wsConnected ? Wifi : WifiOff}
          iconColor={wsConnected ? '#22c55e' : '#94a3b8'}
          label={isAr ? 'WebSocket' : 'WebSocket'}
          sublabel={wsConnected
            ? (isAr ? 'متصل — تحديث مباشر نشط' : 'Connecté — mise à jour en temps réel')
            : (isAr ? 'جاري إعادة الاتصال...' : 'Reconnexion...')}
        />
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">{t(lang, 'languageSelect')}</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { code: 'ar', label: 'العربية', sub: 'Arabic (RTL)' },
              { code: 'fr', label: 'Français', sub: 'French (LTR)' },
            ].map(l => (
              <button key={l.code} type="button" onClick={() => setLang(l.code)}
                className="flex flex-col items-center gap-1 py-3.5 rounded-2xl font-semibold text-sm transition-all"
                style={{
                  background: lang === l.code ? '#0F2044'   : 'rgba(241,245,249,1)',
                  color:      lang === l.code ? 'white'     : '#64748b',
                  border:     lang === l.code ? '2px solid transparent' : '2px solid #e2e8f0',
                }}
              >
                <span className="text-xl leading-none">{l.label}</span>
                <span className="text-[9px] opacity-70 font-normal">{l.sub}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}

// ══ Sub-users tab ═════════════════════════════════════════════════════════════
function SubUsersTab({ lang }) {
  const isAr = lang === 'ar'
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer' })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const ROLES = [
    { key: 'manager',  ar: 'مدير',     fr: 'Gestionnaire' },
    { key: 'viewer',   ar: 'مشاهد',    fr: 'Observateur'  },
    { key: 'reports',  ar: 'تقارير',   fr: 'Rapports'     },
    { key: 'alerts',   ar: 'تنبيهات',  fr: 'Alertes'      },
  ]

  const loadUsers = async () => {
    setLoading(true)
    try { setUsers(await api.subUsers.list()) }
    catch { setUsers([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadUsers() }, []) // eslint-disable-line

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) { setErr(isAr ? 'جميع الحقول مطلوبة' : 'Tous les champs requis'); return }
    setSaving(true); setErr('')
    try {
      const created = await api.subUsers.create(form)
      setUsers(prev => [...prev, created])
      setShowAdd(false)
      setForm({ name: '', email: '', password: '', role: 'viewer' })
    } catch (ex) { setErr(ex.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try { await api.subUsers.remove(id); setUsers(prev => prev.filter(u => u.id !== id)) }
    catch { /* ignore */ }
    finally { setDeleting(null) }
  }

  const roleLabel = (key) => {
    const r = ROLES.find(r => r.key === key)
    return r ? (isAr ? r.ar : r.fr) : key
  }

  const inputCls = 'w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-sm text-primary-500 dark:text-white placeholder-slate-400 outline-none focus:border-accent transition-colors'

  return (
    <div className="space-y-3 px-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {users.length} {isAr ? 'مستخدم فرعي' : 'utilisateur(s)'}
        </p>
        <button type="button" onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-slate-900 rounded-xl text-[11px] font-bold active:scale-95 transition-transform">
          <Plus size={12} strokeWidth={2.5} />
          {isAr ? 'إضافة' : 'Ajouter'}
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-3.5">
        <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
          {isAr
            ? 'المستخدمون الفرعيون يمكنهم الوصول لأجهزتك وفق الصلاحيات المحددة. تحكّم كامل في يدك.'
            : 'Les sous-utilisateurs accèdent à vos appareils selon leurs permissions.'}
        </p>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="border border-accent/30 !bg-accent/5">
              <form onSubmit={handleAdd} className="space-y-3">
                <p className="font-bold text-sm text-primary-500 dark:text-white">{isAr ? 'مستخدم جديد' : 'Nouvel utilisateur'}</p>
                <input value={form.name} onChange={e => setF('name', e.target.value)} placeholder={isAr ? 'الاسم' : 'Nom'} className={inputCls} />
                <input value={form.email} onChange={e => setF('email', e.target.value)} type="email" placeholder="email@example.com" dir="ltr" className={inputCls} />
                <input value={form.password} onChange={e => setF('password', e.target.value)} type="password" placeholder={isAr ? 'كلمة المرور' : 'Mot de passe'} className={inputCls} />
                <div className="grid grid-cols-2 gap-1.5">
                  {ROLES.map(r => (
                    <button key={r.key} type="button" onClick={() => setF('role', r.key)}
                      className="py-2 rounded-xl text-[11px] font-semibold transition-all"
                      style={{
                        background: form.role === r.key ? '#0F2044' : 'rgba(241,245,249,1)',
                        color:      form.role === r.key ? 'white'   : '#64748b',
                      }}
                    >
                      {isAr ? r.ar : r.fr}
                    </button>
                  ))}
                </div>
                {err && <p className="text-xs text-red-500">{err}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowAdd(false)}
                    className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm text-slate-500 font-semibold">
                    {t(lang, 'cancel')}
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 bg-accent text-slate-900 rounded-xl text-sm font-bold disabled:opacity-60">
                    {saving ? '...' : t(lang, 'save')}
                  </button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users list */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : users.length === 0 && !showAdd ? (
        <div className="text-center py-10">
          <Users size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" strokeWidth={1.2} />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{isAr ? 'لا مستخدمون فرعيون بعد' : 'Aucun sous-utilisateur'}</p>
        </div>
      ) : (
        <AnimatePresence>
          {users.map(u => (
            <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}>
              <Card className="!p-0">
                <div className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-primary-500 dark:text-white text-sm flex-shrink-0">
                    {(u.name || u.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary-500 dark:text-white text-sm truncate">{u.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                    <span className="inline-block px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[9px] font-bold mt-0.5">
                      {roleLabel(u.role)}
                    </span>
                  </div>
                  <button type="button"
                    onClick={() => handleDelete(u.id)}
                    disabled={deleting === u.id}
                    className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50">
                    <Trash2 size={13} className="text-red-500" />
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  )
}

// ══ Main ═══════════════════════════════════════════════════════════════════════
export default function Settings() {
  const navigate = useNavigate()
  const {
    clientAuth, lang, setLang,
    darkMode, toggleDarkMode,
    pushEnabled, requestPushPermission, disablePush,
    wsConnected, logoutClient, updateUserInContext,
  } = useApp()

  const isAr = lang === 'ar'
  const [activeTab,    setActiveTab]    = useState('profile')
  const [logoutModal,  setLogoutModal]  = useState(false)

  const TABS = [
    { key: 'profile',    icon: User,    ar: 'الملف',     fr: 'Profil'    },
    { key: 'password',   icon: Lock,    ar: 'الأمان',    fr: 'Sécurité'  },
    { key: 'appearance', icon: Moon,    ar: 'المظهر',    fr: 'Apparence' },
    { key: 'users',      icon: Users,   ar: 'المستخدمون', fr: 'Utilisateurs' },
  ]

  const handleLogout = () => {
    logoutClient()
    navigate('/login')
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50 dark:bg-slate-900">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <PageHeader>
        <h1 className="text-white font-bold text-xl">{t(lang, 'settingsTitle')}</h1>
        <p className="text-white/50 text-xs mt-0.5">{clientAuth?.email || ''}</p>
      </PageHeader>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-900 px-4 pt-3 pb-2 border-b border-gray-100 dark:border-slate-800">
        <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <TabBtn
              key={tab.key}
              icon={tab.icon}
              label={isAr ? tab.ar : tab.fr}
              active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-24 pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'profile'    && <ProfileTab    lang={lang} clientAuth={clientAuth} updateUserInContext={updateUserInContext} />}
            {activeTab === 'password'   && <PasswordTab   lang={lang} />}
            {activeTab === 'appearance' && <AppearanceTab lang={lang} setLang={setLang} darkMode={darkMode} toggleDarkMode={toggleDarkMode} pushEnabled={pushEnabled} requestPushPermission={requestPushPermission} disablePush={disablePush} wsConnected={wsConnected} />}
            {activeTab === 'users'      && <SubUsersTab   lang={lang} />}
          </motion.div>
        </AnimatePresence>

        {/* Logout button */}
        <div className="px-4 mt-6">
          <button
            type="button"
            onClick={() => setLogoutModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-red-500 transition-all active:scale-95"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
          >
            <LogOut size={16} strokeWidth={2} />
            {t(lang, 'logout')}
          </button>
        </div>

        {/* App version */}
        <p className="text-center text-[10px] text-slate-300 dark:text-slate-600 mt-6 pb-2">
          AtharGPS v1.0.0 · SHGPS.MA
        </p>
      </div>

      {/* ── Logout modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {logoutModal && (
          <div className="fixed inset-0 z-50 flex items-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40" onClick={() => setLogoutModal(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative w-full bg-white dark:bg-slate-900 rounded-t-3xl p-6 pb-10"
            >
              <div className="w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto mb-5" />
              <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} className="text-red-500" strokeWidth={1.5} />
              </div>
              <h3 className="text-center font-bold text-primary-500 dark:text-white text-lg mb-2">
                {isAr ? 'تسجيل الخروج؟' : 'Se déconnecter ?'}
              </h3>
              <p className="text-center text-xs text-slate-400 mb-6">
                {isAr ? 'سيتم إغلاق جلستك الحالية' : 'Votre session sera fermée'}
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setLogoutModal(false)}
                  className="flex-1 py-3 border border-gray-200 dark:border-slate-600 rounded-2xl text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {t(lang, 'cancel')}
                </button>
                <button type="button" onClick={handleLogout}
                  className="flex-1 py-3 bg-red-500 text-white rounded-2xl text-sm font-bold active:scale-95 transition-transform">
                  {t(lang, 'logout')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ClientNav />
    </div>
  )
}
