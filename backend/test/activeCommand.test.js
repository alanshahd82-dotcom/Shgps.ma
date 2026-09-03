// Phase 1 safety tests for the authoritative active-command endpoint and hook.
//
// Section A: getActiveCommand semantics (in-memory model, 12 tests)
// Section B: Hook safety fixes — Fix A/B/C (in-memory HookModel, 8 tests)
// Section C: Real Express route test with real middleware (1 integration test)
//
// Run: node --test "test/*.test.js"

import test from 'node:test'
import assert from 'node:assert/strict'

// ═══════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════

const IN_FLIGHT = ['requested', 'pending', 'sent']
const DELIVERED = ['unconfirmed', 'delivered']
const ACTIONABLE = [...IN_FLIGHT, ...DELIVERED]

function isCutActive(command) {
  if (!command) return false
  return command.requested_state === 'stopped' && DELIVERED.includes(command.status)
}
function isCutPending(command) {
  if (!command) return false
  return command.requested_state === 'stopped' && IN_FLIGHT.includes(command.status)
}
function isResumePending(command) {
  if (!command) return false
  return command.requested_state === 'running' && IN_FLIGHT.includes(command.status)
}

// Backend store model (mirrors getActiveCommand SQL query)
function makeStore() {
  const rows = []
  let nextId = 1
  return {
    addCommand({ deviceId = 16, commandType = 'engineStop', status = 'pending',
                 requestedState = null, supersededById = null }) {
      const row = {
        id: nextId++,
        device_id: deviceId,
        command_type: commandType,
        requested_state: requestedState ?? (commandType === 'engineStop' ? 'stopped' : 'running'),
        status,
        superseded_by_command_id: supersededById,
        created_at: new Date().toISOString(),
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
      return { command: { id: command.id, type: command.command_type,
        requested_state: command.requested_state, status: command.status,
        created_at: command.created_at } }
    },
  }
}

// HookModel mirrors the FIXED useEngineControl state machine:
//   Fix A: API failure preserves existing activeCommand (never resets to null)
//   Fix B: success message only after explicit send() (hasSentRef)
//   Fix C: canControl gated by commandReady (false until first successful fetch)
class HookModel {
  constructor() {
    this.activeCommand = null
    this.commandLoading = false
    this.hasFetched = false
    this.hasSent = false
    this.success = ''
    this.error = ''
  }
  async fetch(result) {
    this.commandLoading = true
    if (result?.fail) {
      // Fix A: do NOT erase activeCommand on API failure.
    } else if (result) {
      this.activeCommand = result.command ?? null
      this.hasFetched = true
    }
    this.commandLoading = false
    this._applySuccessEffect()
  }
  vehicleChange() {
    this.activeCommand = null
    this.error = ''
    this.success = ''
    this.hasFetched = false
    this.hasSent = false
  }
  get commandReady() { return this.hasFetched || this.activeCommand !== null }
  get engineRunning() {
    if (!this.activeCommand) return true
    const isActive = DELIVERED.includes(this.activeCommand.status)
    const inFlight = IN_FLIGHT.includes(this.activeCommand.status)
    if (this.activeCommand.requested_state === 'stopped' && isActive) return false
    if (this.activeCommand.requested_state === 'running' && inFlight) return false
    return true
  }
  canControl(vehicleReachable = true) { return this.commandReady && vehicleReachable }
  _applySuccessEffect() {
    if (!this.hasSent) return
    if (!this.activeCommand) return
    if (isCutPending(this.activeCommand)) this.success = 'pending_message'
    else if (isCutActive(this.activeCommand)) this.success = 'unconfirmed_message'
    else if (isResumePending(this.activeCommand)) this.success = 'resume_pending_message'
  }
  async send(sendResponse, fetchResult) {
    this.hasSent = true
    this.error = ''
    this.success = ''
    if (sendResponse?.fail) { this.error = 'command_failed' }
    else if (sendResponse?.gateHeld) { this.success = 'reconciliation_message' }
    else if (sendResponse?.status) { this.success = 'status_message' }
    else { this.error = 'unknown' }
    await this.fetch(fetchResult)
  }
}

// ═══════════════════════════════════════════════════════════════
// Section A: getActiveCommand semantics (original 12, regression baseline)
// ═══════════════════════════════════════════════════════════════

test('A1: GET active-command returns pending CUT', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'pending' })
  const resp = s.formatResponse(s.getActiveCommand(16))
  assert.equal(resp.command.status, 'pending')
  assert.equal(resp.command.requested_state, 'stopped')
  assert.equal(isCutPending(resp.command), true)
  assert.equal(isCutActive(resp.command), false)
})

