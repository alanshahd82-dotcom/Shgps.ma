import React, { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'

// Pages
import SplashScreen from './pages/SplashScreen'
import ClientLogin from './pages/client/Login'
import ClientHome from './pages/client/Home'
import DeviceList from './pages/client/DeviceList'
import DeviceDetail from './pages/client/DeviceDetail'
import Alerts from './pages/client/Alerts'
import Settings from './pages/client/Settings'
import AdminLogin from './pages/admin/AdminLogin'
import Dashboard from './pages/admin/Dashboard'
import Clients from './pages/admin/Clients'
import ClientDetail from './pages/admin/ClientDetail'
import AllDevices from './pages/admin/AllDevices'
import GlobalMap from './pages/admin/GlobalMap'
import AdminAlerts from './pages/admin/AdminAlerts'

// Route guards
function ClientRoute({ children }) {
  const { clientAuth } = useApp()
  const location = useLocation()
  if (!clientAuth) return <Navigate to="/client/login" state={{ from: location }} replace />
  return children
}

function AdminRoute({ children }) {
  const { adminAuth } = useApp()
  const location = useLocation()
  if (!adminAuth) return <Navigate to="/admin/login" state={{ from: location }} replace />
  return children
}

// Landing selector page
function DemoSelector() {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(150deg, #0F2044 0%, #0a1628 60%, #0d2240 100%)' }}
    >
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[200, 380, 560].map((size, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-white/5"
            style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: size, height: size }}
          />
        ))}
      </div>

      {/* Logo */}
      <div className="relative z-10 text-center mb-12">
        <svg width={80} height={80} viewBox="0 0 48 48" fill="none" className="mx-auto mb-4">
          <rect width="48" height="48" rx="14" fill="rgba(255,255,255,0.08)" />
          <path d="M24 8C17.373 8 12 13.373 12 20C12 28.5 24 42 24 42C24 42 36 28.5 36 20C36 13.373 30.627 8 24 8Z" fill="#00D97E" />
          <circle cx="24" cy="20" r="4.5" fill="#0F2044" />
        </svg>
        <h1 className="text-4xl font-extrabold text-white">
          Shgps<span className="text-accent">.ma</span>
        </h1>
        <p className="text-white/50 text-sm mt-2 font-medium tracking-widest uppercase">Interactive Demo</p>
      </div>

      {/* Demo cards */}
      <div className="relative z-10 flex flex-col md:flex-row gap-5 w-full max-w-2xl">
        {/* Client App */}
        <button
          onClick={() => navigate('/client')}
          className="flex-1 bg-white/5 border border-white/10 hover:border-accent/50 hover:bg-white/10 rounded-3xl p-7 text-left transition-all duration-300 group backdrop-blur-sm"
        >
          <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center mb-5 group-hover:bg-accent/30 transition-colors">
            <span className="text-3xl">📱</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">تطبيق العميل</h3>
          <p className="text-white/50 text-sm leading-relaxed">
            واجهة موبايل لتتبع الأجهزة، تحريك المحرك عن بعد، السياج الجغرافي، والتنبيهات.
          </p>
          <div className="mt-5 flex items-center gap-2 text-accent font-semibold text-sm">
            <span>عرض التطبيق</span>
            <span className="text-lg">→</span>
          </div>
        </button>

        {/* Admin Dashboard */}
        <button
          onClick={() => navigate('/admin/login')}
          className="flex-1 bg-white/5 border border-white/10 hover:border-primary-300/30 hover:bg-white/10 rounded-3xl p-7 text-left transition-all duration-300 group backdrop-blur-sm"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary-300/20 flex items-center justify-center mb-5 group-hover:bg-primary-300/30 transition-colors">
            <span className="text-3xl">🖥️</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">لوحة تحكم Admin</h3>
          <p className="text-white/50 text-sm leading-relaxed">
            لوحة ويب لإدارة العملاء والأجهزة، الخريطة الشاملة، والإحصائيات.
          </p>
          <div className="mt-5 flex items-center gap-2 text-white/60 font-semibold text-sm group-hover:text-white/80 transition-colors">
            <span>عرض اللوحة</span>
            <span className="text-lg">→</span>
          </div>
        </button>
      </div>

      <p className="relative z-10 mt-8 text-white/30 text-xs">
        جميع البيانات وهمية للعرض التقديمي فقط
      </p>
    </div>
  )
}

// Client app splash entry
function ClientSplash() {
  const navigate = useNavigate()
  useEffect(() => {
    const t = setTimeout(() => navigate('/client/login'), 2500)
    return () => clearTimeout(t)
  }, [])
  return <SplashScreen />
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          {/* Landing */}
          <Route path="/" element={<DemoSelector />} />

          {/* Client splash */}
          <Route path="/client" element={<ClientSplash />} />

          {/* Client app */}
          <Route path="/client/login" element={<ClientLogin />} />
          <Route path="/client/home" element={<ClientRoute><ClientHome /></ClientRoute>} />
          <Route path="/client/devices" element={<ClientRoute><DeviceList /></ClientRoute>} />
          <Route path="/client/device/:id" element={<ClientRoute><DeviceDetail /></ClientRoute>} />
          <Route path="/client/alerts" element={<ClientRoute><Alerts /></ClientRoute>} />
          <Route path="/client/settings" element={<ClientRoute><Settings /></ClientRoute>} />

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
          <Route path="/admin/clients" element={<AdminRoute><Clients /></AdminRoute>} />
          <Route path="/admin/clients/:id" element={<AdminRoute><ClientDetail /></AdminRoute>} />
          <Route path="/admin/devices" element={<AdminRoute><AllDevices /></AdminRoute>} />
          <Route path="/admin/map" element={<AdminRoute><GlobalMap /></AdminRoute>} />
          <Route path="/admin/alerts" element={<AdminRoute><AdminAlerts /></AdminRoute>} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AppProvider>
  )
}
