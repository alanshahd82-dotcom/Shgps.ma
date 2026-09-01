import { randomUUID } from 'crypto'
import { db } from '../db.js'
import * as traccar from './traccar.js'
import { registerEngineCommandCooldown, positionIsFresh } from './vehicleTelemetry.js'

/**
 * engineCommands — Engine relay command state machine + delivery (Phase 2B).
 *
 * Operates on the 'engine_commands' table. The legacy 'device_commands' table
 * (508 historical rows) is intentionally left untouched and is NOT read or
 * written by this module. After Phase 2B the legacy table is a frozen archive.
 *
 * Safety guarantees (Phase 2 audit + 2A.1 design + 2B):
 *  - A command is persisted BEFORE any physical delivery (createRequest -> PENDING).
 *  - Idempotency: UNIQUE(idempotency_key). Exact retry returns existing row,
 *    no second physical send.
 *  - Conflict protection (option A): active STOP blocks new RESTORE (409) and
 *    vice-versa; equivalent active command returns existing (no duplicate).
 *  - No automatic restore, EVER. The worker only delivers explicitly-requested
 *    pending commands. RESTORE requires explicit authorized user action.
 *  - Truthful GT06 states: pending -> sent -> unconfirmed. 'delivered' is only
 *    used when trustworthy delivery evidence exists; for GT06 it does not, so
 *    the terminal state is 'unconfirmed'. EXECUTED is never produced.
 *  - historical_unverified: conservative terminal state for backfilled legacy
 *    rows; never transitions; excluded from the active-command index.
 *  - Duplicate-send protection: an in-memory in-flight set guards deliverOnce
 *    so the route + worker + WS hook never send the same command twice.
 *  - Traccar unavailable: the command stays PENDING (worker retries). It is
 *    never deleted or failed just because delivery failed transiently.
 *
 * Authorization (requireAuth + requireDeviceOwner) is enforced by the route
 * before calling this module; it never bypasses RBAC.
 */

export const COMMAND_TYPES = ['engineStop', 'engineResume']

export const COMMAND_STATUSES = [
  'requested', 'pending', 'sent', 'delivered', 'unconfirmed',
  'failed', 'expired', 'cancelled', 'historical_unverified',
]

// Phase 2F: supersession-based conflict model. 'unconfirmed' no longer blocks a
// new explicit opposite command; the old command is superseded instead.
export const IN_FLIGHT_STATUSES = ['requested', 'pending', 'sent']
export const DELIVERED_STATUSES = ['unconfirmed', 'delivered']
export const ACTIONABLE_STATUSES = [...IN_FLIGHT_STATUSES, ...DELIVERED_STATUSES]
export const TERMINAL_STATUSES = ['unconfirmed', 'failed', 'expired', 'cancelled', 'historical_unverified']
// Backward-compat alias. Semantics changed: 'unconfirmed' is historical, not a lock.
export const ACTIVE_STATUSES = ACTIONABLE_STATUSES

const IDEMPOTENCY_KEY_MAX = 160
const ADVISORY_KEY_NAMESPACE = 'athar_engine_commands'
const WORKER_BATCH = 50
const WORKER_INTERVAL_MS = Number(process.env.ENGINE_WORKER_INTERVAL_MS || 30000)
// Pending commands older than this TTL are expired by the worker to prevent
// stale delivery on a future device reconnect (Phase 2 — stale command fix).
const COMMAND_TTL_MS = Number(process.env.ENGINE_COMMAND_TTL_MS || 24 * 60 * 60 * 1000) // 24h default

// In-flight delivery guard (single process): prevents the route, the poll
// worker and the WS hook from sending the same command twice.
const _inflight = new Set()

export class CommandConflictError extends Error {
  constructor(activeCommand) {
    super('A conflicting engine command is already active for this device')
    this.name = 'CommandConflictError'
    this.code = 'COMMAND_CONFLICT'
    this.status = 409
    this.activeCommand = activeCommand
  }
}

export class InvalidCommandError extends Error {
  constructor(message) {
    super(message || 'Invalid engine command')
    this.name = 'InvalidCommandError'
    this.code = 'INVALID_COMMAND'
    this.status = 400
  }
}

