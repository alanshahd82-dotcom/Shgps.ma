import './env.js'        // ← must be first: populates process.env before config.js is evaluated
import express from 'express'
import cors from 'cors'
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
import { statsRouter }       from './routes/stats.js'
import { adminRouter }       from './routes/admin.js'
import { maintenanceRouter } from './routes/maintenance.js'
import { sharingRouter }     from './routes/sharing.js'
import { leadsRouter }           from './routes/leads.js'
import { driverBehaviorRouter } from './routes/driverBehavior.js'
import { subUsersRouter }       from './routes/subUsers.js'
import { subAdminsRouter }      from './routes/subAdmins.js'
import { settingsRouter }       from './routes/settings.js'
import { config }        from './config.js'
import { getAllPositions, getAllDevices } from './services/traccar.js'
import { isRevoked }    from './services/tokenBlacklist.js'
import { db }            from './db.js'
import { syncSubscriptionState } from './services/subscriptions.js'
import { DEFAULT_SUPPORT_SETTINGS } from './services/supportSettings.js'
import { speedKmh } from './utils/speed.js'
import {
  markVehicleDisconnected,
  markVehicleConnected,
  detectExternalPowerLoss,
  detectExternalPowerRestored,
  reducePowerTelemetryState,
  isVehicleDisconnected,
  observeVehicleVoltage,
  POWER_SILENCE_WINDOW_MS,
  readVehicleVoltage as readCachedVehicleVoltage,
} from './services/vehicleTelemetry.js'

// ── Self-healing schema migrations ────────────────────────────────────────
async function runMigrations() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        city VARCHAR(100),
        subscription VARCHAR(50) DEFAULT 'Basic',
        is_admin BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        max_devices INTEGER DEFAULT 5,
        expiry_date TIMESTAMP,
        traccar_id INTEGER UNIQUE,
        avatar VARCHAR(10),
        must_change_password BOOLEAN DEFAULT FALSE,
        notification_prefs JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS notification_prefs   JSONB   DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS max_devices           INTEGER DEFAULT 5,
        ADD COLUMN IF NOT EXISTS expiry_date           TIMESTAMP,
        ADD COLUMN IF NOT EXISTS is_active             BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMP DEFAULT NOW()
    `)
    // Older accounts could be created with max_devices=0 by legacy flows.
    // Zero is not a meaningful device limit; repair those accounts on startup.
    await db.query(`
      UPDATE users
      SET max_devices = 5, updated_at = NOW()
      WHERE is_admin = FALSE AND (max_devices IS NULL OR max_devices < 1)
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        traccar_id INTEGER UNIQUE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        imei VARCHAR(20) UNIQUE NOT NULL,
        type VARCHAR(50) DEFAULT 'bike',
        plate VARCHAR(50),
        subscription_plan_id VARCHAR(32),
        subscription_start_date DATE,
        subscription_end_date DATE,
        subscription_status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_lat DOUBLE PRECISION,
        last_lng DOUBLE PRECISION,
        last_speed NUMERIC(8,2),
        last_update TIMESTAMP
      )
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        data JSONB,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await db.query(
      `INSERT INTO app_settings (key, value) VALUES ('support_contacts', $1)
       ON CONFLICT (key) DO NOTHING`,
      [JSON.stringify(DEFAULT_SUPPORT_SETTINGS)]
    )
    await db.query(`
      ALTER TABLE devices
        ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS last_lat    DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS last_lng    DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS last_speed  NUMERIC(8,2),
        ADD COLUMN IF NOT EXISTS last_update TIMESTAMP,
        ADD COLUMN IF NOT EXISTS subscription_plan_id VARCHAR(32),
        ADD COLUMN IF NOT EXISTS subscription_start_date DATE,
        ADD COLUMN IF NOT EXISTS subscription_end_date DATE,
        ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'active'
    `)
    await db.query(`ALTER TABLE devices ALTER COLUMN type SET DEFAULT 'bike'`)
    await db.query(`
      UPDATE devices
      SET type = 'bike'
      WHERE type IS NULL OR BTRIM(type) = '' OR type NOT IN ('car', 'bike', 'truck')
    `)
    await db.query(`
      ALTER TABLE devices
        ADD COLUMN IF NOT EXISTS driver VARCHAR(120)
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
    // Keep installations created with the older driver-behavior migration
    // compatible with the current API columns and queries.
    await db.query(`
      ALTER TABLE driver_behavior_scores
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS speeding_events INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS idle_min INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS trip_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS recorded_date DATE,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
    `)
    await db.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name='driver_behavior_scores' AND column_name='date'
        ) THEN
          EXECUTE $sql$
            UPDATE driver_behavior_scores
            SET recorded_date = COALESCE(recorded_date, date, CURRENT_DATE),
                speeding_events = COALESCE(speeding_events, 0),
                idle_min = COALESCE(idle_min, 0),
                trip_count = COALESCE(trip_count, 0),
                updated_at = COALESCE(updated_at, NOW())
            WHERE recorded_date IS NULL
          $sql$;
        ELSE
          UPDATE driver_behavior_scores
          SET recorded_date = COALESCE(recorded_date, CURRENT_DATE),
              speeding_events = COALESCE(speeding_events, 0),
              idle_min = COALESCE(idle_min, 0),
              trip_count = COALESCE(trip_count, 0),
              updated_at = COALESCE(updated_at, NOW())
          WHERE recorded_date IS NULL;
        END IF;
      END $$;
    `)
    await db.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name='driver_behavior_scores' AND column_name='client_id'
        ) THEN
          EXECUTE $sql$
            UPDATE driver_behavior_scores
            SET user_id = COALESCE(user_id, client_id)
            WHERE user_id IS NULL
          $sql$;
          EXECUTE 'ALTER TABLE driver_behavior_scores ALTER COLUMN client_id DROP NOT NULL';
        END IF;
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name='driver_behavior_scores' AND column_name='date'
        ) THEN
          EXECUTE 'ALTER TABLE driver_behavior_scores ALTER COLUMN date DROP NOT NULL';
        END IF;
      END $$;
    `)
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS driver_behavior_scores_device_date_idx
      ON driver_behavior_scores(device_id, recorded_date)
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
    // Sub-admins support
    await db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_sub_admin BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS parent_admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS admin_permissions JSONB DEFAULT '{"add_clients":true,"add_devices":true,"view_reports":true,"view_map":true,"view_alerts":true,"device_setup":false,"support_settings":false}'
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS sub_admin_client_access (
        sub_admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at   TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (sub_admin_id, client_id)
      )
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
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used       BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    // Durable per-device disconnect state so a backend restart does not
    // forget which devices are already in a disconnect episode and re-fire
    // the alert on the next silence check.
    await db.query(`
      CREATE TABLE IF NOT EXISTS device_power_states (
        traccar_id        INTEGER PRIMARY KEY,
        disconnected      BOOLEAN NOT NULL DEFAULT FALSE,
        disconnect_trigger VARCHAR(20),
        updated_at        TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[DB] Migrations OK')
  } catch (err) {
    console.warn('[DB] Migration warning:', err.message)
  }
}

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: process.env.FRONTEND_URL || false,
  credentials: true,
}))

