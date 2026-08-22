import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { AppProvider, useApp } from './context/AppContext'

// Pages
import LandingPage from './pages/LandingPage'
import ClientWelcome from './pages/client/ClientWelcome'
import ClientLogin from './pages/client/Login'
import ForgotPassword from './pages/client/ForgotPassword'
import ResetPassword from './pages/client/ResetPassword'
import ClientHome from './pages/client/Home'
import Subscriptions from './pages/client/Subscriptions'
import DeviceList from './pages/client/DeviceList'
import DeviceDetail from './pages/client/DeviceDetail'
import Alerts from './pages/client/Alerts'
import Settings from './pages/client/Settings'
const Reports = lazy(() => import('./pages/client/Reports'))
const DriverBehavior = lazy(() => import('./pages/client/DriverBehavior'))
import Maintenance from './pages/client/Maintenance'
import Geofences from './pages/client/Geofences'
import DeviceWizard from './pages/client/DeviceWizard'
import LiveMap from './pages/client/LiveMap'
import VehicleControl from './pages/client/VehicleControl'
import Help from './pages/client/Help'
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Clients = lazy(() => import('./pages/admin/Clients'))
const ClientDetail = lazy(() => import('./pages/admin/ClientDetail'))
const SubAdmins = lazy(() => import('./pages/admin/SubAdmins'))
const AllDevices = lazy(() => import('./pages/admin/AllDevices'))
const GlobalMap = lazy(() => import('./pages/admin/GlobalMap'))
const AdminAlerts = lazy(() => import('./pages/admin/AdminAlerts'))
const DeviceSetup = lazy(() => import('./pages/admin/DeviceSetup'))
const SupportSettings = lazy(() => import('./pages/admin/SupportSettings'))
const Leads = lazy(() => import('./pages/admin/Leads'))
import NotFound from './pages/NotFound'
import PublicMap from './pages/PublicMap'
import PublicShare from './pages/PublicShare'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import ForcePasswordModal from './components/ForcePasswordModal'

// ── New Design System Screens (Phase 6+) ─────────────────────────────────────
import MapScreen from './design-system/screens/MapScreen'
import VehiclesScreen from './design-system/screens/VehiclesScreen'
import AlertsScreen from './design-system/screens/AlertsScreen'
import TripsScreen from './design-system/screens/TripsScreen'
import MoreScreen from './design-system/screens/MoreScreen'

/* ────────────────────────────────────────────────────────────────
   ROUTE GUARDS
───────────────────────────────────────────────────────────────── */

function isClientAuthenticated(clientAuth) {
  if (!clientAuth || !localStorage.getItem('athargps_token')) return false
  try {
    const stored = JSON.parse(localStorage.getItem('athargps_client'))
    return !!stored && stored.isAdmin !== true
  } catch {
    return false
  }
}

function isAdminAuthenticated(adminAuth) {
  if (!adminAuth || !localStorage.getItem('athargps_token')) return false
  try {
    const stored = JSON.parse(localStorage.getItem('athargps_admin'))
    return !!stored && stored.isAdmin === true
  } catch {
    return false
  }
}

function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-primary-500">
        <div className="h-8 w-8 rounded-full border-4 border-slate-200 border-t-accent animate-spin" />
        <p className="text-sm font-semibold">جاري تحميل لوحة التحكم...</p>
      </div>
    </div>
  )
}

function ClientRoute({ children }) {
  const { clientAuth, authReady, authBootstrapError, mustChangePassword, clearMustChange, lang } = useApp()
  const location = useLocation()
  if (!authReady) return <AuthLoading />
  if (authBootstrapError || !isClientAuthenticated(clientAuth)) {
    return <Navigate to="/client/login" state={{ from: location }} replace />
  }
  return (
    <>
      {children}
      {mustChangePassword && (
        <ForcePasswordModal lang={lang} onSuccess={clearMustChange} />
      )}
    </>
  )
}

function AdminRoute({ children }) {
  const { adminAuth, authReady, authBootstrapError } = useApp()
  const location = useLocation()
  if (!authReady) return <AuthLoading />
  if (authBootstrapError || !isAdminAuthenticated(adminAuth)) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }
  return children
}