function requestedStateFor(type) {
  return type === 'engineStop' ? 'stopped' : 'running'
}

function normalizeIdempotencyKey(clientKey) {
  if (!clientKey) return null
  const key = String(clientKey).trim()
  if (!key) return null
  return key.slice(0, IDEMPOTENCY_KEY_MAX)
}

function generateIdempotencyKey() {
  return 'gen_' + randomUUID()
}

function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    device_id: row.device_id,
    user_id: row.user_id,
    command_type: row.command_type,
    requested_state: row.requested_state,
    status: row.status,
    idempotency_key: row.idempotency_key,
    legacy_id: row.legacy_id ?? null,
    traccar_command_id: row.traccar_command_id ?? null,
    traccar_device_id: row.traccar_device_id ?? null,
    protocol: row.protocol ?? null,
    command_profile: row.command_profile ?? null,
    error: row.error ?? null,
    ip_address: row.ip_address ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sent_at: row.sent_at ?? null,
    delivered_at: row.delivered_at ?? null,
    resolved_at: row.resolved_at ?? null,
    superseded_by_command_id: row.superseded_by_command_id ?? null,
    cancellation_state: row.cancellation_state ?? null,
    cancellation_confirmed_at: row.cancellation_confirmed_at ?? null,
  }
}

// Phase 2F helpers
// A command is QUEUED_LIVE when it is still physically queued in Traccar
// (pending + a real Traccar command id > 0). Only such a command can fire
// later and reverse a newer intent; 'unconfirmed'/'sent' have already left
// the queue and are historical.
function isQueuedLive(cmd) {
  return !!cmd && cmd.status === 'pending' && cmd.traccar_command_id != null && cmd.traccar_command_id > 0
}

// Device gate: is there a pending Traccar cancellation for this device? While
// true, no new command for this device may enter Traccar.
async function isDeviceGated(client, deviceId) {
  const r = await client.query(
    "SELECT 1 FROM engine_commands WHERE device_id = $1 AND cancellation_state = 'pending' AND traccar_command_id > 0 LIMIT 1",
    [deviceId]
  )
  return r.rowCount > 0
}

// Latest non-superseded, actionable command for a device (current intent).
async function getLatestCurrent(client, deviceId) {
  const r = await client.query(
    "SELECT * FROM engine_commands WHERE device_id = $1 AND superseded_by_command_id IS NULL AND status = ANY($2) ORDER BY id DESC LIMIT 1",
    [deviceId, ACTIONABLE_STATUSES]
  )
  return r.rowCount > 0 ? r.rows[0] : null
}

// Idempotent, conservative Traccar cancellation. Called AFTER the PostgreSQL
// commit, never inside a transaction. 204/404 -> confirmed; 5xx/unknown -> the
// gate stays 'pending' and the worker retries. 404 is treated only as "not
// currently in the Traccar queue" (NOT as "delivered").
async function attemptCancellation(oldCmd) {
  if (!oldCmd || !oldCmd.traccar_command_id || oldCmd.traccar_command_id <= 0) return
  try {
    await traccar.cancelQueuedCommand(oldCmd.traccar_command_id)
    await db.query(
      "UPDATE engine_commands SET cancellation_state = 'confirmed', cancellation_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1 AND cancellation_state = 'pending'",
      [oldCmd.id]
    )
    console.log('[engine] cancellation confirmed (204)', JSON.stringify({ id: oldCmd.id, traccarCommandId: oldCmd.traccar_command_id }))
  } catch (e) {
    if (e && e.status === 404) {
      await db.query(
        "UPDATE engine_commands SET cancellation_state = 'confirmed', cancellation_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1 AND cancellation_state = 'pending'",
        [oldCmd.id]
      )
      console.log('[engine] cancellation resolved (404: not currently queued)', JSON.stringify({ id: oldCmd.id }))
    } else {
      console.warn('[engine] cancellation pending (will retry)', JSON.stringify({ id: oldCmd.id, status: e && e.status, message: e && e.message }))
    }
  }
}

