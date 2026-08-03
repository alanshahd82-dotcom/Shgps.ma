import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'

export const alertsRouter = Router()

alertsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = req.user.is_admin
      ? await db.query(`SELECT a.*,d.name AS device_name,u.name AS client_name
          FROM alerts a LEFT JOIN devices d ON a.device_id=d.id LEFT JOIN users u ON a.user_id=u.id
          ORDER BY a.created_at DESC LIMIT 200`)
      : await db.query(`SELECT a.*,d.name AS device_name
          FROM alerts a LEFT JOIN devices d ON a.device_id=d.id
          WHERE a.user_id=$1 ORDER BY a.created_at DESC LIMIT 100`, [req.user.id])
    res.json(rows.map(a=>({
      id:a.id, type:a.type, message:a.message,
      deviceId:a.device_id, deviceName:a.device_name, clientName:a.client_name??null,
      read:a.is_read, time:a.created_at, data:a.data,
    })))
  } catch (err) { console.error(err); res.status(500).json({ error:'Server error' }) }
})

alertsRouter.patch('/read-all', requireAuth, async (req, res) => {
  try { await db.query('UPDATE alerts SET is_read=true WHERE user_id=$1',[req.user.id]); res.json({success:true}) }
  catch { res.status(500).json({error:'Server error'}) }
})

alertsRouter.patch('/:id/read', requireAuth, async (req, res) => {
  try { await db.query('UPDATE alerts SET is_read=true WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]); res.json({success:true}) }
  catch { res.status(500).json({error:'Server error'}) }
})
