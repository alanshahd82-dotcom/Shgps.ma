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

// ─── HTTP server ───────────────────────────────────────────────────────────────
const server = createServer(app)

// ─── WebSocket server (frontend clients) ──────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/api/socket' })
const frontendClients = new Set()

wss.on('connection', (ws, req) => {
  try {
    const url   = new URL(req.url, 'http://localhost')
    const token = url.searchParams.get('token')
    if (!token) { ws.close(1008, 'Unauthorized'); return }
    jwt.verify(token, config.jwtSecret)   // throws if invalid
  } catch {
    ws.close(1008, 'Invalid token')
    return
  }

  frontendClients.add(ws)
  console.log(`[WS] Frontend client connected — total: ${frontendClients.size}`)

  ws.on('close', () => {
    frontendClients.delete(ws)
    console.log(`[WS] Frontend client disconnected — total: ${frontendClients.size}`)
  })

  ws.on('error', (err) => console.error('[WS] Frontend client error:', err.message))
})

// ─── Traccar WebSocket bridge ──────────────────────────────────────────────────
function connectTraccar() {
  const wsUrl = config.traccar.url
    .replace(/^https?:\/\//, (m) => (m.startsWith('https') ? 'wss://' : 'ws://'))
  const auth = Buffer.from(
    `${config.traccar.email}:${config.traccar.password}`
  ).toString('base64')

  const traccarWs = new WebSocket(`${wsUrl}/api/socket`, {
    headers: { Authorization: `Basic ${auth}` },
  })

  traccarWs.on('open', () => {
    console.log('[Traccar WS] Connected to', wsUrl)
  })

  traccarWs.on('message', (data) => {
    const msg = data.toString()
    // Forward every Traccar update to all authenticated frontend clients
    for (const client of frontendClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg)
      }
    }
  })

  traccarWs.on('close', () => {
    console.log('[Traccar WS] Disconnected — reconnecting in 5 s…')
    setTimeout(connectTraccar, 5000)
  })

  traccarWs.on('error', (err) => {
    console.error('[Traccar WS] Error:', err.message)
  })
}

// ─── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🚀 SHGPS Backend running on port ${PORT}`)
  // Start Traccar bridge only when credentials are configured
  if (config.traccar.email && config.traccar.password) {
    connectTraccar()
  } else {
    console.warn('[Traccar WS] No credentials — bridge disabled (set TRACCAR_ADMIN_EMAIL / TRACCAR_ADMIN_PASSWORD)')
  }
})
