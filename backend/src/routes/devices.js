import { Router } from 'express'
import { requireAuth, requireMainAdmin }  from '../middleware/auth.js'
import { logAudit }    from '../services/auditLog.js'
import { validateBody, schemas } from '../validation/schemas.js'
    import { db }          from '../db.js'
    import * as traccar    from '../services/traccar.js'
import { deviceAccessScope, getAccessibleDevice, requireDeviceOwner } from '../middleware/deviceAccess.js'
import {
  addMonths,
  dateOnly,
  getSubscriptionPlan,
  getSubscriptionSnapshot,
  syncSubscriptionState,
} from '../services/subscriptions.js'
import { speedKmh } from '../utils/speed.js'
import {
  hasKnownVehicleVoltage,
  isVehicleDisconnected,
  positionIsFresh,
  positionIsSilent,
  POWER_SILENCE_WINDOW_MS,
  readBatteryLevel,
  readVehicleVoltage,
  registerEngineCommandCooldown,
} from '../services/vehicleTelemetry.js'

    export const devicesRouter = Router()

    function readElectricalTelemetry(position, traccarId, options = {}) {
      const connected = options.connected !== false
      return {
        voltage: readVehicleVoltage(position, traccarId, { ...options, connected }),
        batteryLevel: readBatteryLevel(position),
        powerDisconnected: Boolean(options.powerDisconnected || isVehicleDisconnected(traccarId)),
      }
    }

    async function clientHasUsedFreeTrial(clientId) {
      if (!clientId) return false
      const { rows } = await db.query(
        `SELECT 1
         FROM devices
         WHERE user_id=$1 AND subscription_plan_id='free_trial_3_months'
         LIMIT 1`,
        [clientId]
      )
      return Boolean(rows[0])
    }

    // GET /devices/test-connection?imei= — check whether a registered device has sent data
    devicesRouter.get('/test-connection', requireAuth, requireMainAdmin, async (req, res) => {
      const { imei } = req.query
      if (!imei) return res.status(400).json({ error: 'IMEI required' })
      try {
        // Check local DB first
        const { rows } = await db.query('SELECT id, traccar_id, name, user_id FROM devices WHERE imei=$1', [imei])
        if (rows[0]) {
          let traccarDevice = null
          let position = null
          try {
            const [allDevices, allPos] = await Promise.all([
              traccar.getAllDevices(),
              traccar.getAllPositions(),
            ])
            traccarDevice = allDevices.find(d =>
              d.id === rows[0].traccar_id || d.uniqueId === imei
            ) || null
            position = allPos.find(p =>
              p.deviceId === traccarDevice?.id || p.deviceId === rows[0].traccar_id
            ) || null
          } catch {}
          const online = traccarDevice?.status === 'online' || !!position
          return res.json({
            found: true, registered: true, deviceId: rows[0].id,
            traccarId: traccarDevice?.id ?? rows[0].traccar_id,
            name: rows[0].name, online,
            traccarRegistered: !!traccarDevice,
            hasPosition: !!position,
            traccarStatus: traccarDevice?.status || null,
            lastUpdate: position?.fixTime || traccarDevice?.lastUpdate || null,
          })
        }
        // Check Traccar directly (admin-level device list)
        try {
          const traccarDevices = await traccar.getAllDevices()
          const td = Array.isArray(traccarDevices) && traccarDevices.find(d => d.uniqueId === imei)
          if (td) {
            const allPos = await traccar.getAllPositions()
            const position = allPos.find(p => p.deviceId === td.id) || null
            return res.json({ found: true, registered: false, traccarId: td.id,
              name: td.name, online: td.status === 'online' || !!position,
              traccarRegistered: true, hasPosition: !!position,
              traccarStatus: td.status || null,
              lastUpdate: position?.fixTime || td.lastUpdate || null })
          }
        } catch {}
        return res.json({ found: false, registered: false, online: false })
      } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
    })

    devicesRouter.get('/', requireAuth, async (req, res) => {
    try {
      const scope = deviceAccessScope(req.user, 'd')
      const { rows } = await db.query(
        `SELECT d.*,u.name AS client_name
         FROM devices d
         LEFT JOIN users u ON d.user_id=u.id
         WHERE ${scope.text}
         ORDER BY d.created_at DESC`,
        scope.values
      )

      // Build position map by Traccar device ID
      let pm = {}
      let traccarById  = {}   // Traccar device by numeric Traccar ID
      let traccarByImei = {}  // Traccar device by IMEI (uniqueId) — fallback for null traccar_id
      let positionByImei = {}
      try {
        const [allPositions, allTraccarDevs] = await Promise.all([
          traccar.getAllPositions(),
          traccar.getAllDevices(),
        ])
        for (const p of allPositions) pm[p.deviceId] = p
        for (const td of allTraccarDevs) {
          traccarById[td.id] = td
          if (td.uniqueId) traccarByImei[td.uniqueId] = td
        }
        for (const p of allPositions) {
          const td = traccarById[p.deviceId]
          if (td?.uniqueId) positionByImei[td.uniqueId] = p
        }
      } catch {}

      // Auto-repair: devices with null traccar_id that exist in Traccar by IMEI
      const repairs = rows
        .filter(d => !d.traccar_id && d.imei && traccarByImei[d.imei])
        .map(d => db.query('UPDATE devices SET traccar_id=$1 WHERE id=$2', [traccarByImei[d.imei].id, d.id])
          .then(() => { d.traccar_id = traccarByImei[d.imei].id })
          .catch(() => {})
        )
      if (repairs.length) await Promise.all(repairs)

      await Promise.all(rows.map(d =>
        syncSubscriptionState(db, d, d.client_name ?? req.user.name ?? null)
          .then(snapshot => { d.subscription_status = snapshot.subscriptionStatus })
          .catch(err => console.warn('[Subscription] state sync skipped:', err.message))
      ))

      // Load active geofences from local DB for all devices
      let geofenceMap = {}
      try {
        const { rows: gRows } = await db.query(
          'SELECT device_id, id, name FROM local_geofences WHERE device_id = ANY($1::int[])',
          [rows.map(d => d.id)]
        )
        for (const g of gRows) geofenceMap[g.device_id] = g
      } catch {}

      res.json(rows.map(d => {
        // Position: by traccarId first, then IMEI fallback
        const livePosition = pm[d.traccar_id] ?? positionByImei[d.imei] ?? null
        const td = traccarById[d.traccar_id] ?? traccarByImei[d.imei] ?? null
        const hasStoredPosition = Number.isFinite(Number(d.last_lat)) && Number.isFinite(Number(d.last_lng))
        const storedPosition = hasStoredPosition
          ? {
              latitude: Number(d.last_lat),
              longitude: Number(d.last_lng),
              speed: d.last_speed ?? 0,
              fixTime: d.last_update ?? null,
            }
          : null
        // If Traccar has no fresh position for a connected stationary device,
        // keep its last locally stored GPS fix visible on the map.
        const p = livePosition ?? (td?.status === 'online' ? storedPosition : null)
        const freshLivePosition = positionIsFresh(livePosition, POWER_SILENCE_WINDOW_MS)
        const telemetryId = d.traccar_id ?? td?.id
        const telemetrySilent = positionIsSilent(livePosition ?? storedPosition, POWER_SILENCE_WINDOW_MS)
        const inferredDisconnect = !freshLivePosition
          && telemetrySilent
          && hasKnownVehicleVoltage(telemetryId)
        // Stored coordinates keep the map useful, but must never count as
        // current telemetry for voltage or disconnect decisions.
        const telemetryPosition = freshLivePosition ? livePosition : null
        // Traccar device entry (for authoritative status field)
        // A position is proof of a live/known device even when it is stationary.
        // Traccar's device.status can lag behind the last position, so do not
        // label a stopped device offline merely because speed is zero.
        // External power loss is not a connection loss. A tracker with an
        // internal battery remains online while fresh positions arrive.
        const status = telemetrySilent
          ? 'offline'
          : (td?.status === 'online' || !!p ? 'online' : 'offline')
        const localGeo = geofenceMap[d.id] || null
        const subscription = getSubscriptionSnapshot(d)
        const trackingEnabled = subscription.trackingEnabled
        const electrical = trackingEnabled
          ? readElectricalTelemetry(telemetryPosition, telemetryId, {
              connected: freshLivePosition,
              powerDisconnected: inferredDisconnect,
            })
          : { voltage: null, batteryLevel: null, powerDisconnected: false }
        return {
          id:        d.id,
          traccarId: d.traccar_id ?? td?.id ?? null,
          name:      d.name,
          imei:      d.imei,
          type:      d.type,
          plate:     d.plate,
          clientId:  d.user_id,
          clientName:d.client_name ?? null,
          status,
          lat:       trackingEnabled && p != null ? p.latitude  : null,
          lng:       trackingEnabled && p != null ? p.longitude : null,
          speed:     trackingEnabled ? Math.round(speedKmh(p?.speed)) : null,
          lastUpdate:trackingEnabled ? (p?.fixTime   ?? null) : null,
          engineOn:  trackingEnabled ? (p?.attributes?.ignition ?? false) : false,
          voltage:   electrical.voltage,
          batteryLevel: electrical.batteryLevel,
          powerDisconnected: electrical.powerDisconnected,
          signal:    trackingEnabled ? (p?.attributes?.rssi ?? p?.attributes?.gsm ?? p?.attributes?.signal ?? p?.attributes?.signalStrength ?? null) : null,
          fuel:      trackingEnabled ? (p?.attributes?.fuel ?? p?.attributes?.fuelLevel ?? null) : null,
          subscriptionPlanId: subscription.subscriptionPlanId,
          subscriptionStartDate: subscription.subscriptionStartDate,
          subscriptionEndDate: subscription.subscriptionEndDate,
          subscriptionStatus: subscription.subscriptionStatus,
          subscriptionDaysRemaining: subscription.subscriptionDaysRemaining,
          trackingEnabled,
          geofenceActive:   !!localGeo,
          activeGeofenceId: localGeo?.id ?? null,
          geofence: localGeo ? { id: localGeo.id, name: localGeo.name } : null,
        }
      }))
    } catch (err) { console.error(err); res.status(500).json({ error:'Server error' }) }
    })

    // POST / — إنشاء جهاز جديد مباشرة (أدمن فقط)
    devicesRouter.post('/', requireAuth, validateBody(schemas.addDevice), async (req, res) => {
      if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' })
      const { name, imei, type, plate, clientId, subscriptionPlanId } = req.body
      if (!name || !imei) return res.status(400).json({ error: 'Name and IMEI required' })
      if (!/^\d{15}$/.test(imei)) return res.status(400).json({ error: 'IMEI must be exactly 15 digits' })
      const plan = getSubscriptionPlan(subscriptionPlanId)
      if (!plan) return res.status(400).json({ error: 'A valid subscription plan is required' })
      try {
        if (clientId) {
          const { rows: clientRows } = await db.query(
            `SELECT max_devices,
                    (SELECT COUNT(*)::int FROM devices WHERE user_id=users.id) AS devices_count
             FROM users WHERE id=$1 AND is_admin=false`,
            [clientId]
          )
          const client = clientRows[0]
          if (!client) return res.status(404).json({ error: 'Client not found' })
          const maxDevices = Math.max(1, Number(client.max_devices) || 5)
          if (Number(client.devices_count) >= maxDevices) {
            return res.status(409).json({
              code: 'DEVICE_LIMIT_REACHED',
              error: `Device limit reached (${client.devices_count}/${maxDevices}). Increase the client limit before adding another device. / Limite d'appareils atteinte.`,
            })
          }
          if (plan.trial && await clientHasUsedFreeTrial(clientId)) {
            return res.status(409).json({
              code: 'FREE_TRIAL_ALREADY_USED',
              error: 'This client has already used the free 3-month trial.',
            })
          }
        }
        const subscriptionStartDate = dateOnly(new Date())
        const subscriptionEndDate = addMonths(subscriptionStartDate, plan.durationMonths)
        let traccarId = null
        try {
          const td = await traccar.createDevice(name, imei)
          traccarId = td.id
          if (clientId) {
            const { rows: ur } = await db.query('SELECT traccar_id FROM users WHERE id=$1', [clientId])
            if (ur[0]?.traccar_id) await traccar.linkDevice(ur[0].traccar_id, traccarId)
          }
        } catch (e) { console.warn('Traccar device skipped:', e.message) }
        const { rows } = await db.query(
          `INSERT INTO devices (name,imei,type,plate,user_id,traccar_id)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
           [name, imei, type || 'bike', plate || null, clientId || null, traccarId]
        )
        await db.query(
          `UPDATE devices
           SET subscription_plan_id=$1, subscription_start_date=$2,
               subscription_end_date=$3, subscription_status='active'
           WHERE id=$4`,
          [plan.id, subscriptionStartDate, subscriptionEndDate, rows[0].id]
        )
        rows[0].subscription_plan_id = plan.id
        rows[0].subscription_start_date = subscriptionStartDate
        rows[0].subscription_end_date = subscriptionEndDate
        rows[0].subscription_status = 'active'
        const d = rows[0]
        res.status(201).json({
          id: d.id, name: d.name, imei: d.imei, type: d.type, plate: d.plate,
          clientId: d.user_id, status: 'offline', lat: null, lng: null, speed: 0,
          lastUpdate: null, engineOn: false, voltage: null, batteryLevel: null, signal: null, fuel: null,
          subscriptionPlanId: d.subscription_plan_id,
          subscriptionStartDate: d.subscription_start_date,
          subscriptionEndDate: d.subscription_end_date,
          subscriptionStatus: 'active',
          subscriptionDaysRemaining: plan.durationMonths * 30,
          trackingEnabled: true,
          geofenceActive: false, activeGeofenceId: null, geofence: null,
        })
      } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'IMEI already registered' })
        console.error(err); res.status(500).json({ error: 'Server error' })
      }
    })

    // POST /quick-add — حقلان إلزاميان فقط: IMEI + phone، مع خطة الجهاز.
    devicesRouter.post('/quick-add', requireAuth, validateBody(schemas.addDevice), async (req, res) => {
      if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' })
      const { imei, phone, clientId, maxDevices, subscriptionPlanId } = req.body
      if (!imei)  return res.status(400).json({ error: 'IMEI required' })
      if (!phone) return res.status(400).json({ error: 'Phone required' })
      if (!/^\d{15}$/.test(imei)) return res.status(400).json({ error: 'IMEI must be exactly 15 digits' })
      const plan = getSubscriptionPlan(subscriptionPlanId)
      if (!plan) return res.status(400).json({ error: 'A valid subscription plan is required' })

      try {
        let deviceName = `GPS-${imei.slice(-6)}` // اسم افتراضي
        let finalClientId = clientId ? Number(clientId) : null
        const requestedMaxDevices =
          maxDevices === undefined || maxDevices === null || maxDevices === ''
            ? null
            : Number(maxDevices)
        if (requestedMaxDevices !== null &&
            (!Number.isInteger(requestedMaxDevices) || requestedMaxDevices < 1)) {
          return res.status(400).json({ error: 'maxDevices must be a positive integer' })
        }
        if (finalClientId) {
          const { rows: clientRows } = await db.query(
            `SELECT id, name, max_devices,
                    (SELECT COUNT(*)::int FROM devices WHERE user_id=users.id) AS devices_count
             FROM users WHERE id=$1 AND is_admin=false`,
            [finalClientId]
          )
          const client = clientRows[0]
          if (!client) return res.status(404).json({ error: 'Client not found' })
          const effectiveMaxDevices = requestedMaxDevices ?? Math.max(1, Number(client.max_devices) || 5)
          if (Number(client.devices_count) >= effectiveMaxDevices) {
            return res.status(409).json({
              code: 'DEVICE_LIMIT_REACHED',
              error: `Device limit reached (${client.devices_count}/${effectiveMaxDevices}). Increase the client limit before adding another device.`,
            })
          }
          const seq = Number(client.devices_count) + 1
          deviceName = `${client.name} - #${seq}`
          if (plan.trial && await clientHasUsedFreeTrial(finalClientId)) {
            return res.status(409).json({
              code: 'FREE_TRIAL_ALREADY_USED',
              error: 'This client has already used the free 3-month trial.',
            })
          }
        }

        // سجّل في Traccar
        let traccarId = null
        try {
          const td = await traccar.createDevice(deviceName, imei)
          traccarId = td.id
          if (finalClientId) {
            const { rows: ur } = await db.query('SELECT traccar_id FROM users WHERE id=$1', [finalClientId])
            if (ur[0]?.traccar_id) await traccar.linkDevice(ur[0].traccar_id, traccarId)
          }
        } catch (e) { console.warn('Traccar skipped:', e.message) }

        const subscriptionStartDate = dateOnly(new Date())
        const subscriptionEndDate = addMonths(subscriptionStartDate, plan.durationMonths)

        // إدراج الجهاز + تحديث حد الأجهزة في معاملة واحدة
        await db.query('BEGIN')
        try {
          // أضف عمود phone إن لم يكن موجوداً (يُشغَّل مرة واحدة)
          await db.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`).catch(() => {})

          const { rows } = await db.query(
            `INSERT INTO devices (
               name,imei,type,plate,user_id,traccar_id,phone,
               subscription_plan_id,subscription_start_date,subscription_end_date,subscription_status
               ) VALUES ($1,$2,'bike',null,$3,$4,$5,$6,$7,$8,'active') RETURNING *`,
            [deviceName, imei, finalClientId, traccarId, phone || null,
              plan.id, subscriptionStartDate, subscriptionEndDate]
          )
          if (finalClientId && requestedMaxDevices !== null) {
            await db.query(
              `UPDATE users SET max_devices=$1 WHERE id=$2`,
              [requestedMaxDevices, finalClientId]
            )
          }
          await db.query('COMMIT')
          const d = rows[0]
          res.status(201).json({
             id: d.id, name: d.name, imei: d.imei, type: d.type, phone: d.phone,
            clientId: d.user_id, status: 'offline',
            lat: null, lng: null, speed: 0, lastUpdate: null,
            engineOn: false, voltage: null, batteryLevel: null, signal: null, fuel: null,
            subscriptionPlanId: d.subscription_plan_id,
            subscriptionStartDate: d.subscription_start_date,
            subscriptionEndDate: d.subscription_end_date,
            subscriptionStatus: 'active',
            subscriptionDaysRemaining: plan.durationMonths * 30,
            trackingEnabled: true,
            geofenceActive: false, activeGeofenceId: null, geofence: null,
          })
        } catch (e) { await db.query('ROLLBACK'); throw e }

      } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'IMEI already registered' })
        console.error(err); res.status(500).json({ error: 'Server error' })
      }
    })

    // PATCH /:id/info — device owner (or admin) can edit name / driver / phone / plate
    devicesRouter.patch('/:id/info', requireAuth, requireDeviceOwner, async (req, res) => {
      const { name, driver, phone, plate, type } = req.body
      if (name === undefined && driver === undefined && phone === undefined && plate === undefined && type === undefined)
        return res.status(400).json({ error: 'Nothing to update' })
      if (type !== undefined && !['car', 'bike', 'truck'].includes(type))
        return res.status(400).json({ error: 'Type must be car, bike, or truck' })
      if (phone !== undefined && phone !== '' && !/^\+?[0-9\s().-]{8,24}$/.test(String(phone).trim()))
        return res.status(400).json({ error: 'Invalid driver phone number' })
      try {
        // Older installations may have created devices before the driver phone field existed.
        // Keep the existing update API backward-compatible without changing the schema file.
        await db.query('ALTER TABLE devices ADD COLUMN IF NOT EXISTS phone VARCHAR(20)')
        const device = req.device
        const sets = []; const vals = []; let i = 1
        if (name   !== undefined) { sets.push(`name=$${i++}`);   vals.push(String(name).trim())   }
        if (driver !== undefined) { sets.push(`driver=$${i++}`); vals.push(String(driver).trim()) }
        if (phone  !== undefined) { sets.push(`phone=$${i++}`);  vals.push(String(phone).trim())  }
        if (plate  !== undefined) { sets.push(`plate=$${i++}`);  vals.push(String(plate).trim())  }
        if (type   !== undefined) { sets.push(`type=$${i++}`);   vals.push(type)                 }
        sets.push(`updated_at=NOW()`)
        vals.push(req.params.id)
        const { rows } = await db.query(
           `UPDATE devices SET ${sets.join(',')} WHERE id=$${i} RETURNING id,name,driver,phone,plate,type,updated_at`,
          vals
        )
        res.json(rows[0])
      } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }) }
    })

    // PATCH /:id/subscription — admin or the device owner can renew by plan.
    // Renewal starts at the later of today or the current end date so active
    // time is never lost. This endpoint never changes user-level subscriptions.
    devicesRouter.patch('/:id/subscription', requireAuth, requireDeviceOwner, async (req, res) => {
      const { subscriptionPlanId } = req.body
      const plan = getSubscriptionPlan(subscriptionPlanId)
      if (!plan) return res.status(400).json({ error: 'A valid subscription plan is required' })
      try {
        const device = req.device
         if (plan.trial && !req.user.is_admin) {
           return res.status(403).json({
             code: 'FREE_TRIAL_REQUIRES_APPROVAL',
             error: 'The free trial must be activated by an administrator.',
           })
         }
         if (plan.trial && await clientHasUsedFreeTrial(device.user_id)) {
           return res.status(409).json({
             code: 'FREE_TRIAL_ALREADY_USED',
             error: 'This client has already used the free 3-month trial.',
           })
         }

        const today = dateOnly(new Date())
        const currentEnd = dateOnly(device.subscription_end_date)
        const startDate = currentEnd && currentEnd >= today ? currentEnd : today
        const endDate = addMonths(startDate, plan.durationMonths)
        const result = await db.query(
          `UPDATE devices
           SET subscription_plan_id=$1, subscription_start_date=$2,
               subscription_end_date=$3, subscription_status='active', updated_at=NOW()
           WHERE id=$4 RETURNING *`,
          [plan.id, startDate, endDate, device.id]
        )
        const updated = result.rows[0]
        res.json({
          id: updated.id,
          subscriptionPlanId: updated.subscription_plan_id,
          subscriptionStartDate: updated.subscription_start_date,
          subscriptionEndDate: updated.subscription_end_date,
          subscriptionStatus: 'active',
          subscriptionDaysRemaining: getSubscriptionSnapshot(updated).subscriptionDaysRemaining,
          trackingEnabled: true,
        })
      } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to renew subscription' })
      }
    })

    devicesRouter.get('/:id', requireAuth, requireDeviceOwner, async (req, res) => {
    try {
      const dev = req.device
      const subscription = getSubscriptionSnapshot(dev)
      let livePosition = null
      try {
        const positions = await traccar.getAllPositions()
        livePosition = positions.find(position => position.deviceId === dev.traccar_id) || null
      } catch {}
      const freshPosition = positionIsFresh(livePosition, POWER_SILENCE_WINDOW_MS)
      const inferredDisconnect = !freshPosition
        && positionIsSilent(livePosition ?? { lastUpdate: dev.last_update }, POWER_SILENCE_WINDOW_MS)
        && hasKnownVehicleVoltage(dev.traccar_id)
      const electrical = subscription.trackingEnabled
        ? readElectricalTelemetry(
            freshPosition ? livePosition : null,
            dev.traccar_id,
            { connected: freshPosition, powerDisconnected: inferredDisconnect },
          )
        : { voltage: null, batteryLevel: null, powerDisconnected: false }
      // Load geofence state from local DB
      let localGeo = null
      try {
        const { rows: gRows } = await db.query(
          'SELECT id, name FROM local_geofences WHERE device_id=$1 LIMIT 1',
          [dev.id]
        )
        localGeo = gRows[0] || null
      } catch {}

      res.json({
        ...dev,
        status: freshPosition ? 'online' : 'offline',
        lat: subscription.trackingEnabled && freshPosition ? livePosition.latitude : null,
        lng: subscription.trackingEnabled && freshPosition ? livePosition.longitude : null,
        speed: subscription.trackingEnabled && freshPosition ? Math.round(speedKmh(livePosition.speed)) : null,
        lastUpdate: subscription.trackingEnabled
          ? (livePosition?.fixTime ?? dev.last_update ?? null)
          : null,
        engineOn: subscription.trackingEnabled && freshPosition
          ? (livePosition.attributes?.ignition ?? false)
          : false,
        voltage: electrical.voltage,
        batteryLevel: electrical.batteryLevel,
        powerDisconnected: electrical.powerDisconnected,
        signal: subscription.trackingEnabled && freshPosition
          ? (livePosition.attributes?.rssi ?? livePosition.attributes?.gsm ?? livePosition.attributes?.signal ?? null)
          : null,
        ...(subscription.trackingEnabled ? {} : {
          last_lat: null, last_lng: null, last_speed: null, last_update: null,
        }),
        subscriptionPlanId: subscription.subscriptionPlanId,
        subscriptionStartDate: subscription.subscriptionStartDate,
        subscriptionEndDate: subscription.subscriptionEndDate,
        subscriptionStatus: subscription.subscriptionStatus,
        subscriptionDaysRemaining: subscription.subscriptionDaysRemaining,
        trackingEnabled: subscription.trackingEnabled,
        geofenceActive:   !!localGeo,
        activeGeofenceId: localGeo?.id ?? null,
        geofence: localGeo ? { id: localGeo.id, name: localGeo.name } : null,
      })
    } catch (err) { console.error(err); res.status(500).json({ error:'Server error' }) }
    })

    devicesRouter.post('/:id/command', requireAuth, requireDeviceOwner, async (req, res) => {
      try {
        const dev = req.device
        const type = req.body.type
        if (!['engineStop', 'engineResume'].includes(type)) {
          return res.status(400).json({ error: 'Command type must be engineStop or engineResume' })
        }
        if (!dev.traccar_id) {
          return res.status(400).json({ error: 'Device has no Traccar mapping' })
        }

        // Resolve the protocol when Traccar exposes it, but never let an
        // optional lookup prevent the command from being sent. Known GT06
        // devices use Traccar's standard encoder; an unknown protocol falls
        // back to the documented one-argument GS900 relay command.
        let protocol = ''
        let traccarDevice = null
        try {
          traccarDevice = await traccar.getDevice(dev.traccar_id)
          protocol = String(traccarDevice?.protocol || '').toLowerCase()
        } catch (lookupError) {
          console.warn('[engine] protocol lookup failed; defaulting to RELAY:', lookupError.message)
        }
        const knownNonRelay = /^(?:teltonika|t55|h02|tk103|meiligao|suntech|wondex)/i.test(protocol)
        const isRelayProtocol = protocol ? !knownNonRelay : true
        const command = isRelayProtocol
          ? traccar.resolveEngineCommand({
              type,
              protocol,
              deviceAttributes: traccarDevice?.attributes || {},
            })
          : { type, attributes: {}, profile: 'traccar-standard' }

        console.log('[engine] dispatch', JSON.stringify({
          deviceId: dev.traccar_id,
          protocol: protocol || null,
          profile: command.profile,
          type: command.type,
          attributes: command.attributes,
        }))
        const traccarResponse = await traccar.sendCommand(
          dev.traccar_id,
          command.type,
          command.attributes,
        )
        // Some relay-capable trackers echo externalPower:false/powerCut:true
        // after a successful engine command. That is command telemetry, not a
        // battery pull; suppress only the resulting power alert for 60 seconds.
        registerEngineCommandCooldown(dev.traccar_id, dev.id)
        const delivery = traccar.getCommandDeliveryMeta(traccarResponse)

        await db.query(
          `INSERT INTO device_commands (device_id, user_id, command, traccar_id, result, ip_address)
           VALUES ($1,$2,$3,$4,'sent',$5)`,
          [dev.id, req.user.id, type, dev.traccar_id, req.ip]
        ).catch(e => console.error('[device_commands insert]', e.message))

        await logAudit(req.user.id, `engine_${type}`, 'device', dev.id, {
          imei: dev.imei,
          command: type,
          relay: isRelayProtocol,
          commandProfile: command.profile,
        }).catch(()=>{})
        res.json({
          ok: true,
          type,
          relay: isRelayProtocol,
          commandProfile: command.profile,
          commandId: delivery.commandId,
          queueState: delivery.queueState,
          traccarResponse: traccarResponse ?? null,
        })
      } catch (err) {
        console.error('[command error]', err.message)
        await db.query(
          `INSERT INTO device_commands (device_id, user_id, command, traccar_id, result, error_msg, ip_address)
           VALUES ($1,$2,$3,$4,'failed',$5,$6)`,
          [req.device?.id, req.user.id, req.body.type, req.device?.traccar_id, err.message, req.ip]
        ).catch(()=>{})
        res.status(502).json({ error: 'Failed to send command: ' + err.message })
      }
    })

    // POST /:id/geofence — ينشئ سياجاً جغرافياً ويخزّنه محلياً وفي Traccar (إن أمكن)
    devicesRouter.post('/:id/geofence', requireAuth, requireDeviceOwner, async (req, res) => {
      try {
        const dev = req.device

        const { name, latitude, longitude, radius } = req.body
        if (!latitude || !longitude || !radius) {
          return res.status(400).json({ error: 'latitude, longitude and radius are required' })
        }

        const geofenceName = name || `Geofence-${dev.name}`

        // حذف أي سياج سابق لهذا الجهاز
        await db.query('DELETE FROM local_geofences WHERE device_id=$1', [dev.id])

        // حفظ السياج في قاعدة البيانات المحلية (fallback دائم)
        const coords = JSON.stringify({ lat: latitude, lng: longitude })
        const { rows: gRows } = await db.query(
          `INSERT INTO local_geofences (user_id, device_id, name, type, coords, radius)
           VALUES ($1, $2, $3, 'circle', $4, $5) RETURNING *`,
          [req.user.id, dev.id, geofenceName, coords, radius]
        )
        const localGeofence = gRows[0]

        // محاولة المزامنة مع Traccar (اختيارية — لا تُفشل الطلب عند فشلها)
        let traccarGeofence = null
        try {
          traccarGeofence = await traccar.createGeofence(geofenceName, latitude, longitude, radius)
          await traccar.linkGeofenceToDevice(dev.traccar_id, traccarGeofence.id)
        } catch (e) {
          console.warn('[Geofence] Traccar sync skipped:', e.message)
        }

        res.json({
          success: true,
          geofence: {
            id:   localGeofence.id,
            name: localGeofence.name,
            traccarId: traccarGeofence?.id ?? null,
          },
        })
      } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to create geofence' })
      }
    })

    // DELETE /:id — admin only — حذف الجهاز نهائياً
    devicesRouter.delete('/:id', requireAuth, requireDeviceOwner, async (req, res) => {
      if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' })
      try {
        const dev = req.device
        // حذف من Traccar (اختياري — لا يُفشل الطلب)
        if (dev.traccar_id) {
          try { await traccar.deleteDevice(dev.traccar_id) } catch (e) {
            console.warn('[Device] Traccar delete skipped:', e.message)
          }
        }
        // حذف من قاعدة البيانات (CASCADE يعالج الجداول الفرعية)
        await logAudit(req.user.id, 'device_deleted', 'device', dev.id, { imei: dev.imei, name: dev.name })
        await db.query('DELETE FROM devices WHERE id=$1', [dev.id])
        res.json({ success: true })
      } catch (err) {
        console.error(err); res.status(500).json({ error: 'Failed to delete device' })
      }
    })

    // DELETE /:id/geofence — يحذف السياج الجغرافي من المحلي ومن Traccar (إن أمكن)
    devicesRouter.delete('/:id/geofence', requireAuth, requireDeviceOwner, async (req, res) => {
      try {
        const dev = req.device

        // حذف من قاعدة البيانات المحلية
        await db.query('DELETE FROM local_geofences WHERE device_id=$1', [dev.id])

        // محاولة حذف من Traccar (اختيارية)
        const { geofenceId } = req.body
        if (geofenceId) {
          try {
            await traccar.unlinkGeofenceFromDevice(dev.traccar_id, geofenceId)
            await traccar.deleteGeofence(geofenceId)
          } catch (e) {
            console.warn('[Geofence] Traccar delete skipped:', e.message)
          }
        }

        res.json({ success: true })
      } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete geofence' })
      }
    })