// Public hook for the route/worker to drive a pending cancellation explicitly.
export async function reconcileCancellation(oldCmd) {
  return attemptCancellation(oldCmd)
}

// ── Create (idempotent + conflict-protected) ──────────────────────────────
export async function createRequest({
  deviceId, userId, commandType, idempotencyKey = null, ip = null,
  protocol = null, commandProfile = null, traccarDeviceId = null,
}) {
  if (!COMMAND_TYPES.includes(commandType)) throw new InvalidCommandError('Command type must be engineStop or engineResume')
  if (!Number.isInteger(deviceId) || deviceId <= 0) throw new InvalidCommandError('Invalid device id')
  if (!Number.isInteger(userId) || userId <= 0) throw new InvalidCommandError('Invalid user id')

  const key = normalizeIdempotencyKey(idempotencyKey) || generateIdempotencyKey()
  const requestedState = requestedStateFor(commandType)

  const client = await db.connect()
  let latestRow = null
  let wasQueuedLive = false
  let outCmd = null
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [ADVISORY_KEY_NAMESPACE, deviceId])

    // 1) Exact retry: same idempotency key -> return untouched existing row.
    const existing = await client.query('SELECT * FROM engine_commands WHERE idempotency_key = $1 LIMIT 1', [key])
    if (existing.rowCount > 0) { await client.query('COMMIT'); return mapRow(existing.rows[0]) }

    // 2) Current intent: latest non-superseded, actionable command.
    latestRow = await getLatestCurrent(client, deviceId)

    // 3) Dedup: same requested state, still actionable -> return existing.
    if (latestRow && latestRow.requested_state === requestedState && ACTIONABLE_STATUSES.includes(latestRow.status)) {
      await client.query('COMMIT')
      return mapRow(latestRow)
    }

    // 4) Supersession path: fall through to insert (handled below).

    // 3) Insert PENDING (offline-safe default; delivery attempted next).
    const insert = await client.query(
      'INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, idempotency_key, protocol, command_profile, traccar_device_id, ip_address) VALUES ($1,$2,$3,$4,\'pending\',$5,$6,$7,$8,$9) RETURNING *',
      [deviceId, userId, commandType, requestedState, key, protocol, commandProfile, traccarDeviceId, ip]
    )
    if (latestRow) {
      await client.query('UPDATE engine_commands SET superseded_by_command_id = $1, updated_at = NOW() WHERE id = $2', [insert.rows[0].id, latestRow.id])
      wasQueuedLive = isQueuedLive(mapRow(latestRow))
      if (wasQueuedLive) {
        await client.query("UPDATE engine_commands SET cancellation_state = 'pending', updated_at = NOW() WHERE id = $1", [latestRow.id])
      }
    }
    await client.query('COMMIT')
    console.log('[engine] created command', JSON.stringify({ id: insert.rows[0].id, device: deviceId, type: commandType, status: 'pending', superseded: latestRow ? latestRow.id : null, queuedLive: wasQueuedLive }))
    outCmd = mapRow(insert.rows[0])
    outCmd.gateHeld = wasQueuedLive
  } catch (err) {
    try { await client.query('ROLLBACK') } catch (_) {}
    throw err
  } finally {
    client.release()
  }
  // Post-commit external side effect (outside any transaction): cancel the old
  // queued Traccar command so it cannot fire later and reverse this intent.
  if (wasQueuedLive && latestRow) {
    await attemptCancellation(mapRow(latestRow)).catch(() => { /* logged inside */ })
  }
  return outCmd
}

// ── Reads ──────────────────────────────────────────────────────────────────
export async function getActiveCommand(deviceId) {
  const r = await db.query(
    "SELECT * FROM engine_commands WHERE device_id = $1 AND superseded_by_command_id IS NULL AND status = ANY($2) ORDER BY id DESC LIMIT 1",
    [deviceId, ACTIONABLE_STATUSES]
  )
  return r.rowCount > 0 ? mapRow(r.rows[0]) : null
}
export async function getCommand(commandId, deviceId = null) {
  const q = deviceId ? 'SELECT * FROM engine_commands WHERE id = $1 AND device_id = $2 LIMIT 1' : 'SELECT * FROM engine_commands WHERE id = $1 LIMIT 1'
  const params = deviceId ? [commandId, deviceId] : [commandId]
  const r = await db.query(q, params)
  return r.rowCount > 0 ? mapRow(r.rows[0]) : null
}

