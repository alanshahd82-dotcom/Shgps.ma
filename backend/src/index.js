import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import jwt from 'jsonwebtoken'
import { authRouter }          from './routes/auth.js'
import { devicesRouter }       from './routes/devices.js'
import { clientsRouter }       from './routes/clients.js'
import { alertsRouter }        from './routes/alerts.js'
import { mapRouter }           from './routes/map.js'
import { statsRouter }         from './routes/stats.js'
import { subscriptionsRouter } from './routes/subscriptions.js'
import { adminRouter }         from './routes/admin.js'
import { config }              from './config.js'

dotenv.config()

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }))
app.use(express.json())

app.use('/api/auth',              authRouter)
app.use('/api/devices',           devicesRouter)
app.use('/api/clients',           clientsRouter)
app.use('/api/alerts',            alertsRouter)
app.use('/api/map',               mapRouter)
app.use('/api/stats',             statsRouter)
app.use('/api/subscription',      subscriptionsRouter)
app.use('/api/admin/subscriptions', subscriptionsRouter)
app.use('/api/admin',             adminRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '2.0.0', app: 'Athar GPS' }))

// --- HTTP server ---------------------------------------------------------------
const server = createServer(app)

// --- WebSocket server (frontend clients) ---------------------------------------
const wss = new WebSocketServer({ server, path: '/api/socket' })
const frontendClients = new Set()

wss.on('connection', (ws, req) => {
  try {
    const url   = new URL(req.url, 'http://localhost')
    const token = url.searchParams.get('token')
    if (!token) { ws.close(1008, 'Unauthorized'); return }
    jwt.verify(token, config.jwtSecret)
  } catch {
    ws.close(1008, 'Invalid token')
    return
  }

  frontendClients.add(ws)

  ws.on('close', () => frontendClients.delete(ws))
  ws.on('error', (err) => console.error('[WS] Frontend error:', err.message))
})

// --- Traccar WebSocket bridge --------------------------------------------------
async function ensureTraccarAdmin(baseUrl) {
  try {
    const res = await fetch(baseUrl + '/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Admin', email: config.traccar.email,
        password: config.traccar.password, administrator: true,
      }),
    })
    if (res.ok) console.log('[Traccar WS] Admin user created')
    else console.log('[Traccar WS] Admin user already exists')
  } catch (err) { console.warn('[Traccar WS] User creation skipped:', err.message) }
}

async function connectTraccar() {
  const baseUrl = config.traccar.url
  const wsBase  = baseUrl.startsWith('https://') ? baseUrl.replace('https://', 'wss://') : baseUrl.replace('http://', 'ws://')

  await ensureTraccarAdmin(baseUrl)

  let sessionCookie = ''
  let userToken = ''
  try {
    const formBody = `email=${encodeURIComponent(config.traccar.email)}&password=${encodeURIComponent(config.traccar.password)}`
    const res = await fetch(baseUrl + '/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    })
    if (!res.ok) { console.error('[Traccar WS] Session POST failed:', res.status); setTimeout(connectTraccar, 10000); return }
    const setCookie = res.headers.get('set-cookie') || ''
    sessionCookie = setCookie.split(';')[0]
    const user = await res.json()
    userToken = user.token || ''
  } catch (err) { console.error('[Traccar WS] Session error:', err.message); setTimeout(connectTraccar, 10000); return }

  const socketUrl = userToken ? wsBase + '/api/socket?token=' + userToken : wsBase + '/api/socket'
  const wsOpts = (!userToken && sessionCookie) ? { headers: { Cookie: sessionCookie } } : {}
  const traccarWs = new WebSocket(socketUrl, wsOpts)

  traccarWs.on('open',    ()    => console.log('[Traccar WS] Connected'))
  traccarWs.on('message', (data) => { for (const c of frontendClients) { if (c.readyState === WebSocket.OPEN) c.send(data.toString()) } })
  traccarWs.on('close',   ()    => { console.log('[Traccar WS] Disconnected — reconnecting…'); setTimeout(connectTraccar, 5000) })
  traccarWs.on('error',   (err) => console.error('[Traccar WS] Error:', err.message))
}

// --- Start --------------------------------------------------------------------
server.listen(PORT, () => {
  console.log('Athar GPS Backend running on port ' + PORT)
  if (config.traccar.email && config.traccar.password) connectTraccar()
  else console.warn('[Traccar WS] No credentials — bridge disabled')
})
