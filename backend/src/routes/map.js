import { Router } from 'express'
    import { requireAuth, requireAdmin } from '../middleware/auth.js'
    import { db }       from '../db.js'
    import * as traccar from '../services/traccar.js'
import { getSubscriptionSnapshot } from '../services/subscriptions.js'
import { config } from '../config.js'

    export const mapRouter = Router()

const ALLOWED_STYLES = new Set([
  'osm-bright',
  'osm-bright-grey',
  'osm-bright-smooth',
  'osm-carto',
  'osm-liberty',
  'klokantech-basic',
  'dark-matter-dark-grey',
  'dark-matter-dark-purple',
])

// Geoapify tile proxy: keep the provider key on the server, never in browser code.
mapRouter.get('/tiles/:z/:x/:y.png', async (req, res) => {
  const z = Number(req.params.z)
  const x = Number(req.params.x)
  const y = Number(req.params.y)
  const style = ALLOWED_STYLES.has(req.query.style) ? req.query.style : config.geoapify.style

  if (!config.geoapify.apiKey) {
    return res.status(503).json({ error: 'Map provider is not configured' })
  }
  if (!Number.isInteger(z) || z < 0 || z > 20 || !Number.isInteger(x) || x < 0 || !Number.isInteger(y) || y < 0) {
    return res.status(400).json({ error: 'Invalid tile coordinates' })
  }

  try {
    const upstream = await fetch(
      `https://maps.geoapify.com/v1/tile/${style}/${z}/${x}/${y}.png?apiKey=${encodeURIComponent(config.geoapify.apiKey)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!upstream.ok) {
      return res.status(upstream.status === 401 || upstream.status === 403 ? 502 : upstream.status)
        .json({ error: 'Map provider rejected the tile request' })
    }
    const contentType = upstream.headers.get('content-type') || 'image/png'
    const buffer = Buffer.from(await upstream.arrayBuffer())
    res.set('Content-Type', contentType)
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400')
    return res.send(buffer)
  } catch (err) {
    console.error('[Maps] Geoapify tile request failed:', err.message)
    return res.status(502).json({ error: 'Map provider unavailable' })
  }
})

    mapRouter.get('/positions', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const [{ rows }, positions] = await Promise.all([
        db.query('SELECT d.*,u.name AS client_name FROM devices d LEFT JOIN users u ON d.user_id=u.id'),
        traccar.getAllPositions().catch(()=>[]),
      ])
      const pm = {}
      for (const p of positions) pm[p.deviceId]=p
      res.json(rows.map(d => {
        const subscription = getSubscriptionSnapshot(d)
        const position = subscription.trackingEnabled ? pm[d.traccar_id] : null
        return {
          id: d.id, name: d.name, type: d.type, plate: d.plate, clientName: d.client_name,
          lat: position?.latitude ?? null, lng: position?.longitude ?? null,
          speed: position?.speed ?? 0,
          status: position ? 'online' : 'offline',
          lastUpdate: position?.fixTime ?? null,
          subscriptionStatus: subscription.subscriptionStatus,
          trackingEnabled: subscription.trackingEnabled,
        }
      }))
    } catch (err) { console.error(err); res.status(500).json({ error:'Server error' }) }
    })
    