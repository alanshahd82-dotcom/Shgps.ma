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

  useEffect(() => {
    if (!clientAuth && !adminAuth) return
    loadDevices()
    loadAlerts()
    if (adminAuth) loadClients()
    openWebSocket()
    return () => closeWebSocket()
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!clientAuth && !adminAuth) return
    const id = setInterval(loadDevices, 30000)
    return () => clearInterval(id)
  }, [clientAuth, adminAuth]) // eslint-disable-line

  async function loadDevices() {
    try { setDevices(await api.devices.list()) } catch {}
  }
  async function loadAlerts() {
    try { setAlertsList(await api.alerts.list()) } catch {}
  }
  async function loadClients() {
    try { setClientList(await api.clients.list()) } catch {}
  }

  function openWebSocket() {
    const token = localStorage.getItem('athargps_token')
    if (!token) return
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host     = window.location.host
    const url      = `${protocol}://${host}/api/socket?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)
    wsRef.current = ws
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
                  engineOn:   pos.attributes?.ignition ?? updated[idx].engineOn,
                  battery:    pos.attributes?.battery  ?? updated[idx].battery,
                  signal:     pos.attributes?.rssi     ?? updated[idx].signal,
                  fuel:       pos.attributes?.fuel     ?? updated[idx].fuel,
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
              if (idx !== -1) updated[idx] = { ...updated[idx], status: dev.status === 'online' ? 'online' : 'offline' }
            }
            return updated
          })
        }
      } catch {}
    }
    ws.onerror = () => {}
    ws.onclose = () => {}
  }

  function closeWebSocket() {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  const loginClient = async (email, password) => {
    try {
      const data = await api.auth.login(email, password)
      if (data.user?.isAdmin) return false
      localStorage.setItem('athargps_token', data.token)
      localStorage.setItem('athargps_client', JSON.stringify(data.user))
      setClientAuth(data.user)
      return true
    } catch { return false }
  }

  const loginAdmin = async (email, password) => {
    try {
      const data = await api.auth.login(email, password)
      if (!data.user?.isAdmin) return false
      localStorage.setItem('athargps_token', data.token)
      localStorage.setItem('athargps_admin', JSON.stringify(data.user))
      setAdminAuth(data.user)
      return true
    } catch { return false }
  }

  const logoutClient = () => {
    localStorage.removeItem('athargps_token')
    localStorage.removeItem('athargps_client')
    setClientAuth(null)
    setDevices([])
    closeWebSocket()
  }

  const logoutAdmin = () => {
    localStorage.removeItem('athargps_token')
    localStorage.removeItem('athargps_admin')
    setAdminAuth(null)
    setDevices([])
    setClientList([])
    closeWebSocket()
  }

  // ── Devices ─────────────────────────────────────────────────────────────────
  const toggleEngine = async (deviceId) => {
    const dev = devices.find(d => d.id === deviceId)
    if (!dev) return
    const type = dev.engineOn ? 'engineStop' : 'engineResume'
    try {
      await api.devices.sendCommand(deviceId, type)
      setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, engineOn: !d.engineOn } : d))
    } catch {}
  }

  const getClientDevices = (clientId) => devices.filter(d => d.clientId === clientId)
  const getOnlineDevices = () => devices.filter(d => d.status === 'online')

  // ── Alerts ──────────────────────────────────────────────────────────────────
  const unreadCount = alertsList.filter(a => !a.read && !a.is_read).length

  const markAlertRead = async (alertId) => {
    try {
      await api.alerts.markRead(alertId)
      setAlertsList(prev => prev.map(a => a.id === alertId ? { ...a, read: true, is_read: true } : a))
    } catch {}
  }

  const markAllAlertsRead = async () => {
    try {
      await api.alerts.markAllRead()
      setAlertsList(prev => prev.map(a => ({ ...a, read: true, is_read: true })))
    } catch {}
  }

  // ── Clients (Admin) ─────────────────────────────────────────────────────────
  const addClient = async (data) => {
    const created = await api.clients.create(data)
    setClientList(prev => [created, ...prev])
    return created
  }

  const addDevice = async (clientId, data) => {
    const created = await api.clients.addDevice(clientId, data)
    setDevices(prev => [...prev, { ...created, status: 'offline', lat: 0, lng: 0, speed: 0 }])
    setClientList(prev => prev.map(c => c.id === clientId ? { ...c, devicesCount: (c.devicesCount || 0) + 1 } : c))
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
      getClientDevices, getOnlineDevices,
      unreadCount, markAlertRead, markAllAlertsRead,
      addClient, addDevice, deleteClient,
      refreshDevices: loadDevices,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
