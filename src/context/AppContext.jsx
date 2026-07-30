import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { api } from '../api/index.js'

const AppContext = createContext(null)

function loadFromStorage(key) {
  try { return JSON.parse(localStorage.getItem(key)) } catch { return null }
}

export function AppProvider({ children }) {
  const [lang, setLang]             = useState('ar')
  const [clientAuth, setClientAuth] = useState(() => loadFromStorage('athargps_client'))
  const [adminAuth,  setAdminAuth]  = useState(() => loadFromStorage('athargps_admin'))
  const [devices,    setDevices]    = useState([])
  const [alertsList, setAlertsList] = useState([])
  const [clientList, setClientList] = useState([])
  const wsRef = useRef(null)

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

  // Refresh devices every 30 s (WS handles real-time; polling is a fallback)
  useEffect(() => {
    if (!clientAuth && !adminAuth) return
    const id = setInterval(loadDevices, 30000)
    return () => clearInterval(id)
  }, [clientAuth, adminAuth]) // eslint-disable-line

  async function loadDevices() {
    try { setDevices(await api.devices.list()) } catch (e) { console.error('devices:', e.message) }
  }
  async function loadAlerts() {
    try { setAlertsList(await api.alerts.list()) } catch (e) { console.error('alerts:', e.message) }
  }
  async function loadClients() {
    try { setClientList(await api.clients.list()) } catch (e) { console.error('clients:', e.message) }
  }

  // ── WebSocket live tracking ────────────────────────────────────────────────
  function openWebSocket() {
    const token = localStorage.getItem('athargps_token')
    if (!token) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host     = window.location.host
    const url      = `${protocol}://${host}/api/socket?token=${encodeURIComponent(token)}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => console.log('[WS] Live tracking connected')

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        // Traccar pushes { positions: [...], devices: [...] }
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

        // Traccar also pushes device status changes
        if (data.devices && data.devices.length > 0) {
          setDevices(prev => {
            const updated = [...prev]
            for (const dev of data.devices) {
              const idx = updated.findIndex(d => d.traccarId === dev.id || d.traccar_id === dev.id)
              if (idx !== -1) {
                updated[idx] = {
                  ...updated[idx],
                  status: dev.status === 'online' ? 'online' : 'offline',
                }
              }
            }
            return updated
          })
        }
      } catch {}
    }

    ws.onclose = (e) => {
      console.log('[WS] Disconnected', e.code)
      // Reconnect after 5 s unless we intentionally closed
      if (e.code !== 1000) {
        setTimeout(openWebSocket, 5000)
      }
    }

    ws.onerror = (err) => console.error('[WS] Error:', err)
  }

  function closeWebSocket() {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Logout')
      wsRef.current = null
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const loginClient = async (email, password) => {
    try {
      const { token, user } = await api.auth.login(email, password)
      if (user.isAdmin) throw new Error('Use admin login')
      localStorage.setItem('athargps_token',  token)
      localStorage.setItem('athargps_client', JSON.stringify(user))
      setClientAuth(user)
      loadDevices()
      loadAlerts()
      openWebSocket()
      return true
    } catch (e) { console.error(e.message); return false }
  }

  const loginAdmin = async (email, password) => {
    try {
      const { token, user } = await api.auth.login(email, password)
      if (!user.isAdmin) throw new Error('Not an admin account')
      localStorage.setItem('athargps_token', token)
      localStorage.setItem('athargps_admin', JSON.stringify(user))
      setAdminAuth(user)
      loadDevices()
      loadAlerts()
      loadClients()
      openWebSocket()
      return true
    } catch (e) { console.error(e.message); return false }
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

  const toggleEngine = async (deviceId) => {
    const dev = devices.find(d => d.id === deviceId)
    if (!dev) return
    try {
      await api.devices.sendCommand(deviceId, dev.engineOn ? 'engineStop' : 'engineResume')
      setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, engineOn: !d.engineOn } : d))
    } catch (e) { console.error('command:', e.message) }
  }

  // ── Geofencing ────────────────────────────────────────────────────────────
  const saveGeofence = async (deviceId, geofenceData) => {
    const result = await api.devices.setGeofence(deviceId, geofenceData)
    // تحديث حالة الجهاز بمعرّف السياج الجديد في الذاكرة
    setDevices(prev => prev.map(d =>
      d.id === deviceId
        ? { ...d, activeGeofenceId: result.geofence?.id ?? null, geofenceActive: true }
        : d
    ))
    return result
  }

  const removeGeofence = async (deviceId, geofenceId) => {
    await api.devices.removeGeofence(deviceId, geofenceId)
    setDevices(prev => prev.map(d =>
      d.id === deviceId
        ? { ...d, activeGeofenceId: null, geofenceActive: false }
        : d
    ))
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const getClientDevices = (clientId) =>
    adminAuth ? devices.filter(d => d.clientId === clientId) : devices

  const getOnlineDevices = () => devices.filter(d => d.status === 'online')

  const unreadCount = alertsList.filter(a => !a.read).length

  const markAlertRead = async (alertId) => {
    try {
      await api.alerts.markRead(alertId)
      setAlertsList(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a))
    } catch {}
  }

  const markAllAlertsRead = async () => {
    try {
      await api.alerts.markAllRead()
      setAlertsList(prev => prev.map(a => ({ ...a, read: true })))
    } catch {}
  }

  const addClient = async (data) => {
    const created = await api.clients.create(data)
    setClientList(prev => [created, ...prev])
    return created
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

  const deleteClient = async (clientId) => {
    await api.clients.delete(clientId)
    setClientList(prev => prev.filter(c => c.id !== clientId))
  }

  return (
    <AppContext.Provider value={{
      lang, setLang,
      clientAuth, adminAuth,
      devices, alertsList, clientList,
      loginClient, loginAdmin,
      logoutClient, logoutAdmin,
      toggleEngine,
      saveGeofence, removeGeofence,
      getClientDevices, getOnlineDevices,
      unreadCount, markAlertRead, markAllAlertsRead,
      addClient, addDevice, addDeviceDirect, deleteClient,
      refreshDevices: loadDevices,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
