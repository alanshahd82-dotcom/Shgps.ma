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
  const [authReady,  setAuthReady]          = useState(false)
  const [mustChangePassword, setMustChange] = useState(false)
  const [devices,      setDevices]          = useState([])
  const [alertsList,   setAlertsList]       = useState([])
  const [clientList,   setClientList]       = useState([])
  const [networkError, setNetworkError]     = useState(false)
  const [clientsError, setClientsError]     = useState(false)
  const [wsConnected,        setWsConnected]        = useState(false)
  const [subscriptionExpired, setSubscriptionExpired] = useState(false)
  const [darkMode,       setDarkModeState]  = useState(() => localStorage.getItem('athargps_darkmode') === 'true')
  const [pushEnabled,    setPushEnabled]    = useState(() => localStorage.getItem('athargps_push') === 'true')
  const wsRef      = useRef(null)
  const wsRetryRef = useRef(0) // exponential backoff counter
  const devicesRef = useRef([]) // mirror of devices — readable inside stale WS closures
  const positionPendingRef = useRef(new Map())
  const positionFlushTimerRef = useRef(null)

  // Keep devicesRef current so WS closures can look up device names without stale state
  useEffect(() => { devicesRef.current = devices }, [devices])

  function flushPositionUpdates() {
    const pending = positionPendingRef.current
    if (!pending.size) return
    positionPendingRef.current = new Map()
    setDevices(prev => {
      const updated = [...prev]
      for (const pos of pending.values()) {
        const idx = updated.findIndex(d => d.traccarId === pos.deviceId || d.traccar_id === pos.deviceId)
        if (idx !== -1 && updated[idx].trackingEnabled !== false) {
          updated[idx] = {
            ...updated[idx],
            lat:        pos.latitude,
            lng:        pos.longitude,
            speed:      pos.speed ?? 0,
            lastUpdate: pos.fixTime,
            fixTime:    pos.fixTime,
            course:     pos.course ?? pos.attributes?.course ?? updated[idx].course,
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

  function queuePositionUpdates(positions) {
    for (const pos of positions) {
      const deviceKey = pos.deviceId ?? pos.id
      if (deviceKey != null) positionPendingRef.current.set(String(deviceKey), pos)
    }
    if (positionFlushTimerRef.current) return
    flushPositionUpdates()
    positionFlushTimerRef.current = window.setTimeout(() => {
      positionFlushTimerRef.current = null
      flushPositionUpdates()
    }, 500)
  }

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
      const n = new Notification(title, { body, icon: '/athar-gps-mark.svg', badge: '/athar-gps-mark.svg', ...opts })
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
    const token = localStorage.getItem('athargps_token')
    if (!token) {
      setAuthReady(true)
      return
    }
    let cancelled = false

    async function hydrateSession() {
      try {
        // Revalidate the persisted session so a closed/reopened app keeps working
        // while revoked or expired tokens are removed instead of showing a blank app.
        const currentUser = await api.auth.me()
        if (cancelled) return
        if (currentUser.isAdmin) {
          setAdminAuth(currentUser)
          setClientAuth(null)
          localStorage.setItem('athargps_admin', JSON.stringify(currentUser))
          localStorage.removeItem('athargps_client')
        } else {
          setClientAuth(currentUser)
          setAdminAuth(null)
          localStorage.setItem('athargps_client', JSON.stringify(currentUser))
          localStorage.removeItem('athargps_admin')
        }
        setMustChange(!!currentUser.mustChangePassword)
        // Let protected pages render as soon as the session itself is valid.
        // Device/client/alert loading is secondary and must not blank the app.
        if (!cancelled) setAuthReady(true)
        await Promise.all([loadDevices(), loadAlerts(), currentUser.isAdmin ? loadClients() : Promise.resolve()])
        if (!cancelled) openWebSocket()
      } catch (error) {
        if (cancelled) return
        closeWebSocket()
        // Keep the persisted session during temporary network/server errors.
        // Only a confirmed 401 means that the token is no longer usable.
        if (error?.status === 401) {
          localStorage.removeItem('athargps_token')
          localStorage.removeItem('athargps_client')
          localStorage.removeItem('athargps_admin')
          setClientAuth(null)
          setAdminAuth(null)
          setDevices([])
          setAlertsList([])
          setClientList([])
        }
      } finally {
        if (!cancelled) setAuthReady(true)
      }
    }

    hydrateSession()
    return () => {
      cancelled = true
      closeWebSocket()
    }
  }, []) // eslint-disable-line

  // Refresh devices every 30 s, clients every 60 s
  useEffect(() => {
    if (!clientAuth && !adminAuth) return
    const devId     = setInterval(loadDevices, 30000)
    const clientsId = adminAuth ? setInterval(loadClients, 60000) : null
    return () => { clearInterval(devId); if (clientsId) clearInterval(clientsId) }
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
      const clients = Array.isArray(res) ? res : (res.data || [])
      setClientList(clients)
      setClientsError(false)
      return clients
    } catch (error) {
      setClientsError(true)
      return []
    }
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
          queuePositionUpdates(data.positions)
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
              id:         ev.id || Date.now(),
              type:       ev.type || 'event',
              deviceId:   ev.deviceId,
              deviceName: devicesRef.current.find(d => d.id === ev.deviceId)?.name || '',
              message:    ev.attributes?.message || ev.type,
              time:       ev.eventTime || new Date().toISOString(),
              read:       false,
            }))
            // Fire browser notifications for new alerts (if enabled)
            if (localStorage.getItem('athargps_push') === 'true' && Notification.permission === 'granted') {
              for (const ev of data.events) {
                try {
                  new Notification('ATHAR GPS', {
                    body: ev.attributes?.message || ev.type || 'تنبيه جديد',
                    icon: '/athar-gps-mark.svg',
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
    if (positionFlushTimerRef.current) {
      window.clearTimeout(positionFlushTimerRef.current)
      positionFlushTimerRef.current = null
    }
    positionPendingRef.current = new Map()
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
        const error = new Error('SUBSCRIPTION_EXPIRED')
        error.code = 'SUBSCRIPTION_EXPIRED'
        setSubscriptionExpired(true)
        throw error
      }
    }
    // The app uses one active API token. Never leave an admin session beside
    // the client session, otherwise admin requests can be sent as the client.
    localStorage.removeItem('athargps_admin')
    setAdminAuth(null)
    localStorage.setItem('athargps_last_email', email.trim().toLowerCase())
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
    // The app uses one active API token. Clear any previous client session
    // before loading admin-only data such as the client selector.
    localStorage.removeItem('athargps_client')
    setClientAuth(null)
    localStorage.setItem('athargps_token', data.token)
    localStorage.setItem('athargps_admin', JSON.stringify(data.user))
    setAdminAuth(data.user)
    setMustChange(!!data.user.mustChangePassword)
    loadDevices(); loadAlerts(); loadClients(); openWebSocket()
    return data
  }

  const logoutClient = async () => {
    try {
      if (localStorage.getItem('athargps_token')) await api.auth.logout()
    } catch {
      // The local session is still cleared when the server is unreachable.
    }
    closeWebSocket()
    localStorage.removeItem('athargps_token')
    localStorage.removeItem('athargps_client')
    localStorage.removeItem('athargps_admin')
    setClientAuth(null); setAdminAuth(null); setDevices([]); setAlertsList([]); setClientList([])
  }

  const logoutAdmin = () => {
    closeWebSocket()
    localStorage.removeItem('athargps_token')
    localStorage.removeItem('athargps_admin')
    localStorage.removeItem('athargps_client')
    setAdminAuth(null); setClientAuth(null); setDevices([]); setAlertsList([]); setClientList([])
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
      clientAuth, adminAuth, authReady,
       setClientAuth,
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
      refreshClients: loadClients,
      updateUserInContext,
      networkError, clientsError,
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
