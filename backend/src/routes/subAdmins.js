import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { requireAuth, requireMainAdmin } from '../middleware/auth.js'
import { validateBody, schemas } from '../validation/schemas.js'
import { db } from '../db.js'

export const subAdminsRouter = Router()

const DEFAULT_PERMISSIONS = {
  add_clients:      true,
  add_devices:      true,
  view_reports:     true,
  view_map:         true,
  view_alerts:      true,
  device_setup:     false,
  support_settings: false,
}

// GET /api/sub-admins — list sub-admins
subAdminsRouter.get('/', requireAuth, requireMainAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id, u.name, u.email, u.phone, u.is_active, u.admin_permissions,
             u.created_at, u.avatar,
             COUNT(DISTINCT sac.client_id)::int AS assigned_clients
      FROM users u
      LEFT JOIN sub_admin_client_access sac ON sac.sub_admin_id = u.id
      WHERE u.is_sub_admin = true AND u.parent_admin_id = $1
      GROUP BY u.id ORDER BY u.created_at DESC
    `, [req.user.id])
    res.json(rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// POST /api/sub-admins — create sub-admin
subAdminsRouter.post('/', requireAuth, requireMainAdmin, validateBody(schemas.createSubAdmin), async (req, res) => {
  const { name, email, password, adminPermissions } = req.body
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email, password required' })
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  try {
    const hash = await bcrypt.hash(password, 12)
    const perms = { ...DEFAULT_PERMISSIONS, ...(adminPermissions || {}) }
    const { rows } = await db.query(`
      INSERT INTO users
        (name, email, password_hash, is_admin, is_sub_admin, parent_admin_id, admin_permissions, avatar, subscription)
      VALUES ($1,$2,$3,true,true,$4,$5,$6,'Admin')
      RETURNING id, name, email, is_active, admin_permissions, created_at, avatar
    `, [name, email, hash, req.user.id, JSON.stringify(perms), name.charAt(0).toUpperCase()])
    res.status(201).json({ ...rows[0], assigned_clients: 0 })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' })
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/sub-admins/:id — update sub-admin
subAdminsRouter.patch('/:id', requireAuth, requireMainAdmin, validateBody(schemas.updateSubAdmin), async (req, res) => {
  const { name, isActive, adminPermissions, password } = req.body
  const sets = []
  const vals = []
  let i = 1
  if (name !== undefined)             { sets.push(`name=$${i++}`);              vals.push(name) }
  if (isActive !== undefined)         { sets.push(`is_active=$${i++}`);         vals.push(isActive) }
  if (adminPermissions !== undefined) { sets.push(`admin_permissions=$${i++}`); vals.push(JSON.stringify(adminPermissions)) }
  if (password)                       { sets.push(`password_hash=$${i++}`);     vals.push(await bcrypt.hash(password, 12)) }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
  sets.push(`updated_at=NOW()`)
  vals.push(req.params.id, req.user.id)
  try {
    const { rows } = await db.query(
      `UPDATE users SET ${sets.join(',')}
       WHERE id=$${i++} AND parent_admin_id=$${i} AND is_sub_admin=true
       RETURNING id,name,email,is_active,admin_permissions,avatar`,
      vals
    )
    if (!rows[0]) return res.status(404).json({ error: 'Sub-admin not found' })
    res.json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// DELETE /api/sub-admins/:id
subAdminsRouter.delete('/:id', requireAuth, requireMainAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `DELETE FROM users WHERE id=$1 AND parent_admin_id=$2 AND is_sub_admin=true RETURNING id`,
      [req.params.id, req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Sub-admin not found' })
    res.json({ ok: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// GET /api/sub-admins/:id/clients — get clients assigned to a sub-admin
subAdminsRouter.get('/:id/clients', requireAuth, requireMainAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id, u.name, u.email, u.avatar, u.is_active,
             COUNT(d.id)::int AS devices_count
      FROM sub_admin_client_access sac
      JOIN users u ON u.id = sac.client_id
      LEFT JOIN devices d ON d.user_id = u.id
      WHERE sac.sub_admin_id = $1
      GROUP BY u.id
    `, [req.params.id])
    res.json(rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})

// PUT /api/sub-admins/:id/clients — replace client assignments
subAdminsRouter.put('/:id/clients', requireAuth, requireMainAdmin, validateBody(schemas.assignSubAdminClients), async (req, res) => {
  const { clientIds } = req.body
  if (!Array.isArray(clientIds)) return res.status(400).json({ error: 'clientIds must be array' })
  try {
    const { rows: saRows } = await db.query(
      'SELECT id FROM users WHERE id=$1 AND parent_admin_id=$2 AND is_sub_admin=true',
      [req.params.id, req.user.id]
    )
    if (!saRows[0]) return res.status(404).json({ error: 'Sub-admin not found' })
    await db.query('DELETE FROM sub_admin_client_access WHERE sub_admin_id=$1', [req.params.id])
    if (clientIds.length > 0) {
      const values = clientIds.map((_, i) => `($1,$${i + 2})`).join(',')
      await db.query(
        `INSERT INTO sub_admin_client_access (sub_admin_id, client_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        [req.params.id, ...clientIds]
      )
    }
    res.json({ ok: true, assigned: clientIds.length })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
})
