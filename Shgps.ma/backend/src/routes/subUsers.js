import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db.js'
import { requireAuth }    from '../middleware/auth.js'
import { requireRole }    from '../middleware/requireRole.js'
import { validateBody, schemas } from '../validation/schemas.js'
import { logAudit }    from '../services/auditLog.js'

export const subUsersRouter = Router()

// All routes require auth (client only — not admin creating sub-users for others)

// GET /api/sub-users — list sub-users created by this client
subUsersRouter.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, email, name, role, is_active, created_at
       FROM users
       WHERE parent_client_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    )
    res.json(rows.map(u => ({
      id:        u.id,
      email:     u.email,
      name:      u.name,
      role:      u.role || 'viewer',
      isActive:  u.is_active,
      createdAt: u.created_at,
    })))
  } catch (err) {
    console.error('[sub-users GET]', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/sub-users — create a sub-user
subUsersRouter.post('/', requireAuth, requireRole('manager'), validateBody(schemas.createSubUser), async (req, res) => {
  try {
    const { name, email, password, role } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' })
    }

    const VALID_ROLES = ['manager', 'viewer', 'reports', 'alerts']
    const assignedRole = VALID_ROLES.includes(role) ? role : 'viewer'

    // Check email is not already in use
    const { rows: existing } = await db.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase().trim()])
    if (existing.length > 0) return res.status(409).json({ error: 'Email already in use' })

    const passwordHash = await bcrypt.hash(password, 10)

    const { rows } = await db.query(
      `INSERT INTO users
         (email, password_hash, name, role, parent_client_id, is_active, is_admin, subscription, max_devices)
       VALUES ($1, $2, $3, $4, $5, true, false, 'sub', 0)
       RETURNING id, email, name, role, is_active, created_at`,
      [email.toLowerCase().trim(), passwordHash, name.trim(), assignedRole, req.user.id]
    )
    const u = rows[0]
    await logAudit(req.user.id, 'sub_user_created', 'user', u.id, { email: u.email, role: u.role })
    res.status(201).json({
      id:        u.id,
      email:     u.email,
      name:      u.name,
      role:      u.role,
      isActive:  u.is_active,
      createdAt: u.created_at,
    })
  } catch (err) {
    console.error('[sub-users POST]', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/sub-users/:id — update role or active status
subUsersRouter.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { role, isActive } = req.body
    const { rows } = await db.query(
      'SELECT * FROM users WHERE id=$1 AND parent_client_id=$2',
      [req.params.id, req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Sub-user not found' })

    const VALID_ROLES = ['manager', 'viewer', 'reports', 'alerts']
    const updates = []
    const params  = []
    let   idx     = 1

    if (role !== undefined && VALID_ROLES.includes(role)) {
      updates.push(`role=$${idx++}`); params.push(role)
    }
    if (isActive !== undefined) {
      updates.push(`is_active=$${idx++}`); params.push(Boolean(isActive))
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' })

    params.push(req.params.id, req.user.id)
    const { rows: updated } = await db.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at=NOW()
       WHERE id=$${idx++} AND parent_client_id=$${idx}
       RETURNING id, email, name, role, is_active, created_at`,
      params
    )
    const u = updated[0]
    res.json({ id: u.id, email: u.email, name: u.name, role: u.role, isActive: u.is_active, createdAt: u.created_at })
  } catch (err) {
    console.error('[sub-users PATCH]', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/sub-users/:id
subUsersRouter.delete('/:id', requireAuth, requireRole('manager'), async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id FROM users WHERE id=$1 AND parent_client_id=$2',
      [req.params.id, req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Sub-user not found' })

    await logAudit(req.user.id, 'sub_user_deleted', 'user', Number(req.params.id), {})
    await db.query('DELETE FROM users WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    console.error('[sub-users DELETE]', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})
