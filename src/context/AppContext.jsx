import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { api } from '../api/index.js'

const AppContext = createContext(null)

function loadFromStorage(key) {
  try { return JSON.parse(localStorage.getItem(key)) } catch { return null }
}

export function AppProvider({ children }) {
  const [lang, setLang]                     = useState('ar')
  const [clientAuth, setClientAuth]         = useState(() => loadFromStorage('athargps_client'))
  const [adminAuth,  setAdminAuth]          = useState(() => loadFromStorage('athargps_admin'))
  const [mustChangePassword, setMustChange] = useState(false)
  const [devices,      setDevices]          = useState([])
  const [alertsList,   setAlertsList]       = useState([])
  const [clientList,   setClientList]       = useState([])
  const [networkError, setNetworkError]     = useState(false)
  const [wsConnected,        setWsConnected]        = useState(false)
  const [subscriptionExpired, setSubscriptionExpired] = useState(false)
  const [darkMode,       setDarkModeState]  = useState(() => localStorage.getItem('athargps_darkmode') === 'true')
  const [pushEnabled,    setPushEnabled]    = useState(() => localStorage.getItem('athargps_push') === 'true')
  const wsRef      = useRef(null)
  const wsRetryRef = useRef(0) // exponential backoff counter

  // ── Dark mode ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('athargps_darkmode', String(darkMode))
  }, [darkMode])

  const toggleDarkMode = () => setDarkModeState(prev => !prev)
  const setDarkMode = (val) => setDarkModeState(val)

  // ── Push Notifications ─────────────────────────────────────────────────────
  const requestPushPermission = async () => {
    if (!('Notification' in window)) return 'unsupported'
    const permission = await Notification.requestPermission()
    const granted = permission === 'granted'
    setPushEnabled(granted)
    localStorage.setItem('athargps_push', String(granted))
    return permission
  }

  const disablePush = () => {
    setPushEnabled(false)
    localStorage.setItem('athargps_push', 'false')
  }

  // Send a browser notification (used when WS alert arrives & push is enabled)
  const sendBrowserNotification = (title, body, opts = {}) => {
    if (!pushEnabled || Notification.permission !== 'granted') return
    try {
      const n = new Notification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', ...opts })
      n.onclick = () => { window.focus(); n.close() }
    } catch { /* silently skip if blocked */ }
  }

  // ── Language / RTL ────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  // Initial data load
  useEffect(() => {
    if (!clientAuth && !adminAuth) return
    loadDevices()
    loadAlerts()
    if (adminAuth) loadClients()
    openWebSocket()
    return () => closeWebSocket()
  }, []) // eslint-disable-line

  // Refresh devices every 30 s
  useEffect(() => {
    if (!clientAuth && !adminAuth) return
    const id = setInterval(loadDevices, 30000)
    return () => clearInterval(id)
  }, [clientAuth, adminAuth]) // eslint-disable-line

  async function loadDevices() {
    try {
      setDevices(await api.devices.list())
      setNetworkError(false)
    } catch {
      setNetworkError(true)
    }
  }
  async function loadAlerts() {
    try { setAlertsList(await api.alerts.list()) } catch { /* non-critical */ }
  }
  async function loadClients() {
    try {
      const res = await api.clients.list()
      setClientList(Array.isArray(res) ? res : (res.data || []))
    } catch { /* non-critical */ }
  }

  // ── WebSocket live tracking ────────────────────────────────────────────────
  function openWebSocket() {
    const token = localStorage.getItem('athargps_token')
    if (!token) return

    const wsBase = import.meta.env.VITE_WS_URL || (() => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      return `${protocol}://${window.location.host}/api/socket`
    })()
    const url = `${wsBase}?token=${encodeURIComponent(token)}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setWsConnected(true)
      wsRetryRef.current = 0 // reset backoff on success
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.positions && data.positions.length > 0) {
          setDevices(prev => {
            const updated = [...prev]
            for (const pos of data.positions) {
              const idx = updated.findIndex(d => d.traccarId === pos.deviceId || d.traccar_id === pos.deviceId)
              if (idx !== -1) {
                updated[idx] = {
                  ...updated[idx],
                  lat:        pos.latitude,
                  lng:        pos.longitude,
                  speed:      pos.speed ?? 0,
                  lastUpdate: pos.fixTime,
                  status:     'online',
                  engineOn:   pos.attributes?.ignition   ?? updated[idx].engineOn,
                  battery:    pos.attributes?.battery    ?? updated[idx].battery,
                  signal:     pos.attributes?.rssi       ?? updated[idx].signal,
                  fuel:       pos.attributes?.fuel       ?? updated[idx].fuel,
                }
              }
            }
            return updated
          })
        }

        if (data.devices && data.devices.length > 0) {
          setDevices(prev => {
            const updated = [...prev]
            for (const dev of data.devices) {
              const idx = updated.findIndex(d => d.traccarId === dev.id || d.traccar_id === dev.id)
              if (idx !== -1) {
                updated[idx] = { ...updated[idx], status: dev.status }
              }
            }
            return updated
          })
        }

        if (data.events && data.events.length > 0) {
          // Push new events to alertsList
          setAlertsList(prev => {
            const newAlerts = data.events.map(ev => ({
              id:        ev.id || Date.now(),
              type:      ev.type || 'event',
              deviceId:  ev.deviceId,
              message:   ev.attributes?.message || ev.type,
              createdAt: ev.eventTime || new Date().toISOString(),
              read:      false,
            }))
            // Fire browser notifications for new alerts (if enabled)
            if (localStorage.getItem('athargps_push') === 'true' && Notification.permission === 'granted') {
              for (const ev of data.events) {
                try {
                  new Notification('AtharGPS', {
                    body: ev.attributes?.message || ev.type || 'تنبيه جديد',
                    icon: '/icon-192.png',
                  })
                } catch { /* ignore */ }
              }
            }
            return [...newAlerts, ...prev].slice(0, 100) // keep last 100
          })
        }
      } catch {}
    }

    ws.onclose = () => {
      setWsConnected(false)
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
      if (localStorage.getItem('athargps_token')) {
        const delay = Math.min(1000 * Math.pow(2, wsRetryRef.current), 30000)
        wsRetryRef.current += 1
        setTimeout(openWebSocket, delay)
      }
    }

    ws.onerror = () => ws.close()
  }

  function closeWebSocket() {
    if (wsRef.current) {
      wsRef.current.onclose = null // prevent reconnect loop
      wsRef.current.close()
      wsRef.current = null
    }
    setWsConnected(false)
    wsRetryRef.current = 0
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const loginClient = async (email, password) => {
    const data = await api.auth.login(email, password)
    // ── Subscription guard ────────────────────────────────────────────────
    if (data.user?.expiryDate) {
      const daysLeft = Math.ceil((new Date(data.user.expiryDate) - new Date()) / 86400000)
      if (daysLeft <= 0 || data.user.isActive === false) {
        setSubscriptionExpired(true)
        return data
      }
    }
    localStorage.setItem('athargps_token',  data.token)
    localStorage.setItem('athargps_client', JSON.stringify(data.user))
    setClientAuth(data.user)
    setMustChange(!!data.user.mustChangePassword)
    loadDevices(); loadAlerts(); openWebSocket()
    return data
  }

  const loginAdmin = async (email, password) => {
    const data = await api.auth.login(email, password)
    if (!data.user.isAdmin) throw new Error('Not an admin account')
    localStorage.setItem('athargps_token', data.token)
    localStorage.setItem('athargps_admin', JSON.stringify(data.user))
    setAdminAuth(data.user)
    setMustChange(!!data.user.mustChangePassword)
    loadDevices(); loadAlerts(); loadClients(); openWebSocket()
    return data
  }

  const logoutClient = () => {
    closeWebSocket()
    localStorage.removeItem('athargps_token')
    localStorage.removeItem('athargps_client')
    setClientAuth(null); setDevices([]); setAlertsList([])
  }

  const logoutAdmin = () => {
    closeWebSocket()
    localStorage.removeItem('athargps_token')
    localStorage.removeItem('athargps_admin')
    setAdminAuth(null); setDevices([]); setAlertsList([]); setClientList([])
  }

  const clearMustChange = () => {
    setMustChange(false)
    const stored = loadFromStorage('athargps_admin') || loadFromStorage('athargps_client')
    if (stored) {
      const updated = { ...stored, mustChangePassword: false }
      if (adminAuth) localStorage.setItem('athargps_admin', JSON.stringify(updated))
      else localStorage.setItem('athargps_client', JSON.stringify(updated))
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  const toggleEngine = async (deviceId, turnOff) => {
    setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, engineOn: !turnOff } : d))
    try {
      await api.devices.sendCommand(deviceId, turnOff ? 'engineStop' : 'engineResume')
    } catch (err) {
      setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, engineOn: !!turnOff } : d))
      throw err
    }
  }

  const saveGeofence = async (deviceId, data) => {
    const result = await api.devices.setGeofence(deviceId, data)
    setDevices(prev => prev.map(d =>
      d.id === deviceId
        ? { ...d, geofence: result, geofenceActive: true, activeGeofenceId: result?.geofence?.id ?? result?.id ?? null }
        : d
    ))
    return result
  }

  const removeGeofence = async (deviceId, geofenceId) => {
    await api.devices.removeGeofence(deviceId, geofenceId)
    setDevices(prev => prev.map(d =>
      d.id === deviceId
        ? { ...d, geofence: null, geofenceActive: false, activeGeofenceId: null }
        : d
    ))
  }

  const getClientDevices = (clientId) => devices.filter(d => d.clientId === clientId || d.user_id === clientId)
  const getOnlineDevices = () => devices.filter(d => d.status === 'online')

  const unreadCount = alertsList.filter(a => !a.read).length

  const markAlertRead = async (alertId) => {
    await api.alerts.markRead(alertId)
    setAlertsList(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a))
  }

  const markAllAlertsRead = async () => {
    await api.alerts.markAllRead()
    setAlertsList(prev => prev.map(a => ({ ...a, read: true })))
  }

  const updateUserInContext = (data) => {
    setClientAuth(prev => {
      const updated = { ...(prev || {}), ...data }
      localStorage.setItem('athargps_client', JSON.stringify(updated))
      return updated
    })
  }

  const addClient = async (data) => {
    const created = await api.clients.create(data)
    setClientList(prev => [created, ...prev])
    return created
  }

  const updateClient = async (clientId, data) => {
    const updated = await api.clients.update(clientId, data)
    setClientList(prev => prev.map(client => client.id === clientId ? updated : client))
    return updated
  }

  const addDevice = async (clientId, data) => {
    const created = await api.clients.addDevice(clientId, data)
    setDevices(prev => [...prev, { ...created, status:'offline', lat:0, lng:0, speed:0 }])
    setClientList(prev => prev.map(c => c.id === clientId ? { ...c, devicesCount: c.devicesCount + 1 } : c))
    return created
  }

  const addDeviceDirect = async (data) => {
    const created = await api.devices.create(data)
    setDevices(prev => [...prev, created])
    if (data.clientId) {
      setClientList(prev => prev.map(c => c.id === data.clientId ? { ...c, devicesCount: c.devicesCount + 1 } : c))
    }
    return created
  }

  const deleteDevice = async (deviceId) => {
    const dev = devices.find(d => d.id === deviceId)
    await api.devices.delete(deviceId)
    setDevices(prev => prev.filter(d => d.id !== deviceId))
    if (dev?.clientId || dev?.user_id) {
      const ownerId = dev.clientId || dev.user_id
      setClientList(prev => prev.map(c =>
        c.id === ownerId ? { ...c, devicesCount: Math.max(0, (c.devicesCount ?? 1) - 1) } : c
      ))
    }
  }

  const deleteClient = async (clientId) => {
    await api.clients.delete(clientId)
    setClientList(prev => prev.filter(c => c.id !== clientId))
  }

  return (
    <AppContext.Provider value={{
      lang, setLang,
      clientAuth, adminAuth,
      mustChangePassword, clearMustChange,
      devices, alertsList, clientList,
      loginClient, loginAdmin,
      logoutClient, logoutAdmin,
      toggleEngine,
      saveGeofence, removeGeofence,
      getClientDevices, getOnlineDevices,
      unreadCount, markAlertRead, markAllAlertsRead,
      addClient, updateClient, addDevice, addDeviceDirect, deleteDevice, deleteClient,
      refreshDevices: loadDevices,
      updateUserInContext,
      networkError,
      wsConnected,
      darkMode, toggleDarkMode, setDarkMode,
      pushEnabled, requestPushPermission, disablePush, sendBrowserNotification,
      subscriptionExpired, setSubscriptionExpired,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
