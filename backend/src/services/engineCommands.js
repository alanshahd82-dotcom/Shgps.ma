import { randomUUID } from 'crypto'
import { db } from '../db.js'

/**
 * engineCommands — Engine relay command state machine (Phase 2A.1).
 *
 * Operates on the `engine_commands` table. The legacy `device_commands`
 * table (508 historical rows) is intentionally left untouched and is NOT read
 * or written by this module.
 *
 * Safety guarantees (see Phase 2 audit + 2A.1 design):
 *  - A command is persisted BEFORE any physical delivery. Phase 2B will wire
 *    Traccar; this module only owns the database/state model.
 *  - Idempotency: UNIQUE(idempotency_key). Exact retry returns existing row.
 *  - Conflict protection (option A): active STOP blocks new RESTORE (409) and
 *    vice-versa; equivalent active command returns existing (no duplicate).
 *  - No automatic restore, ever. RESTORE only via explicit authorized request.
 *  - Truthful GT06 states: requested -> pending -> sent -> delivered ->
 *    unconfirmed. EXECUTED is intentionally NOT produced.
 *  - historical_unverified: conservative terminal state for backfilled legacy
 *    rows whose original result='sent' cannot be trusted as delivery/execution
 *    evidence. Never transitions; excluded from the active-command index so it
 *    never blocks new commands.
 *
 * This module performs NO Traccar calls and changes NO engine behavior.
 * Authorization (requireAuth + requireDeviceOwner) is enforced by the route
 * before calling this module; it never bypasses RBAC.
 */

export const COMMAND_TYPES = ['engineStop', 'engineResume']

export const COMMAND_STATUSES = [
  'requested',
  'pending',
  'sent',
  'delivered',
  'unconfirmed',
  'failed',
  'expired',
  'cancelled',
  'historical_unverified',
]

export const ACTIVE_STATUSES = ['requested', 'pending', 'sent', 'delivered', 'unconfirmed']
export const TERMINAL_STATUSES = ['unconfirmed', 'failed', 'expired', 'cancelled', 'historical_unverified']

const IDEMPOTENCY_KEY_MAX = 160
const ADVISORY_KEY_NAMESPACE = 'athar_engine_commands'

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
  }
}

/**
 * Create a command request (idempotent + conflict-protected).
 * Returns the command row (newly inserted OR existing retained row for an
 * exact retry). Throws CommandConflictError (409) when a conflicting command
 * is active. Throws InvalidCommandError (400) for a bad type/input.
 */
export async function createRequest({
  deviceId,
  userId,
  commandType,
  idempotencyKey = null,
  ip = null,
  protocol = null,
  commandProfile = null,
  traccarDeviceId = null,
}) {
  if (!COMMAND_TYPES.includes(commandType)) {
    throw new InvalidCommandError('Command type must be engineStop or engineResume')
  }
  if (!Number.isInteger(deviceId) || deviceId <= 0) {
    throw new InvalidCommandError('Invalid device id')
  }
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new InvalidCommandError('Invalid user id')
  }

  const key = normalizeIdempotencyKey(idempotencyKey) || generateIdempotencyKey()
  const requestedState = requestedStateFor(commandType)

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Serialize command creation per device so the active-command check is
    // authoritative against concurrent requests (double-click, tabs, retries).
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1), $2)',
      [ADVISORY_KEY_NAMESPACE, deviceId]
    )

    // 1) Exact retry: same idempotency key already exists -> return untouched.
    const existing = await client.query(
      'SELECT * FROM engine_commands WHERE idempotency_key = $1 LIMIT 1',
      [key]
    )
    if (existing.rowCount > 0) {
      await client.query('COMMIT')
      return mapRow(existing.rows[0])
    }

    // 2) Conflict check: any active command for this device? (row-locked)
    const active = await client.query(
      'SELECT * FROM engine_commands ' +
        'WHERE device_id = $1 AND status = ANY($2) ' +
        'ORDER BY created_at DESC LIMIT 1 FOR UPDATE',
      [deviceId, ACTIVE_STATUSES]
    )
    if (active.rowCount > 0) {
      const activeCmd = mapRow(active.rows[0])
      if (activeCmd.command_type === commandType) {
        // Equivalent active command: idempotent return (no duplicate).
        await client.query('COMMIT')
        return activeCmd
      }
      // Conflicting active command: REJECT (option A). No cancel/replace.
      await client.query('COMMIT')
      throw new CommandConflictError(activeCmd)
    }

    // 3) Insert the new request as 'pending' (offline-safe default; Phase 2B
    //    transitions to sent/delivered after Traccar delivery).
    const insert = await client.query(
      'INSERT INTO engine_commands ' +
        '(device_id, user_id, command_type, requested_state, status, ' +
        'idempotency_key, protocol, command_profile, traccar_device_id, ip_address) ' +
        'VALUES ($1,$2,$3,$4,\'pending\',$5,$6,$7,$8,$9) RETURNING *',
      [deviceId, userId, commandType, requestedState, key,
        protocol, commandProfile, traccarDeviceId, ip]
    )
    await client.query('COMMIT')
    return mapRow(insert.rows[0])
  } catch (err) {
    try { await client.query('ROLLBACK') } catch (_) {}
    throw err
  } finally {
    client.release()
  }
}

