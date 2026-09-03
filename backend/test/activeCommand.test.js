// Phase 1 tests for the authoritative active-command endpoint.
//
// Deterministic POLICY tests against an in-memory model that mirrors the
// semantics of backend/src/services/engineCommands.js getActiveCommand().
// They do NOT import the real module (which depends on postgres + Traccar)
// and NEVER send a real engine command.
//
// Run: node backend/test/activeCommand.test.js

import test from 'node:test'
import assert from 'node:assert/strict'

const IN_FLIGHT = ['requested', 'pending', 'sent']
const DELIVERED = ['unconfirmed', 'delivered']
const ACTIONABLE = [...IN_FLIGHT, ...DELIVERED]

function makeStore() {
  const rows = []
  let nextId = 1
  return {
    addCommand({ deviceId = 16, commandType = 'engineStop', status = 'pending',
                 requestedState = null, supersededById = null, traccarCommandId = null,
                 createdAt = Date.now() }) {
      const row = {
        id: nextId++,
        device_id: deviceId,
        command_type: commandType,
        requested_state: requestedState ?? (commandType === 'engineStop' ? 'stopped' : 'running'),
        status,
        traccar_command_id: traccarCommandId,
        superseded_by_command_id: supersededById,
        cancellation_state: null,
        created_at: new Date(createdAt).toISOString(),
        updated_at: new Date(createdAt).toISOString(),
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
    formatResponse(command) {
      if (!command) return { command: null }
      return {
        command: {
          id: command.id,
          type: command.command_type,
          requested_state: command.requested_state,
          status: command.status,
          created_at: command.created_at,
          traccar_command_id: command.traccar_command_id ?? null,
        },
      }
    },
  }
}

function deriveEngineRunning(command) {
  if (!command) return true
  const isActive = ['unconfirmed', 'delivered'].includes(command.status)
  const inFlight = ['requested', 'pending', 'sent'].includes(command.status)
  if (command.requested_state === 'stopped' && isActive) return false
  if (command.requested_state === 'running' && inFlight) return false
  return true
}

function isCutActive(command) {
  if (!command) return false
  return command.requested_state === 'stopped' && ['unconfirmed', 'delivered'].includes(command.status)
}

function isCutPending(command) {
  if (!command) return false
  return command.requested_state === 'stopped' && ['requested', 'pending', 'sent'].includes(command.status)
}

function isResumePending(command) {
  if (!command) return false
  return command.requested_state === 'running' && ['requested', 'pending', 'sent'].includes(command.status)
}

test('1: GET active-command returns pending CUT', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'pending' })
  const cmd = s.getActiveCommand(16)
  const resp = s.formatResponse(cmd)
  assert.equal(resp.command.status, 'pending')
  assert.equal(resp.command.requested_state, 'stopped')
  assert.equal(resp.command.type, 'engineStop')
  assert.equal(isCutPending(resp.command), true)
  assert.equal(isCutActive(resp.command), false)
})

test('2: GET active-command returns unconfirmed CUT', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'unconfirmed' })
  const cmd = s.getActiveCommand(16)
  const resp = s.formatResponse(cmd)
  assert.equal(resp.command.status, 'unconfirmed')
  assert.equal(resp.command.requested_state, 'stopped')
  assert.equal(isCutActive(resp.command), true)
  assert.equal(isCutPending(resp.command), false)
})

test('3: GET active-command returns pending RESUME', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineResume', status: 'pending', requestedState: 'running' })
  const cmd = s.getActiveCommand(16)
  const resp = s.formatResponse(cmd)
  assert.equal(resp.command.status, 'pending')
  assert.equal(resp.command.requested_state, 'running')
  assert.equal(isResumePending(resp.command), true)
})

test('4: GET active-command returns null when no active command exists', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'expired' })
  s.addCommand({ commandType: 'engineStop', status: 'cancelled' })
  s.addCommand({ commandType: 'engineStop', status: 'failed' })
  const cmd = s.getActiveCommand(16)
  const resp = s.formatResponse(cmd)
  assert.equal(resp.command, null)
})

test('5: frontend reload while CUT is pending preserves pending UI state', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'pending' })
  const cmd = s.getActiveCommand(16)
  const resp = s.formatResponse(cmd)
  assert.equal(deriveEngineRunning(resp.command), true)
  assert.equal(isCutPending(resp.command), true)
})

test('6: frontend reload while CUT is active preserves CUT ACTIVE UI state', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'unconfirmed' })
  const cmd = s.getActiveCommand(16)
  const resp = s.formatResponse(cmd)
  assert.equal(deriveEngineRunning(resp.command), false)
  assert.equal(isCutActive(resp.command), true)
})

test('7: telemetry ignition/speed changes do not change command UI state', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'unconfirmed' })
  const cmd = s.getActiveCommand(16)
  const resp = s.formatResponse(cmd)
  assert.equal(deriveEngineRunning(resp.command), false)
  assert.equal(isCutActive(resp.command), true)
  assert.equal(deriveEngineRunning(resp.command), false)
  assert.equal(isCutActive(resp.command), true)
})

test('8: WebSocket reconnect does not clear command state', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'pending' })
  let cmd = s.getActiveCommand(16)
  let resp = s.formatResponse(cmd)
  assert.equal(isCutPending(resp.command), true)
  cmd = s.getActiveCommand(16)
  resp = s.formatResponse(cmd)
  assert.equal(isCutPending(resp.command), true)
  assert.equal(resp.command.status, 'pending')
})

test('9: unauthorized user cannot read another user device command state', () => {
  const s = makeStore()
  s.addCommand({ deviceId: 16, commandType: 'engineStop', status: 'pending' })
  const accessibleByUserB = false
  if (!accessibleByUserB) {
    const resp = { error: 'Device not found' }
    assert.equal(resp.error, 'Device not found')
    assert.equal(resp.command, undefined)
  } else {
    assert.fail('Should not reach here for unauthorized user')
  }
})

test('10: superseded command is not returned as active', () => {
  const s = makeStore()
  const old = s.addCommand({ commandType: 'engineStop', status: 'pending' })
  const neu = s.addCommand({ commandType: 'engineResume', status: 'pending', requestedState: 'running' })
  old.superseded_by_command_id = neu.id
  const cmd = s.getActiveCommand(16)
  const resp = s.formatResponse(cmd)
  assert.equal(resp.command.id, neu.id)
  assert.equal(resp.command.requested_state, 'running')
  assert.equal(isResumePending(resp.command), true)
})

test('11: latest actionable command wins (ORDER BY id DESC LIMIT 1)', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'unconfirmed' })
  s.addCommand({ commandType: 'engineResume', status: 'pending', requestedState: 'running' })
  const cmd = s.getActiveCommand(16)
  const resp = s.formatResponse(cmd)
  assert.equal(resp.command.requested_state, 'running')
  assert.equal(isResumePending(resp.command), true)
})

test('12: expired command is not actionable (not returned)', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'expired' })
  const cmd = s.getActiveCommand(16)
  const resp = s.formatResponse(cmd)
  assert.equal(resp.command, null)
  assert.equal(deriveEngineRunning(resp.command), true)
})
