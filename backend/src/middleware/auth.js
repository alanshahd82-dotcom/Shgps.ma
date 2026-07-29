import jwt from 'jsonwebtoken'
import { db } from '../db.js'
import { config } from '../config.js'

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, config.jwtSecret)
    const { rows } = await db.query('SELECT * FROM users WHERE id=$1 AND is_active=true', [payload.userId])
    if (!rows[0]) return res.status(401).json({ error: 'User not found' })
    req.user = rows[0]
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

export async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin access required' })
    next()
  })
}
