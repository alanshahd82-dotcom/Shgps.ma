import React, { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'

// Pages
import LandingPage from './pages/LandingPage'
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
          <Route path="/" element={<LandingPage />} />

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
