// SHGPS API Client
const API_URL = import.meta.env.VITE_API_URL || '/api'

function getToken() { return localStorage.getItem('athargps_token') }

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
    login:          (email, password) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me:             ()                => apiFetch('/auth/me'),
    logout:         ()                => apiFetch('/auth/logout', { method: 'POST' }),
    changePassword: (currentPassword, newPassword) =>
      apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
    updateProfile:  (data) => apiFetch('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  },
  devices: {
    list:           ()              => apiFetch('/devices'),
    get:            (id)            => apiFetch(`/devices/${id}`),
    create:         (data)          => apiFetch('/devices', { method: 'POST', body: JSON.stringify(data) }),
    quickAdd:       (data)          => apiFetch('/devices/quick-add', { method: 'POST', body: JSON.stringify(data) }),
    sendCommand:    (id, type)      => apiFetch(`/devices/${id}/command`, { method: 'POST', body: JSON.stringify({ type }) }),
    setGeofence:    (id, data)      => apiFetch(`/devices/${id}/geofence`, { method: 'POST', body: JSON.stringify(data) }),
    removeGeofence:    (id, geofenceId) => apiFetch(`/devices/${id}/geofence`, { method: 'DELETE', body: JSON.stringify({ geofenceId }) }),
    testConnection:    (imei)           => apiFetch(`/devices/test-connection?imei=${encodeURIComponent(imei)}`),
  },
  clients: {
    list:               ()              => apiFetch('/clients'),
    create:             (data)          => apiFetch('/clients',        { method: 'POST',   body: JSON.stringify(data) }),
    update:             (id, data)      => apiFetch(`/clients/${id}`,  { method: 'PUT',    body: JSON.stringify(data) }),
    delete:             (id)            => apiFetch(`/clients/${id}`,  { method: 'DELETE' }),
    addDevice:          (cid, data)     => apiFetch(`/clients/${cid}/devices`, { method: 'POST', body: JSON.stringify(data) }),
    resetPassword:      (id, password)  => apiFetch(`/clients/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
    updateSubscription: (id, data)      => apiFetch(`/clients/${id}/subscription`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  alerts: {
    list:        ()   => apiFetch('/alerts'),
    markRead:    (id) => apiFetch(`/alerts/${id}/read`,  { method: 'PATCH' }),
    markAllRead: ()   => apiFetch('/alerts/read-all',     { method: 'PATCH' }),
  },
  map: {
    positions: () => apiFetch('/map/positions'),
  },
  reports: {
    get: (deviceId, from, to) => {
      const params = new URLSearchParams({ deviceId })
      if (from) params.set('from', from)
      if (to)   params.set('to', to)
      return apiFetch(`/reports/trips?${params}`)
    },
    summary: (days = 7) => apiFetch(`/reports/daily-summary?days=${days}`),
  },
  admin: {
    stats:        () => apiFetch('/admin/stats'),
    monthlyStats: () => apiFetch('/admin/monthly-stats'),
    traccarSync:  () => apiFetch('/admin/traccar-sync', { method: 'POST' }),
  },
  maintenance: {
    list:   (deviceId) => apiFetch(`/maintenance?deviceId=${deviceId}`),
    add:    (data)     => apiFetch('/maintenance', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id)       => apiFetch(`/maintenance/${id}`, { method: 'DELETE' }),
  },
  driverBehavior: {
    saveScore: (deviceId, payload) =>
      fetch(`/api/driver-behavior/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ deviceId, ...payload }),
      }).then(r => r.json()),
    getScores: (deviceId, days = 30) =>
      fetch(`/api/driver-behavior/scores?deviceId=${deviceId}&days=${days}`, { credentials: 'include' }).then(r => r.json()),
    getSummary: (deviceId) =>
      fetch(`/api/driver-behavior/summary?deviceId=${deviceId}`, { credentials: 'include' }).then(r => r.json()),
  },
  sharing: {
    create: (deviceId, expireHours = 24) => apiFetch('/sharing', { method: 'POST', body: JSON.stringify({ deviceId, expireHours }) }),
    get:    (token)    => apiFetch(`/sharing/${token}`),
  },
  leads: {
    submit: (data) => apiFetch('/leads', { method: 'POST', body: JSON.stringify(data) }),
    list:   ()     => apiFetch('/leads'),
  },
}
