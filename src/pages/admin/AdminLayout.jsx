import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, Cpu, Map, Bell, LogOut, Menu, X, Globe, Shield, Wrench,
  Plus, CheckCircle2, AlertCircle, CalendarDays, Hash, User2, Smartphone, CircleHelp,
  Phone, AlertTriangle, SlidersHorizontal, Inbox, UserCog, CreditCard, BarChart2
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import Logo from '../../components/Logo'
import ForcePasswordModal from '../../components/ForcePasswordModal'
import SubscriptionPlans from '../../components/SubscriptionPlans'

/* ─── Quick Add Device Modal ──────────────────────────────────────────────── */
function QuickAddModal({ open, onClose, lang, clientList, clientsError, onRefreshClients, onSuccess }) {
  const isAr = lang === 'ar'

  // ── required fields
  const [imei,    setImei]    = useState('')
  const [phone,   setPhone]   = useState('')

  // ── optional (expandable)
  const [expanded,  setExpanded]  = useState(false)
  const [clientId,  setClientId]  = useState('')
  const [maxDev,    setMaxDev]    = useState('1')
  const [expires,   setExpires]   = useState('')
  const [subscriptionPlanId, setSubscriptionPlanId] = useState('3_months')
  const [search,    setSearch]    = useState('')

  // ── ui state
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [done,    setDone]    = useState(null)

  const filtered = clientList.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 6)

  const selectedClient = clientList.find(c => String(c.id) === String(clientId))

  const reset = () => {
    setImei(''); setPhone(''); setClientId(''); setMaxDev('1')
    setExpires(''); setSubscriptionPlanId('3_months'); setSearch(''); setError(''); setDone(null); setExpanded(false)
  }
  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const result = await api.devices.quickAdd({
        imei:      imei.trim(),
        phone:     phone.trim() || null,
        clientId:  clientId ? Number(clientId) : null,
        maxDevices: clientId ? Number(maxDev) : null,
        expiresAt:  clientId ? (expires || null) : null,
        subscriptionPlanId,
      })
      setDone(result)
      onSuccess(result)
    } catch (err) {
      setError(err.message || (isAr ? 'حدث خطأ' : 'Erreur'))
    } finally { setLoading(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={handleClose}
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
              <button onClick={handleClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20">
                <X size={16} className="text-white" />
              </button>
            </div>

            {/* ── Success ── */}
            {done ? (
              <div className="p-7 text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={28} className="text-green-500" />
                </div>
                <h4 className="font-bold text-primary-500 text-base mb-0.5">
                  {isAr ? 'تم تسجيل الجهاز ✓' : 'Appareil enregistré ✓'}
                </h4>
                <p className="text-slate-500 text-sm mb-0.5">{done.name}</p>
                <p className="text-slate-400 text-xs font-mono mb-1">{done.imei}</p>
                {done.phone && (
                  <p className="text-slate-400 text-xs mb-4 flex items-center gap-1.5"><Phone size={12} />{done.phone}</p>
                )}
                {!done.clientId && (
                  <p className="text-xs text-amber-500 bg-amber-50 rounded-xl px-3 py-2 mb-4">
                    <><AlertTriangle size={13} className="inline me-1 shrink-0" />{isAr ? 'الجهاز غير مربوط بعميل — يمكن ربطه لاحقاً من قائمة الأجهزة' : 'Appareil non assigné — à lier depuis la liste'}</>
                  </p>
                )}
                <div className="flex gap-3">
                  <button onClick={handleClose}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-slate-500 hover:bg-gray-50">
                    {isAr ? 'إغلاق' : 'Fermer'}
                  </button>
                  <button onClick={reset}
                    className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-bold hover:bg-primary-600">
                    {isAr ? '+ جهاز آخر' : '+ Autre'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 space-y-3.5">

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
                    value={imei}
                    maxLength={15}
                    onChange={e => setImei(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                  <div className="flex justify-between mt-1 px-0.5">
                    {imei.length > 0 && imei.length < 15
                      ? <p className="text-[11px] text-amber-500">{imei.length}/15</p>
                      : imei.length === 15
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
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                  />
                </div>

                {/* ── Optional section toggle ── */}
                <button
                  type="button"
                  onClick={() => setExpanded(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs font-semibold text-slate-400 hover:bg-slate-100 transition-colors"
                >
                  <span className="flex items-center gap-1.5"><SlidersHorizontal size={13} /><span>{isAr ? 'إعدادات إضافية (اختياري)' : 'Options supplémentaires (facultatif)'}</span></span>
                  <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>▾</motion.span>
                </button>

                {/* ── Optional fields ── */}
                <AnimatePresence>
                  {expanded && (
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
                          {isAr ? 'ربط بعميل' : 'Assigner à un client'}
                        </label>
                        {selectedClient ? (
                          <div className="flex items-center justify-between border border-primary-300 bg-primary-50 rounded-xl px-3 py-2">
                            <div>
                              <p className="text-sm font-bold text-primary-500">{selectedClient.name}</p>
                              <p className="text-xs text-slate-400">{selectedClient.email}</p>
                            </div>
                            <button type="button" onClick={() => { setClientId(''); setSearch('') }}
                              className="text-slate-400 hover:text-red-400"><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="relative">
                            <input
                              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                              placeholder={isAr ? 'اسم العميل...' : 'Nom du client...'}
                              value={search}
                              onChange={e => setSearch(e.target.value)}
                              autoComplete="off"
                            />
                            {search && filtered.length > 0 && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                                {filtered.map(c => (
                                  <button key={c.id} type="button"
                                    onClick={() => { setClientId(String(c.id)); setSearch('') }}
                                    className="w-full text-left px-3 py-2 hover:bg-primary-50 border-b border-gray-50 last:border-0">
                                    <p className="text-sm font-semibold text-primary-500">{c.name}</p>
                                    <p className="text-[11px] text-slate-400">{c.email}</p>
                                  </button>
                                ))}
                              </div>
                            )}
                            {search && !filtered.length && (
                              <p className="mt-1 text-[11px] text-slate-400">
                                {isAr ? 'لا يوجد عميل مطابق' : 'Aucun client correspondant'}
                              </p>
                            )}
                          </div>
                        )}
                        {!clientList.length && (
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
                      {clientId && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="flex items-center gap-1 text-xs font-bold text-slate-500 mb-1.5">
                              <Hash size={10} />{isAr ? 'عدد الأجهزة' : 'Max appareils'}
                            </label>
                            <input type="number" min="1" max="50"
                              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                              value={maxDev} onChange={e => setMaxDev(e.target.value)} />
                          </div>
                          <div>
                            <label className="flex items-center gap-1 text-xs font-bold text-slate-500 mb-1.5">
                              <CalendarDays size={10} />{isAr ? 'تاريخ الانتهاء' : 'Expiration'}
                            </label>
                            <input type="date"
                              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                              value={expires} min={new Date().toISOString().split('T')[0]}
                              onChange={e => setExpires(e.target.value)} />
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="flex items-center gap-1 text-xs font-bold text-slate-500 mb-1.5">
                          <CalendarDays size={10} />{isAr ? 'خطة اشتراك الجهاز — دفع نقدي' : 'Forfait appareil — paiement comptant'}
                        </label>
                        <SubscriptionPlans value={subscriptionPlanId} onChange={setSubscriptionPlanId} lang={lang} compact includeTrial />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || imei.length !== 15 || !phone.trim()}
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

export default function AdminLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { adminAuth, logoutAdmin, lang, setLang, alertsList, mustChangePassword, clearMustChange,
          clientList, clientsError, refreshDevices, refreshClients } = useApp()
  const [sidebarOpen,    setSidebarOpen]    = useState(false)
  const [showQuickAdd,   setShowQuickAdd]   = useState(false)

  useEffect(() => {
    if (showQuickAdd && !clientList.length) refreshClients?.()
    // Load the clients when this modal is opened, without refetching on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQuickAdd])

  const handleQuickAddSuccess = () => {
    // Device already created by the modal's API call — just refresh lists
    refreshDevices?.()
    refreshClients?.()
  }

  const allUnread = alertsList.filter(a => !a.read).length

  const handleLogout = () => {
    logoutAdmin()
    navigate('/admin/login')
  }

  const isSubAdmin   = !!adminAuth?.isSubAdmin
  const adminPerms   = adminAuth?.adminPermissions || {}

  const navItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: t(lang, 'adminDashboard') },
    { path: '/admin/clients',   icon: Users,            label: t(lang, 'clientsList') },
    { path: '/admin/devices',   icon: Cpu,              label: t(lang, 'allDevices') },
    { path: '/admin/subscriptions', icon: CreditCard,       label: lang === 'ar' ? 'الاشتراكات' : 'Abonnements' },
    ...((!isSubAdmin || adminPerms.view_map)     ? [{ path: '/admin/map',         icon: Map,       label: t(lang, 'globalMap') }]          : []),
    ...((!isSubAdmin || adminPerms.view_alerts)  ? [{ path: '/admin/alerts',      icon: Bell,      label: t(lang, 'allAlerts'), badge: allUnread }] : []),
    ...((!isSubAdmin || adminPerms.device_setup) ? [{ path: '/admin/setup',       icon: Wrench,    label: t(lang, 'deviceSetup') }]        : []),
    ...(!isSubAdmin ? [
      { path: '/admin/support',    icon: CircleHelp, label: lang === 'ar' ? 'بيانات الدعم'     : 'Support'  },
      { path: '/admin/leads',      icon: Inbox,      label: lang === 'ar' ? 'طلبات التواصل'   : 'Demandes' },
      { path: '/admin/sub-admins', icon: UserCog,    label: lang === 'ar' ? 'مسؤولون فرعيون'  : 'Sous-admins' },
    ] : []),
  ]

  const isAr = lang === 'ar'
  const navGroups = [
    {
      label: isAr ? 'الرئيسية' : 'Principal',
      paths: ['/admin/dashboard', '/admin/clients', '/admin/devices', '/admin/subscriptions', '/admin/map', '/admin/alerts'],
    },
    {
      label: isAr ? 'إدارة الأجهزة' : 'Gestion des appareils',
      paths: ['/admin/setup'],
    },
    {
      label: isAr ? 'الإدارة' : 'Administration',
      paths: ['/admin/support', '/admin/leads', '/admin/sub-admins'],
    },
  ]

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-slate-100">
        <Logo size="md" />
        <div className="mt-3 flex items-center gap-2 bg-primary-50 rounded-xl px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-bold">
            {adminAuth?.name?.[0] || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-primary-500 truncate">{adminAuth?.name || 'Admin'}</p>
            <p className="text-[10px] text-slate-400 truncate">{adminAuth?.email}</p>
          </div>
          <Shield size={12} className="text-accent flex-shrink-0" />
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navGroups.map(group => {
          const items = navItems.filter(item => group.paths.includes(item.path))
          if (items.length === 0) return null
          return (
            <div key={group.label} className="mb-2">
              <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
              {items.map(item => {
                const Icon = item.icon
                const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setSidebarOpen(false) }}
                    className={`admin-sidebar-item w-full text-left ${active ? 'active' : ''}`}
                  >
                    <div className="relative">
                      <Icon size={18} />
                      {item.badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Quick Add button in sidebar */}
      <div className="px-4 pb-2">
        <button
          onClick={() => { setSidebarOpen(false); setShowQuickAdd(true) }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-accent text-slate-900 font-bold text-sm hover:bg-accent/90 transition-all shadow-md shadow-accent/20"
        >
          <Plus size={16} />
          {lang === 'ar' ? 'إضافة جهاز سريعة' : 'Ajout rapide'}
        </button>
      </div>

      <div className="p-4 border-t border-slate-100 space-y-1">
        <div className="flex items-center gap-2 px-4 py-2">
          <Globe size={16} className="text-slate-400" />
          <div className="flex gap-1 flex-1">
            {['ar', 'fr'].map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`flex-1 text-xs py-1 rounded-lg font-semibold transition-all ${
                  lang === l ? 'bg-primary-500 text-white' : 'bg-gray-100 text-slate-500'
                }`}
              >
                {l === 'ar' ? 'العربية' : 'FR'}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="admin-sidebar-item w-full text-left text-red-400 hover:bg-red-50 hover:text-red-500"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">{t(lang, 'logout')}</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Force password change modal */}
      {mustChangePassword && (
        <ForcePasswordModal lang={lang} onSuccess={clearMustChange} />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-100 flex-shrink-0 shadow-sm">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              className="fixed top-0 bottom-0 left-0 w-72 bg-white z-50 lg:hidden shadow-2xl"
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X size={16} />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"
          >
            <Menu size={20} className="text-primary-500" />
          </button>
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            {/* Quick Add — mobile */}
            <button
              onClick={() => setShowQuickAdd(true)}
              className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-sm shadow-accent/30"
            >
              <Plus size={18} className="text-slate-900" />
            </button>
            <button
              onClick={() => navigate('/admin/alerts')}
              className="relative w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"
            >
              <Bell size={18} className="text-primary-500" />
              {allUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {allUnread}
                </span>
              )}
            </button>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Quick Add Device Modal — accessible from every admin page */}
      <QuickAddModal
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        lang={lang}
        clientList={clientList || []}
        clientsError={clientsError}
        onRefreshClients={refreshClients}
        onSuccess={handleQuickAddSuccess}
      />
    </div>
  )
}
