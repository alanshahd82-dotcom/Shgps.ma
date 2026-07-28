import React, { createContext, useContext, useState, useEffect } from 'react'
    import { api } from '../api/index.js'

    const AppContext = createContext(null)

    function loadFromStorage(key) {
    try { return JSON.parse(localStorage.getItem(key)) } catch { return null }
    }

    export function AppProvider({ children }) {
    const [lang, setLang] = useState('ar')
    const [clientAuth, setClientAuth] = useState(() => loadFromStorage('shgps_client'))
    const [adminAuth,  setAdminAuth]  = useState(() => loadFromStorage('shgps_admin'))
    const [devices,    setDevices]    = useState([])
    const [alertsList, setAlertsList] = useState([])
    const [clientList, setClientList] = useState([])

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
    }, []) // eslint-disable-line

    // Refresh devices every 15 s
    useEffect(() => {
      if (!clientAuth && !adminAuth) return
      const id = setInterval(loadDevices, 15000)
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

    const loginClient = async (email, password) => {
      try {
        const { token, user } = await api.auth.login(email, password)
        if (user.isAdmin) throw new Error('Use admin login')
        localStorage.setItem('shgps_token',  token)
        localStorage.setItem('shgps_client', JSON.stringify(user))
        setClientAuth(user)
        return true
      } catch (e) { console.error(e.message); return false }
    }

    const loginAdmin = async (email, password) => {
      try {
        const { token, user } = await api.auth.login(email, password)
        if (!user.isAdmin) throw new Error('Not an admin account')
        localStorage.setItem('shgps_token', token)
        localStorage.setItem('shgps_admin', JSON.stringify(user))
        setAdminAuth(user)
        return true
      } catch (e) { console.error(e.message); return false }
    }

    const logoutClient = () => {
      localStorage.removeItem('shgps_token')
      localStorage.removeItem('shgps_client')
      setClientAuth(null); setDevices([]); setAlertsList([])
    }

    const logoutAdmin = () => {
      localStorage.removeItem('shgps_token')
      localStorage.removeItem('shgps_admin')
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
    