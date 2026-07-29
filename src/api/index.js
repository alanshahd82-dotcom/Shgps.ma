// Athar GPS API Client
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
    updateSettings: (settings)        => apiFetch('/auth/me/settings', { method: 'PATCH', body: JSON.stringify(settings) }),
    changePassword: (data)            => apiFetch('/auth/me/password', { method: 'PATCH', body: JSON.stringify(data) }),
    updatePhone:    (phone)           => apiFetch('/auth/me/phone', { method: 'PATCH', body: JSON.stringify({ phone }) }),
    forgotPassword: (email)           => apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword:  (data)            => apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
  },
  devices: {
    list:        ()           => apiFetch('/devices'),
    get:         (id)         => apiFetch(`/devices/${id}`),
    sendCommand: (id, type)   => apiFetch(`/devices/${id}/command`, { method: 'POST', body: JSON.stringify({ type }) }),
    activate:    (code)       => apiFetch('/devices/activate', { method: 'POST', body: JSON.stringify({ activationCode: code }) }),
    saveGeofence:(id, data)   => apiFetch(`/devices/${id}/geofence`, { method: 'POST', body: JSON.stringify(data) }),
  },
  clients: {
    list:      ()         => apiFetch('/clients'),
    create:    (data)     => apiFetch('/clients',       { method: 'POST',   body: JSON.stringify(data) }),
    update:    (id, data) => apiFetch(`/clients/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
    delete:    (id)       => apiFetch(`/clients/${id}`, { method: 'DELETE' }),
    addDevice: (cid, data)=> apiFetch(`/clients/${cid}/devices`, { method: 'POST', body: JSON.stringify(data) }),
  },
  alerts: {
    list:        ()   => apiFetch('/alerts'),
    markRead:    (id) => apiFetch(`/alerts/${id}/read`, { method: 'PATCH' }),
    markAllRead: ()   => apiFetch('/alerts/read-all',   { method: 'PATCH' }),
  },
  map: {
    positions: () => apiFetch('/map/positions'),
  },
  stats: {
    trips:    (params) => apiFetch('/stats/trips?'    + new URLSearchParams(params)),
    monthly:  (params) => apiFetch('/stats/monthly?'  + new URLSearchParams(params)),
    activity: (params) => apiFetch('/stats/activity?' + new URLSearchParams(params)),
  },
  subscription: {
    get:    ()         => apiFetch('/subscription'),
  },
  admin: {
    stats:           ()         => apiFetch('/admin/stats'),
    revenue:         ()         => apiFetch('/admin/stats/revenue'),
    reports:         (params)   => apiFetch('/admin/reports?' + new URLSearchParams(params)),
    settings:        ()         => apiFetch('/admin/settings'),
    updateSettings:  (data)     => apiFetch('/admin/settings', { method: 'PATCH', body: JSON.stringify(data) }),
    subscriptions:   (params)   => apiFetch('/admin/subscriptions/admin?' + new URLSearchParams(params || {})),
    renewSubscription:(id, data)=> apiFetch(`/admin/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    createSubscription:(data)   => apiFetch('/admin/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
    registerDevice:  (data)     => apiFetch('/devices/admin', { method: 'POST', body: JSON.stringify(data) }),
    unregisteredDevices: ()     => apiFetch('/devices/admin/unregistered'),
  },
}
