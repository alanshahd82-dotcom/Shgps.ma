// SHGPS API Client
    const API_URL = import.meta.env.VITE_API_URL || '/api'

    function getToken() { return localStorage.getItem('shgps_token') }

    async function apiFetch(path, options = {}) {
    const token = getToken()
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    return res.json()
    }

    export const api = {
    auth: {
      login:  (email, password) => apiFetch('/auth/login', { method:'POST', body: JSON.stringify({ email, password }) }),
      me:     ()               => apiFetch('/auth/me'),
      logout: ()               => apiFetch('/auth/logout', { method:'POST' }),
    },
    devices: {
      list:        ()           => apiFetch('/devices'),
      get:         (id)         => apiFetch(`/devices/${id}`),
      sendCommand: (id, type)   => apiFetch(`/devices/${id}/command`, { method:'POST', body: JSON.stringify({ type }) }),
      setGeofence: (id, data)   => apiFetch(`/devices/${id}/geofence`, { method:'POST', body: JSON.stringify(data) }),
      removeGeofence: (id, geofenceId) => apiFetch(`/devices/${id}/geofence`, { method:'DELETE', body: JSON.stringify({ geofenceId }) }),
    },
    clients: {
      list:      ()         => apiFetch('/clients'),
      create:    (data)     => apiFetch('/clients',     { method:'POST',   body: JSON.stringify(data) }),
      update:    (id, data) => apiFetch(`/clients/${id}`, { method:'PUT',    body: JSON.stringify(data) }),
      delete:    (id)       => apiFetch(`/clients/${id}`, { method:'DELETE' }),
      addDevice: (cid, data)=> apiFetch(`/clients/${cid}/devices`, { method:'POST', body: JSON.stringify(data) }),
    },
    alerts: {
      list:       ()   => apiFetch('/alerts'),
      markRead:   (id) => apiFetch(`/alerts/${id}/read`, { method:'PATCH' }),
      markAllRead:()   => apiFetch('/alerts/read-all',    { method:'PATCH' }),
    },
    map: {
      positions: () => apiFetch('/map/positions'),
    },
    }
