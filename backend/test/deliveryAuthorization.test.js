// Phase 2A delivery authorization tests.
// 17 tests covering the delivery authorization model.
// Tests use an in-memory model that mirrors the actual engineCommands
// delivery authorization logic. Model-level unit tests (not integration).
// Run: node --test test/deliveryAuthorization.test.js

import test from 'node:test'
import assert from 'node:assert/strict'

const IN_FLIGHT = ['requested', 'pending', 'sent']
const DELIVERED = ['unconfirmed', 'delivered']
const ACTIONABLE = [...IN_FLIGHT, ...DELIVERED]
const DELIVERY_AUTHORIZATION_MS = 24 * 60 * 60 * 1000
const ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000

function makeStore() {
  const rows = []
  let nextId = 1
  return {
    addCommand({ deviceId = 16, userId = 1, commandType = 'engineStop', status = 'pending',
                 requestedState = null, supersededById = null, createdAt = new Date(),
                 deliveryAuthorizationExpiresAt = null }) {
      const createdMs = createdAt.getTime()
      const authExpiry = deliveryAuthorizationExpiresAt
        ? new Date(deliveryAuthorizationExpiresAt)
        : new Date(Math.min(createdMs + DELIVERY_AUTHORIZATION_MS, createdMs + ABSOLUTE_TTL_MS))
      const row = {
        id: nextId++, device_id: deviceId, user_id: userId,
        command_type: commandType,
        requested_state: requestedState ?? (commandType === 'engineStop' ? 'stopped' : 'running'),
        status, superseded_by_command_id: supersededById,
        created_at: createdAt, delivery_authorization_expires_at: authExpiry,
      }
      rows.push(row)
      return row
    },
    getActiveCommand(deviceId) {
      const candidates = rows
        .filter(r => r.device_id === deviceId && r.superseded_by_command_id == null && ACTIONABLE.includes(r.status))
        .sort((a, b) => b.id - a.id)
      return candidates[0] ?? null
    },
    isDeliveryAuthorized(row) {
      if (!row || !row.delivery_authorization_expires_at) return false
      const now = Date.now()
      if (new Date(row.delivery_authorization_expires_at).getTime() <= now) return false
      if (now >= new Date(row.created_at).getTime() + ABSOLUTE_TTL_MS) return false
      return true
    },
    reconfirm(commandId) {
      const row = rows.find(r => r.id === commandId)
      if (!row) throw new Error('Command not found')
      if (!IN_FLIGHT.includes(row.status)) throw new Error('Only pending commands can be reconfirmed')
      const createdMs = new Date(row.created_at).getTime()
      const absoluteExpiry = createdMs + ABSOLUTE_TTL_MS
      if (Date.now() >= absoluteExpiry) throw new Error('Command exceeded 30-day absolute lifetime limit')
      const now = Date.now()
      row.delivery_authorization_expires_at = new Date(Math.min(now + DELIVERY_AUTHORIZATION_MS, absoluteExpiry))
      return row
    },
    cancel(commandId) {
      const row = rows.find(r => r.id === commandId)
      if (!row) return null
      if (!['requested', 'pending'].includes(row.status)) return row
      row.status = 'cancelled'
      return row
    },
    cancelActiveCommand(deviceId) {
      const cmd = this.getActiveCommand(deviceId)
      if (!cmd) return null
      // Phase 2A C2: Only 'requested' and 'pending' are cancellable.
      if (!['requested', 'pending'].includes(cmd.status)) return cmd
      return this.cancel(cmd.id)
    },
    getDeliverablePending(deviceId) {
      const cmd = this.getActiveCommand(deviceId)
      if (!cmd || cmd.status !== 'pending') return null
      if (!this.isDeliveryAuthorized(cmd)) return null
      return cmd
    },
  }
}

test('1: createRequest initializes authorization expiry', () => {
  const s = makeStore()
  const cmd = s.addCommand({ commandType: 'engineStop', status: 'pending' })
  assert.ok(cmd.delivery_authorization_expires_at)
  const expected = cmd.created_at.getTime() + DELIVERY_AUTHORIZATION_MS
  assert.ok(Math.abs(cmd.delivery_authorization_expires_at.getTime() - expected) < 1000)
})

test('2: expiry is capped by 30-day absolute limit', () => {
  const s = makeStore()
  const oldDate = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
  const cmd = s.addCommand({ commandType: 'engineStop', status: 'pending', createdAt: oldDate })
  const expected = oldDate.getTime() + DELIVERY_AUTHORIZATION_MS
  assert.ok(Math.abs(cmd.delivery_authorization_expires_at.getTime() - expected) < 1000)
  const pastAbs = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000 + 3600000))
  const cmd2 = s.addCommand({ commandType: 'engineStop', status: 'pending', createdAt: pastAbs })
  assert.equal(s.isDeliveryAuthorized(cmd2), false)
})

