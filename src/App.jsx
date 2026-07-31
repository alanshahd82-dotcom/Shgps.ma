import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { AppProvider, useApp } from './context/AppContext'

// Pages
import LandingPage from './pages/LandingPage'
import ClientLogin from './pages/client/Login'
import ClientHome from './pages/client/Home'
import DeviceList from './pages/client/DeviceList'
import DeviceDetail from './pages/client/DeviceDetail'
import Alerts from './pages/client/Alerts'
import Settings from './pages/client/Settings'
import Reports from './pages/client/Reports'
import DriverBehavior from './pages/client/DriverBehavior'
import Maintenance from './pages/client/Maintenance'
import AdminLogin from './pages/admin/AdminLogin'
import Dashboard from './pages/admin/Dashboard'
import Clients from './pages/admin/Clients'
import ClientDetail from './pages/admin/ClientDetail'
import AllDevices from './pages/admin/AllDevices'
import GlobalMap from './pages/admin/GlobalMap'
import AdminAlerts from './pages/admin/AdminAlerts'
import DeviceSetup from './pages/admin/DeviceSetup'
import PublicMap from './pages/PublicMap'
import PublicShare from './pages/PublicShare'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'

/* ─────────────────────────────────────────────────────────────────────────────
   ROUTE GUARDS
───────────────────────────────────────────────────────────────────────────── */

function isClientAuthenticated(clientAuth) {
  if (!clientAuth) return false
  try {
    const stored = JSON.parse(localStorage.getItem('athargps_client'))
    return !!stored
  } catch {
    return false
  }
}

function isAdminAuthenticated(adminAuth) {
  if (!adminAuth) return false
  try {
    const stored = JSON.parse(localStorage.getItem('athargps_admin'))
    return !!stored
  } catch {
    return false
  }
}

function ClientRoute({ children }) {
  const { clientAuth } = useApp()
  const location = useLocation()
  if (!isClientAuthenticated(clientAuth)) {
    return <Navigate to="/client/login" state={{ from: location }} replace />
  }
  return children
}

function AdminRoute({ children }) {
  const { adminAuth } = useApp()
  const location = useLocation()
  if (!isAdminAuthenticated(adminAuth)) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }
  return children
}

/* ─────────────────────────────────────────────────────────────────────────────
   ROUTER
───────────────────────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public ─────────────────────────────────────────────────── */}
          <Route
            path="/"
            element={Capacitor.isNativePlatform()
              ? <Navigate to="/client/login" replace />
              : <LandingPage />}
          />
          <Route path="/login" element={<Navigate to="/client/login" replace />} />
          <Route path="/share/:token" element={<PublicShare />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          {/* ── Client app ─────────────────────────────────────────────── */}
          <Route path="/client" element={<Navigate to="/client/login" replace />} />
          <Route path="/client/login"  element={<ClientLogin />} />

          <Route path="/client/home"            element={<ClientRoute><ClientHome /></ClientRoute>} />
          <Route path="/client/devices"         element={<ClientRoute><DeviceList /></ClientRoute>} />
          <Route path="/client/device/:id"      element={<ClientRoute><DeviceDetail /></ClientRoute>} />
          <Route path="/client/alerts"          element={<ClientRoute><Alerts /></ClientRoute>} />
          <Route path="/client/settings"        element={<ClientRoute><Settings /></ClientRoute>} />
          <Route path="/client/reports"         element={<ClientRoute><Reports /></ClientRoute>} />
          <Route path="/client/driver-behavior" element={<ClientRoute><DriverBehavior /></ClientRoute>} />
          <Route path="/client/maintenance"     element={<ClientRoute><Maintenance /></ClientRoute>} />

          {/* ── Admin app ──────────────────────────────────────────────── */}
          <Route path="/admin/login" element={<AdminLogin />} />

          <Route path="/admin/dashboard"    element={<AdminRoute><Dashboard /></AdminRoute>} />
          <Route path="/admin/clients"      element={<AdminRoute><Clients /></AdminRoute>} />
          <Route path="/admin/clients/:id"  element={<AdminRoute><ClientDetail /></AdminRoute>} />
          <Route path="/admin/devices"      element={<AdminRoute><AllDevices /></AdminRoute>} />
          <Route path="/admin/map"          element={<AdminRoute><GlobalMap /></AdminRoute>} />
          <Route path="/admin/alerts"       element={<AdminRoute><AdminAlerts /></AdminRoute>} />
          <Route path="/admin/setup"        element={<AdminRoute><DeviceSetup /></AdminRoute>} />

          {/* ── Catch-all → Landing ────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
