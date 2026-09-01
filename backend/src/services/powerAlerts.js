// ── Power disconnect/restore alert engine ────────────────────────────────────
//
// Extracted from index.js so the telemetry alert logic can be tested
// deterministically with a mocked Traccar client, db, and clock.
//
// Core safety rule (system-wide, every device on every account): silence is
// not electrical feedback. It may update connectivity state, but it must never
// create a vehicle-battery alert. Only an explicit tracker power signal may
// create that alert.

import {
  markVehicleDisconnected,
  markVehicleConnected,
  detectExternalPowerLoss,
  detectExternalPowerRestored,
  reducePowerTelemetryState,
  observeVehicleVoltage,
  isBatteryVoltage,
  POWER_SILENCE_WINDOW_MS,
  isPowerAlertSuppressed,
} from './vehicleTelemetry.js'

// Hard ceiling for the Traccar REST verification call so a hung request can
// never leave a silence alert stuck in "pending verification" forever.
export const POWER_VERIFY_TIMEOUT_MS = 10_000

export function withTimeout(promise, ms, message, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeoutFn(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeoutFn(timer))
}

function positionTimestamp(position, fallback) {
  // serverTime is the receipt time and is the only timestamp that proves the
  // tracker sent a packet recently. fixTime can remain unchanged for hours on
  // idle/no-GPS devices such as bekane, so choosing it first creates a false
  // silence timeout even while keep-alive packets continue to arrive.
  const candidates = [
    position?.serverTime,
    position?.deviceTime,
    position?.fixTime ?? position?.lastUpdate ?? position?.last_update,
  ]
  for (const raw of candidates) {
    if (!raw) continue
    const ts = new Date(raw).getTime()
    if (Number.isFinite(ts)) return Math.min(ts, fallback)
  }
  return fallback
}

function positionSignature(position) {
  // serverTime changes every time Traccar receives a packet, even when
  // fixTime and coordinates are identical (common on idle no-GPS devices).
  // Including it ensures each new packet is detected as new telemetry so
  // that the restore guard fires correctly after a silence episode ends.
  const attributes = position?.attributes || {}
  return [
    position?.id ?? '',
    position?.fixTime ?? position?.lastUpdate ?? position?.last_update ?? '',
    position?.serverTime ?? '',
    position?.latitude ?? '',
    position?.longitude ?? '',
    attributes.charge ?? '',
    attributes.alarm ?? '',
    attributes.powerCut ?? attributes.power_cut ?? '',
    attributes.externalPower ?? '',
  ].join('|')
}

/**
 * Build the power-alert engine.
 *
 * All external effects are injectable so tests can run with a mocked
 * Traccar client, db, event senders, clock, and timers. Production code in
 * index.js passes the real implementations and default timings.
 */
