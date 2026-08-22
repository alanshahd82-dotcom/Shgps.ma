// ATHAR GPS API Client
const API_URL = import.meta.env.VITE_API_URL || '/api'
export const BOOT_TIMEOUT_MS = 8000

function getToken() { return localStorage.getItem('athargps_token') }

async function apiFetch(path, options = {}, timeoutMs = 0) {
  const token = getToken()
  const controller = timeoutMs > 0 && typeof AbortController !== 'undefined'
    ? new AbortController()
    : null
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      ...(controller && !options.signal ? { signal: controller.signal } : {}),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const error = new Error(data.error || `HTTP ${res.status}`)
      error.code = data.code
      error.status = res.status
      throw error
    }
    return res.json()
  } catch (error) {
    if (controller?.signal.aborted && !options.signal?.aborted) {
      error.code = 'BOOT_TIMEOUT'
    }
    throw error
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId)
  }
}

export const api = {
  subAdmins: {
    list:          ()                  => apiFetch('/sub-admins'),
    create:        (data)              => apiFetch('/sub-admins', { method: 'POST', body: JSON.stringify(data) }),
    update:        (id, data)          => apiFetch(`/sub-admins/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete:        (id)                => apiFetch(`/sub-admins/${id}`, { method: 'DELETE' }),
    getClients:    (id)                => apiFetch(`/sub-admins/${id}/clients`),
    assignClients: (id, clientIds)     => apiFetch(`/sub-admins/${id}/clients`, { method: 'PUT', body: JSON.stringify({ clientIds }) }),
  },
  auth: {
    login:          (email, password) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me:             ()                => apiFetch('/auth/me', {}, BOOT_TIMEOUT_MS),
    logout:         ()                => apiFetch('/auth/logout', { method: 'POST' }),
    changePassword: (currentPassword, newPassword) =>
      apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
    updateProfile:  (data) => apiFetch('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
    forgotPassword: (email) => apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword:  (token, newPassword) => apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  },
  devices: {
    list:           ()              => apiFetch('/devices'),
    get:            (id)            => apiFetch(`/devices/${id}`),
    create:         (data)          => apiFetch('/devices', { method: 'POST', body: JSON.stringify(data) }),
    quickAdd:       (data)          => apiFetch('/devices/quick-add', { method: 'POST', body: JSON.stringify(data) }),
    updateInfo:        (id, data) =>
      apiFetch(`/devices/${id}/info`, { method: 'PATCH', body: JSON.stringify(data) }),
    renewSubscription: (id, subscriptionPlanId) =>
      apiFetch(`/devices/${id}/subscription`, { method: 'PATCH', body: JSON.stringify({ subscriptionPlanId }) }),
    delete:         (id)            => apiFetch(`/devices/${id}`,    { method: 'DELETE' }),
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
  stats: {
    getPositions: (deviceId, from, to, maxPoints, signal) => {
      const params = new URLSearchParams({ deviceId: String(deviceId) })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (maxPoints != null) params.set('maxPoints', String(maxPoints))
      return apiFetch(`/stats/positions?${params}`, signal ? { signal } : {})
    },
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
      apiFetch('/driver-behavior/scores', {
        method: 'POST',
        body: JSON.stringify({ deviceId, ...payload }),
      }),
    getScores: (deviceId, days = 30) =>
      apiFetch(`/driver-behavior/scores?deviceId=${deviceId}&days=${days}`),
    getSummary: (deviceId) =>
      apiFetch(`/driver-behavior/summary?deviceId=${deviceId}`),
  },
  sharing: {
    create: (deviceId, expireHours = 24) => apiFetch('/sharing', { method: 'POST', body: JSON.stringify({ deviceId, expireHours }) }),
    get:    (token)    => apiFetch(`/sharing/${token}`),
  },
  leads: {
    submit: (data) => apiFetch('/leads', { method: 'POST', body: JSON.stringify(data) }),
    list:   ()     => apiFetch('/leads'),
  },
  geofences: {
    list:   ()     => apiFetch('/geofences'),
    get:    (id)   => apiFetch(`/geofences/${id}`),
    create: (data) => apiFetch('/geofences', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id)   => apiFetch(`/geofences/${id}`, { method: 'DELETE' }),
  },
  subUsers: {
    list:   ()           => apiFetch('/sub-users'),
    create: (data)       => apiFetch('/sub-users',       { method: 'POST',   body: JSON.stringify(data) }),
    update: (id, data)   => apiFetch(`/sub-users/${id}`, { method: 'PATCH',  body: JSON.stringify(data) }),
    remove: (id)         => apiFetch(`/sub-users/${id}`, { method: 'DELETE' }),
  },
  settings: {
    support: () => apiFetch('/settings/support'),
    renewalContacts: () => apiFetch('/settings/renewal-contacts'),
  },
  adminSettings: {
    support: (data) => apiFetch('/settings/support', { method: 'PUT', body: JSON.stringify(data) }),
    renewalContacts: (data) => apiFetch('/settings/renewal-contacts', { method: 'PUT', body: JSON.stringify(data) }),
  },
}