// ── Transitions ────────────────────────────────────────────────────────────
const ALLOWED_TRANSITIONS = {
  requested: ['pending', 'sent', 'delivered', 'unconfirmed', 'failed', 'cancelled'],
  pending: ['sent', 'delivered', 'unconfirmed', 'failed', 'expired', 'cancelled'],
  sent: ['delivered', 'unconfirmed', 'failed', 'cancelled'],
  delivered: ['unconfirmed', 'failed', 'cancelled'],
  unconfirmed: ['cancelled'],
  failed: ['cancelled'],
  expired: ['cancelled'],
  cancelled: [],
  historical_unverified: [],
}
function isAllowedTransition(from, to) {
  if (from === to) return true
  return (ALLOWED_TRANSITIONS[from] || []).includes(to)
}

export async function transition(commandId, nextStatus, { error = null, traccarCommandId = null } = {}) {
  if (!COMMAND_STATUSES.includes(nextStatus)) throw new InvalidCommandError('Invalid target status')
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const cur = await client.query('SELECT * FROM engine_commands WHERE id = $1 FOR UPDATE', [commandId])
    if (cur.rowCount === 0) { await client.query('ROLLBACK'); return null }
    const from = cur.rows[0].status
    if (!isAllowedTransition(from, nextStatus)) { await client.query('ROLLBACK'); throw new InvalidCommandError('Illegal status transition: ' + from + ' -> ' + nextStatus) }
    const sets = ['status = $2', 'updated_at = NOW()']
    const params = [commandId, nextStatus]
    let pi = 3
    if (TERMINAL_STATUSES.includes(nextStatus)) sets.push('resolved_at = NOW()')
    if (nextStatus === 'sent') sets.push('sent_at = COALESCE(sent_at, NOW())')
    if (nextStatus === 'delivered') sets.push('delivered_at = COALESCE(delivered_at, NOW())')
    if (error !== null) { sets.push('error = $' + pi); params.push(error); pi++ }
    if (traccarCommandId !== null) { sets.push('traccar_command_id = $' + pi); params.push(traccarCommandId); pi++ }
    const r = await client.query('UPDATE engine_commands SET ' + sets.join(', ') + ' WHERE id = $1 RETURNING *', params)
    await client.query('COMMIT')
    console.log('[engine] transition', JSON.stringify({ id: commandId, from, to: nextStatus }))
    return r.rowCount > 0 ? mapRow(r.rows[0]) : null
  } catch (err) {
    try { await client.query('ROLLBACK') } catch (_) {}
    throw err
  } finally {
    client.release()
  }
}

export async function cancel(commandId, deviceId = null) {
  const cmd = await getCommand(commandId, deviceId)
  if (!cmd) return null
  if (cmd.status === 'cancelled') return cmd
  // Only pre-delivery states may be cancelled. A command already
  // sent/unconfirmed/delivered has left the server and cannot be recalled;
  // an explicit opposite command (supersession) is the only way to change
  // state then. No automatic restore is ever issued.
  if (!['requested', 'pending'].includes(cmd.status)) return cmd
  // If still queued in Traccar, attempt cancellation there first (best-effort,
  // outside any transaction). The gate stays held until Traccar confirms.
  if (isQueuedLive(cmd)) {
    await attemptCancellation(cmd)
  }
  return transition(commandId, 'cancelled')
}

// ── Delivery ───────────────────────────────────────────────────────────────
function isTransientTraccarError(err) {
  if (!err) return true
  if (err.code === 'TRACCAR_AUTH_FAILED') return true
  const st = err.status
  if (!st) return true            // network / timeout / fetch failed -> unreachable
  if (st >= 500) return true      // server error -> retry
  return false                    // 4xx (not auth) -> permanent rejection
}

