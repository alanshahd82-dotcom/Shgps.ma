import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { db }       from '../db.js'
import * as traccar from '../services/traccar.js'

export const clientsRouter = Router()

clientsRouter.get('/', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id,u.name,u.email,u.phone,u.city,u.subscription,u.is_active,u.avatar,u.created_at,
             COUNT(d.id)::int AS devices_count
      FROM users u LEFT JOIN devices d ON u.id=d.user_id
      WHERE u.is_admin=false GROUP BY u.id ORDER BY u.created_at DESC`)
    res.json(rows.map(u=>({
      id:u.id, name:u.name, email:u.email, phone:u.phone, city:u.city,
      subscription:u.subscription, status: u.is_active?'active':'inactive',
      devicesCount:u.devices_count, joinDate:u.created_at, avatar:u.avatar||u.name?.charAt(0),
    })))
  } catch (err) { console.error(err); res.status(500).json({ error:'Server error' }) }
})

clientsRouter.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name, email, password, phone, city, subscription } = req.body
  if (!name||!email||!password) return res.status(400).json({ error:'Name, email, password required' })
  try {
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await db.query(`
      INSERT INTO users (name,email,password_hash,phone,city,subscription,avatar,must_change_password)
      VALUES ($1,$2,$3,$4,$5,$6,$7,true)
      RETURNING id,name,email,phone,city,subscription,is_active,created_at`,
      [name, email.toLowerCase(), hash, phone, city, subscription||'Basic', name.charAt(0)])
    const user = rows[0]
    try {
      const tu = await traccar.createUser(name, email, password)
      await db.query('UPDATE users SET traccar_id=$1 WHERE id=$2', [tu.id, user.id])
    } catch (e) { console.warn('Traccar user skipped:', e.message) }
    res.status(201).json({ id:user.id, name:user.name, email:user.email, phone:user.phone,
      city:user.city, subscription:user.subscription, status:'active',
      devicesCount:0, joinDate:user.created_at, avatar:name.charAt(0) })
  } catch (err) {
    if (err.code==='23505') return res.status(409).json({ error:'Email already exists' })
    console.error(err); res.status(500).json({ error:'Server error' })
  }
})

clientsRouter.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, phone, city, subscription, is_active } = req.body
  try {
    const { rows } = await db.query(`
      UPDATE users SET name=COALESCE($1,name), phone=COALESCE($2,phone),
        city=COALESCE($3,city), subscription=COALESCE($4,subscription),
        is_active=COALESCE($5,is_active), updated_at=NOW()
      WHERE id=$6 AND is_admin=false RETURNING id`,
      [name,phone,city,subscription,is_active,req.params.id])
    if (!rows[0]) return res.status(404).json({ error:'Client not found' })
    res.json({ success:true })
  } catch (err) { console.error(err); res.status(500).json({ error:'Server error' }) }
})

clientsRouter.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT traccar_id FROM users WHERE id=$1 AND is_admin=false', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error:'Client not found' })
    if (rows[0].traccar_id) try { await traccar.deleteUser(rows[0].traccar_id) } catch {}
    await db.query('DELETE FROM users WHERE id=$1 AND is_admin=false', [req.params.id])
    res.json({ success:true })
  } catch (err) { console.error(err); res.status(500).json({ error:'Server error' }) }
})

// POST /api/clients/:id/reset-password — reset client password (admin)
clientsRouter.post('/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  const { password } = req.body
  if (!password) return res.status(400).json({ error: 'Password required' })
  try {
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await db.query(
      `UPDATE users SET password_hash=$1, must_change_password=true, updated_at=NOW()
       WHERE id=$2 AND is_admin=false RETURNING id`,
      [hash, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Client not found' })
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

clientsRouter.post('/:id/devices', requireAuth, requireAdmin, async (req, res) => {
  const { name, imei, type, plate } = req.body
  if (!name||!imei) return res.status(400).json({ error:'Name and IMEI required' })
  const clientId = req.params.id
  try {
    let traccarId = null
    try {
      const td = await traccar.createDevice(name, imei)
      traccarId = td.id
      const { rows: clientRows } = await db.query('SELECT traccar_id FROM users WHERE id=$1', [clientId])
      if (clientRows[0]?.traccar_id) await traccar.linkDevice(clientRows[0].traccar_id, traccarId)
    } catch (e) { console.warn('Traccar device skipped:', e.message) }
    const { rows } = await db.query(
      `INSERT INTO devices (name,imei,type,plate,user_id,traccar_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, imei, type || 'car', plate || null, clientId || null, traccarId]
    )
    const d = rows[0]
    res.status(201).json({
      id: d.id, name: d.name, imei: d.imei, type: d.type, plate: d.plate,
      clientId: d.user_id, status: 'offline', lat: 0, lng: 0, speed: 0,
      lastUpdate: null, engineOn: false, battery: null, signal: null, fuel: null,
    })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'IMEI already registered' })
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})