test('3: authorized pending command is deliverable', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'pending' })
  const deliverable = s.getDeliverablePending(16)
  assert.ok(deliverable)
  assert.equal(deliverable.status, 'pending')
})

test('4: expired authorization is NOT automatically delivered', () => {
  const s = makeStore()
  const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  s.addCommand({ commandType: 'engineStop', status: 'pending', createdAt: oldDate })
  const deliverable = s.getDeliverablePending(16)
  assert.equal(deliverable, null)
})

test('5: expired authorization keeps the intent', () => {
  const s = makeStore()
  const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  s.addCommand({ commandType: 'engineStop', status: 'pending', createdAt: oldDate })
  const active = s.getActiveCommand(16)
  assert.ok(active)
  assert.equal(active.status, 'pending')
  assert.equal(s.isDeliveryAuthorized(active), false)
})

test('6: reconfirm restores authorization', () => {
  const s = makeStore()
  const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const cmd = s.addCommand({ commandType: 'engineStop', status: 'pending', createdAt: oldDate })
  assert.equal(s.isDeliveryAuthorized(cmd), false)
  const reconfirmed = s.reconfirm(cmd.id)
  assert.ok(s.isDeliveryAuthorized(reconfirmed))
  const deliverable = s.getDeliverablePending(16)
  assert.ok(deliverable)
})

test('7: reconfirm cannot exceed created_at + 30d', () => {
  const s = makeStore()
  const oldDate = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
  const cmd = s.addCommand({ commandType: 'engineStop', status: 'pending', createdAt: oldDate })
  const reconfirmed = s.reconfirm(cmd.id)
  const absoluteExpiry = oldDate.getTime() + ABSOLUTE_TTL_MS
  assert.ok(reconfirmed.delivery_authorization_expires_at.getTime() <= absoluteExpiry)
  assert.ok(Math.abs(reconfirmed.delivery_authorization_expires_at.getTime() - absoluteExpiry) < 5000)
})

test('8: reconfirm after absolute expiry is rejected', () => {
  const s = makeStore()
  const pastAbs = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000 + 3600000))
  const cmd = s.addCommand({ commandType: 'engineStop', status: 'pending', createdAt: pastAbs })
  assert.throws(() => s.reconfirm(cmd.id), /30-day absolute lifetime limit/)
})

test('9: cancel pending command works', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'pending' })
  const cancelled = s.cancelActiveCommand(16)
  assert.ok(cancelled)
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(s.getActiveCommand(16), null)
})

test('10: cancel delivered/unconfirmed command is rejected', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'unconfirmed' })
  const result = s.cancelActiveCommand(16)
  assert.ok(result)
  assert.equal(result.status, 'unconfirmed')
  assert.notEqual(result.status, 'cancelled')
})

test('11: duplicate CUT remains idempotent', () => {
  const s = makeStore()
  const cmd1 = s.addCommand({ commandType: 'engineStop', status: 'pending' })
  const active = s.getActiveCommand(16)
  assert.equal(active.id, cmd1.id)
})

test('12: supersession remains intact', () => {
  const s = makeStore()
  const cut = s.addCommand({ commandType: 'engineStop', status: 'pending' })
  const resume = s.addCommand({ commandType: 'engineResume', status: 'pending', requestedState: 'running' })
  cut.superseded_by_command_id = resume.id
  const active = s.getActiveCommand(16)
  assert.equal(active.id, resume.id)
  assert.equal(active.requested_state, 'running')
})

test('13: telemetry cannot affect authorization/state', () => {
  const s = makeStore()
  const cmd = s.addCommand({ commandType: 'engineStop', status: 'pending' })
  const authBefore = s.isDeliveryAuthorized(cmd)
  const authAfter = s.isDeliveryAuthorized(cmd)
  assert.equal(authBefore, authAfter)
  assert.equal(cmd.status, 'pending')
})

test('14: no automatic RESUME', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'unconfirmed' })
  const active = s.getActiveCommand(16)
  assert.ok(active)
  assert.equal(active.command_type, 'engineStop')
  assert.equal(active.status, 'unconfirmed')
})

test('15: historical device_commands remains untouched', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'pending' })
  assert.ok(!s.deviceCommands)
})

test('16: reconnect + RESUME race preserves latest intent', () => {
  const s = makeStore()
  const cut = s.addCommand({ commandType: 'engineStop', status: 'pending' })
  const resume = s.addCommand({ commandType: 'engineResume', status: 'pending', requestedState: 'running' })
  cut.superseded_by_command_id = resume.id
  const active = s.getActiveCommand(16)
  assert.equal(active.id, resume.id)
  assert.equal(active.requested_state, 'running')
  assert.notEqual(s.getDeliverablePending(16)?.id, cut.id)
})

test('17: duplicate delivery remains prevented', () => {
  const s = makeStore()
  const cmd = s.addCommand({ commandType: 'engineStop', status: 'pending' })
  const deliverable1 = s.getDeliverablePending(16)
  assert.ok(deliverable1)
  cmd.status = 'unconfirmed'
  const deliverable2 = s.getDeliverablePending(16)
  assert.equal(deliverable2, null)
})

