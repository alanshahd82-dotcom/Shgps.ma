import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import jwt from 'jsonwebtoken'
import { authRouter }        from './routes/auth.js'
import { devicesRouter }     from './routes/devices.js'
import { clientsRouter }     from './routes/clients.js'
import { alertsRouter }      from './routes/alerts.js'
import { mapRouter }         from './routes/map.js'
import { geofencesRouter }   from './routes/geofences.js'
import { reportsRouter }     from './routes/reports.js'
import { adminRouter }       from './routes/admin.js'
import { maintenanceRouter } from './routes/maintenance.js'
import { sharingRouter }     from './routes/sharing.js'
import { leadsRouter }           from './routes/leads.js'
import { driverBehaviorRouter } from './routes/driverBehavior.js'
import { subUsersRouter }       from './routes/subUsers.js'
import { subscriptionsRouter }  from './routes/subscriptions.js'
import { config }        from './config.js'
import { isRevoked }    from './services/tokenBlacklist.js'
import { db }            from './db.js'
import { runMigrations } from './db/init.js'
import { refreshAllDeviceLicenses } from './services/deviceSubscriptions.js'

dotenv.config()

const app  = express()
const PORT = process.env.PORT || 3001

let appReady = false

app.use(cors({
  origin: process.env.FRONTEND_URL || false,
  credentials: true,
}))

app.use(express.json({ limit: '1mb' }))

app.use('/api/auth',        authRouter)
app.use('/api/devices',     devicesRouter)
app.use('/api/clients',     clientsRouter)
app.use('/api/alerts',      alertsRouter)
app.use('/api/map',         mapRouter)
app.use('/api/geofences',   geofencesRouter)
app.use('/api/reports',     reportsRouter)
app.use('/api/admin',       adminRouter)
app.use('/api/maintenance', maintenanceRouter)
app.use('/api/sharing',     sharingRouter)
app.use('/api/leads',           leadsRouter)
app.use('/api/driver-behavior', driverBehaviorRouter)
app.use('/api/sub-users',       subUsersRouter)
app.use('/api/subscriptions',   subscriptionsRouter)

app.get('/api/health', async (_req, res) => {
  if (!appReady) {
    return res.status(503).json({ status: 'startup', db: 'pending', traccar: 'pending', version: '1.2.0', ts: new Date().toISOString() })
  }
  let dbOk = false, traccarOk = false
  let dbStatus = 'disconnected', traccarStatus = 'unreachable'
  try { await db.query('SELECT 1'); dbOk = true; dbStatus = 'connected' } catch (err) { dbStatus = 'error: ' + err.message.slice(0, 60) }
  try {
    const probe = await traccar.checkServer()
    traccarOk     = probe.available
    traccarStatus = probe.available ? `reachable${probe.version ? ' v' + probe.version : ''}` : `unreachable: ${probe.reason ?? 'unknown'}`
  } catch { traccarStatus = 'unreachable' }
  const status = dbOk && traccarOk ? 'ready' : !dbOk ? 'database_unavailable' : !traccarOk ? 'traccar_unavailable' : 'degraded'
  res.status(dbOk ? 200 : 503).json({ status, db: dbStatus, traccar: traccarStatus, version: '1.2.0', ts: new Date().toISOString() })
})

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/api/socket' })
const frontendClients = new Set()

wss.on('connection', (ws, req) => {
  try {
    const url   = new URL(req.url, 'http://localhost')
    const token = url.searchParams.get('token')
    if (!token) { ws.close(1008, 'Unauthorized'); return }
    jwt.verify(token, config.jwtSecret)
    if (isRevoked(token)) { ws.close(1008, 'Token revoked'); return }
  } catch { ws.close(1008, 'Invalid token'); return }
  frontendClients.add(ws)
  console.log('[WS] Frontend client connected — total: ' + frontendClients.size)
  ws.on('close', () => { frontendClients.delete(ws); console.log('[WS] Frontend client disconnected — total: ' + frontendClients.size) })
  ws.on('error', (err) => console.error('[WS] Frontend client error:', err.message))
})

async function connectTraccar() {
  const baseUrl = config.traccar.url
  const wsBase  = baseUrl.startsWith('https://') ? baseUrl.replace('https://', 'wss://') : baseUrl.replace('http://', 'ws://')
  const adminResult = await traccar.ensureAdminUser(baseUrl, config.traccar.email, config.traccar.password)
  if (adminResult.created) console.log('[Traccar WS] Admin user created successfully')
  else if (adminResult.reason === 'already_exists') console.log('[Traccar WS] Admin user already exists')
  else console.warn('[Traccar WS] Admin user creation skipped:', adminResult.reason)
  let sessionCookie = '', userToken = ''
  try {
    const session = await traccar.createSession(baseUrl, config.traccar.email, config.traccar.password)
    sessionCookie = session.sessionCookie
    userToken     = session.userToken
    console.log('[Traccar WS] Session OK')
  } catch (err) { console.error('[Traccar WS] Session error:', err.message); setTimeout(connectTraccar, 10000); return }
  const socketUrl = userToken ? wsBase + '/api/socket?token=' + userToken : wsBase + '/api/socket'
  const wsOpts = (!userToken && sessionCookie) ? { headers: { Cookie: sessionCookie } } : {}
  const traccarWs = new WebSocket(socketUrl, wsOpts)
  traccarWs.on('open', () => console.log('[Traccar WS] Connected to', wsBase))
  traccarWs.on('message', (data) => { const msg = data.toString(); for (const client of frontendClients) { if (client.readyState === WebSocket.OPEN) client.send(msg) } })
  traccarWs.on('close', () => { console.log('[Traccar WS] Disconnected — reconnecting in 5 s...'); setTimeout(connectTraccar, 5000) })
  traccarWs.on('error', (err) => console.error('[Traccar WS] Error:', err.message))
}

server.listen(PORT, async () => {
  console.log('AtharGPS Backend running on port ' + PORT)
  try { await runMigrations(); appReady = true; console.log('[App] Ready ✓') }
  catch (err) { console.error('[App] Migration failed — serving health checks only:', err.message) }
  refreshAllDeviceLicenses().catch((err) => console.error('[Licenses] Initial refresh failed:', err.message))
  setInterval(() => refreshAllDeviceLicenses().catch((err) => console.error('[Licenses] Scheduled refresh failed:', err.message)), 60 * 60 * 1000)
  if (config.traccar.email && config.traccar.password) connectTraccar()
  else console.warn('[Traccar WS] No credentials — bridge disabled')
})