// ── Security Headers ────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000')
  }
  next()
})

// Live API responses must never be served from a browser or reverse-proxy
// cache. Map tiles set their own long-lived cache policy in map.js.
app.use('/api', (req, res, next) => {
  if (!req.path.startsWith('/map/tiles/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
  }
  next()
})

app.use(express.json({ limit: '1mb' }))

app.use('/api/auth',        authRouter)
app.use('/api/devices',     devicesRouter)
app.use('/api/clients',     clientsRouter)
app.use('/api/alerts',      alertsRouter)
app.use('/api/map',         mapRouter)
app.use('/api/geofences',   geofencesRouter)
app.use('/api/reports',     reportsRouter)
app.use('/api/stats',        statsRouter)
app.use('/api/admin',       adminRouter)
app.use('/api/maintenance', maintenanceRouter)
app.use('/api/sharing',     sharingRouter)
app.use('/api/leads',           leadsRouter)
app.use('/api/driver-behavior', driverBehaviorRouter)
app.use('/api/sub-users',       subUsersRouter)
app.use('/api/sub-admins',      subAdminsRouter)
app.use('/api/settings',        settingsRouter)

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

function readVehicleVoltage(position) {
  return readCachedVehicleVoltage(position, position?.deviceId, { connected: true })
}

// Real disconnect = the device stopped sending ANY data for this long.
// Voltage itself is intermittent on GT06 (sent every few minutes), so we
// must NOT alert on missing voltage alone — only on a truly silent device.
const POWER_DISCONNECT_GRACE_MS = POWER_SILENCE_WINDOW_MS
// A device is considered connected if it sent ANY data within this window.
// Must be >= POWER_DISCONNECT_GRACE_MS so a slowly-reporting but connected
// device is never mistaken for disconnected.
const POWER_POSITION_MAX_AGE_MS = POWER_SILENCE_WINDOW_MS
const powerTelemetry = new Map()
const powerDisconnectTimers = new Map()
const powerDisconnectRetryTimers = new Map()

function clearPowerDisconnectTimer(traccarId) {
  const timer = powerDisconnectTimers.get(String(traccarId))
  if (timer) clearTimeout(timer)
  powerDisconnectTimers.delete(String(traccarId))
}

function clearPowerDisconnectRetryTimer(traccarId) {
  const timer = powerDisconnectRetryTimers.get(String(traccarId))
  if (timer) clearTimeout(timer)
  powerDisconnectRetryTimers.delete(String(traccarId))
}

// ── Durable power-state persistence ──────────────────────────────────────────
// Persist which devices are in a confirmed disconnect episode so that a
// backend restart does not forget the state and re-fire the alert on the next
// silence check (preventing duplicate alerts across restarts).

async function persistPowerDisconnected(traccarId, trigger) {
  try {
    await db.query(
      `INSERT INTO device_power_states (traccar_id, disconnected, disconnect_trigger, updated_at)
       VALUES ($1, TRUE, $2, NOW())
       ON CONFLICT (traccar_id) DO UPDATE
         SET disconnected = TRUE, disconnect_trigger = $2, updated_at = NOW()`,
      [traccarId, trigger || 'silence']
    )
  } catch (err) {
    console.warn('[Power] Failed to persist disconnect state:', err.message)
  }
}

async function persistPowerConnected(traccarId) {
  try {
    await db.query(
      `DELETE FROM device_power_states WHERE traccar_id = $1`,
      [traccarId]
    )
  } catch (err) {
    console.warn('[Power] Failed to clear disconnect state:', err.message)
  }
}

// Called once at startup. Restores in-memory disconnect state from the DB so
// that a restart mid-disconnect episode does not fire a second alert.
async function loadPersistedPowerStates() {
  try {
    const { rows } = await db.query(
      `SELECT traccar_id, disconnect_trigger FROM device_power_states WHERE disconnected = TRUE`
    )
    for (const row of rows) {
      const key = String(row.traccar_id)
      const existing = powerTelemetry.get(key)
      if (existing) {
        existing.disconnected = true
        if (row.disconnect_trigger) existing.disconnectTrigger = row.disconnect_trigger
      } else {
        powerTelemetry.set(key, {
          lastValidAt: null,
          lastValidVoltage: null,
          missingSince: null,
          lastPositionAt: null,
          lastPositionKey: null,
          powerLossSignal: null,
          disconnectTrigger: row.disconnect_trigger || 'silence',
          invalidPositionCount: 0,
          disconnected: true,
          alerting: false,
        })
      }
      markVehicleDisconnected(row.traccar_id)
    }
    console.log('[Power] Loaded', rows.length, 'persisted disconnect state(s) from DB')
  } catch (err) {
    console.warn('[Power] Failed to load persisted power states:', err.message)
  }
}

function positionTimestamp(position, fallback) {
  const raw = position?.fixTime ?? position?.lastUpdate ?? position?.last_update
  const timestamp = raw ? new Date(raw).getTime() : NaN
  if (!Number.isFinite(timestamp)) return fallback
  return Math.min(timestamp, fallback)
}

function positionSignature(position) {
  const attributes = position?.attributes || {}
  return [
    position?.id ?? '',
    position?.fixTime ?? position?.lastUpdate ?? position?.last_update ?? '',
    position?.latitude ?? '',
    position?.longitude ?? '',
    attributes.charge ?? '',
    attributes.alarm ?? '',
    attributes.powerCut ?? attributes.power_cut ?? '',
    attributes.externalPower ?? '',
  ].join('|')
}

function sendPowerDisconnectEvent(device, alert) {
  const message = JSON.stringify({
    type: 'device:power-disconnected',
    deviceId: device.id,
    traccarId: device.traccar_id,
    alert: {
      id: alert.id,
      type: alert.type,
      message: alert.message,
      deviceName: device.name,
      createdAt: alert.created_at,
      data: alert.data,
      read: false,
    },
  })

  for (const client of frontendClients) {
    if (client.readyState !== WebSocket.OPEN) continue
    if (client.isAdmin || client.userId === device.user_id) client.send(message)
  }
}

function sendPowerRestoredEvent(device, alert) {
  const message = JSON.stringify({
    type: 'device:power-restored',
    deviceId: device.id,
    traccarId: device.traccar_id,
    alert: {
      id: alert.id,
      type: alert.type,
      message: alert.message,
      deviceName: device.name,
      createdAt: alert.created_at,
      data: alert.data,
      read: false,
    },
  })
  for (const client of frontendClients) {
    if (client.readyState !== WebSocket.OPEN) continue
    if (client.isAdmin || client.userId === device.user_id) client.send(message)
  }
}

async function createPowerRestoredAlert(traccarId) {
  try {
    const { rows } = await db.query(
      'SELECT id, traccar_id, user_id, name FROM devices WHERE traccar_id=$1 LIMIT 1',
      [traccarId]
    )
    const device = rows[0]
    if (!device) return
    const message = `تم استعادة تغذية ${device.name} / Alimentation restaurée : ${device.name}`
    const { rows: alertRows } = await db.query(
      `INSERT INTO alerts (device_id, user_id, type, message, data)
       VALUES ($1, $2, 'power_restored', $3, $4)
       RETURNING id, type, message, data, created_at`,
      [
        device.id,
        device.user_id,
        message,
        JSON.stringify({ traccarId }),
      ]
    )
    sendPowerRestoredEvent(device, alertRows[0])
    console.log('[Power] Vehicle power restored — device:', device.id)
  } catch (err) {
    console.warn('[Power] Restore alert skipped:', err.message)
  }
}

async function createPowerDisconnectedAlert(traccarId, { immediate = false } = {}) {
  const key = String(traccarId)
  const state = powerTelemetry.get(key)
  const now = Date.now()
  if (!state || state.alerting || state.disconnected || !state.lastPositionAt) return

  const silenceConfirmed = Boolean(
    state.missingSince
      && now - state.missingSince >= POWER_DISCONNECT_GRACE_MS
      && now - state.lastPositionAt >= POWER_POSITION_MAX_AGE_MS,
  )
  const signalConfirmed = Boolean(immediate && state.powerLossSignal)
  if (!silenceConfirmed && !signalConfirmed) return

  state.alerting = true
  try {
    const { rows } = await db.query(
      'SELECT id, traccar_id, user_id, name FROM devices WHERE traccar_id=$1 LIMIT 1',
      [traccarId]
    )
    const device = rows[0]
    if (!device) {
      state.alerting = false
      return
    }

    const latest = powerTelemetry.get(key)
    const latestSilenceConfirmed = Boolean(
      latest?.missingSince
        && Date.now() - latest.missingSince >= POWER_DISCONNECT_GRACE_MS
        && Date.now() - latest.lastPositionAt >= POWER_POSITION_MAX_AGE_MS,
    )
    const latestSignalConfirmed = Boolean(immediate && latest?.powerLossSignal)
    if (!latest || latest !== state || latest.disconnected
      || (!latestSilenceConfirmed && !latestSignalConfirmed)) {
      state.alerting = false
      return
    }

    const message = `تم فصل التغذية عن ${device.name} / Alimentation débranchée : ${device.name}`
    const { rows: alertRows } = await db.query(
      `INSERT INTO alerts (device_id, user_id, type, message, data)
       VALUES ($1, $2, 'power_disconnected', $3, $4)
       RETURNING id, type, message, data, created_at`,
      [
        device.id,
        device.user_id,
        message,
        JSON.stringify({
          reason: latest.powerLossSignal?.source || 'vehicle_power_missing',
          trigger: latestSignalConfirmed ? 'telemetry' : 'silence',
          traccarId,
          lastValidVoltage: state.lastValidVoltage,
          graceSeconds: POWER_DISCONNECT_GRACE_MS / 1000,
        }),
      ]
    )

    state.disconnected = true
    state.disconnectTrigger = latestSignalConfirmed ? 'telemetry' : 'silence'
    state.alerting = false
    clearPowerDisconnectRetryTimer(traccarId)
    markVehicleDisconnected(traccarId)
    void persistPowerDisconnected(traccarId, state.disconnectTrigger)
    sendPowerDisconnectEvent(device, alertRows[0])
    console.log('[Power] Vehicle power disconnected — device:', device.id)
  } catch (err) {
    state.alerting = false
    console.warn('[Power] Disconnect alert skipped:', err.message)
    if (state.powerLossSignal) {
      clearPowerDisconnectRetryTimer(traccarId)
      powerDisconnectRetryTimers.set(key, setTimeout(() => {
        powerDisconnectRetryTimers.delete(key)
        void createPowerDisconnectedAlert(traccarId, { immediate: true })
      }, 5000))
    }
  }
}

function schedulePowerDisconnectCheck(traccarId, lastPositionAt) {
  const key = String(traccarId)
  clearPowerDisconnectTimer(traccarId)
  const delay = Math.max(
    25,
    POWER_DISCONNECT_GRACE_MS - (Date.now() - lastPositionAt) + 25,
  )
  powerDisconnectTimers.set(key, setTimeout(() => {
    powerDisconnectTimers.delete(key)
    const state = powerTelemetry.get(key)
    if (!state || state.lastPositionAt !== lastPositionAt || state.disconnected) return

    const remaining = POWER_DISCONNECT_GRACE_MS - (Date.now() - state.lastPositionAt)
    if (remaining > 0) {
      schedulePowerDisconnectCheck(traccarId, state.lastPositionAt)
      return
    }

    // No new position arrived during the complete silence window. This is
    // intentionally based on the last GPS/data timestamp, never on voltage
    // omission in an otherwise connected position.
    state.missingSince = state.lastPositionAt
    powerTelemetry.set(key, state)
    void createPowerDisconnectedAlert(traccarId)
  }, delay))
}

function observePowerTelemetry(position) {
  const traccarId = position?.deviceId
  if (traccarId == null) return

  const key = String(traccarId)
  const now = Date.now()
  const voltage = observeVehicleVoltage(position)
  const current = powerTelemetry.get(key) || {
    lastValidAt: null,
    lastValidVoltage: null,
    missingSince: null,
    lastPositionAt: null,
    lastPositionKey: null,
    powerLossSignal: null,
    disconnectTrigger: null,
    invalidPositionCount: 0,
    disconnected: false,
    alerting: false,
  }
  const signature = positionSignature(position)
  const powerLossSignal = detectExternalPowerLoss(position)
  const powerRestoredSignal = detectExternalPowerRestored(position)
  const transition = reducePowerTelemetryState(current, {
    signature,
    observedAt: positionTimestamp(position, now),
    now,
    powerLossSignal,
    powerRestoredSignal,
  })
  const next = transition.state

  // A healthy position after a confirmed disconnect episode: transition back to connected.
  // Fire ONE restore alert, clear the in-memory disconnect state, and remove the device
  // from the disconnectedVehicles Set so the WebSocket bridge stops marking it disconnected.
  if (transition.restored) {
    powerTelemetry.set(key, next)
    markVehicleConnected(traccarId)
    void persistPowerConnected(traccarId)
    void createPowerRestoredAlert(traccarId)
    // Fall through to process this healthy position normally (voltage cache, silence timer).
  }

  if (voltage !== null) {
    // A real voltage reading (not a guess) — store it as the last known good value.
    next.lastValidAt = now
    next.lastValidVoltage = voltage
  }

  if (powerLossSignal) {
    powerTelemetry.set(key, next)
    if (transition.shouldAlertImmediately) {
      clearPowerDisconnectTimer(traccarId)
      void createPowerDisconnectedAlert(traccarId, { immediate: true })
    }
    return
  }

  // A position without voltage is still connected. Keep the last real
  // voltage and wait for actual silence. Keep a pending explicit power-loss
  // signal until its alert has been persisted, even if another packet races in.
  powerTelemetry.set(key, next)
  if (transition.shouldScheduleSilence) {
    schedulePowerDisconnectCheck(traccarId, next.lastPositionAt)
  }
}

// Cache: Traccar device ID → local user_id (owner). Refreshed on start + hourly.
let traccarOwnerCache = new Map()
async function refreshTraccarOwnerCache() {
  try {
    const { rows } = await db.query('SELECT traccar_id, user_id FROM devices WHERE traccar_id IS NOT NULL')
    const m = new Map()
    for (const row of rows) m.set(row.traccar_id, row.user_id)
    traccarOwnerCache = m
    console.log('[WS] Device ownership cache refreshed —', m.size, 'device(s)')
  } catch (err) {
    console.warn('[WS] Ownership cache refresh skipped:', err.message)
  }
}

wss.on('connection', (ws, req) => {
  try {
    const url   = new URL(req.url, 'http://localhost')
    const token = url.searchParams.get('token')
    if (!token) { ws.close(1008, 'Unauthorized'); return }
    const decoded = jwt.verify(token, config.jwtSecret)
    if (isRevoked(token)) { ws.close(1008, 'Token revoked'); return }
    ws.userId  = decoded.userId
    ws.isAdmin = decoded.isAdmin || false
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

  ws.on('message', data => {
    if (data.toString() === 'ping' && ws.readyState === WebSocket.OPEN) ws.send('pong')
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
      if (res.status === 401 || res.status === 403) {
        console.error('[Traccar WS] Authentication rejected. Check TRACCAR_ADMIN_EMAIL/PASSWORD against the persistent Traccar database; bridge disabled until restart.')
        return
      }
      console.error('[Traccar WS] Session POST failed:', res.status, '— retrying in 30 s')
      setTimeout(connectTraccar, 30000)
      return
    }
    const setCookie = res.headers.get('set-cookie') || ''
    sessionCookie = setCookie.split(';')[0]
    const user = await res.json()
    userToken = user.token || ''
    console.log('[Traccar WS] Session OK — user:', user.email)
  } catch (err) {
    console.error('[Traccar WS] Session error:', err.message, '— retrying in 30 s')
    setTimeout(connectTraccar, 30000)
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
    let parsed = null
    try { parsed = JSON.parse(msg) } catch {}

    if (parsed && Array.isArray(parsed.positions)) {
      parsed.positions.forEach(observePowerTelemetry)
    }

    for (const client of frontendClients) {
      if (client.readyState !== WebSocket.OPEN) continue

      // Admins receive all device data
      if (client.isAdmin) { client.send(msg); continue }

      // Non-JSON messages (e.g. pings) — forward as-is
      if (!parsed) { client.send(msg); continue }

      // Collect Traccar device IDs referenced in this message
      const deviceIds = new Set()
      if (Array.isArray(parsed.positions)) parsed.positions.forEach(p => deviceIds.add(p.deviceId))
      if (Array.isArray(parsed.devices))   parsed.devices.forEach(d => deviceIds.add(d.id))
      if (Array.isArray(parsed.events))    parsed.events.forEach(e => deviceIds.add(e.deviceId))

      // No device IDs in message (e.g. heartbeat) — forward as-is
      if (deviceIds.size === 0) { client.send(msg); continue }

      // Send only if at least one device in the message belongs to this client
      const allowed = [...deviceIds].some(tid => traccarOwnerCache.get(tid) === client.userId)
      if (allowed) {
        let outMsg = msg
        if (parsed && Array.isArray(parsed.positions)) {
          const patched = {
            ...parsed,
            positions: parsed.positions.map(p => {
              // Forward the same explicit power-loss signal that the observer
              // uses. The alert insert is asynchronous, so waiting for the
              // database event would leave the live UI briefly showing a
              // connected vehicle after the last packet already said power
              // was lost.
              const powerDisconnected = Boolean(
                detectExternalPowerLoss(p) || isVehicleDisconnected(p.deviceId),
              )
              return {
                ...p,
                speed: Math.round(speedKmh(p.speed)),
                voltage: readVehicleVoltage(p),
                powerDisconnected,
              }
            }),
          }
          try { outMsg = JSON.stringify(patched) } catch {}
        }
        client.send(outMsg)
      }
    }
  })

  traccarWs.on('close', () => {
    console.log('[Traccar WS] Disconnected — reconnecting in 30 s...')
    setTimeout(connectTraccar, 30000)
  })

  traccarWs.on('error', (err) => console.error('[Traccar WS] Error:', err.message))
}

async function runSubscriptionCheck() {
  try {
    const { rows } = await db.query(`
      SELECT d.*, u.name AS client_name
      FROM devices d
      LEFT JOIN users u ON u.id=d.user_id
      WHERE d.subscription_end_date IS NOT NULL
    `)
    for (const device of rows) {
      await syncSubscriptionState(db, device, device.client_name ?? null)
    }
    console.log('[Subscription] Scheduled check complete:', rows.length)
  } catch (err) {
    console.warn('[Subscription] Scheduled check skipped:', err.message)
  }
}

// --- Start --------------------------------------------------------------------
server.listen(PORT, async () => {
  console.log('ATHAR GPS Backend running on port ' + PORT)
  await runMigrations()
  await loadPersistedPowerStates()
  await runSubscriptionCheck()
  setInterval(runSubscriptionCheck, 6 * 60 * 60 * 1000)
  await refreshTraccarOwnerCache()
  setInterval(refreshTraccarOwnerCache, 60 * 60 * 1000)
  if (config.traccar.email && config.traccar.password) {
    connectTraccar()
  } else {
    console.warn('[Traccar WS] No credentials — bridge disabled')
  }
})
