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
import { config }        from './config.js'
import { db }            from './db.js'

dotenv.config()

// ── Self-healing schema migrations ────────────────────────────────────────
async function runMigrations() {
  try {
    await db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS notification_prefs   JSONB   DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS max_devices           INTEGER DEFAULT 5,
        ADD COLUMN IF NOT EXISTS expiry_date           TIMESTAMP,
        ADD COLUMN IF NOT EXISTS is_active             BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMP DEFAULT NOW()
    `)
    await db.query(`
      ALTER TABLE devices
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS local_geofences (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
        device_id    INTEGER REFERENCES devices(id) ON DELETE SET NULL,
        name         VARCHAR(255) NOT NULL,
        type         VARCHAR(20)  NOT NULL DEFAULT 'circle',
        coords       JSONB        NOT NULL,
        radius       NUMERIC(10,2),
        notify_enter BOOLEAN DEFAULT TRUE,
        notify_exit  BOOLEAN DEFAULT TRUE,
        created_at   TIMESTAMP DEFAULT NOW()
      )
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS maintenance_logs (
        id               SERIAL PRIMARY KEY,
        device_id        INTEGER REFERENCES devices(id) ON DELETE CASCADE,
        type             VARCHAR(50) NOT NULL,
        note             TEXT,
        mileage          NUMERIC(12,2),
        date             TIMESTAMP DEFAULT NOW(),
        next_due_mileage NUMERIC(12,2),
        created_at       TIMESTAMP DEFAULT NOW()
      )
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS share_links (
        id         SERIAL PRIMARY KEY,
        token      VARCHAR(64) UNIQUE NOT NULL,
        device_id  INTEGER REFERENCES devices(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS driver_behavior_scores (
        id               SERIAL PRIMARY KEY,
        device_id        INTEGER REFERENCES devices(id) ON DELETE CASCADE,
        user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
        score            INTEGER NOT NULL DEFAULT 100,
        speeding_events  INTEGER DEFAULT 0,
        idle_min         INTEGER DEFAULT 0,
        trip_count       INTEGER DEFAULT 0,
        recorded_date    DATE NOT NULL DEFAULT CURRENT_DATE,
        updated_at       TIMESTAMP DEFAULT NOW(),
        UNIQUE (device_id, recorded_date)
      )
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(255) NOT NULL,
        phone      VARCHAR(50)  NOT NULL,
        email      VARCHAR(255),
        package    VARCHAR(50),
        message    TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    // Sub-users support
    await db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS parent_client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'owner'
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_users_parent_client_id ON users(parent_client_id)
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_device_access (
        id          SERIAL PRIMARY KEY,
        sub_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_id   INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        created_at  TIMESTAMP DEFAULT NOW(),
        UNIQUE(sub_user_id, device_id)
      )
    `)
    console.log('[DB] Migrations OK')
  } catch (err) {
    console.warn('[DB] Migration warning:', err.message)
  }
}

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }))
app.use(express.json())

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

app.get('/api/health', async (_req, res) => {
  let dbStatus = 'disconnected'
  let traccarStatus = 'unreachable'
  try {
    await db.query('SELECT 1')
    dbStatus = 'connected'
  } catch {}
  try {
    const r = await fetch(config.traccar.url + '/api/server', { signal: AbortSignal.timeout(3000) })
    traccarStatus = r.ok ? 'reachable' : 'error'
  } catch {}
  const ok = dbStatus === 'connected'
  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', db: dbStatus, traccar: traccarStatus, version: '1.2.0', ts: new Date().toISOString() })
})

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
    if (res.ok) console.log('[Traccar WS] Admin user created successfully')
    else if (res.status === 400 || res.status === 409) console.log('[Traccar WS] Admin user already exists')
    else console.log('[Traccar WS] User creation response:', res.status)
  } catch (err) {
    console.warn('[Traccar WS] User creation skipped:', err.message)
  }
}

async function connectTraccar() {
  const baseUrl = config.traccar.url
  const wsBase  = baseUrl.startsWith('https://')
    ? baseUrl.replace('https://', 'wss://')
    : baseUrl.replace('http://', 'ws://')

  await ensureTraccarAdmin(baseUrl)

  let sessionCookie = ''
  let userToken = ''
  try {
    const formBody = 'email=' + encodeURIComponent(config.traccar.email)
                   + '&password=' + encodeURIComponent(config.traccar.password)
    const res = await fetch(baseUrl + '/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    })
    if (!res.ok) {
      console.error('[Traccar WS] Session POST failed:', res.status)
      setTimeout(connectTraccar, 10000)
      return
    }
    const setCookie = res.headers.get('set-cookie') || ''
    sessionCookie = setCookie.split(';')[0]
    const user = await res.json()
    userToken = user.token || ''
    console.log('[Traccar WS] Session OK — user:', user.email)
  } catch (err) {
    console.error('[Traccar WS] Session error:', err.message)
    setTimeout(connectTraccar, 10000)
    return
  }

  const socketUrl = userToken
    ? wsBase + '/api/socket?token=' + userToken
    : wsBase + '/api/socket'
  const wsOpts = (!userToken && sessionCookie) ? { headers: { Cookie: sessionCookie } } : {}

  const traccarWs = new WebSocket(socketUrl, wsOpts)

  traccarWs.on('open', () => console.log('[Traccar WS] Connected to', wsBase))

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

  traccarWs.on('error', (err) => console.error('[Traccar WS] Error:', err.message))
}

// --- Start --------------------------------------------------------------------
server.listen(PORT, async () => {
  console.log('AtharGPS Backend running on port ' + PORT)
  await runMigrations()
  if (config.traccar.email && config.traccar.password) {
    connectTraccar()
  } else {
    console.warn('[Traccar WS] No credentials — bridge disabled')
  }
})