async function getDeviceRow(deviceId) {
  const { rows } = await db.query('SELECT * FROM devices WHERE id = $1', [deviceId])
  return rows[0] || null
}

// Resolve the protocol + relay command exactly as the legacy route did, so
// physical command behavior is unchanged. Centralized here so there is exactly
// ONE engine-command execution path.
function resolveCommand(commandType, traccarDevice, protocol) {
  const knownNonRelay = /^(?:teltonika|t55|h02|tk103|meiligao|suntech|wondex)/i.test(protocol)
  const isRelayProtocol = protocol ? !knownNonRelay : true
  const cmd = isRelayProtocol
    ? traccar.resolveEngineCommand({ type: commandType, protocol, deviceAttributes: traccarDevice?.attributes || {} })
    : { type: commandType, attributes: {}, profile: 'traccar-standard' }
  return { cmd, isRelayProtocol }
}

/**
 * Deliver a single pending command to Traccar. Idempotent: a command already
 * accepted by Traccar (traccar_command_id set) or no longer pending is skipped.
 * An in-memory guard prevents concurrent delivery of the same command.
 *
 * Traccar semantics (verified, not inferred):
 *  - sendCommand returns the command object with id = the Traccar COMMAND id
 *    (NOT the device id), or null (accepted-no-body).
 *  - id > 0  -> queued (device offline; Traccar stores it for the next session)
 *  - id == 0 -> sent (device online; pushed to the tracker)
 *  - null    -> accepted-no-body
 *
 * State mapping (GT06, no trustworthy physical-relay evidence):
 *  - queued (offline)      -> stay PENDING (record traccar_command_id; no re-send)
 *  - sent / accepted        -> sent -> unconfirmed (physical state unprovable)
 *  - transient Traccar err -> stay PENDING (worker retries; never deleted)
 *  - permanent 4xx reject   -> failed
 */
export async function deliverOnce(command, dev) {
  if (!command || !dev?.traccar_id) return command
  if (_inflight.has(command.id)) return command
  _inflight.add(command.id)
  try {
    // Re-validate under the per-device advisory lock immediately before any
    // physical send. A stale command object must never bypass the gate.
    const client = await db.connect()
    let cur
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [ADVISORY_KEY_NAMESPACE, command.device_id])
      const r = await client.query('SELECT * FROM engine_commands WHERE id = $1 FOR UPDATE', [command.id])
      if (r.rowCount === 0) { await client.query('COMMIT'); return null }
      const row = r.rows[0]
      if (row.superseded_by_command_id != null) { await client.query('COMMIT'); return mapRow(row) }
      if (row.status !== 'pending' && row.status !== 'requested') { await client.query('COMMIT'); return mapRow(row) }
      if (row.traccar_command_id != null) { await client.query('COMMIT'); return mapRow(row) }
      if (await isDeviceGated(client, command.device_id)) {
        await client.query('COMMIT')
        console.log('[engine] delivery deferred (cancellation gate held)', JSON.stringify({ id: command.id, device: command.device_id }))
        return mapRow(row)
      }
      await client.query('COMMIT')
      cur = mapRow(row)
    } catch (e) {
      try { await client.query('ROLLBACK') } catch (_) {}
      throw e
    } finally {
      client.release()
    }

    let protocol = cur.protocol || ''
    let traccarDevice = null
    try {
      traccarDevice = await traccar.getDevice(dev.traccar_id)
      protocol = String(traccarDevice?.protocol || '').toLowerCase() || protocol
    } catch (e) {
      console.warn('[engine] protocol lookup failed; defaulting:', e.message)
    }
    const { cmd } = resolveCommand(cur.command_type, traccarDevice, protocol)

    let response
    try {
      response = await traccar.sendCommand(dev.traccar_id, cmd.type, cmd.attributes)
    } catch (err) {
      if (isTransientTraccarError(err)) {
        console.warn('[engine] transient Traccar error, leaving pending:', err.message)
        return await getCommand(command.id)
      }
      console.error('[engine] permanent Traccar rejection:', err.message)
      await transition(command.id, 'failed', { error: err.message })
      return await getCommand(command.id)
    }

    const meta = traccar.getCommandDeliveryMeta(response)
    registerEngineCommandCooldown(dev.traccar_id, dev.id)

    // Persist protocol/profile metadata for observability.
    await db.query('UPDATE engine_commands SET protocol = $1, command_profile = $2, traccar_device_id = COALESCE(traccar_device_id, $3) WHERE id = $4', [protocol || null, cmd.profile, dev.traccar_id, command.id])

    if (meta.queueState === 'queued') {
      // Device offline: Traccar queued the command. Record the real Traccar
      // command id and stay PENDING (waiting for vehicle connection). Do NOT
      // re-send; the worker transitions to unconfirmed on reconnect.
      await db.query('UPDATE engine_commands SET traccar_command_id = $1, sent_at = COALESCE(sent_at, NOW()), updated_at = NOW() WHERE id = $2', [meta.commandId, command.id])
      console.log('[engine] queued (offline)', JSON.stringify({ id: command.id, traccarCommandId: meta.commandId }))
      return await getCommand(command.id)
    }

    // sent (online, pushed) or accepted-no-body / accepted-response-without-id.
    // Pass through 'sent' for observability, then 'unconfirmed' for GT06
    // (physical relay state cannot be proven). Never 'delivered' for GT06.
    await transition(command.id, 'sent', { traccarCommandId: meta.commandId })
    await transition(command.id, 'unconfirmed')
    return await getCommand(command.id)
  } finally {
    _inflight.delete(command.id)
  }
}

