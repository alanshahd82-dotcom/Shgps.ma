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
// Traccar 6.x: use GET /api/session with Basic Auth to retrieve the user token,
// then open the WebSocket with ?token=<value> — most reliable method.
async function connectTraccar() {
  const baseUrl = config.traccar.url
  const wsBase  = baseUrl.startsWith('https://')
    ? baseUrl.replace('https://', 'wss://')
    : baseUrl.replace('http://', 'ws://')

  const basicAuth = Buffer.from(
    config.traccar.email + ':' + config.traccar.password
  ).toString('base64')

  // Step 1: fetch session via Basic Auth to get the user's API token
  let userToken = ''
  try {
    const res = await fetch(baseUrl + '/api/session', {
      headers: { Authorization: 'Basic ' + basicAuth },
    })
    if (!res.ok) {
      console.error('[Traccar WS] Session fetch failed:', res.status)
      setTimeout(connectTraccar, 10000)
      return
    }
    const user = await res.json()
    userToken = user.token || ''
    console.log('[Traccar WS] Session OK — user:', user.email, '— token present:', !!userToken)
  } catch (err) {
    console.error('[Traccar WS] Session error:', err.message)
    setTimeout(connectTraccar, 10000)
    return
  }

  // Step 2: open WebSocket — prefer token param, fall back to Basic Auth header
  const socketUrl = userToken
    ? wsBase + '/api/socket?token=' + userToken
    : wsBase + '/api/socket'

  const wsOpts = userToken ? {} : { headers: { Authorization: 'Basic ' + basicAuth } }
  const traccarWs = new WebSocket(socketUrl, wsOpts)

  traccarWs.on('open', () => {
    console.log('[Traccar WS] Connected to', wsBase)
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
    console.warn('[Traccar WS] No credentials — bridge disabled')
  }
})