function ClientEntry() {
  const { clientAuth, authReady, authBootstrapError } = useApp()
  const hasSeenOnboarding = localStorage.getItem('athargps_onboarding_seen') === 'true'
  if (!authReady) return <AuthLoading />
  return (
    <Navigate
      to={!authBootstrapError && isClientAuthenticated(clientAuth)
        ? '/client/home'
        : hasSeenOnboarding ? '/client/login' : '/client/start'}
      replace
    />
  )
}

/* ────────────────────────────────────────────────────────────────
   ROUTER
───────────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Suspense fallback={<AuthLoading />}>
          <Routes>
          {/* ── Public ─────────────────────────────────────────────────── */}
          <Route
            path="/"
            element={Capacitor.isNativePlatform()
              ? <Navigate to="/client" replace />
              : <LandingPage />}
          />
          <Route path="/login" element={<Navigate to="/client/login" replace />} />
          <Route path="/share/:token" element={<PublicShare />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          {/* ── Client app ─────────────────────────────────────────────── */}
          <Route path="/client" element={<ClientEntry />} />
          <Route path="/client/start"            element={<ClientWelcome />} />
          <Route path="/client/login"           element={<ClientLogin />} />
          <Route path="/client/forgot-password" element={<ForgotPassword />} />
          <Route path="/client/reset-password"  element={<ResetPassword />} />

          <Route path="/client/home"            element={<ClientRoute><ClientHome /></ClientRoute>} />
          <Route path="/subscriptions"          element={<ClientRoute><Subscriptions /></ClientRoute>} />
          <Route path="/client/devices"         element={<ClientRoute><DeviceList /></ClientRoute>} />
          <Route path="/client/vehicles"        element={<ClientRoute><VehiclesScreen /></ClientRoute>} />
          <Route path="/client/device/:id"      element={<ClientRoute><DeviceDetail /></ClientRoute>} />
          <Route path="/client/vehicle/:id"     element={<ClientRoute><DeviceDetail /></ClientRoute>} />
          <Route path="/client/alerts"          element={<ClientRoute><AlertsScreen /></ClientRoute>} />
          <Route path="/client/settings"        element={<ClientRoute><Settings /></ClientRoute>} />
          <Route path="/client/reports"         element={<ClientRoute><Reports /></ClientRoute>} />
          <Route path="/client/driver-behavior" element={<ClientRoute><DriverBehavior /></ClientRoute>} />
          <Route path="/client/maintenance"     element={<ClientRoute><Maintenance /></ClientRoute>} />
          <Route path="/client/geofences"       element={<ClientRoute><Geofences /></ClientRoute>} />
          <Route path="/client/device-wizard"   element={<ClientRoute><DeviceWizard /></ClientRoute>} />
          <Route path="/client/map"             element={<ClientRoute><MapScreen /></ClientRoute>} />
          <Route path="/client/trips"           element={<ClientRoute><TripsScreen /></ClientRoute>} />
          <Route path="/client/more"            element={<ClientRoute><MoreScreen /></ClientRoute>} />
          <Route path="/client/help"            element={<ClientRoute><Help /></ClientRoute>} />

          {/* ── Admin app ──────────────────────────────────────────────── */}
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/login" element={<AdminLogin />} />

          <Route path="/admin/dashboard"    element={<AdminRoute><Dashboard /></AdminRoute>} />
          <Route path="/admin/clients"      element={<AdminRoute><Clients /></AdminRoute>} />
          <Route path="/admin/clients/:id"  element={<AdminRoute><ClientDetail /></AdminRoute>} />
          <Route path="/admin/devices"      element={<AdminRoute><AllDevices /></AdminRoute>} />
          <Route path="/admin/map"          element={<AdminRoute><GlobalMap /></AdminRoute>} />
          <Route path="/admin/alerts"       element={<AdminRoute><AdminAlerts /></AdminRoute>} />
          <Route path="/admin/setup"        element={<AdminRoute><DeviceSetup /></AdminRoute>} />
          <Route path="/admin/support"      element={<AdminRoute><SupportSettings /></AdminRoute>} />
          <Route path="/admin/leads"        element={<AdminRoute><Leads /></AdminRoute>} />
          <Route path="/admin/sub-admins"   element={<AdminRoute><SubAdmins /></AdminRoute>} />

          {/* ── Catch-all → 404 ───────────────────────────────────────── */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppProvider>
  )
}
