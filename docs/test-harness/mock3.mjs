// Mock of the ATHAR GPS API + WebSocket for local browser tests (never touches production).
import http from 'node:http'
import { createRequire } from 'node:module'
const require = createRequire('/home/user/Shgps.ma/backend/package.json')
const { WebSocketServer } = require('ws')

const iso = ms => new Date(Date.now() - ms).toISOString()
const min = 60e3, day = 86400e3
let activeCommandBody = { command: null }
let devices = [
  { id: 1, traccarId: 37, name: 'Dacia Logan', imei: '000000000000001', type: 'car', plate: '11-A-111', clientId: 5, clientName: 'Client A', clientPhone: '0600000001', status: 'online', lat: 33.5731, lng: -7.5898, locationAt: iso(2 * min), locationSource: 'live', gpsValid: true, speed: 42, lastUpdate: iso(1 * min), voltage: 13.1, trackingEnabled: true, subscriptionStatus: 'active', subscriptionPlanId: '3_months', engineOn: true },
  { id: 2, traccarId: 136, name: 'Honda PCX (sans GPS)', imei: '000000000000002', type: 'bike', plate: '22-B-222', clientId: 5, clientName: 'Client A', clientPhone: '0600000001', status: 'online', lat: 33.9, lng: -6.9, locationAt: iso(55 * min), locationSource: 'stored', gpsValid: false, speed: 0, lastUpdate: iso(1 * min), voltage: 12.8, trackingEnabled: true, subscriptionStatus: 'active', subscriptionPlanId: '3_months' },
  { id: 3, traccarId: 55, name: 'Camion Atlas', imei: '000000000000003', type: 'truck', plate: '33-C-333', clientId: 6, clientName: 'Client B', clientPhone: '0600000002', status: 'offline', lat: 34.02, lng: -6.84, locationAt: iso(13 * day), locationSource: 'stored', gpsValid: null, speed: null, lastUpdate: iso(13 * day), voltage: null, trackingEnabled: true, subscriptionStatus: 'active', subscriptionPlanId: '6_months' },
  { id: 4, traccarId: 70, name: 'Renault Kangoo (jamais localisé)', imei: '000000000000004', type: 'car', plate: '44-D-444', clientId: 6, clientName: 'Client B', clientPhone: '0600000002', status: 'offline', lat: null, lng: null, locationAt: null, locationSource: null, gpsValid: null, speed: null, lastUpdate: null, voltage: null, trackingEnabled: true, subscriptionStatus: 'active', subscriptionPlanId: '12_months' },
]
const clients = [
  { id: 5, name: 'Client A', email: 'a@client.ma', phone: '0600000001', maxDevices: 5, devicesCount: 2, isActive: true, status: 'active', subscription: 'Basic' },
  { id: 6, name: 'Client B', email: 'b@client.ma', phone: '0600000002', maxDevices: 5, devicesCount: 2, isActive: true, status: 'active', subscription: 'Basic' },
]
const seen = []
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
const wss = new WebSocketServer({ noServer: true })
const sockets = new Set()
let pongs = true
wss.on('connection', ws => {
  sockets.add(ws)
  ws.on('message', m => { if (m.toString() === 'ping' && pongs) ws.send('pong') })
  ws.on('close', () => sockets.delete(ws))
})
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0]
  const isClient = (req.headers.authorization || '').includes('client-token')
  let body = ''
  req.on('data', c => body += c)
  req.on('end', () => {
    if (req.method !== 'GET' && !url.startsWith('/__')) seen.push({ url, body: body ? JSON.parse(body) : null })
    if (url === '/__seen') return send(res, 200, seen)
    if (url === '/__state') { devices = JSON.parse(body); return send(res, 200, { ok: true }) }
    if (url === '/__push') { for (const s of sockets) s.send(body); return send(res, 200, { sockets: sockets.size }) }
    if (url === '/__kill') { for (const s of sockets) s.terminate(); return send(res, 200, { ok: true }) }
    if (url === '/__nopong') { pongs = false; return send(res, 200, { ok: true }) }
    if (url === '/__sockets') return send(res, 200, { sockets: sockets.size })
    if (url === '/api/auth/me') return send(res, 200, isClient ? { id: 5, name: 'Client A', email: 'a@client.ma', isAdmin: false } : { id: 1, name: 'Admin', email: 'admin@x.ma', isAdmin: true })
    if (url === '/api/devices' && req.method === 'GET') return send(res, 200, devices)
    if (/^\/api\/devices\/\d+\/command$/.test(url) && req.method === 'POST') {
      const b = body ? JSON.parse(body) : {}
      if (!b.password) return send(res, 400, { error: 'Password is required', code: 'PASSWORD_REQUIRED' })
      if (b.password !== 'Secret123') return send(res, 403, { error: 'Incorrect password', code: 'INVALID_PASSWORD' })
      return send(res, 200, { ok: true, command: { id: 77, status: 'unconfirmed' } })
    }
    if (url === '/__command') { activeCommandBody = JSON.parse(body); return send(res, 200, { ok: true }) }
    if (/^\/api\/devices\/\d+\/active-command$/.test(url)) return send(res, 200, activeCommandBody)
    if (/^\/api\/devices\/\d+$/.test(url) && req.method === 'GET') return send(res, 200, devices.find(d => d.id === Number(url.split('/').pop())) || {})
    if (url === '/api/devices/quick-add' && req.method === 'POST') return send(res, 201, { id: 50, name: 'New', imei: JSON.parse(body).imei, phone: JSON.parse(body).phone, clientId: JSON.parse(body).clientId })
    if (/^\/api\/devices\/\d+\/replace$/.test(url) && req.method === 'POST') return send(res, 200, { ok: true })
    if (url === '/api/clients') return send(res, 200, { data: clients, total: clients.length, page: 1, limit: 50 })
    if (url === '/api/alerts') return send(res, 200, [])
    if (url === '/api/map/positions') return send(res, 200, devices)
    if (url === '/api/map/config') return send(res, 200, { provider: 'osm', mapboxToken: '' })
    if (url === '/api/admin/stats') return send(res, 200, { totalDevices: devices.length, onlineDevices: 2, offlineDevices: 2, totalClients: 2 })
    if (url === '/api/admin/monthly-stats') return send(res, 200, [])
    return send(res, 200, {})
  })
})
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/api/socket')) wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req))
  else socket.destroy()
})
server.listen(3001, () => console.log('mock3 on 3001'))
