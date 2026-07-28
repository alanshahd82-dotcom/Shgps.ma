import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { devices as initialDevices, clients, alerts as initialAlerts, DEMO_CLIENT, DEMO_ADMIN } from '../data/mockData'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [lang, setLang] = useState('ar')
  const [clientAuth, setClientAuth] = useState(null)
  const [adminAuth, setAdminAuth] = useState(null)
  const [devices, setDevices] = useState(initialDevices)
  const [alertsList, setAlertsList] = useState(initialAlerts)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [clientList, setClientList] = useState(clients)

  // Update html dir on lang change
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  // Live tracking simulation — move devices slightly every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setDevices(prev => prev.map(d => {
        if (d.status !== 'online') return d
        const speedFactor = d.speed / 3600 * 2 * 0.0001
        const angle = Math.random() * Math.PI * 2
        const deltaLat = Math.cos(angle) * speedFactor
        const deltaLng = Math.sin(angle) * speedFactor
        // Small random speed variation
        const newSpeed = Math.max(0, d.speed + (Math.random() - 0.5) * 4)
        return {
          ...d,
          lat: d.lat + deltaLat,
          lng: d.lng + deltaLng,
          speed: Math.round(newSpeed),
          lastUpdate: new Date().toISOString(),
        }
      }))
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const loginClient = (email, password) => {
    if (email === DEMO_CLIENT.email && password === DEMO_CLIENT.password) {
      const client = clients.find(c => c.id === 'c1')
      setClientAuth(client)
      return true
    }
    return false
  }

  const loginAdmin = (email, password) => {
    if (email === DEMO_ADMIN.email && password === DEMO_ADMIN.password) {
      setAdminAuth({ name: 'مدير النظام', email })
      return true
    }
    return false
  }

  const logoutClient = () => setClientAuth(null)
  const logoutAdmin = () => setAdminAuth(null)

  const toggleEngine = (deviceId) => {
    setDevices(prev => prev.map(d =>
      d.id === deviceId ? { ...d, engineOn: !d.engineOn, speed: !d.engineOn ? d.speed : 0 } : d
    ))
  }

  const getClientDevices = (clientId) =>
    devices.filter(d => d.clientId === clientId)

  const getOnlineDevices = () => devices.filter(d => d.status === 'online')

  const unreadCount = alertsList.filter(a => !a.read).length

  const markAlertRead = (alertId) => {
    setAlertsList(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a))
  }

  const markAllAlertsRead = () => {
    setAlertsList(prev => prev.map(a => ({ ...a, read: true })))
  }

  const addClient = (newClient) => {
    setClientList(prev => [...prev, { ...newClient, id: `c${Date.now()}`, status: 'active', devicesCount: 0, joinDate: new Date().toISOString().split('T')[0] }])
  }

  const deleteClient = (clientId) => {
    setClientList(prev => prev.filter(c => c.id !== clientId))
  }

  const addDevice = (newDevice) => {
    setDevices(prev => [...prev, {
      ...newDevice,
      id: `d${Date.now()}`,
      status: 'offline',
      lat: 33.5731 + (Math.random() - 0.5) * 2,
      lng: -7.5898 + (Math.random() - 0.5) * 2,
      speed: 0,
      battery: Math.floor(Math.random() * 40 + 60),
      signal: 2,
      lastUpdate: new Date().toISOString(),
      engineOn: false,
      fuel: 50,
      totalDistance: 0,
      trips: []
    }])
  }

  return (
    <AppContext.Provider value={{
      lang, setLang,
      clientAuth, loginClient, logoutClient,
      adminAuth, loginAdmin, logoutAdmin,
      devices, setDevices,
      alertsList, setAlertsList,
      unreadCount, markAlertRead, markAllAlertsRead,
      selectedDevice, setSelectedDevice,
      clientList, addClient, deleteClient,
      toggleEngine,
      getClientDevices,
      getOnlineDevices,
      addDevice,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
