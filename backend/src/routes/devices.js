import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { db }       from '../db.js'
import * as traccar from '../services/traccar.js'
import crypto       from 'crypto'

export const devicesRouter = Router()

// GET /api/devices
devicesRouter.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = req.user.is_admin
      ? await db.query('SELECT d.*,u.name AS client_name FROM devices d LEFT JOIN users u ON d.user_id=u.id ORDER BY d.created_at DESC')
      : await db.query('SELECT * FROM devices WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id])

    let pm = {}
    try { for (const p of await traccar.getAllPositions()) pm[p.deviceId]=p } catch {}

    res.json(rows.map(d => {
      const p = pm[d.traccar_id]
      return {
        id: d.id, name: d.name, imei: d.imei, type: d.type, plate: d.plate,
        clientId: d.user_id, clientName: d.client_name ?? null,
        activationCode: req.user.is_admin ? d.activation_code : undefined,
        isActivated: d.is_activated,
        status:     p ? 'online' : 'offline',
        lat:        p?.latitude  ?? 0,
        lng:        p?.longitude ?? 0,
        speed:      p?.speed     ?? 0,
        lastUpdate: p?.fixTime   ?? null,
        engineOn:   p?.attributes?.ignition ?? false,
        battery:    p?.attributes?.battery  ?? null,
        signal:     p?.attributes?.rssi     ?? null,
        fuel:       p?.attributes?.fuel     ?? null,
      }
    }))
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// GET /api/devices/:id
devicesRouter.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM devices WHERE id=$1', [req.params.id])
    const dev = rows[0]
    if (!dev) return res.status(404).json({ error: 'Device not found' })
    if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    let history = []
    try { history = await traccar.getHistory(dev.traccar_id) } catch {}
    res.json({ ...dev, history })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// POST /api/devices/:id/command
devicesRouter.post('/:id/command', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM devices WHERE id=$1', [req.params.id])
    const dev = rows[0]
    if (!dev) return res.status(404).json({ error: 'Device not found' })
    if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    await traccar.sendCommand(dev.traccar_id, req.body.type)
    // Log the command
    try {
      await db.query(
        'INSERT INTO device_commands (device_id, user_id, command, traccar_id, ip_address) VALUES ($1,$2,$3,$4,$5)',
        [dev.id, req.user.id, req.body.type, dev.traccar_id, req.ip]
      )
    } catch {}
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to send command' }) }
})

// POST /api/devices/activate
devicesRouter.post('/activate', requireAuth, async (req, res) => {
  try {
    const { activationCode } = req.body
    if (!activationCode) return res.status(400).json({ error: 'Activation code required' })
    const { rows } = await db.query(
      'SELECT * FROM devices WHERE activation_code=$1 AND is_activated=false',
      [activationCode.toUpperCase()]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Invalid or already used activation code' })
    await db.query('UPDATE devices SET user_id=$1, is_activated=true WHERE id=$2', [req.user.id, rows[0].id])
    res.json({ success: true, device: { id: rows[0].id, name: rows[0].name } })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// POST /api/devices/admin — register new device
devicesRouter.post('/admin', requireAdmin, async (req, res) => {
  try {
    const { name, imei, type, plate, protocol, clientId } = req.body
    if (!name || !imei) return res.status(400).json({ error: 'Name and IMEI required' })
    const activationCode = crypto.randomBytes(3).toString('hex').toUpperCase()
    let traccarId = null
    try {
      const traccarDevice = await traccar.createDevice({ name, imei, protocol: protocol || 'GT06' })
      traccarId = traccarDevice?.id ?? null
    } catch (e) { console.warn('[Admin] Traccar device creation failed:', e.message) }
    const { rows } = await db.query(
      `INSERT INTO devices (name, imei, type, plate, traccar_id, user_id, activation_code, is_activated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, imei, type || 'car', plate || null, traccarId, clientId || null, activationCode, !!clientId]
    )
    res.status(201).json({ ...rows[0], activationCode })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'IMEI already exists' })
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/devices/:id/geofence
devicesRouter.post('/:id/geofence', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM devices WHERE id=$1', [req.params.id])
    const dev = rows[0]
    if (!dev) return res.status(404).json({ error: 'Device not found' })
    if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    const { lat, lng, radius, name: gfName } = req.body
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' })
    try {
      await traccar.createGeofence(gfName || 'Geofence', lat, lng, radius || 500)
    } catch (e) { console.warn('[Geofence] Traccar error:', e.message) }
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})