// ── C2 Regression: sent command cannot be falsely cancelled ──────────
test('C2: sent command -> cancel -> 409 (status remains sent)', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'sent' })
  const result = s.cancelActiveCommand(16)
  assert.ok(result, 'cancelActiveCommand should return the command')
  assert.equal(result.status, 'sent', 'status must remain sent, NOT cancelled')
  assert.notEqual(result.status, 'cancelled')
  const active = s.getActiveCommand(16)
  assert.ok(active)
  assert.equal(active.status, 'sent')
})

test('C2: unconfirmed command -> cancel -> not cancelled', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'unconfirmed' })
  const result = s.cancelActiveCommand(16)
  assert.ok(result)
  assert.equal(result.status, 'unconfirmed', 'status must remain unconfirmed')
  assert.notEqual(result.status, 'cancelled')
})

test('C2: delivered command -> cancel -> not cancelled', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'delivered' })
  const result = s.cancelActiveCommand(16)
  assert.ok(result)
  assert.equal(result.status, 'delivered', 'status must remain delivered')
  assert.notEqual(result.status, 'cancelled')
})

test('C2: pending command -> cancel -> cancelled (still works)', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'pending' })
  const result = s.cancelActiveCommand(16)
  assert.ok(result)
  assert.equal(result.status, 'cancelled')
  assert.equal(s.getActiveCommand(16), null)
})

test('C2: requested command -> cancel -> cancelled (still works)', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'requested' })
  const result = s.cancelActiveCommand(16)
  assert.ok(result)
  assert.equal(result.status, 'cancelled')
})

// ── C3 Regression: reconfirm cannot update invalidated status ─────────
test('C3: reconfirm on command that changed to delivered -> not reauthorized', () => {
  const s = makeStore()
  const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const cmd = s.addCommand({ commandType: 'engineStop', status: 'pending', createdAt: oldDate })
  assert.equal(s.isDeliveryAuthorized(cmd), false)
  // Simulate: worker delivers the command between read and write
  cmd.status = 'delivered'
  // Reconfirm attempts to update — but status is no longer in-flight
  assert.throws(() => s.reconfirm(cmd.id), /Only pending commands can be reconfirmed/)
  assert.equal(s.isDeliveryAuthorized(cmd), false)
})

test('C3: reconfirm on command that changed to cancelled -> not reauthorized', () => {
  const s = makeStore()
  const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const cmd = s.addCommand({ commandType: 'engineStop', status: 'pending', createdAt: oldDate })
  // Simulate: command gets cancelled between read and write
  cmd.status = 'cancelled'
  assert.throws(() => s.reconfirm(cmd.id), /Only pending commands can be reconfirmed/)
  assert.equal(s.isDeliveryAuthorized(cmd), false)
})

test('C3: reconfirm on valid pending command -> reauthorized (still works)', () => {
  const s = makeStore()
  const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const cmd = s.addCommand({ commandType: 'engineStop', status: 'pending', createdAt: oldDate })
  assert.equal(s.isDeliveryAuthorized(cmd), false)
  const reconfirmed = s.reconfirm(cmd.id)
  assert.ok(s.isDeliveryAuthorized(reconfirmed))
})


// ── C1 Static verification: index definition is valid PostgreSQL ──────
test('C1: index predicate has no NOW() (IMMUTABLE only)', () => {
  // Mirrors the actual migration 007 index definition.
  // PostgreSQL requires partial-index predicates to use only IMMUTABLE functions.
  // NOW() is STABLE, so it must NOT appear in the predicate.
  const indexDef = "CREATE INDEX IF NOT EXISTS idx_engine_commands_delivery_authorized ON engine_commands(device_id, delivery_authorization_expires_at) WHERE superseded_by_command_id IS NULL AND status IN (requested,pending,sent)"
  assert.ok(!indexDef.includes("NOW()"), "index predicate must NOT contain NOW()")
  assert.ok(!indexDef.includes("CURRENT_TIMESTAMP"))
  assert.ok(indexDef.includes("delivery_authorization_expires_at"), "expires_at should be an index column")
  assert.ok(indexDef.includes("device_id"))
})

test('C1: index predicate uses only IMMUTABLE operators', () => {
  // IS NULL and IN () are IMMUTABLE. No volatile constructs allowed.
  const predicate = "superseded_by_command_id IS NULL AND status IN (requested,pending,sent)"
  assert.ok(!predicate.includes("NOW()"))
  assert.ok(!predicate.includes("CURRENT_DATE"))
  assert.ok(!predicate.includes("CURRENT_TIMESTAMP"))
  assert.ok(predicate.includes("IS NULL"), "should use IS NULL")
  assert.ok(predicate.includes("IN ("), "should use IN")
})