export function createPowerAlertEngine({
  db,
  getAllPositions,
  sendPowerDisconnectEvent = () => {},
  sendPowerRestoredEvent = () => {},
  silenceWindowMs = POWER_SILENCE_WINDOW_MS,
  verifyTimeoutMs = POWER_VERIFY_TIMEOUT_MS,
  verifyRetryDelayMs = 60_000,
  signalRetryDelayMs = 5_000,
  now = Date.now,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  // Real disconnect = the device stopped sending ANY data for this long.
  // Voltage itself is intermittent on GT06 (sent every few minutes), so we
  // must NOT alert on missing voltage alone — only on a truly silent device.
  const POWER_DISCONNECT_GRACE_MS = silenceWindowMs
  // A device is considered connected if it sent ANY data within this window.
  // Must be >= POWER_DISCONNECT_GRACE_MS so a slowly-reporting but connected
  // device is never mistaken for disconnected.
  const POWER_POSITION_MAX_AGE_MS = silenceWindowMs

  const powerTelemetry = new Map()
  const powerDisconnectTimers = new Map()
  const powerDisconnectRetryTimers = new Map()

  function clearPowerDisconnectTimer(traccarId) {
    const timer = powerDisconnectTimers.get(String(traccarId))
    if (timer) clearTimeoutFn(timer)
    powerDisconnectTimers.delete(String(traccarId))
  }

  function clearPowerDisconnectRetryTimer(traccarId) {
    const timer = powerDisconnectRetryTimers.get(String(traccarId))
    if (timer) clearTimeoutFn(timer)
    powerDisconnectRetryTimers.delete(String(traccarId))
  }

  // ── Durable power-state persistence ────────────────────────────────────────
  // Persist which devices are in a confirmed disconnect episode so that a
  // backend restart does not forget the state and re-fire the alert on the
  // next silence check (preventing duplicate alerts across restarts).

  async function persistPowerDisconnected(traccarId, trigger) {
    try {
      await db.query(
        `INSERT INTO device_power_states (traccar_id, disconnected, disconnect_trigger, updated_at)
         VALUES ($1, TRUE, $2, NOW())
         ON CONFLICT (traccar_id) DO UPDATE
           SET disconnected = TRUE, disconnect_trigger = $2, updated_at = NOW()`,
        [traccarId, trigger || 'silence']
      )
    } catch (err) {
      console.warn('[Power] Failed to persist disconnect state:', err.message)
    }
  }

  async function persistPowerConnected(traccarId) {
    try {
      await db.query(
        `DELETE FROM device_power_states WHERE traccar_id = $1`,
        [traccarId]
      )
    } catch (err) {
      console.warn('[Power] Failed to clear disconnect state:', err.message)
    }
  }

  // Called once at startup. Restores in-memory disconnect state from the DB so
  // that a restart mid-disconnect episode does not fire a second alert.
  async function loadPersistedPowerStates() {
    try {
      const { rows } = await db.query(
        `SELECT traccar_id, disconnect_trigger FROM device_power_states WHERE disconnected = TRUE`
      )
      for (const row of rows) {
        const key = String(row.traccar_id)
        const existing = powerTelemetry.get(key)
        if (existing) {
          existing.disconnected = true
          if (row.disconnect_trigger) existing.disconnectTrigger = row.disconnect_trigger
        } else {
          powerTelemetry.set(key, {
            lastValidAt: null,
            lastValidVoltage: null,
            missingSince: null,
            lastPositionAt: null,
            lastPositionKey: null,
            powerLossSignal: null,
            disconnectTrigger: row.disconnect_trigger || 'silence',
            invalidPositionCount: 0,
            disconnected: true,
            alerting: false,
            everSeenBatteryVoltage: false,
          })
        }
        markVehicleDisconnected(row.traccar_id)
      }
      console.log('[Power] Loaded', rows.length, 'persisted disconnect state(s) from DB')
    } catch (err) {
      console.warn('[Power] Failed to load persisted power states:', err.message)
    }
  }

  async function createPowerRestoredAlert(traccarId) {
    if (isPowerAlertSuppressed(traccarId, now())) return
    try {
      const { rows } = await db.query(
        'SELECT id, traccar_id, user_id, name FROM devices WHERE traccar_id=$1 LIMIT 1',
        [traccarId]
      )
      const device = rows[0]
      if (!device) return
      const message = `تم استعادة تغذية ${device.name} / Alimentation restaurée : ${device.name}`
      const { rows: alertRows } = await db.query(
        `INSERT INTO alerts (device_id, user_id, type, message, data)
         VALUES ($1, $2, 'power_restored', $3, $4)
         RETURNING id, type, message, data, created_at`,
        [
          device.id,
          device.user_id,
          message,
          JSON.stringify({ traccarId }),
        ]
      )
      sendPowerRestoredEvent(device, alertRows[0])
      console.log('[Power] Vehicle power restored — device:', device.id)
    } catch (err) {
      console.warn('[Power] Restore alert skipped:', err.message)
    }
  }

  async function createPowerDisconnectedAlert(traccarId, { immediate = false } = {}) {
    if (isPowerAlertSuppressed(traccarId, now())) return
    // Silence proves only that this bridge did not receive a packet. It cannot
    // distinguish a GSM gap, tracker sleep, device fault, or cut wiring from a
    // vehicle-battery removal. Only an explicit electrical tracker signal may
    // create a battery notification.
    if (!immediate) return
    const key = String(traccarId)
    const state = powerTelemetry.get(key)
    if (!state || state.alerting || state.disconnected || !state.lastPositionAt) return

    const signalConfirmed = Boolean(immediate && state.powerLossSignal)
    if (!signalConfirmed) return

    // Reserve the state before the awaited database write so concurrent
    // explicit power-loss packets cannot both proceed to insert.
    state.alerting = true
    try {
      const { rows } = await db.query(
        'SELECT id, traccar_id, user_id, name FROM devices WHERE traccar_id=$1 LIMIT 1',
        [traccarId]
      )
      const device = rows[0]
      if (!device) {
        state.alerting = false
        return
      }

      const latest = powerTelemetry.get(key)
      const latestSignalConfirmed = Boolean(latest?.powerLossSignal)
      if (!latest || latest !== state || latest.disconnected
        || !latestSignalConfirmed) {
        state.alerting = false
        return
      }

      const message = `تم فصل التغذية عن ${device.name} / Alimentation débranchée : ${device.name}`
      const { rows: alertRows } = await db.query(
        `INSERT INTO alerts (device_id, user_id, type, message, data)
         VALUES ($1, $2, 'power_disconnected', $3, $4)
         RETURNING id, type, message, data, created_at`,
        [
          device.id,
          device.user_id,
          message,
          JSON.stringify({
            reason: latest.powerLossSignal?.source || 'vehicle_power_missing',
            trigger: latestSignalConfirmed ? 'telemetry' : 'silence',
            traccarId,
            lastValidVoltage: state.lastValidVoltage,
            graceSeconds: POWER_DISCONNECT_GRACE_MS / 1000,
          }),
        ]
      )

      state.disconnected = true
      state.disconnectTrigger = latestSignalConfirmed ? 'telemetry' : 'silence'
      state.alerting = false
      clearPowerDisconnectRetryTimer(traccarId)
      markVehicleDisconnected(traccarId)
      void persistPowerDisconnected(traccarId, state.disconnectTrigger)
      sendPowerDisconnectEvent(device, alertRows[0])
      console.log('[Power] Vehicle power disconnected — device:', device.id)
    } catch (err) {
      state.alerting = false
      console.warn('[Power] Disconnect alert skipped:', err.message)
      if (state.powerLossSignal) {
        clearPowerDisconnectRetryTimer(traccarId)
        powerDisconnectRetryTimers.set(key, setTimeoutFn(() => {
          powerDisconnectRetryTimers.delete(key)
          if (isPowerAlertSuppressed(traccarId, now())) return
          void createPowerDisconnectedAlert(traccarId, { immediate: true })
        }, signalRetryDelayMs))
      }
    }
  }

  function schedulePowerDisconnectCheck(traccarId, lastPositionAt) {
    const key = String(traccarId)
    clearPowerDisconnectTimer(traccarId)
    const delay = Math.max(
      25,
      POWER_DISCONNECT_GRACE_MS - (now() - lastPositionAt) + 25,
    )
    powerDisconnectTimers.set(key, setTimeoutFn(() => {
      powerDisconnectTimers.delete(key)
      const state = powerTelemetry.get(key)
      if (!state || state.lastPositionAt !== lastPositionAt || state.disconnected) return

      const remaining = POWER_DISCONNECT_GRACE_MS - (now() - state.lastPositionAt)
      if (remaining > 0) {
        schedulePowerDisconnectCheck(traccarId, state.lastPositionAt)
        return
      }

      // No new position arrived during the complete silence window. This is
      // intentionally based on the last GPS/data timestamp, never on voltage
      // omission in an otherwise connected position.
      state.missingSince = state.lastPositionAt
      powerTelemetry.set(key, state)
      console.log('[Power] Silence observed without electrical confirmation; battery alert suppressed:', key)
    }, delay))
  }

  function observePowerTelemetry(position) {
    const traccarId = position?.deviceId
    if (traccarId == null) return

    const key = String(traccarId)
    const nowMs = now()
    const voltage = observeVehicleVoltage(position)
    const current = powerTelemetry.get(key) || {
      lastValidAt: null,
      lastValidVoltage: null,
      missingSince: null,
      lastPositionAt: null,
      lastPositionKey: null,
      powerLossSignal: null,
      disconnectTrigger: null,
      invalidPositionCount: 0,
      disconnected: false,
      alerting: false,
      everSeenBatteryVoltage: false,
    }
    // FIX 1: a standalone tracker (no vehicle battery) never reports a
    // battery-range voltage. charge:false can only be an electrical disconnect
    // for a device that has previously reported one, so track that per device
    // and pass it to the loss detector.
    const everSeenBatteryVoltage = current.everSeenBatteryVoltage
      || (voltage !== null && isBatteryVoltage(voltage))
    const signature = positionSignature(position)
    const powerAlertSuppressed = isPowerAlertSuppressed(traccarId, nowMs)
    const powerLossSignal = powerAlertSuppressed ? null : detectExternalPowerLoss(position, { everSeenBatteryVoltage })
    // A restore signal is never suppressed: the engine-command cooldown exists
    // to avoid a false DISCONNECT alert echoed by the relay. Dropping the
    // restore signal during that window used to leave the vehicle stuck in a
    // "power cut" state long after the supply came back.
    const powerRestoredSignal = detectExternalPowerRestored(position)
    const transition = reducePowerTelemetryState(current, {
      signature,
      observedAt: positionTimestamp(position, nowMs),
      now: nowMs,
      powerLossSignal,
      powerRestoredSignal,
    })
    const next = transition.state
    next.everSeenBatteryVoltage = everSeenBatteryVoltage

    // A healthy position after a confirmed disconnect episode: transition back to connected.
    // Always clear the in-memory disconnect state and the persisted device_power_states row.
    // The restore USER ALERT is emitted for an explicit affirmative restore signal
    // (powerCut:false, charge:true, externalPower:true, powerRestored alarm) on ANY device —
    // that is electrical feedback, not silence. The AMBIGUOUS restores (a silence episode
    // ending, or the clean-telemetry probation clearing a legacy false-disconnect row) are
    // gated on everSeenBatteryVoltage: a standalone tracker that never had a vehicle battery
    // can only hold a legacy false-disconnect row, so restoring it must be SILENT — clear
    // the row, fire no power_restored alert.
    if (transition.restored) {
      powerTelemetry.set(key, next)
      markVehicleConnected(traccarId)
      void persistPowerConnected(traccarId)
      if (!powerAlertSuppressed && (everSeenBatteryVoltage || powerRestoredSignal)) void createPowerRestoredAlert(traccarId)
      // Fall through to process this healthy position normally (voltage cache, silence timer).
    }

    if (voltage !== null) {
      // A real voltage reading (not a guess) — store it as the last known good value.
      next.lastValidAt = nowMs
      next.lastValidVoltage = voltage
    }

    if (powerLossSignal) {
      powerTelemetry.set(key, next)
      if (transition.shouldAlertImmediately) {
        clearPowerDisconnectTimer(traccarId)
        if (!isPowerAlertSuppressed(traccarId, now())) {
          void createPowerDisconnectedAlert(traccarId, { immediate: true })
        }
      }
      return
    }

    // A position without voltage is still connected. Keep the last real
    // voltage and wait for actual silence. Keep a pending explicit power-loss
    // signal until its alert has been persisted, even if another packet races in.
    powerTelemetry.set(key, next)
    if (transition.shouldScheduleSilence) {
      schedulePowerDisconnectCheck(traccarId, next.lastPositionAt)
    }
  }

  function dispose() {
    for (const timer of powerDisconnectTimers.values()) clearTimeoutFn(timer)
    for (const timer of powerDisconnectRetryTimers.values()) clearTimeoutFn(timer)
    powerDisconnectTimers.clear()
    powerDisconnectRetryTimers.clear()
    powerTelemetry.clear()
  }

  return {
    observePowerTelemetry,
    createPowerDisconnectedAlert,
    createPowerRestoredAlert,
    schedulePowerDisconnectCheck,
    loadPersistedPowerStates,
    dispose,
    // Exposed for deterministic tests and index.js diagnostics only.
    powerTelemetry,
    powerDisconnectTimers,
    powerDisconnectRetryTimers,
  }
}
