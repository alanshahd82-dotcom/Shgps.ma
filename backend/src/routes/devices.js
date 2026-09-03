import { Router } from 'express'
import { requireAuth, requireMainAdmin }  from '../middleware/auth.js'
import { logAudit }    from '../services/auditLog.js'
import { validateBody, schemas } from '../validation/schemas.js'
    import { db }          from '../db.js'
    import * as traccar    from '../services/traccar.js'
    import * as engineCommands from '../services/engineCommands.js'
import { deviceAccessScope, getAccessibleClient, getAccessibleDevice, requireDeviceOwner } from '../middleware/deviceAccess.js'
import {
  addMonths,
  dateOnly,
  getSubscriptionPlan,
  getSubscriptionSnapshot,
  syncSubscriptionState,
} from '../services/subscriptions.js'
import { speedKmh } from '../utils/speed.js'
import {
  isVehicleDisconnected,
  positionIsFresh,
  positionIsSilent,
  POWER_SILENCE_WINDOW_MS,
  readBatteryLevel,
  readLastKnownVehicleVoltage,
  readVehicleVoltage,
  registerEngineCommandCooldown,
  resolveDeviceStatus,
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
              speed: Math.round(speedKmh(d.last_speed)),
              fixTime: d.last_update ?? null,
            }
          : null
        // If Traccar has no fresh position for a connected stationary device,
        // keep its last locally stored GPS fix visible on the map.
        const p = livePosition ?? (td?.status === 'online' ? storedPosition : null)
        const freshLivePosition = positionIsFresh(livePosition, POWER_SILENCE_WINDOW_MS)
        const telemetryId = d.traccar_id ?? td?.id
        const telemetrySilent = positionIsSilent(livePosition ?? storedPosition, POWER_SILENCE_WINDOW_MS)
        // Stored coordinates keep the map useful, but must never count as
        // current telemetry for voltage or disconnect decisions.
        const telemetryPosition = freshLivePosition ? livePosition : null
        // Traccar device entry (for authoritative status field)
        // A position is proof of a live/known device even when it is stationary.
        // Traccar's device.status can lag behind the last position, so do not
        // label a stopped device offline merely because speed is zero.
        // External power loss is not a connection loss. A tracker with an
        // internal battery remains online while fresh positions arrive.
        const status = resolveDeviceStatus(td, livePosition ?? storedPosition)
        const localGeo = geofenceMap[d.id] || null
        const subscription = getSubscriptionSnapshot(d)
        const trackingEnabled = subscription.trackingEnabled
        let electrical = trackingEnabled
          ? readElectricalTelemetry(telemetryPosition, telemetryId, {
              connected: freshLivePosition,
            })
          : { voltage: null, batteryLevel: null, powerDisconnected: false }

        // Phase 2H-2: last-known vehicle-voltage contract.
        // Fresh telemetry  -> current valid battery voltage, voltageStale=false.
        // Stale/silent      -> serve the last-known VALID battery voltage
        //                      (re-validated through isBatteryVoltage) with
        //                      voltageStale=true, but only when no confirmed
        //                      external-power disconnect.
        // Confirmed disconnect -> voltage stays null; telemetry silence is
        //                      never reinterpreted as a power loss here.
        if (trackingEnabled) {
          if (freshLivePosition) {
            electrical.voltageStale = false
            electrical.lastVoltageAt = null
          } else if (!electrical.powerDisconnected) {
            const lastKnown = readLastKnownVehicleVoltage(telemetryId)
            if (lastKnown) {
              electrical.voltage = lastKnown.voltage
              electrical.lastVoltageAt = new Date(lastKnown.lastSeenAt).toISOString()
              electrical.voltageStale = true
            } else {
              electrical.voltage = null
              electrical.lastVoltageAt = null
              electrical.voltageStale = true
            }
          } else {
            electrical.voltage = null
            electrical.voltageStale = false
            electrical.lastVoltageAt = null
          }
        } else {
          electrical.voltageStale = false
          electrical.lastVoltageAt = null
        }
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
           speed:     trackingEnabled && p ? Math.round(speedKmh(p.speed)) : null,
          lastUpdate:trackingEnabled ? (td?.lastUpdate ?? p?.fixTime ?? null) : null,
           engineOn:  trackingEnabled && p ? (p.attributes?.ignition ?? null) : null,
           motion:    trackingEnabled && p ? (p.attributes?.motion ?? null) : null,
          voltage:   electrical.voltage,
          voltageStale: electrical.voltageStale,
          lastVoltageAt: electrical.lastVoltageAt,
          batteryLevel: electrical.batteryLevel,
          charge:     trackingEnabled && p ? (p.attributes?.charge ?? null) : null,
          powerDisconnected: electrical.powerDisconnected,
          signal:    trackingEnabled ? (p?.attributes?.rssi ?? p?.attributes?.gsm ?? p?.attributes?.signal ?? p?.attributes?.signalStrength ?? null) : null,
          fuel:      trackingEnabled ? (p?.attributes?.fuel ?? p?.attributes?.fuelLevel ?? null) : null,
          course:    trackingEnabled && p ? (p.course ?? p.attributes?.course ?? null) : null,
          address:   trackingEnabled && p ? (p.address ?? null) : null,
          totalDistance: trackingEnabled && p ? (p.attributes?.totalDistance ?? null) : null,
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
      if (req.user.is_sub_admin && !clientId) {
        return res.status(400).json({ error: 'A client is required for sub-admin device creation' })
      }
      if (!name || !imei) return res.status(400).json({ error: 'Name and IMEI required' })
      if (!/^\d{15}$/.test(imei)) return res.status(400).json({ error: 'IMEI must be exactly 15 digits' })
      const plan = getSubscriptionPlan(subscriptionPlanId)
      if (!plan) return res.status(400).json({ error: 'A valid subscription plan is required' })
      try {
        if (clientId) {
          const clientScope = await getAccessibleClient(db, req.user, clientId)
          if (!clientScope) return res.status(404).json({ error: 'Client not found' })
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
           clientId: d.user_id, status: 'offline', lat: null, lng: null, speed: null,
           lastUpdate: null, engineOn: null, voltage: null, batteryLevel: null, signal: null, fuel: null,
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
      if (req.user.is_sub_admin && !clientId) {
        return res.status(400).json({ error: 'A client is required for sub-admin device creation' })
      }
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
          const clientScope = await getAccessibleClient(db, req.user, finalClientId)
          if (!clientScope) return res.status(404).json({ error: 'Client not found' })
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
             lat: null, lng: null, speed: null, lastUpdate: null,
             engineOn: null, voltage: null, batteryLevel: null, signal: null, fuel: null,
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
      let traccarDevice = null
      try {
        const [positions, traccarDevices] = await Promise.all([
          traccar.getAllPositions(),
          traccar.getAllDevices(),
        ])
        livePosition = positions.find(position => position.deviceId === dev.traccar_id) || null
        traccarDevice = traccarDevices.find(d => d.id === dev.traccar_id) || null
      } catch {}
      const freshPosition = positionIsFresh(livePosition, POWER_SILENCE_WINDOW_MS)
      const status = resolveDeviceStatus(traccarDevice, livePosition)
      const electrical = subscription.trackingEnabled
        ? readElectricalTelemetry(
            freshPosition ? livePosition : null,
            dev.traccar_id,
            { connected: freshPosition },
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
        status,
        lat: subscription.trackingEnabled && freshPosition ? livePosition.latitude : null,
        lng: subscription.trackingEnabled && freshPosition ? livePosition.longitude : null,
        speed: subscription.trackingEnabled && freshPosition ? Math.round(speedKmh(livePosition.speed)) : null,
        lastUpdate: subscription.trackingEnabled
          ? (livePosition?.fixTime ?? dev.last_update ?? null)
          : null,
        engineOn: subscription.trackingEnabled && freshPosition
          ? (livePosition.attributes?.ignition ?? null)
          : null,
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

    // GET /:id/active-command — Phase 1: authoritative engine command state.
    // Returns the latest non-superseded actionable command or null. Read-only:
    // never mutates command rows, never sends a Traccar command, never reads
    // legacy device_commands as live state. The frontend uses this to derive
    // the CUT/RESUME button state instead of inferring it from ignition telemetry.
    devicesRouter.get('/:id/active-command', requireAuth, requireDeviceOwner, async (req, res) => {
      try {
        const dev = req.device
        const command = await engineCommands.getActiveCommand(dev.id)
        if (!command) return res.json({ command: null })
        res.json({
          command: {
            id: command.id,
            type: command.command_type,
            requested_state: command.requested_state,
            status: command.status,
            created_at: command.created_at,
            traccar_command_id: command.traccar_command_id ?? null,
            delivery_authorized: command.delivery_authorized ?? false,
            delivery_authorization_expires_at: command.delivery_authorization_expires_at ?? null,
          },
        })
      } catch (err) {
        console.error('[active-command error]', err.message)
        res.status(500).json({ error: 'Failed to read active command: ' + err.message })
      }
    })

    // POST /:id/active-command/reconfirm — Phase 2A: reauthorize delivery for
    // a pending command whose authorization window has expired. Extends the
    // window by 24h, capped by the 30-day absolute limit. Does NOT create a
    // new command. Does NOT send a Traccar command directly.
    devicesRouter.post('/:id/active-command/reconfirm', requireAuth, requireDeviceOwner, async (req, res) => {
      try {
        const dev = req.device
        const command = await engineCommands.getActiveCommand(dev.id)
        if (!command) return res.status(404).json({ error: 'No active command to reconfirm' })
        if (!engineCommands.IN_FLIGHT_STATUSES.includes(command.status)) {
          return res.status(409).json({ error: 'Command is not pending; cannot reconfirm', command })
        }
        try {
          const reconfirmed = await engineCommands.reconfirmCommand(command.id, dev.id)
          await logAudit(req.user.id, 'engine_reconfirm', 'device', dev.id, {
            commandId: reconfirmed?.id,
            delivery_authorization_expires_at: reconfirmed?.delivery_authorization_expires_at,
          }).catch(() => {})
          res.json({ command: reconfirmed })
        } catch (e) {
          if (e.code === 'INVALID_COMMAND') {
            return res.status(409).json({ error: e.message, code: e.code })
          }
          throw e
        }
      } catch (err) {
        console.error('[reconfirm error]', err.message)
        res.status(500).json({ error: 'Failed to reconfirm command: ' + err.message })
      }
    })

    // POST /:id/active-command/cancel — Phase 2A: cancel the active pending
    // command. Only pre-delivery states (requested/pending) may be cancelled.
    // Sent/unconfirmed/delivered commands cannot be recalled. Does NOT touch
    // legacy device_commands.
    devicesRouter.post('/:id/active-command/cancel', requireAuth, requireDeviceOwner, async (req, res) => {
      try {
        const dev = req.device
        const command = await engineCommands.getActiveCommand(dev.id)
        if (!command) return res.status(404).json({ error: 'No active command to cancel' })
        if (!engineCommands.IN_FLIGHT_STATUSES.includes(command.status)) {
          return res.status(409).json({ error: 'Command already delivered; cannot cancel', command })
        }
        const cancelled = await engineCommands.cancelActiveCommand(dev.id)
        await logAudit(req.user.id, 'engine_cancel', 'device', dev.id, {
          commandId: cancelled?.id,
          status: cancelled?.status,
        }).catch(() => {})
        res.json({ command: cancelled })
      } catch (err) {
        console.error('[cancel error]', err.message)
        res.status(500).json({ error: 'Failed to cancel command: ' + err.message })
      }
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

        const idempotencyKey = req.headers['idempotency-key'] || null

        let command
        try {
          command = await engineCommands.createRequest({
            deviceId: dev.id,
            userId: req.user.id,
            commandType: type,
            idempotencyKey,
            ip: req.ip,
            traccarDeviceId: dev.traccar_id,
          })
        } catch (e) {
          if (e.code === 'INVALID_COMMAND') {
            return res.status(400).json({ error: e.message, code: e.code })
          }
          throw e
        }

        // Attempt delivery only when the command is still pending and has not
        // yet been accepted by Traccar. Idempotent retries (same key) return the
        // existing command and never re-send; the in-flight guard inside
        // deliverOnce also protects against the worker / WS hook racing us.
        if (command.status === 'pending' && command.traccar_command_id == null) {
          command = await engineCommands.deliverOnce(command, dev)
        }

        await logAudit(req.user.id, `engine_${type}`, 'device', dev.id, {
          imei: dev.imei,
          command: type,
          commandId: command?.id,
          status: command?.status,
          traccarCommandId: command?.traccar_command_id,
          supersededCommandId: command?.superseded_by_command_id ?? null,
          gateHeld: !!command?.gateHeld,
        }).catch(() => {})

        res.json({
          ok: true,
          type,
          command,
          gateHeld: !!command?.gateHeld,
          // Backward-compatible fields for older clients.
          commandId: command?.traccar_command_id ?? null,
          queueState: command?.status === 'pending' ? 'queued' : 'sent',
        })
      } catch (err) {
        console.error('[command error]', err.message)
        res.status(500).json({ error: 'Failed to process command: ' + err.message })
      }
    })

    // Cancel a pending engine command. Only pre-delivery states (requested /
    // pending) may be cancelled. If still queued in Traccar, a best-effort
    // DELETE is attempted; the device gate stays held until Traccar confirms.
    // No automatic opposite command is ever issued (no auto-restore).
    devicesRouter.post('/:id/command/:commandId/cancel', requireAuth, requireDeviceOwner, async (req, res) => {
      try {
        const dev = req.device
        const commandId = Number(req.params.commandId)
        if (!Number.isInteger(commandId) || commandId <= 0) {
          return res.status(400).json({ error: 'Invalid command id' })
        }
        const command = await engineCommands.cancel(commandId, dev.id)
        await logAudit(req.user.id, 'engine_cancel', 'device', dev.id, {
          imei: dev.imei,
          commandId,
          status: command?.status,
          traccarCommandId: command?.traccar_command_id ?? null,
        }).catch(() => {})
        res.json({ ok: true, command })
      } catch (err) {
        console.error('[cancel error]', err.message)
        res.status(500).json({ error: 'Failed to cancel command: ' + err.message })
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
