import jwt from 'jsonwebtoken'
import pg from 'pg'

const { Client } = pg
const db = new Client({ connectionString: process.env.DATABASE_URL })
await db.connect()

const out = { timestamp: new Date().toISOString() }

// 1. Admin + JWT + backend REST API (what Home/Vehicles consume)
try {
  const { rows } = await db.query("SELECT id, email, name FROM users WHERE is_admin = true AND is_active = true LIMIT 1")
  const admin = rows[0]
  out.admin = admin?.email
  const token = jwt.sign({ userId: admin.id }, process.env.JWT_SECRET)
  const apiRes = await fetch('http://localhost:3001/api/devices', { headers: { Authorization: 'Bearer ' + token } })
  const apiJson = await apiRes.json()
  const apiDevices = Array.isArray(apiJson) ? apiJson : (apiJson.devices || apiJson.data || [])
  out.backend_api = apiDevices.filter(d =>
    d.traccarId === 37 || d.traccarId === 70 || d.traccar_id === 37 || d.traccar_id === 70 ||
    d.imei === '865190075236599' || d.imei === '865190075270325'
  )
} catch(e) { out.backend_api_error = e.message }

// 2. Traccar raw
try {
  const traccarAuth = 'Basic ' + Buffer.from(process.env.TRACCAR_ADMIN_EMAIL + ':' + process.env.TRACCAR_ADMIN_PASSWORD).toString('base64')
  const [dRes, pRes] = await Promise.all([
    fetch(process.env.TRACCAR_URL + '/api/devices', { headers: { Authorization: traccarAuth } }),
    fetch(process.env.TRACCAR_URL + '/api/positions', { headers: { Authorization: traccarAuth } }),
  ])
  const tDevs = await dRes.json()
  const tPos = await pRes.json()
  out.traccar = {}
  for (const id of [37, 70]) {
    const dev = tDevs.find(d => d.id === id)
    const pos = tPos.find(p => p.deviceId === id)
    out.traccar[id] = { device: dev, position: pos }
  }
} catch(e) { out.traccar_error = e.message }

// 3. DB devices
try {
  const { rows } = await db.query("SELECT id, traccar_id, name, imei, plate, type, last_lat, last_lng, last_speed, last_update FROM devices WHERE traccar_id IN (37, 70)")
  out.db_devices = rows
} catch(e) { out.db_devices_error = e.message }

// 4. Recent power alerts
try {
  const { rows } = await db.query("SELECT a.id, a.type, a.message, a.data, a.created_at, d.traccar_id, d.name, d.imei FROM alerts a JOIN devices d ON a.device_id = d.id WHERE d.traccar_id IN (37, 70) AND a.type IN ('power_disconnected','power_restored') ORDER BY a.created_at DESC LIMIT 20")
  out.recent_power_alerts = rows
} catch(e) { out.alerts_error = e.message }

// 5. Power states
try {
  const { rows } = await db.query("SELECT * FROM device_power_states WHERE device_id IN (SELECT id FROM devices WHERE traccar_id IN (37,70))")
  out.power_states = rows
} catch(e) { out.power_states_error = e.message }

// 6. All recent alerts
try {
  const { rows } = await db.query("SELECT a.id, a.type, a.message, a.created_at, d.traccar_id FROM alerts a JOIN devices d ON a.device_id = d.id WHERE d.traccar_id IN (37, 70) ORDER BY a.created_at DESC LIMIT 10")
  out.recent_all_alerts = rows
} catch(e) { out.all_alerts_error = e.message }

await db.end()
console.log(JSON.stringify(out, null, 2))
