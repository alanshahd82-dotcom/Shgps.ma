// Phase 2I policy tests for the engine-command TTL expiration (Stage 3).
//
// Deterministic POLICY tests against an in-memory model that mirrors the
// semantics of backend/src/services/engineCommands.js Stage 3. They do NOT
// import the real module (which depends on postgres + Traccar) and they NEVER
// send a real engine command. Run: node backend/test/engineTtl.test.js
//
// Invariants verified:
//  - A pending command older than COMMAND_TTL_MS is expired (terminal state).
//  - A pending command newer than TTL is NOT expired (stays pending).
//  - A superseded command (superseded_by_command_id IS NOT NULL) is NOT expired
//    even if older than TTL — it is already replaced, not stale.
//  - A non-pending command (sent/delivered/unconfirmed) is NOT expired.
//  - An expired command is terminal: it is never delivered even if the device
//    reconnects and the poll worker runs.

let passed = 0
let failed = 0
function assert(cond, name) {
  if (cond) { passed++; console.log('  ok - ' + name) }
  else { failed++; console.error('  FAIL - ' + name) }
}

const COMMAND_TTL_MS = Number(process.env.ENGINE_COMMAND_TTL_MS || 24 * 60 * 60 * 1000) // 24h default

function makeStore() {
  const db = { rows: [], nextId: 1 }
  const traccar = { sent: [] }

  // Mirrors Stage 3: expire pending commands older than TTL.
  // SQL: UPDATE engine_commands SET status='expired', updated_at=NOW(),
  //      resolved_at=NOW() WHERE status='pending' AND superseded_by_command_id
  //      IS NULL AND created_at < $1
  async function expireStaleCommands(now = Date.now()) {
    const cutoff = new Date(now - COMMAND_TTL_MS)
    let expired = 0
    for (const row of db.rows) {
      if (row.status === 'pending' &&
          row.superseded_by_command_id == null &&
          new Date(row.created_at) < cutoff) {
        row.status = 'expired'
        row.updated_at = new Date(now).toISOString()
        row.resolved_at = new Date(now).toISOString()
        expired++
      }
    }
    return expired
  }

  // Mirrors the delivery gate: only pending, non-superseded commands are delivered.
  async function deliverPending(now = Date.now()) {
    let delivered = 0
    for (const row of db.rows) {
      if (row.status === 'pending' && row.superseded_by_command_id == null) {
        traccar.sent.push({ deviceId: row.device_id, type: row.command_type })
        row.status = 'sent'
        delivered++
      }
    }
    return delivered
  }

  function addCommand({ deviceId = 16, commandType = 'engineStop', status = 'pending',
                        createdAt = Date.now(), supersededById = null }) {
    const row = {
      id: db.nextId++,
      device_id: deviceId,
      command_type: commandType,
      requested_state: commandType === 'engineStop' ? 'stopped' : 'running',
      status: status,
      traccar_command_id: null,
      superseded_by_command_id: supersededById,
      cancellation_state: null,
      created_at: new Date(createdAt).toISOString(),
      updated_at: new Date(createdAt).toISOString(),
      resolved_at: null,
    }
    db.rows.push(row)
    return row
  }

  return { db, traccar, expireStaleCommands, deliverPending, addCommand }
}

async function main() {
  // 1. Pending command older than TTL → expired
  {
    const s = makeStore()
    const old = s.addCommand({ createdAt: Date.now() - COMMAND_TTL_MS - 60000 }) // 1min past TTL
    const expired = await s.expireStaleCommands()
    assert(expired === 1, '1: one stale command expired')
    assert(old.status === 'expired', '1: old command status is expired')
    assert(old.resolved_at != null, '1: resolved_at set')
  }

  // 2. Pending command newer than TTL → NOT expired
  {
    const s = makeStore()
    const fresh = s.addCommand({ createdAt: Date.now() - 1000 }) // 1s old
    const expired = await s.expireStaleCommands()
    assert(expired === 0, '2: no fresh commands expired')
    assert(fresh.status === 'pending', '2: fresh command still pending')
  }

  // 3. Superseded command older than TTL → NOT expired
  {
    const s = makeStore()
    const old = s.addCommand({ createdAt: Date.now() - COMMAND_TTL_MS - 60000 })
    const neu = s.addCommand({ createdAt: Date.now() })
    old.superseded_by_command_id = neu.id
    const expired = await s.expireStaleCommands()
    assert(expired === 0, '3: superseded command not expired')
    assert(old.status === 'pending', '3: superseded command stays pending (history)')
  }

  // 4. Non-pending command (sent) older than TTL → NOT expired
  {
    const s = makeStore()
    const sent = s.addCommand({ status: 'sent', createdAt: Date.now() - COMMAND_TTL_MS - 60000 })
    const expired = await s.expireStaleCommands()
    assert(expired === 0, '4: sent command not expired')
    assert(sent.status === 'sent', '4: sent command stays sent')
  }

  // 5. Expired command is terminal — never delivered
  {
    const s = makeStore()
    const old = s.addCommand({ createdAt: Date.now() - COMMAND_TTL_MS - 60000 })
    await s.expireStaleCommands()
    assert(old.status === 'expired', '5a: command expired')
    const delivered = await s.deliverPending()
    assert(delivered === 0, '5b: expired command not delivered')
    assert(s.traccar.sent.length === 0, '5c: nothing sent to Traccar')
  }

  // 6. Mixed: old expired, fresh delivered
  {
    const s = makeStore()
    const old = s.addCommand({ createdAt: Date.now() - COMMAND_TTL_MS - 60000 })
    const fresh = s.addCommand({ createdAt: Date.now() - 1000 })
    const expired = await s.expireStaleCommands()
    assert(expired === 1, '6a: only old command expired')
    assert(old.status === 'expired', '6b: old is expired')
    assert(fresh.status === 'pending', '6c: fresh still pending')
    const delivered = await s.deliverPending()
    assert(delivered === 1, '6d: only fresh command delivered')
    assert(s.traccar.sent.length === 1, '6e: exactly one command sent to Traccar')
  }

  // 7. Exactly at TTL boundary → NOT expired (created_at < cutoff, not <=)
  {
    const s = makeStore()
    const boundary = s.addCommand({ createdAt: Date.now() - COMMAND_TTL_MS + 1000 }) // 1s before TTL
    const expired = await s.expireStaleCommands()
    assert(expired === 0, '7: command just before TTL not expired')
    assert(boundary.status === 'pending', '7: boundary command still pending')
  }

  console.log(`\nTTL policy tests: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
