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

/* ─────────────────────────────────────────────────────────────────────────────
   ROUTE GUARDS — double-layer security:
   1. Context state (clientAuth / adminAuth) loaded from localStorage on mount.
   2. Direct localStorage check as a second guard in case context is stale.
   Any unauthenticated access to /client/* or /admin/* is blocked immediately.
───────────────────────────────────────────────────────────────────────────── */

/** Returns true only when BOTH the context token AND localStorage agree the
 *  client session is active. */
function isClientAuthenticated(clientAuth) {
  if (!clientAuth) return false
  try {
    const stored = JSON.parse(localStorage.getItem('shgps_client'))
    return !!stored
  } catch {
    return false
  }
}

/** Returns true only when BOTH the context token AND localStorage agree the
 *  admin session is active. */
function isAdminAuthenticated(adminAuth) {
  if (!adminAuth) return false
  try {
    const stored = JSON.parse(localStorage.getItem('shgps_admin'))
    return !!stored
  } catch {
    return false
  }
}

function ClientRoute({ children }) {
  const { clientAuth } = useApp()
  const location = useLocation()

  if (!isClientAuthenticated(clientAuth)) {
    // Strip any residual state and redirect to login
    return <Navigate to="/client/login" state={{ from: location }} replace />
  }
  return children
}

function AdminRoute({ children }) {
  const { adminAuth } = useApp()
  const location = useLocation()

  if (!isAdminAuthenticated(adminAuth)) {
    // Redirect to admin login — never expose the dashboard
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }
  return children
}

// Client app splash entry — always proceeds to login
function ClientSplash() {
  const navigate = useNavigate()
  useEffect(() => {
    const t = setTimeout(() => navigate('/client/login'), 2500)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line
  return <SplashScreen />
}

/* ─────────────────────────────────────────────────────────────────────────────
   ROUTER
   IMPORTANT: The root path "/" MUST always render <LandingPage />.
   Do NOT change this mapping.
───────────────────────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          {/* ── Public ─────────────────────────────────────────────────── */}
          <Route path="/" element={<LandingPage />} />

          {/* ── Client app ─────────────────────────────────────────────── */}
          <Route path="/client"        element={<ClientSplash />} />
          <Route path="/client/login"  element={<ClientLogin />} />

          {/* Protected client pages — redirect to /client/login if not auth */}
          <Route path="/client/home"      element={<ClientRoute><ClientHome /></ClientRoute>} />
          <Route path="/client/devices"   element={<ClientRoute><DeviceList /></ClientRoute>} />
          <Route path="/client/device/:id" element={<ClientRoute><DeviceDetail /></ClientRoute>} />
          <Route path="/client/alerts"    element={<ClientRoute><Alerts /></ClientRoute>} />
          <Route path="/client/settings"  element={<ClientRoute><Settings /></ClientRoute>} />

          {/* ── Admin app ──────────────────────────────────────────────── */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Protected admin pages — redirect to /admin/login if not auth */}
          <Route path="/admin/dashboard"    element={<AdminRoute><Dashboard /></AdminRoute>} />
          <Route path="/admin/clients"      element={<AdminRoute><Clients /></AdminRoute>} />
          <Route path="/admin/clients/:id"  element={<AdminRoute><ClientDetail /></AdminRoute>} />
          <Route path="/admin/devices"      element={<AdminRoute><AllDevices /></AdminRoute>} />
          <Route path="/admin/map"          element={<AdminRoute><GlobalMap /></AdminRoute>} />
          <Route path="/admin/alerts"       element={<AdminRoute><AdminAlerts /></AdminRoute>} />

          {/* ── Catch-all → Landing ────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AppProvider>
  )
}
