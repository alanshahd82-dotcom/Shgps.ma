import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, Cpu, Map, Bell, LogOut, Menu, X, Globe, Shield, Wrench,
  Plus, CheckCircle2, AlertCircle, CalendarDays, Hash, User2, Smartphone
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import Logo from '../../components/Logo'
import ForcePasswordModal from '../../components/ForcePasswordModal'

/* ─── Quick Add Device Modal ──────────────────────────────────────────────── */
function QuickAddModal({ open, onClose, lang, clientList, onSuccess }) {
  const isAr = lang === 'ar'
  const [imei,      setImei]      = useState('')
  const [clientId,  setClientId]  = useState('')
  const [maxDev,    setMaxDev]    = useState('1')
  const [expires,   setExpires]   = useState('')
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [done,      setDone]      = useState(null) // { name, imei }

  const filtered = clientList.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8)

  const selectedClient = clientList.find(c => String(c.id) === String(clientId))

  const reset = () => {
    setImei(''); setClientId(''); setMaxDev('1'); setExpires('')
    setSearch(''); setError(''); setDone(null)
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const result = await api.devices.quickAdd({
        imei: imei.trim(),
        clientId: Number(clientId),
        maxDevices: Number(maxDev),
        expiresAt: expires || null,
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
            className="w-full md:max-w-[460px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-primary-500">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                  <Smartphone size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base leading-tight">
                    {isAr ? 'إضافة جهاز سريعة' : 'Ajout rapide d\'appareil'}
                  </h3>
                  <p className="text-white/60 text-xs">
                    {isAr ? '4 حقول فقط' : '4 champs seulement'}
                  </p>
                </div>
              </div>
              <button onClick={handleClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20">
                <X size={16} className="text-white" />
              </button>
            </div>

            {/* Success state */}
            {done ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-green-500" />
                </div>
                <h4 className="font-bold text-primary-500 text-lg mb-1">
                  {isAr ? 'تم إضافة الجهاز ✓' : 'Appareil ajouté ✓'}
                </h4>
                <p className="text-slate-500 text-sm mb-1">{done.name}</p>
                <p className="text-slate-400 text-xs font-mono mb-6">{done.imei}</p>
                <div className="flex gap-3">
                  <button onClick={handleClose}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-slate-500 hover:bg-gray-50">
                    {isAr ? 'إغلاق' : 'Fermer'}
                  </button>
                  <button onClick={reset}
                    className="flex-1 py-3 rounded-xl bg-primary-500 text-white text-sm font-bold hover:bg-primary-600">
                    {isAr ? 'إضافة جهاز آخر' : 'Ajouter un autre'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                    <AlertCircle size={15} className="shrink-0" />
                    {error}
                  </div>
                )}

                {/* IMEI */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1.5">
                    <Smartphone size={12} />
                    {isAr ? 'رقم IMEI (15 رقم)' : 'Numéro IMEI (15 chiffres)'}
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
                    placeholder="358900001234567"
                    value={imei}
                    maxLength={15}
                    onChange={e => setImei(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                  {imei.length > 0 && imei.length !== 15 && (
                    <p className="text-xs text-amber-500 mt-1">
                      {isAr ? `${imei.length}/15 رقم` : `${imei.length}/15 chiffres`}
                    </p>
                  )}
                </div>

                {/* Client search */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1.5">
                    <User2 size={12} />
                    {isAr ? 'العميل' : 'Client'}
                  </label>
                  {selectedClient ? (
                    <div className="flex items-center justify-between border border-primary-300 bg-primary-50 rounded-xl px-4 py-2.5">
                      <div>
                        <p className="text-sm font-bold text-primary-500">{selectedClient.name}</p>
                        <p className="text-xs text-slate-400">{selectedClient.email}</p>
                      </div>
                      <button type="button" onClick={() => { setClientId(''); setSearch('') }}
                        className="text-slate-400 hover:text-red-400">
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                        placeholder={isAr ? 'ابحث باسم العميل...' : 'Rechercher le client...'}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoComplete="off"
                      />
                      {search && filtered.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                          {filtered.map(c => (
                            <button key={c.id} type="button"
                              onClick={() => { setClientId(String(c.id)); setSearch('') }}
                              className="w-full text-left px-4 py-2.5 hover:bg-primary-50 border-b border-gray-50 last:border-0">
                              <p className="text-sm font-semibold text-primary-500">{c.name}</p>
                              <p className="text-xs text-slate-400">{c.email}</p>
                            </button>
                          ))}
                        </div>
                      )}
                      {search && filtered.length === 0 && (
                        <p className="text-xs text-slate-400 mt-1 px-1">
                          {isAr ? 'لم يُوجد عميل' : 'Aucun client trouvé'}
                        </p>
                      )}
                    </div>
                  )}
                  <input type="hidden" value={clientId} required onChange={() => {}} />
                </div>

                {/* Max devices + Expiry */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1.5">
                      <Hash size={12} />
                      {isAr ? 'عدد الأجهزة المسموح' : 'Appareils max'}
                    </label>
                    <input
                      type="number" min="1" max="50"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                      value={maxDev}
                      onChange={e => setMaxDev(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1.5">
                      <CalendarDays size={12} />
                      {isAr ? 'تاريخ الانتهاء' : 'Date d\'expiration'}
                    </label>
                    <input
                      type="date"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                      value={expires}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setExpires(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || imei.length !== 15 || !clientId}
                  className="w-full py-3.5 rounded-xl bg-primary-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primary-600 transition-colors mt-2"
                >
                  {loading
                    ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{isAr ? 'جاري الإضافة...' : 'Ajout en cours...'}</>
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
          clientList, addDeviceDirect } = useApp()
  const [sidebarOpen,    setSidebarOpen]    = useState(false)
  const [showQuickAdd,   setShowQuickAdd]   = useState(false)

  const handleQuickAddSuccess = (device) => {
    // AppContext already tracks devices via addDeviceDirect; here we just keep the modal open for "add another"
    addDeviceDirect && addDeviceDirect({ ...device, clientId: device.clientId })
  }

  const allUnread = alertsList.filter(a => !a.read).length

  const handleLogout = () => {
    logoutAdmin()
    navigate('/admin/login')
  }

  const navItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: t(lang, 'adminDashboard') },
    { path: '/admin/clients', icon: Users, label: t(lang, 'clientsList') },
    { path: '/admin/devices', icon: Cpu, label: t(lang, 'allDevices') },
    { path: '/admin/map', icon: Map, label: t(lang, 'globalMap') },
    { path: '/admin/alerts', icon: Bell, label: t(lang, 'allAlerts'), badge: allUnread },
    { path: '/admin/setup', icon: Wrench, label: t(lang, 'deviceSetup') },
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
        {navItems.map(item => {
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
        onSuccess={handleQuickAddSuccess}
      />
    </div>
  )
}