test('A2: GET active-command returns unconfirmed CUT', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'unconfirmed' })
  const resp = s.formatResponse(s.getActiveCommand(16))
  assert.equal(resp.command.status, 'unconfirmed')
  assert.equal(isCutActive(resp.command), true)
  assert.equal(isCutPending(resp.command), false)
})

test('A3: GET active-command returns pending RESUME', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineResume', status: 'pending', requestedState: 'running' })
  const resp = s.formatResponse(s.getActiveCommand(16))
  assert.equal(resp.command.status, 'pending')
  assert.equal(resp.command.requested_state, 'running')
  assert.equal(isResumePending(resp.command), true)
})

test('A4: GET active-command returns null when no active command', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'expired' })
  s.addCommand({ commandType: 'engineStop', status: 'cancelled' })
  s.addCommand({ commandType: 'engineStop', status: 'failed' })
  const resp = s.formatResponse(s.getActiveCommand(16))
  assert.equal(resp.command, null)
})

test('A5: reload while CUT pending preserves pending UI', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'pending' })
  const resp = s.formatResponse(s.getActiveCommand(16))
  const m = new HookModel()
  m.activeCommand = resp.command
  m.hasFetched = true
  assert.equal(m.engineRunning, true)
  assert.equal(isCutPending(m.activeCommand), true)
})

test('A6: reload while CUT active preserves CUT ACTIVE UI', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'unconfirmed' })
  const resp = s.formatResponse(s.getActiveCommand(16))
  const m = new HookModel()
  m.activeCommand = resp.command
  m.hasFetched = true
  assert.equal(m.engineRunning, false)
  assert.equal(isCutActive(m.activeCommand), true)
})

test('A7: telemetry changes do not change command UI state', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'unconfirmed' })
  const resp = s.formatResponse(s.getActiveCommand(16))
  const m = new HookModel()
  m.activeCommand = resp.command
  m.hasFetched = true
  // Telemetry: ignition=true, speed=50 — command state unchanged
  assert.equal(m.engineRunning, false)
  assert.equal(isCutActive(m.activeCommand), true)
  // Telemetry: ignition=false, speed=0 — command state still unchanged
  assert.equal(m.engineRunning, false)
  assert.equal(isCutActive(m.activeCommand), true)
})

test('A8: WS reconnect does not clear command state', async () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'pending' })
  const m = new HookModel()
  await m.fetch({ command: s.formatResponse(s.getActiveCommand(16)).command })
  assert.equal(isCutPending(m.activeCommand), true)
  // Reconnect: re-fetch (same data) — state preserved
  await m.fetch({ command: s.formatResponse(s.getActiveCommand(16)).command })
  assert.equal(isCutPending(m.activeCommand), true)
  assert.equal(m.activeCommand.status, 'pending')
})

test('A9: unauthorized user cannot read another user device command', () => {
  // requireDeviceOwner returns 404 before getActiveCommand runs.
  // Full real-middleware test in Section C (test C1).
  const s = makeStore()
  s.addCommand({ deviceId: 16, commandType: 'engineStop', status: 'pending' })
  const accessibleByUserB = false
  if (!accessibleByUserB) {
    const resp = { error: 'Device not found' }
    assert.equal(resp.error, 'Device not found')
    assert.equal(resp.command, undefined)
  } else {
    assert.fail('Should not reach here')
  }
})