// ── Worker ─────────────────────────────────────────────────────────────────
/**
 * Process pending commands. Called by setInterval (poll) and the Traccar WS
 * bridge (reconnect). NEVER sends engineResume automatically — it only delivers
 * explicitly-requested pending commands. No auto-restore, ever.
 */
export async function processPendingCommands() {
  // Stage 1: reconcile pending Traccar cancellations (crash recovery). Must
  // always run before delivery so a superseded queued command is removed from
  // Traccar before any new command for the same device is sent.
  try {
    const pend = await db.query("SELECT * FROM engine_commands WHERE cancellation_state = 'pending' AND traccar_command_id > 0 ORDER BY updated_at ASC LIMIT $1", [WORKER_BATCH])
    for (const row of pend.rows) {
      try { await attemptCancellation(mapRow(row)) } catch (e) { console.warn('[engine-worker] cancellation retry failed', row.id, e.message) }
    }
  } catch (e) { console.error('[engine-worker] cancellation query failed:', e.message) }

  // Stage 2: deliver eligible latest non-superseded pending commands whose
  // device gate is not held.
  let pending
  try {
    pending = await db.query(
      "SELECT e.id FROM engine_commands e WHERE e.status = 'pending' AND e.superseded_by_command_id IS NULL AND NOT EXISTS (SELECT 1 FROM engine_commands c WHERE c.device_id = e.device_id AND c.cancellation_state = 'pending' AND c.traccar_command_id > 0) ORDER BY e.created_at ASC LIMIT $1",
      [WORKER_BATCH]
    )
  } catch (e) { console.error('[engine-worker] pending query failed:', e.message); return }
  for (const row of pending.rows) {
    try {
      const cmd = await getCommand(row.id)
      if (!cmd || cmd.status !== 'pending') continue
      const dev = await getDeviceRow(cmd.device_id)
      if (!dev) continue
      if (cmd.traccar_command_id == null) {
        // Never sent to Traccar -> attempt delivery (handles Traccar-was-down).
        await deliverOnce(cmd, dev)
      } else {
        // Queued (offline at request time). If the device has now reported,
        // Traccar delivered the queued command on reconnect -> unconfirmed.
        await maybeConfirmQueued(cmd, dev)
      }
    } catch (e) {
      console.error('[engine-worker] command', row.id, 'failed:', e.message)
    }
  }
}

