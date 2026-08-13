import { Router } from 'express'
    import { requireAuth } from '../middleware/auth.js'
    import { db }       from '../db.js'
    import * as traccar from '../services/traccar.js'
import { deviceAccessScope } from '../middleware/deviceAccess.js'
import { getSubscriptionSnapshot } from '../services/subscriptions.js'
import {
  hasKnownVehicleVoltage,
  isVehicleDisconnected,
  positionIsFresh,
  positionIsSilent,
  POWER_SILENCE_WINDOW_MS,
  readBatteryLevel,
  readVehicleVoltage,
} from '../services/vehicleTelemetry.js'
import { config } from '../config.js'

    export const mapRouter = Router()

function readElectricalTelemetry(position, traccarId, connected) {
  return {
    voltage: readVehicleVoltage(position, traccarId, { connected }),
    batteryLevel: readBatteryLevel(position),
    powerDisconnected: !connected && isVehicleDisconnected(traccarId),
  }
}

const ALLOWED_STYLES = new Set([
  'osm-bright',
  'osm-bright-grey',
  'osm-bright-smooth',
  'osm-carto',
  'osm-liberty',
  'dark-matter',
  'klokantech-basic',
  'dark-matter-dark-grey',
  'dark-matter-dark-purple',
  'hybrid',
])

const TILE_LIMIT = 180
const TILE_WINDOW_MS = 60 * 1000
const tileAttempts = new Map()
const tileCache = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of tileAttempts) {
    if (now - entry.startedAt > TILE_WINDOW_MS) tileAttempts.delete(key)
  }
  for (const [key, entry] of tileCache) {
    if (entry.expiresAt <= now) tileCache.delete(key)
  }
}, TILE_WINDOW_MS).unref()

// Geoapify tile proxy: keep the provider key on the server, never in browser code.
mapRouter.get('/tiles/:z/:x/:y.png', async (req, res) => {
  const z = Number(req.params.z)
  const x = Number(req.params.x)
  const y = Number(req.params.y)
  const style = ALLOWED_STYLES.has(req.query.style) ? req.query.style : config.geoapify.style

  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const attempt = tileAttempts.get(clientIp)
  if (!attempt || now - attempt.startedAt > TILE_WINDOW_MS) {
    tileAttempts.set(clientIp, { startedAt: now, count: 1 })
  } else {
    attempt.count += 1
    if (attempt.count > TILE_LIMIT) {
      return res.status(429).json({ error: 'Too many map tile requests. Try again shortly.' })
    }
  }

  const maxTile = 2 ** z
  if (!config.geoapify.apiKey) {
    return res.status(503).json({ error: 'Map provider is not configured' })
  }
  if (!Number.isInteger(z) || z < 0 || z > 20 || !Number.isInteger(x) || x < 0 || !Number.isInteger(y) || y < 0 || x >= maxTile || y >= maxTile) {
    return res.status(400).json({ error: 'Invalid tile coordinates' })
  }

  const cacheKey = `${style}/${z}/${x}/${y}`
  const cached = tileCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    res.set('Content-Type', cached.contentType)
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400')
    return res.send(cached.buffer)
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
    tileCache.set(cacheKey, { buffer, contentType, expiresAt: now + 24 * 60 * 60 * 1000 })
    if (tileCache.size > 500) tileCache.delete(tileCache.keys().next().value)
    res.set('Content-Type', contentType)
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400')
    return res.send(buffer)
  } catch (err) {
    console.error('[Maps] Geoapify tile request failed:', err.message)
    return res.status(502).json({ error: 'Map provider unavailable' })
  }
})

    mapRouter.get('/positions', requireAuth, async (req, res) => {
    try {
      const scope = deviceAccessScope(req.user, 'd')
      const deviceQuery = {
        text: `SELECT d.*,u.name AS client_name
               FROM devices d
               LEFT JOIN users u ON d.user_id=u.id
               WHERE ${scope.text}`,
        values: scope.values,
      }
      const [{ rows }, positions] = await Promise.all([
        db.query(deviceQuery.text, deviceQuery.values),
        traccar.getAllPositions().catch(()=>[]),
      ])
      const pm = {}
      for (const p of positions) pm[p.deviceId]=p
      res.json(rows.map(d => {
        const subscription = getSubscriptionSnapshot(d)
        const position = subscription.trackingEnabled ? pm[d.traccar_id] : null
        const freshPosition = positionIsFresh(position, POWER_SILENCE_WINDOW_MS)
        const inferredDisconnect = !freshPosition
          && positionIsSilent(position, POWER_SILENCE_WINDOW_MS)
          && hasKnownVehicleVoltage(d.traccar_id)
        const electrical = readElectricalTelemetry(
          freshPosition ? position : null,
          d.traccar_id,
          freshPosition,
        )
        electrical.powerDisconnected = electrical.powerDisconnected || inferredDisconnect
        return {
          id: d.id, name: d.name, type: d.type, plate: d.plate, clientName: d.client_name,
          lat: position?.latitude ?? null, lng: position?.longitude ?? null,
          speed: position?.speed ?? 0,
          status: freshPosition ? 'online' : 'offline',
          lastUpdate: position?.fixTime ?? null,
          engineOn: position?.attributes?.ignition ?? false,
          voltage: electrical.voltage,
          batteryLevel: electrical.batteryLevel,
          powerDisconnected: electrical.powerDisconnected,
          signal: position?.attributes?.rssi ?? position?.attributes?.gsm ?? position?.attributes?.signal ?? position?.attributes?.signalStrength ?? null,
          fuel: position?.attributes?.fuel ?? position?.attributes?.fuelLevel ?? null,
          subscriptionStatus: subscription.subscriptionStatus,
          trackingEnabled: subscription.trackingEnabled,
        }
      }))
    } catch (err) { console.error(err); res.status(500).json({ error:'Server error' }) }
    })
    
// ── Satellite tiles proxy (Esri) ────────────────────────────────────────────
mapRouter.get('/sat-tiles/:z/:x/:y.png', async (req, res) => {
  try {
    const { z, x, y } = req.params
    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
    const up = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    })
    if (!up.ok) return res.status(502).end()
    const buf = Buffer.from(await up.arrayBuffer())
    res.set('Content-Type', up.headers.get('content-type') || 'image/png')
    res.set('Cache-Control', 'public, max-age=604800')
    res.send(buf)
  } catch {
    res.status(502).end()
  }
})

// Street tiles proxy: the replay screen must have a keyless map fallback.
// Keep the provider request server-side so browser CORS and tile-policy
// differences cannot leave the map stuck on its loading surface.
mapRouter.get('/street-tiles/:z/:x/:y.png', async (req, res) => {
  try {
    const z = Number(req.params.z)
    const x = Number(req.params.x)
    const y = Number(req.params.y)
    const maxTile = 2 ** z
    if (!Number.isInteger(z) || z < 0 || z > 19
      || !Number.isInteger(x) || !Number.isInteger(y)
      || x < 0 || y < 0 || x >= maxTile || y >= maxTile) {
      return res.status(400).end()
    }

    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    })
    if (!upstream.ok) return res.status(502).end()

    res.set('Content-Type', upstream.headers.get('content-type') || 'image/png')
    res.set('Cache-Control', 'public, max-age=604800')
    return res.send(Buffer.from(await upstream.arrayBuffer()))
  } catch {
    return res.status(502).end()
  }
})