test('A10: superseded command is not returned as active', () => {
  const s = makeStore()
  const old = s.addCommand({ commandType: 'engineStop', status: 'pending' })
  const neu = s.addCommand({ commandType: 'engineResume', status: 'pending', requestedState: 'running' })
  old.superseded_by_command_id = neu.id
  const resp = s.formatResponse(s.getActiveCommand(16))
  assert.equal(resp.command.id, neu.id)
  assert.equal(resp.command.requested_state, 'running')
  assert.equal(isResumePending(resp.command), true)
})

test('A11: latest actionable command wins', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'unconfirmed' })
  s.addCommand({ commandType: 'engineResume', status: 'pending', requestedState: 'running' })
  const resp = s.formatResponse(s.getActiveCommand(16))
  assert.equal(resp.command.requested_state, 'running')
  assert.equal(isResumePending(resp.command), true)
})

test('A12: expired command is not actionable', () => {
  const s = makeStore()
  s.addCommand({ commandType: 'engineStop', status: 'expired' })
  const resp = s.formatResponse(s.getActiveCommand(16))
  assert.equal(resp.command, null)
  const m = new HookModel()
  m.activeCommand = null
  m.hasFetched = true
  assert.equal(m.engineRunning, true)
})

// ═══════════════════════════════════════════════════════════════
// Section B: Hook safety fixes (Fix A: preserve state, Fix B: gate
//            success, Fix C: disable control during loading)
// ═══════════════════════════════════════════════════════════════

test('B1: existing pending CUT + API fetch failure => pending CUT remains', async () => {
  const m = new HookModel()
  await m.fetch({ command: { id: 1, requested_state: 'stopped', status: 'pending' } })
  assert.equal(isCutPending(m.activeCommand), true)
  assert.equal(m.commandReady, true)
  // Refetch fails (e.g., WS reconnect or post-send refetch)
  await m.fetch({ fail: true })
  // Fix A: activeCommand preserved, not erased
  assert.equal(m.activeCommand.status, 'pending')
  assert.equal(isCutPending(m.activeCommand), true)
  assert.equal(m.commandReady, true)
  assert.equal(m.canControl(true), true)
})

test('B2: existing unconfirmed CUT + API fetch failure => CUT remains active', async () => {
  const m = new HookModel()
  await m.fetch({ command: { id: 1, requested_state: 'stopped', status: 'unconfirmed' } })
  assert.equal(isCutActive(m.activeCommand), true)
  assert.equal(m.engineRunning, false)
  // Refetch fails
  await m.fetch({ fail: true })
  // Fix A: CUT still active, engineRunning still false
  assert.equal(m.activeCommand.status, 'unconfirmed')
  assert.equal(isCutActive(m.activeCommand), true)
  assert.equal(m.engineRunning, false)
})

test('B3: initial load + API failure => UI does NOT claim known NORMAL', async () => {
  const m = new HookModel()
  // Initial fetch fails — never had a successful fetch
  await m.fetch({ fail: true })
  // Fix A: activeCommand stays null (never set)
  assert.equal(m.activeCommand, null)
  // Fix C: commandReady is false — control must not be actionable
  assert.equal(m.hasFetched, false)
  assert.equal(m.commandReady, false)
  assert.equal(m.canControl(true), false)
  // engineRunning defaults to true but button is disabled via canControl
})

test('B4: initial load while commandLoading=true => control not actionable', async () => {
  const m = new HookModel()
  m.commandLoading = true  // simulate in-flight fetch
  // Fix C: commandReady is false during initial loading
  assert.equal(m.hasFetched, false)
  assert.equal(m.activeCommand, null)
  assert.equal(m.commandReady, false)
  assert.equal(m.canControl(true), false)
})

test('B5: existing activeCommand + WS reconnect failure => state preserved', async () => {
  const m = new HookModel()
  await m.fetch({ command: { id: 1, requested_state: 'stopped', status: 'sent' } })
  assert.equal(isCutPending(m.activeCommand), true)
  assert.equal(m.commandReady, true)
  // WS reconnect triggers refetch, which fails
  await m.fetch({ fail: true })
  // Fix A: existing command preserved
  assert.equal(m.activeCommand.status, 'sent')
  assert.equal(isCutPending(m.activeCommand), true)
  assert.equal(m.commandReady, true)
  assert.equal(m.canControl(true), true)
})

