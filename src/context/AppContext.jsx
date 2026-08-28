import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { api } from '../api/index.js'

const AppContext = createContext(null)

function loadFromStorage(key) {
  try { return JSON.parse(localStorage.getItem(key)) } catch { return null }
}

// A tracker can keep sending packets while its GPS fix time stays unchanged
// (idle vehicle, weak sky view). Ranking a live position by fixTime alone made
// those frames look "older" than the stored snapshot, so they were discarded
// and the map stopped moving. Use the most recent timestamp Traccar provides.
function positionTimestamp(position) {
  const candidates = [
    position?.serverTime,
    position?.deviceTime,
    position?.fixTime,
    position?.lastUpdate,
    position?.last_update,
  ]
  let latest = null
  for (const value of candidates) {
    if (!value) continue
    const timestamp = new Date(value).getTime()
    if (Number.isFinite(timestamp) && (latest === null || timestamp > latest)) latest = timestamp
  }
  return latest
}

function validLivePosition(position) {
  const latitude = Number(position?.latitude ?? position?.lat)
  const longitude = Number(position?.longitude ?? position?.lng)
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180 &&
    !(Math.abs(latitude) < 0.01 && Math.abs(longitude) < 0.01)
}

function sameDevice(first, second) {
  return first != null && second != null && String(first) === String(second)
}

function mergeDeviceSnapshots(previous, next) {
  const previousById = new Map(previous.map(device => [String(device.id), device]))
  return next.map(incoming => {
    const current = previousById.get(String(incoming.id))
    if (!current) return incoming

    const incomingHasPosition = validLivePosition(incoming)
    const incomingTime = positionTimestamp(incoming)
    const currentTime = positionTimestamp(current)
    const incomingIsNewer = incomingHasPosition &&
      (currentTime === null || incomingTime === null || incomingTime >= currentTime)

    if (incomingIsNewer) return { ...current, ...incoming }

    return {
      ...current,
      ...incoming,
      lat: current.lat ?? current.last_lat,
      lng: current.lng ?? current.last_lng,
      speed: current.speed,
      course: current.course,
      fixTime: current.fixTime,
      lastUpdate: current.lastUpdate,
    }
  })
}

