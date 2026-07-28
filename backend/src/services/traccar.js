import { config } from '../config.js'

    const base = () => config.traccar.url
    const auth = () => 'Basic ' + Buffer.from(`${config.traccar.email}:${config.traccar.password}`).toString('base64')

    async function call(path, opts = {}) {
    const res = await fetch(`${base()}${path}`, {
      ...opts,
      headers: { Authorization: auth(), 'Content-Type': 'application/json', ...opts.headers },
    })
    if (!res.ok) throw new Error(`Traccar ${res.status}: ${await res.text()}`)
    if (res.status === 204) return null
    return res.json()
    }

    export const getAllPositions  = ()            => call('/api/positions')
    export const getAllDevices    = ()            => call('/api/devices')
    export const getDevicesByUser = (uid)        => call(`/api/devices?userId=${uid}`)
    export const createDevice     = (name, imei) => call('/api/devices', { method:'POST', body: JSON.stringify({ name, uniqueId: imei }) })
    export const deleteDevice     = (id)         => call(`/api/devices/${id}`, { method:'DELETE' })
    export const createUser = (name, email, pw) =>
    call('/api/users', { method:'POST', body: JSON.stringify({ name, email, password: pw, deviceLimit:100, administrator:false }) })
    export const deleteUser  = (id) => call(`/api/users/${id}`,  { method:'DELETE' })
    export const linkDevice   = (userId, deviceId) => call('/api/permissions', { method:'POST',   body: JSON.stringify({ userId, deviceId }) })
    export const unlinkDevice = (userId, deviceId) => call('/api/permissions', { method:'DELETE', body: JSON.stringify({ userId, deviceId }) })
    export const getHistory = (deviceId, from, to) => {
    const p = new URLSearchParams({
      deviceId,
      from: from || new Date(Date.now()-86400000).toISOString(),
      to:   to   || new Date().toISOString(),
    })
    return call(`/api/reports/route?${p}`)
    }
    export const sendCommand = (deviceId, type) =>
    call('/api/commands/send', { method:'POST', body: JSON.stringify({ deviceId, type }) })
    