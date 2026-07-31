import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, Cpu, Map, Bell, LogOut, Menu, X, Globe, Shield, Wrench
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import Logo from '../../components/Logo'

export default function AdminLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { adminAuth, logoutAdmin, lang, setLang, unreadCount, alertsList } = useApp()
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
      {/* Logo */}
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

      {/* Nav */}
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

      {/* Bottom */}
      <div className="p-4 border-t border-slate-100 space-y-1">
        {/* Language */}
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
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"
          >
            <Menu size={20} className="text-primary-500" />
          </button>
          <Logo size="sm" />
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

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            className="page-enter"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