/** Return the active command for a device, if any (no lock). */
export async function getActiveCommand(deviceId) {
  const r = await db.query(
    'SELECT * FROM engine_commands ' +
      'WHERE device_id = $1 AND status = ANY($2) ' +
      'ORDER BY created_at DESC LIMIT 1',
    [deviceId, ACTIVE_STATUSES]
  )
  return r.rowCount > 0 ? mapRow(r.rows[0]) : null
}

/** Return a command by id (optionally scoped to deviceId for auth safety). */
export async function getCommand(commandId, deviceId = null) {
  const q = deviceId
    ? 'SELECT * FROM engine_commands WHERE id = $1 AND device_id = $2 LIMIT 1'
    : 'SELECT * FROM engine_commands WHERE id = $1 LIMIT 1'
  const params = deviceId ? [commandId, deviceId] : [commandId]
  const r = await db.query(q, params)
  return r.rowCount > 0 ? mapRow(r.rows[0]) : null
}

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

/**
 * Transition a command's status (used by Phase 2B delivery/worker).
 * Validates allowed transitions; refuses illegal jumps. No auto-restore.
 */
export async function transition(commandId, nextStatus, { error = null, traccarCommandId = null } = {}) {
  if (!COMMAND_STATUSES.includes(nextStatus)) {
    throw new InvalidCommandError('Invalid target status')
  }
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const cur = await client.query(
      'SELECT * FROM engine_commands WHERE id = $1 FOR UPDATE',
      [commandId]
    )
    if (cur.rowCount === 0) {
      await client.query('ROLLBACK')
      return null
    }
    const from = cur.rows[0].status
    if (!isAllowedTransition(from, nextStatus)) {
      await client.query('ROLLBACK')
      throw new InvalidCommandError('Illegal status transition: ' + from + ' -> ' + nextStatus)
    }
    const sets = ['status = $2', 'updated_at = NOW()']
    const params = [commandId, nextStatus]
    let pi = 3
    if (TERMINAL_STATUSES.includes(nextStatus)) sets.push('resolved_at = NOW()')
    if (nextStatus === 'sent') sets.push('sent_at = COALESCE(sent_at, NOW())')
    if (nextStatus === 'delivered') sets.push('delivered_at = COALESCE(delivered_at, NOW())')
    if (error !== null) { sets.push('error = $' + pi); params.push(error); pi++ }
    if (traccarCommandId !== null) { sets.push('traccar_command_id = $' + pi); params.push(traccarCommandId); pi++ }
    const r = await client.query(
      'UPDATE engine_commands SET ' + sets.join(', ') + ' WHERE id = $1 RETURNING *',
      params
    )
    await client.query('COMMIT')
    return r.rowCount > 0 ? mapRow(r.rows[0]) : null
  } catch (err) {
    try { await client.query('ROLLBACK') } catch (_) {}
    throw err
  } finally {
    client.release()
  }
}

/** Explicit cancellation by an authorized user (no auto-restore path). */
export async function cancel(commandId, deviceId = null) {
  const cmd = await getCommand(commandId, deviceId)
  if (!cmd) return null
  if (cmd.status === 'cancelled') return cmd
  if (TERMINAL_STATUSES.includes(cmd.status)) return cmd
  return transition(commandId, 'cancelled')
}
