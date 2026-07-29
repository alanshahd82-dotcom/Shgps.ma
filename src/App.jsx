import React, { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'

// Pages
import SplashScreen        from './pages/SplashScreen'
import ClientLogin         from './pages/client/Login'
import ClientHome          from './pages/client/Home'
import DeviceList          from './pages/client/DeviceList'
import DeviceDetail        from './pages/client/DeviceDetail'
import Alerts              from './pages/client/Alerts'
import Settings            from './pages/client/Settings'
import TripHistory         from './pages/client/TripHistory'
import Statistics          from './pages/client/Statistics'
import ForgotPassword      from './pages/client/ForgotPassword'
import ResetPassword       from './pages/client/ResetPassword'
import DeviceOnboarding    from './pages/client/DeviceOnboarding'
import Subscription        from './pages/client/Subscription'
import AdminLogin          from './pages/admin/AdminLogin'
import Dashboard           from './pages/admin/Dashboard'
import Clients             from './pages/admin/Clients'
import ClientDetail        from './pages/admin/ClientDetail'
import AllDevices          from './pages/admin/AllDevices'
import GlobalMap           from './pages/admin/GlobalMap'
import AdminAlerts         from './pages/admin/AdminAlerts'
import Subscriptions       from './pages/admin/Subscriptions'
import Reports             from './pages/admin/Reports'
import DeviceRegistration  from './pages/admin/DeviceRegistration'
import AdminSettings       from './pages/admin/AdminSettings'

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

// Landing selector
function DemoSelector() {
  const navigate = useNavigate()
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(150deg, #0B1F3A 0%, #071830 60%, #0d2240 100%)' }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[200, 380, 560].map((size, i) => (
          <div key={i} className="absolute rounded-full border border-white/5"
            style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: size, height: size }} />
        ))}
      </div>

      <div className="relative z-10 text-center mb-12">
        <svg width={80} height={80} viewBox="0 0 48 48" fill="none" className="mx-auto mb-4">
          <rect width="48" height="48" rx="14" fill="rgba(255,255,255,0.08)" />
          <path d="M24 7C16.82 7 11 12.82 11 20C11 29.5 24 43 24 43C24 43 37 29.5 37 20C37 12.82 31.18 7 24 7Z" fill="#1DBF73" />
          <circle cx="24" cy="20" r="5" fill="#0B1F3A" />
          <circle cx="24" cy="20" r="2.5" fill="#1DBF73" />
        </svg>
        <h1 className="text-4xl font-extrabold text-white">
          Athar <span style={{ color: '#1DBF73' }}>GPS</span>
        </h1>
        <p className="text-white/50 text-sm mt-2 font-medium tracking-widest uppercase">منصة تتبع GPS احترافية</p>
      </div>

      <div className="relative z-10 flex flex-col md:flex-row gap-5 w-full max-w-2xl">
        <button
          onClick={() => navigate('/client')}
          className="flex-1 bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 rounded-3xl p-7 text-left transition-all duration-300 group backdrop-blur-sm"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-5 text-3xl">📱</div>
          <h3 className="text-xl font-bold text-white mb-2">تطبيق العميل</h3>
          <p className="text-white/50 text-sm leading-relaxed">تتبع مركباتك، السياج الجغرافي، التنبيهات، وإحصائيات الرحلات.</p>
          <div className="mt-5 flex items-center gap-2 font-semibold text-sm" style={{ color: '#1DBF73' }}>
            <span>دخول التطبيق</span><span className="text-lg">→</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/admin/login')}
          className="flex-1 bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 rounded-3xl p-7 text-left transition-all duration-300 group backdrop-blur-sm"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-5 text-3xl">🖥️</div>
          <h3 className="text-xl font-bold text-white mb-2">لوحة تحكم Admin</h3>
          <p className="text-white/50 text-sm leading-relaxed">إدارة العملاء والأجهزة، الاشتراكات، التقارير، والإعدادات.</p>
          <div className="mt-5 flex items-center gap-2 text-white/60 font-semibold text-sm group-hover:text-white/80 transition-colors">
            <span>دخول اللوحة</span><span className="text-lg">→</span>
          </div>
        </button>
      </div>
    </div>
  )
}

function ClientSplash() {
  const navigate = useNavigate()
  useEffect(() => { const t = setTimeout(() => navigate('/client/login'), 2500); return () => clearTimeout(t) }, [])
  return <SplashScreen />
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<DemoSelector />} />
          <Route path="/client" element={<ClientSplash />} />

          {/* Client auth */}
          <Route path="/client/login"          element={<ClientLogin />} />
          <Route path="/client/forgot-password" element={<ForgotPassword />} />
          <Route path="/client/reset-password"  element={<ResetPassword />} />

          {/* Client app */}
          <Route path="/client/home"         element={<ClientRoute><ClientHome /></ClientRoute>} />
          <Route path="/client/devices"      element={<ClientRoute><DeviceList /></ClientRoute>} />
          <Route path="/client/device/:id"   element={<ClientRoute><DeviceDetail /></ClientRoute>} />
          <Route path="/client/alerts"       element={<ClientRoute><Alerts /></ClientRoute>} />
          <Route path="/client/settings"     element={<ClientRoute><Settings /></ClientRoute>} />
          <Route path="/client/trips"        element={<ClientRoute><TripHistory /></ClientRoute>} />
          <Route path="/client/stats"        element={<ClientRoute><Statistics /></ClientRoute>} />
          <Route path="/client/add-device"   element={<ClientRoute><DeviceOnboarding /></ClientRoute>} />
          <Route path="/client/subscription" element={<ClientRoute><Subscription /></ClientRoute>} />

          {/* Admin */}
          <Route path="/admin/login"         element={<AdminLogin />} />
          <Route path="/admin/dashboard"     element={<AdminRoute><Dashboard /></AdminRoute>} />
          <Route path="/admin/clients"       element={<AdminRoute><Clients /></AdminRoute>} />
          <Route path="/admin/clients/:id"   element={<AdminRoute><ClientDetail /></AdminRoute>} />
          <Route path="/admin/devices"       element={<AdminRoute><AllDevices /></AdminRoute>} />
          <Route path="/admin/devices/new"   element={<AdminRoute><DeviceRegistration /></AdminRoute>} />
          <Route path="/admin/map"           element={<AdminRoute><GlobalMap /></AdminRoute>} />
          <Route path="/admin/alerts"        element={<AdminRoute><AdminAlerts /></AdminRoute>} />
          <Route path="/admin/subscriptions" element={<AdminRoute><Subscriptions /></AdminRoute>} />
          <Route path="/admin/reports"       element={<AdminRoute><Reports /></AdminRoute>} />
          <Route path="/admin/settings"      element={<AdminRoute><AdminSettings /></AdminRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AppProvider>
  )
}