export function AppProvider({ children }) {
  const [lang, setLang]                     = useState('fr')
  const [clientAuth, setClientAuth]         = useState(() => loadFromStorage('athargps_client'))
  const [adminAuth,  setAdminAuth]          = useState(() => loadFromStorage('athargps_admin'))
  const [authReady,  setAuthReady]          = useState(false)
  const [authBootstrapError, setAuthBootstrapError] = useState(false)
  const [mustChangePassword, setMustChange] = useState(false)
  const [devices,      setDevices]          = useState([])
  const [alertsList,   setAlertsList]       = useState([])
  const [clientList,   setClientList]       = useState([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [devicesLoaded, setDevicesLoaded]   = useState(false)
  const [alertsLoading, setAlertsLoading]   = useState(false)
  const [alertsLoaded, setAlertsLoaded]     = useState(false)
  const [alertsError, setAlertsError]       = useState(false)
  const [networkError, setNetworkError]     = useState(false)
  const [clientsError, setClientsError]     = useState(false)
  const [wsConnected,        setWsConnected]        = useState(false)
  const [subscriptionExpired, setSubscriptionExpired] = useState(false)
  const [darkMode,       setDarkModeState]  = useState(() => localStorage.getItem('athargps_darkmode') === 'true')
  const [pushEnabled,    setPushEnabled]    = useState(() => localStorage.getItem('athargps_push') === 'true')
  const [powerDisconnectNotice, setPowerDisconnectNotice] = useState(null)
  const wsRef      = useRef(null)
  const wsRetryRef = useRef(0) // exponential backoff counter
  const wsHeartbeatRef = useRef(null)
  const wsWatchdogRef = useRef(null)
  const wsConnectTimeoutRef = useRef(null)
  const wsPingSentAtRef = useRef(0)
  const wsReconnectRef = useRef(null)
  const wsLastActivityRef = useRef(0)
  const wsPollingRef = useRef(null)
  const wsEventSequenceRef = useRef(0)
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
        const idx = updated.findIndex(d =>
          sameDevice(d.traccarId ?? d.traccar_id, pos.deviceId ?? pos.id)
        )
        if (idx !== -1 && updated[idx].trackingEnabled !== false && validLivePosition(pos)) {
          const current = updated[idx]
          const incomingTime = positionTimestamp(pos)
          const currentTime = positionTimestamp(current)
          if (incomingTime !== null && currentTime !== null && incomingTime < currentTime) continue
          const powerDisconnected = Boolean(pos.powerDisconnected)
          const latitude = Number(pos.latitude ?? pos.lat)
          const longitude = Number(pos.longitude ?? pos.lng)
          updated[idx] = {
            ...current,
            lat:        latitude,
            lng:        longitude,
            speed:      pos.speed ?? 0,
            // "Last update" means last contact with the tracker, not last GPS
            // lock: serverTime is the packet arrival, fixTime stays for the map.
            lastUpdate: pos.serverTime ?? pos.deviceTime ?? pos.fixTime ?? current.lastUpdate,
            serverTime: pos.serverTime ?? current.serverTime,
            deviceTime: pos.deviceTime ?? current.deviceTime,
            fixTime:    pos.fixTime ?? current.fixTime,
            course:     pos.course ?? pos.attributes?.course ?? current.course,
            // A fresh position proves the tracker is connected. External
            // vehicle-power loss is a separate flag, not an offline state.
            status:     'online',
            engineOn:   pos.attributes?.ignition   ?? current.engineOn,
            voltage:   pos.voltage
              ?? pos.attributes?.voltage
              ?? pos.attributes?.power
              ?? current.voltage
              ?? null,
            powerDisconnected,
            signal:     pos.attributes?.rssi       ?? current.signal,
            fuel:       pos.attributes?.fuel       ?? current.fuel,
          }
        }
      }
      return updated
    })
  }

  function queuePositionUpdates(positions) {
    for (const pos of positions) {
      const deviceKey = pos.deviceId ?? pos.id
      if (deviceKey != null && validLivePosition(pos)) {
        const key = String(deviceKey)
        const previous = positionPendingRef.current.get(key)
        const previousTime = positionTimestamp(previous)
        const nextTime = positionTimestamp(pos)
        if (!previous || previousTime === null || nextTime === null || nextTime >= previousTime) {
          positionPendingRef.current.set(key, pos)
        }
      }
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
        if (!cancelled) {
          setAuthReady(true)
          // Live updates must never wait for the initial REST collections.
          openWebSocket()
        }
        void Promise.all([
          loadDevices(),
          loadAlerts(),
          currentUser.isAdmin ? loadClients() : Promise.resolve(),
        ])
      } catch (error) {
        if (cancelled) return
        closeWebSocket()
        if (localStorage.getItem('athargps_token')) { window.setTimeout(() => { openWebSocket() }, 5000) }
        const isNetworkFailure = error?.code === 'BOOT_TIMEOUT'
          || error?.name === 'AbortError'
          || error?.name === 'TypeError'
        if (isNetworkFailure) setAuthBootstrapError(true)
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
    setDevicesLoading(true)
    try {
      const nextDevices = await api.devices.list()
      setDevices(prev => mergeDeviceSnapshots(prev, Array.isArray(nextDevices) ? nextDevices : []))
      setNetworkError(false)
    } catch {
      setNetworkError(true)
    } finally {
      setDevicesLoaded(true)
      setDevicesLoading(false)
    }
  }
  async function loadAlerts() {
    setAlertsLoading(true)
    setAlertsError(false)
    try {
      const nextAlerts = await api.alerts.list()
      const incoming = Array.isArray(nextAlerts) ? nextAlerts : []
      setAlertsList(prev => {
        const seen = new Set()
        const result = []
        for (const alert of [...incoming, ...prev]) {
          const stableId = alert?.id ?? alert?.eventId ?? alert?.event_id
          if (stableId != null) {
            const key = String(stableId)
            if (seen.has(key)) continue
            seen.add(key)
          }
          result.push(alert)
        }
        return result.slice(0, 100)
      })
    } catch {
      setAlertsError(true)
    } finally {
      setAlertsLoaded(true)
      setAlertsLoading(false)
    }
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
    if (wsRef.current && [WebSocket.OPEN, WebSocket.CONNECTING].includes(wsRef.current.readyState)) return

    const wsBase = import.meta.env.VITE_WS_URL || (() => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      return `${protocol}://${window.location.host}/api/socket`
    })()
    const url = `${wsBase}?token=${encodeURIComponent(token)}`

    const ws = new WebSocket(url)
    wsRef.current = ws
    wsLastActivityRef.current = Date.now()
    wsConnectTimeoutRef.current = window.setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) ws.close()
    }, 8000)

    ws.onopen = () => {
      if (wsConnectTimeoutRef.current) {
        window.clearTimeout(wsConnectTimeoutRef.current)
        wsConnectTimeoutRef.current = null
      }
      setWsConnected(true)
      wsRetryRef.current = 0 // reset backoff on success
      stopFallbackPolling()
      wsLastActivityRef.current = Date.now()
      if (wsHeartbeatRef.current) window.clearInterval(wsHeartbeatRef.current)
      if (wsWatchdogRef.current) window.clearInterval(wsWatchdogRef.current)
      wsHeartbeatRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          wsPingSentAtRef.current = Date.now()
          ws.send('ping')
        }
      }, 20000)
      wsWatchdogRef.current = window.setInterval(() => {
        if (wsPingSentAtRef.current && Date.now() - wsPingSentAtRef.current > 10000) ws.close()
      }, 5000)
    }

    ws.onmessage = (event) => {
      wsLastActivityRef.current = Date.now()
      wsPingSentAtRef.current = 0
      try {
        const data = JSON.parse(event.data)

        if (data.positions && data.positions.length > 0) {
          queuePositionUpdates(data.positions)
        }

        if (data.devices && data.devices.length > 0) {
          setDevices(prev => {
            const updated = [...prev]
            for (const dev of data.devices) {
              const idx = updated.findIndex(d => sameDevice(d.traccarId ?? d.traccar_id, dev.id))
              if (idx !== -1) {
                updated[idx] = { ...updated[idx], status: dev.status }
              }
            }
            return updated
          })
        }

        if (data.events && data.events.length > 0) {
          // Stable server IDs are safe to deduplicate. Events without one are
          // kept conservatively because their distinct identity is unknown.
          setAlertsList(prev => {
            const seenIds = new Set(prev.map(item => item.id).filter(id => id != null).map(String))
            const newAlerts = data.events.map(ev => {
              const stableId = ev.id ?? ev.eventId ?? ev.event_id ?? null
              const eventId = stableId != null
                ? String(stableId)
                : `ws-${Date.now()}-${wsEventSequenceRef.current++}`
              const attributes = ev.attributes && typeof ev.attributes === 'object' ? ev.attributes : {}
              const dataFields = ev.data && typeof ev.data === 'object' ? ev.data : {}
              const deviceId = ev.deviceId ?? ev.device_id ?? ev.vehicleId ?? null
              const device = devicesRef.current.find(d =>
                sameDevice(d.id, deviceId)
                  || sameDevice(d.traccarId ?? d.traccar_id, deviceId)
              )
              return {
                id:         eventId,
                type:       ev.type || 'event',
                deviceId,
                deviceName: device?.name || '',
                message:    ev.message || attributes.message || dataFields.message || ev.type,
                time:       ev.eventTime || ev.event_time || new Date().toISOString(),
                latitude:   ev.latitude ?? ev.lat ?? attributes.latitude ?? attributes.lat ?? dataFields.latitude ?? dataFields.lat,
                longitude:  ev.longitude ?? ev.lng ?? attributes.longitude ?? attributes.lng ?? dataFields.longitude ?? dataFields.lng,
                position:   ev.position || dataFields.position,
                data:       ev.data || attributes,
                read:       false,
                _stableId:  stableId != null ? String(stableId) : null,
              }
            })
            const uniqueAlerts = newAlerts.filter(alert => {
              if (alert._stableId == null) return true
              if (seenIds.has(alert._stableId)) return false
              seenIds.add(alert._stableId)
              return true
            })
            // Fire browser notifications for new alerts (if enabled)
            if (localStorage.getItem('athargps_push') === 'true' && Notification.permission === 'granted') {
              for (const alert of uniqueAlerts) {
                try {
                  new Notification('ATHAR GPS', {
                    body: alert.message || alert.type || 'تنبيه جديد',
                    icon: '/athar-gps-mark.svg',
                  })
                } catch { /* ignore */ }
              }
            }
            return [...uniqueAlerts, ...prev].slice(0, 100) // keep last 100
          })
        }

        if (data.type === 'device:power-disconnected') {
          const incoming = data.alert || {}
          const alertData = incoming.data && typeof incoming.data === 'object' ? incoming.data : {}
          const silenceConfirmed = alertData.trigger === 'silence'
          const device = devicesRef.current.find(item =>
            String(item.id) === String(data.deviceId)
              || String(item.traccarId ?? item.traccar_id) === String(data.traccarId)
          )
          const createdAt = incoming.createdAt || new Date().toISOString()
          const alert = {
            id: incoming.id || `power-${data.deviceId}-${createdAt}`,
            type: 'power_disconnected',
            deviceId: data.deviceId,
            deviceName: incoming.deviceName || device?.name || '',
            message: incoming.message || '',
            created_at: createdAt,
            time: createdAt,
            data: incoming.data,
            read: false,
          }
          setAlertsList(prev => prev.some(item => String(item.id) === String(alert.id))
            ? prev
            : [alert, ...prev].slice(0, 100))
          // Mark ONLY the specific device as disconnected — never touch other devices.
          setDevices(prev => prev.map(item => (
            String(item.id) === String(data.deviceId)
              || String(item.traccarId ?? item.traccar_id) === String(data.traccarId)
              ? {
                  ...item,
                  status: silenceConfirmed ? 'offline' : 'online',
                  voltage: null,
                  powerDisconnected: true,
                }
              : item
          )))
          setPowerDisconnectNotice(alert)
          // The in-app banner is the single immediate notification for this
          // event. Do not stack a browser push on top of the same alert.
        }

        if (data.type === 'device:power-restored') {
          const incoming = data.alert || {}
          const device = devicesRef.current.find(item =>
            String(item.id) === String(data.deviceId)
              || String(item.traccarId ?? item.traccar_id) === String(data.traccarId)
          )
          const createdAt = incoming.createdAt || new Date().toISOString()
          const alert = {
            id: incoming.id || `power-restored-${data.deviceId}-${createdAt}`,
            type: 'power_restored',
            deviceId: data.deviceId,
            deviceName: incoming.deviceName || device?.name || '',
            message: incoming.message || '',
            created_at: createdAt,
            time: createdAt,
            data: incoming.data,
            read: false,
          }
          setAlertsList(prev => prev.some(item => String(item.id) === String(alert.id))
            ? prev
            : [alert, ...prev].slice(0, 100))
          // Clear disconnect flag ONLY for the restored device — never affect other devices.
          setDevices(prev => prev.map(item => (
            String(item.id) === String(data.deviceId)
              || String(item.traccarId ?? item.traccar_id) === String(data.traccarId)
              ? { ...item, status: 'online', powerDisconnected: false }
              : item
          )))
          // Dismiss the disconnect banner if it was for this device.
          setPowerDisconnectNotice(prev =>
            prev && (String(prev.deviceId) === String(data.deviceId)) ? null : prev
          )
          // The alert list remains the single notification record for restore.
        }
      } catch {}
    }

    ws.onclose = () => {
      if (wsConnectTimeoutRef.current) {
        window.clearTimeout(wsConnectTimeoutRef.current)
        wsConnectTimeoutRef.current = null
      }
      if (wsRef.current === ws) wsRef.current = null
      setWsConnected(false)
      if (wsHeartbeatRef.current) {
        window.clearInterval(wsHeartbeatRef.current)
        wsHeartbeatRef.current = null
      }
      if (wsWatchdogRef.current) {
        window.clearInterval(wsWatchdogRef.current)
        wsWatchdogRef.current = null
      }
      startFallbackPolling()
      // Exponential backoff: 1s, 2s, 4s, 8s, max 15s.
      if (localStorage.getItem('athargps_token')) {
        const delay = Math.min(1000 * Math.pow(2, wsRetryRef.current), 15000)
        wsRetryRef.current += 1
        if (wsReconnectRef.current) window.clearTimeout(wsReconnectRef.current)
        wsReconnectRef.current = window.setTimeout(() => {
          wsReconnectRef.current = null
          openWebSocket()
        }, delay)
      }
    }

    ws.onerror = () => ws.close()
  }

  function startFallbackPolling() {
    if (wsPollingRef.current || !localStorage.getItem('athargps_token')) return
    const poll = async () => {
      if (wsConnected || document.hidden) return
      try {
        const nextDevices = await api.map.positions()
        if (Array.isArray(nextDevices) && !wsConnected) {
          setDevices(prev => mergeDeviceSnapshots(prev, nextDevices))
        }
      } catch {}
    }
    poll()
    // WebSocket is the primary live path; keep the fallback gentle for the
    // small production server while avoiding a 15-second stale UI window.
    wsPollingRef.current = window.setInterval(poll, 5000)
  }

  function stopFallbackPolling() {
    if (!wsPollingRef.current) return
    window.clearInterval(wsPollingRef.current)
    wsPollingRef.current = null
  }

  function closeWebSocket() {
    if (wsRef.current) {
      wsRef.current.onclose = null // prevent reconnect loop
      wsRef.current.close()
      wsRef.current = null
    }
    if (wsHeartbeatRef.current) {
      window.clearInterval(wsHeartbeatRef.current)
      wsHeartbeatRef.current = null
    }
    if (wsWatchdogRef.current) {
      window.clearInterval(wsWatchdogRef.current)
      wsWatchdogRef.current = null
    }
    if (wsConnectTimeoutRef.current) {
      window.clearTimeout(wsConnectTimeoutRef.current)
      wsConnectTimeoutRef.current = null
    }
    if (wsReconnectRef.current) {
      window.clearTimeout(wsReconnectRef.current)
      wsReconnectRef.current = null
    }
    stopFallbackPolling()
    if (positionFlushTimerRef.current) {
      window.clearTimeout(positionFlushTimerRef.current)
      positionFlushTimerRef.current = null
    }
    positionPendingRef.current = new Map()
    setWsConnected(false)
    wsRetryRef.current = 0
    wsPingSentAtRef.current = 0
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
    setDevicesLoaded(false)
    setAlertsLoaded(false)
    setAlertsError(false)
    setNetworkError(false)
    setAuthBootstrapError(false)
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
    setDevicesLoaded(false)
    setAlertsLoaded(false)
    setAlertsError(false)
    setNetworkError(false)
    setAuthBootstrapError(false)
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
    setDevicesLoaded(false); setAlertsLoaded(false); setAlertsError(false)
  }

  const logoutAdmin = () => {
    closeWebSocket()
    localStorage.removeItem('athargps_token')
    localStorage.removeItem('athargps_admin')
    localStorage.removeItem('athargps_client')
    setAdminAuth(null); setClientAuth(null); setDevices([]); setAlertsList([]); setClientList([])
    setDevicesLoaded(false); setAlertsLoaded(false); setAlertsError(false)
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
    const normalizedDeviceId = String(deviceId)
    setDevices(prev => prev.map(d => String(d.id) === normalizedDeviceId ? { ...d, engineOn: !turnOff } : d))
    try {
      await api.devices.sendCommand(deviceId, turnOff ? 'engineStop' : 'engineResume')
    } catch (err) {
      setDevices(prev => prev.map(d => String(d.id) === normalizedDeviceId ? { ...d, engineOn: !!turnOff } : d))
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
    setDevices(prev => [...prev, { ...created, status:'offline', lat:null, lng:null, speed:null, engineOn:null }])
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
    <>
      <AppContext.Provider value={{
        lang, setLang,
        clientAuth, adminAuth, authReady,
         authBootstrapError,
         setClientAuth,
        mustChangePassword, clearMustChange,
        devices, alertsList, clientList,
         devicesLoading, devicesLoaded,
         alertsLoading, alertsLoaded, alertsError,
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
      {powerDisconnectNotice && (
        <div
          role="alert"
          className="fixed inset-x-3 top-[calc(1rem+env(safe-area-inset-top))] z-[1200] mx-auto flex max-w-xl items-start gap-3 rounded-2xl border border-red-400/30 bg-[#35131c]/95 px-4 py-3 text-white shadow-2xl backdrop-blur"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-300" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">
              {lang === 'ar' ? 'تم فصل تغذية المركبة' : 'Alimentation véhicule débranchée'}
            </p>
            {powerDisconnectNotice.deviceName && (
              <p className="mt-0.5 truncate text-xs text-red-100/80">{powerDisconnectNotice.deviceName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPowerDisconnectNotice(null)}
            className="shrink-0 rounded-lg p-1 text-red-100/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={lang === 'ar' ? 'إغلاق التنبيه' : 'Fermer l’alerte'}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  )
}

export const useApp = () => useContext(AppContext)
