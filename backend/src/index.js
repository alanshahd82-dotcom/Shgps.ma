import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import jwt from 'jsonwebtoken'
import { authRouter }    from './routes/auth.js'
import { devicesRouter } from './routes/devices.js'
import { clientsRouter } from './routes/clients.js'
import { alertsRouter }  from './routes/alerts.js'
import { mapRouter }     from './routes/map.js'
import { config }        from './config.js'

dotenv.config()

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }))
app.use(express.json())

app.use('/api/auth',    authRouter)
app.use('/api/devices', devicesRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/alerts',  alertsRouter)
app.use('/api/map',     mapRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }))

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
  console.log('[WS] Frontend client connected — total: ' + frontendClients.size)

  ws.on('close', () => {
    frontendClients.delete(ws)
    console.log('[WS] Frontend client disconnected — total: ' + frontendClients.size)
  })

  ws.on('error', (err) => console.error('[WS] Frontend client error:', err.message))
})

// --- Traccar WebSocket bridge --------------------------------------------------
async function connectTraccar() {
  const baseUrl = config.traccar.url
  // convert http:// -> ws://  and  https:// -> wss://
  const wsUrl = baseUrl.startsWith('https://')
    ? baseUrl.replace('https://', 'wss://')
    : baseUrl.replace('http://', 'ws://')

  // Step 1: Login to Traccar via REST to get a session cookie.
  // Basic Auth headers are NOT supported by Traccar for WebSocket upgrades.
  let sessionCookie = ''
  try {
    const params = new URLSearchParams()
    params.append('email',    config.traccar.email)
    params.append('password', config.traccar.password)

    const loginRes = await fetch(baseUrl + '/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!loginRes.ok) {
      console.error('[Traccar WS] Login failed:', loginRes.status, await loginRes.text())
      setTimeout(connectTraccar, 10000)
      return
    }

    const setCookie = loginRes.headers.get('set-cookie')
    if (setCookie) {
      sessionCookie = setCookie.split(';')[0]  // JSESSIONID=<value>
    }
    console.log('[Traccar WS] Session established')
  } catch (err) {
    console.error('[Traccar WS] Login error:', err.message)
    setTimeout(connectTraccar, 10000)
    return
  }

  // Step 2: Open WebSocket using the session cookie
  const traccarWs = new WebSocket(wsUrl + '/api/socket', {
    headers: { Cookie: sessionCookie },
  })

  traccarWs.on('open', () => {
    console.log('[Traccar WS] Connected to', wsUrl)
  })

  traccarWs.on('message', (data) => {
    const msg = data.toString()
    for (const client of frontendClients) {
      if (client.readyState === WebSocket.OPEN) client.send(msg)
    }
  })

  traccarWs.on('close', () => {
    console.log('[Traccar WS] Disconnected — reconnecting in 5 s...')
    setTimeout(connectTraccar, 5000)
  })

  traccarWs.on('error', (err) => {
    console.error('[Traccar WS] Error:', err.message)
  })
}

// --- Start --------------------------------------------------------------------
server.listen(PORT, () => {
  console.log('SHGPS Backend running on port ' + PORT)
  if (config.traccar.email && config.traccar.password) {
    connectTraccar()
  } else {
    console.warn('[Traccar WS] No credentials — bridge disabled (set TRACCAR_ADMIN_EMAIL / TRACCAR_ADMIN_PASSWORD)')
  }
})