// Called by the Traccar WS bridge when a live position arrives (device online).
export async function processPendingCommandsForDevice(deviceId) {
  if (!deviceId) return
  // Reconcile cancellations for this device first (same ordering as the poll).
  try {
    const pend = await db.query("SELECT * FROM engine_commands WHERE device_id = $1 AND cancellation_state = 'pending' AND traccar_command_id > 0", [deviceId])
    for (const row of pend.rows) { try { await attemptCancellation(mapRow(row)) } catch (e) { /* logged */ } }
  } catch (e) { /* ignore */ }

  let pending
  try {
    pending = await db.query(
      "SELECT id FROM engine_commands WHERE device_id = $1 AND status = 'pending' AND superseded_by_command_id IS NULL AND NOT EXISTS (SELECT 1 FROM engine_commands c WHERE c.device_id = $1 AND c.cancellation_state = 'pending' AND c.traccar_command_id > 0) ORDER BY created_at ASC LIMIT 10",
      [deviceId]
    )
  } catch (e) { return }
  for (const row of pending.rows) {
    try {
      const cmd = await getCommand(row.id)
      if (!cmd || cmd.status !== 'pending') continue
      const dev = await getDeviceRow(cmd.device_id)
      if (!dev) continue
      if (cmd.traccar_command_id == null) {
        await deliverOnce(cmd, dev)
      } else {
        // A position just arrived -> device is online -> Traccar delivered the
        // queued command -> unconfirmed (GT06 physical state unprovable).
        await transition(cmd.id, 'sent')
        await transition(cmd.id, 'unconfirmed')
      }
    } catch (e) {
      console.error('[engine-worker] device', deviceId, 'cmd', row.id, 'failed:', e.message)
    }
  }
  // Stage 3: expire pending commands older than TTL. A command pending for hours
  // means the device is offline or Traccar is unreachable; delivering it days or
  // weeks later on an unexpected reconnect is almost never the user's intent and
  // has been linked to unsolicited relay activations. Expiring removes it from
  // the delivery queue safely (terminal 'expired' state, never physically sent).
  try {
    const cutoff = new Date(Date.now() - COMMAND_TTL_MS)
    const exp = await db.query(
      "UPDATE engine_commands SET status = 'expired', updated_at = NOW(), resolved_at = NOW() WHERE status = 'pending' AND superseded_by_command_id IS NULL AND created_at < $1",
      [cutoff]
    )
    if (exp.rowCount > 0) console.log('[engine-worker] expired', exp.rowCount, 'stale pending commands (TTL=' + COMMAND_TTL_MS + 'ms)')
  } catch (e) { console.error('[engine-worker] expiration failed:', e.message) }

}

// Resolve Traccar device ids from a WS message to local device ids and process.

}

export async function onDeviceActivity(traccarIds) {
  if (!Array.isArray(traccarIds) || traccarIds.length === 0) return
  let rows
  try {
    rows = await db.query('SELECT id FROM devices WHERE traccar_id = ANY($1)', [traccarIds])
  } catch (e) { return }
  for (const r of rows.rows) {
    processPendingCommandsForDevice(r.id).catch(e => console.warn('[engine-worker] onDeviceActivity', r.id, 'failed:', e.message))
  }
}

async function maybeConfirmQueued(cmd, dev) {
  try {
    if (cmd.superseded_by_command_id != null) return // stale; do not advance
    const positions = await traccar.getAllPositions()   // cached
    const pos = (positions || []).find(p => p.deviceId === dev.traccar_id)
    if (pos && positionIsFresh(pos)) {
      await transition(cmd.id, 'sent')
      await transition(cmd.id, 'unconfirmed')
    }
  } catch (e) {
    console.warn('[engine-worker] maybeConfirmQueued', cmd.id, 'failed:', e.message)
  }
}

// Start the poll worker (called once at boot from index.js).
let _workerStarted = false
export function startCommandWorker() {
  if (_workerStarted) return
  _workerStarted = true
  processPendingCommands().catch(e => console.warn('[engine-worker] initial run failed:', e.message))
  const t = setInterval(() => {
    processPendingCommands().catch(e => console.warn('[engine-worker] poll failed:', e.message))
  }, WORKER_INTERVAL_MS)
  if (typeof t.unref === 'function') t.unref()
  console.log('[engine-worker] started (interval=' + WORKER_INTERVAL_MS + 'ms)')
}
