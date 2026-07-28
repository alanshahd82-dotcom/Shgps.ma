import { Router } from 'express'
    import bcrypt from 'bcryptjs'
    import jwt    from 'jsonwebtoken'
    import { db }          from '../db.js'
    import { config }      from '../config.js'
    import { requireAuth } from '../middleware/auth.js'

    export const authRouter = Router()

    authRouter.post('/login', async (req, res) => {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    try {
      const { rows } = await db.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase().trim()])
      const user = rows[0]
      if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid credentials' })
      if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' })
      const token = jwt.sign({ userId: user.id, isAdmin: user.is_admin }, config.jwtSecret, { expiresIn: config.jwtExpiry })
      res.json({
        token,
        user: { id:user.id, email:user.email, name:user.name, phone:user.phone, city:user.city,
                subscription:user.subscription, isAdmin:user.is_admin, avatar:user.avatar },
      })
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
    })

    authRouter.get('/me', requireAuth, (req, res) => {
    const u = req.user
    res.json({ id:u.id, email:u.email, name:u.name, phone:u.phone, city:u.city,
               subscription:u.subscription, isAdmin:u.is_admin, avatar:u.avatar })
    })

    authRouter.post('/logout', (_req, res) => res.json({ success: true }))
    