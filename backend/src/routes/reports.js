import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'
import * as traccar from '../services/traccar.js'

export const reportsRouter = Router()

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat/2)**2 + Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
function speedKmh(speed) { return Math.max(0, Number(speed || 0) * 1.852) }
const GAP_MS = 5 * 60 * 1000
function buildTrips(positions) {
  if (!positions || positions.length === 0) return []
  const sorted = [...positions].sort((a, b) => new Date(a.fixTime) - new Date(b.fixTime))
  const trips = []; let current = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const gap = new Date(sorted[i].fixTime) - new Date(sorted[i-1].fixTime)
    if (gap > GAP_MS) { if (current.length > 1) trips.push(current); current = [sorted[i]] }
    else current.push(sorted[i])
  }
  if (current.length > 1) trips.push(current)
  return trips
}

reportsRouter.get(['/', '/trips'], requireAuth, async (req, res) => {
  const { deviceId, from, to } = req.query
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' })
  try {
    const { rows } = await db.query('SELECT * FROM devices WHERE id=$1', [deviceId])
    const dev = rows[0]
    if (!dev) return res.status(404).json({ error: 'Device not found' })
    if (!req.user.is_admin && dev.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    try {
      const positions = await traccar.getHistory(dev.traccar_id, from || new Date(Date.now() - 24*3600000).toISOString(), to || new Date().toISOString())
      if (!positions || positions.length === 0) return res.json({ totalDistanceKm:0, movingDurationMin:0, stoppedDurationMin:0, avgSpeed:0, maxSpeed:0, trips:[], speedSeries:[] })
      let totalDist=0, movingMs=0, maxSpeed=0; const speedSeries=[]
      const sorted = [...positions].sort((a,b) => new Date(a.fixTime)-new Date(b.fixTime))
      for (let i=1; i<sorted.length; i++) {
        const prev=sorted[i-1], cur=sorted[i]
        const segDist=haversine(prev.latitude,prev.longitude,cur.latitude,cur.longitude)
        const segMs=new Date(cur.fixTime)-new Date(prev.fixTime)
        const spd=speedKmh(cur.speed)
        totalDist+=segDist; if(spd>2) movingMs+=segMs; if(spd>maxSpeed) maxSpeed=spd
        speedSeries.push({ time:cur.fixTime, speed:Math.round(spd) })
      }
      const allMs=new Date(sorted[sorted.length-1].fixTime)-new Date(sorted[0].fixTime)
      const stoppedMs=Math.max(0,allMs-movingMs)
      const validSpeeds=sorted.map(p=>speedKmh(p.speed)).filter(s=>s>0)
      const avgSpeed=validSpeeds.length ? validSpeeds.reduce((a,b)=>a+b,0)/validSpeeds.length : 0
      const trips=buildTrips(positions).map((pts,i) => {
        let dist=0; for(let j=1;j<pts.length;j++) dist+=haversine(pts[j-1].latitude,pts[j-1].longitude,pts[j].latitude,pts[j].longitude)
        const dMs=new Date(pts[pts.length-1].fixTime)-new Date(pts[0].fixTime)
        const speeds=pts.map(p=>speedKmh(p.speed)).filter(s=>s>0)
        let stopMs=0; for(let j=1;j<pts.length;j++) if(speedKmh(pts[j].speed)<2) stopMs+=new Date(pts[j].fixTime)-new Date(pts[j-1].fixTime)
        return {
          index:i+1, startTime:pts[0].fixTime, endTime:pts[pts.length-1].fixTime,
          durationMin:Math.round(dMs/60000), distanceKm:Math.round(dist*10)/10,
          avgSpeed:Math.round(speeds.length?speeds.reduce((a,b)=>a+b,0)/speeds.length:0),
          maxSpeed:Math.round(speeds.length?Math.max(...speeds):0),
          stopMin:Math.round(stopMs/60000), points:pts.length,
          route:pts.map(p=>({ latitude:Number(p.latitude), longitude:Number(p.longitude), speed:Math.round(speedKmh(p.speed)), fixTime:p.fixTime, address:p.address||null })),
        }
      })
      return res.json({ totalDistanceKm:Math.round(totalDist*10)/10, movingDurationMin:Math.round(movingMs/60000), stoppedDurationMin:Math.round(stoppedMs/60000), avgSpeed:Math.round(avgSpeed), maxSpeed:Math.round(maxSpeed), trips, speedSeries:speedSeries.slice(0,200) })
    } catch (e) { console.error('[reports] Traccar history error:', e.message); return res.status(502).json({ error: 'Unable to load trip history from Traccar' }) }
  } catch (err) { console.error('[reports]', err); res.status(500).json({ error: 'Server error' }) }
})

reportsRouter.get('/daily-summary', requireAuth, async (req, res) => {
  const days = Math.min(parseInt(req.query.days)||7, 30)
  try {
    const { rows: deviceRows } = await db.query(
      req.user.is_admin ? 'SELECT id, traccar_id FROM devices WHERE traccar_id IS NOT NULL' : 'SELECT id, traccar_id FROM devices WHERE user_id=$1 AND traccar_id IS NOT NULL',
      req.user.is_admin ? [] : [req.user.id]
    )
    if (!deviceRows.length) return res.json({ todayKm: 0, dailyData: [] })
    const now=new Date(), todayStart=new Date(now); todayStart.setHours(0,0,0,0)
    const dailyData=[]; for(let i=days-1;i>=0;i--) { const d=new Date(now); d.setDate(d.getDate()-i); d.setHours(0,0,0,0); dailyData.push({ date:d.toISOString().split('T')[0], km:0 }) }
    let todayKm=0; const from=new Date(Date.now()-days*24*3600000).toISOString(), to=now.toISOString()
    const BATCH=5
    for(let b=0;b<deviceRows.length;b+=BATCH) {
      await Promise.allSettled(deviceRows.slice(b,b+BATCH).map(async(dev) => {
        try {
          const positions=await traccar.getHistory(dev.traccar_id,from,to)
          if(!positions||positions.length<2) return
          const sorted=[...positions].sort((a,b)=>new Date(a.fixTime)-new Date(b.fixTime))
          for(let i=1;i<sorted.length;i++) {
            const dist=haversine(sorted[i-1].latitude,sorted[i-1].longitude,sorted[i].latitude,sorted[i].longitude)
            const dayStr=new Date(sorted[i].fixTime).toISOString().split('T')[0]
            const bucket=dailyData.find(d=>d.date===dayStr)
            if(bucket) bucket.km+=dist
            if(new Date(sorted[i].fixTime)>=todayStart) todayKm+=dist
          }
        } catch {}
      }))
    }
    dailyData.forEach(d=>{d.km=Math.round(d.km*10)/10}); todayKm=Math.round(todayKm*10)/10
    return res.json({ todayKm, dailyData })
  } catch (err) { console.error('[reports/daily-summary]', err); res.status(500).json({ error: 'Server error' }) }
})