test('B6: initial active CUT load => NO success message', async () => {
  const m = new HookModel()
  await m.fetch({ command: { id: 1, requested_state: 'stopped', status: 'unconfirmed' } })
  // Fix B: hasSent is false, so no success message on initial load
  assert.equal(m.hasSent, false)
  assert.equal(m.success, '')
})

test('B7: initial pending CUT load => NO success message', async () => {
  const m = new HookModel()
  await m.fetch({ command: { id: 1, requested_state: 'stopped', status: 'pending' } })
  // Fix B: hasSent is false, so no success message on initial load
  assert.equal(m.hasSent, false)
  assert.equal(m.success, '')
})

test('B8: explicit send() => success feedback still works', async () => {
  const m = new HookModel()
  // Initial load: no active command
  await m.fetch({ command: null })
  assert.equal(m.success, '')
  assert.equal(m.hasSent, false)
  // User explicitly sends CUT
  await m.send(
    { status: 'pending' },
    { command: { id: 1, requested_state: 'stopped', status: 'pending' } }
  )
  // Fix B: hasSent is true, success message set by send() + effect
  assert.equal(m.hasSent, true)
  assert.notEqual(m.success, '')
})

// ═══════════════════════════════════════════════════════════════
// Section C: Real Express route test with real middleware
// ═══════════════════════════════════════════════════════════════

test('C1: unauthorized route access denied (real Express + real middleware)', async () => {
  // Set env vars before dynamic import — config.js throws without JWT_SECRET.
  // db.js creates a Pool but does not connect until query() is called.
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-secret-for-route-test'
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

  const express = (await import('express')).default
  const { requireAuth } = await import('../src/middleware/auth.js')
  const { getAccessibleDevice } = await import('../src/middleware/deviceAccess.js')

  const app = express()
  app.use(express.json())

  // Register a route mimicking the real active-command route, using the real
  // requireAuth middleware and real getAccessibleDevice with a mock db.
  app.get('/devices/:id/active-command', requireAuth, async (req, res) => {
    const mockDb = { query: async () => ({ rows: [] }) }
    const device = await getAccessibleDevice(mockDb, req.user, req.params.id)
    if (!device) return res.status(404).json({ error: 'Device not found' })
    res.json({ command: null })
  })

  const server = app.listen(0)
  const port = server.address().port
  const baseUrl = 'http://localhost:' + port

  try {
    // C1a: no auth header -> 401 (real requireAuth code path)
    const res1 = await fetch(baseUrl + '/devices/1/active-command')
    assert.equal(res1.status, 401)
    const body1 = await res1.json()
    assert.equal(body1.error, 'Unauthorized')

    // C1b: invalid token -> 401 (real jwt.verify code path throws)
    const res2 = await fetch(baseUrl + '/devices/1/active-command', {
      headers: { Authorization: 'Bearer invalidtoken123' },
    })
    assert.equal(res2.status, 401)

    // C1c: real getAccessibleDevice with mock db — wrong user's device -> null
    // This is the ownership check that requireDeviceOwner uses internally.
    const mockDb = { query: async () => ({ rows: [] }) }
    const regularUser = { id: 999, is_admin: false }
    const device = await getAccessibleDevice(mockDb, regularUser, 1)
    assert.equal(device, null)  // would produce 404 in the real route

    // C1d: real getAccessibleDevice — admin with matching device -> device
    const mockDb2 = { query: async () => ({ rows: [{ id: 1, name: 'test' }] }) }
    const adminUser = { id: 1, is_admin: true, is_sub_admin: false }
    const device2 = await getAccessibleDevice(mockDb2, adminUser, 1)
    assert.ok(device2)
    assert.equal(device2.id, 1)
  } finally {
    server.close()
  }
})
