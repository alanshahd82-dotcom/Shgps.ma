import jwt from 'jsonwebtoken'
    import { config } from '../config.js'
    import { db } from '../db.js'

    export async function requireAuth(req, res, next) {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
    const token = header.split(' ')[1]
    try {
      const { userId } = jwt.verify(token, config.jwtSecret)
      const { rows } = await db.query(
        'SELECT id,email,name,is_admin,is_active,traccar_id,phone,city,subscription,avatar FROM users WHERE id=$1',
        [userId]
      )
      if (!rows[0] || !rows[0].is_active) return res.status(401).json({ error: 'Account not found or inactive' })
      req.user = rows[0]
      next()
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' })
    }
    }

    export function requireAdmin(req, res, next) {
    if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin access required' })
    next()
    }
    