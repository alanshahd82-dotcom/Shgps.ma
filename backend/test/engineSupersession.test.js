// Phase 2F policy tests for the engine-command supersession + cancellation gate.
//
// Deterministic POLICY tests against an in-memory model that mirrors the
// semantics of backend/src/services/engineCommands.js. They do NOT import the
// real module (which depends on postgres + Traccar) and they NEVER send a real
// engine command. Run: node backend/test/engineSupersession.test.js
//
// Invariants verified:
//  - A new explicit opposite command supersedes the old; the old is never
//    discarded (it remains as immutable history with superseded_by set).
//  - A new command is NOT sent to Traccar while an old QUEUED_LIVE command
//    still exists for the device (the gate is held).
//  - The gate releases only after the old queued command is confirmed
//    cancelled (204) or not currently queued (404). 5xx holds the gate.
//  - 'unconfirmed' (tid=0, sent-direct) does NOT block a new opposite command.
//  - No automatic restore is ever issued.

let passed = 0
let failed = 0
function assert(cond, name) {
  if (cond) { passed++; console.log('  ok - ' + name) }
  else { failed++; console.error('  FAIL - ' + name) }
}

const ACTIONABLE = ['requested','pending','sent','unconfirmed','delivered']

function makeStore() {
  const traccar = { queue: new Map(), cancelResult: null, sent: [], online: false }
  traccar.cancelQueuedCommand = async function (tid) {
    if (this.cancelResult === 'throw') throw Object.assign(new Error('500'), { status: 500 })
    if (this.cancelResult === 404) throw Object.assign(new Error('404'), { status: 404 })
    this.queue.delete(tid)
    return null // 204
  }
  traccar.sendCommand = async function (deviceId, type) {
    this.sent.push({ deviceId, type })
    if (this.online) return { id: 0 }
    const id = Math.floor(Math.random() * 1e6) + 1
    this.queue.set(id, { deviceId, type })
    return { id }
  }
  const db = { rows: [], nextId: 1 }
  function isQueuedLive(cmd){ return cmd && cmd.status === 'pending' && cmd.traccar_command_id > 0 }
  async function getLatestCurrent(deviceId){
    const rows = db.rows.filter(r => r.device_id === deviceId && r.superseded_by_command_id == null && ACTIONABLE.includes(r.status))
    return rows.length ? rows[rows.length - 1] : null
  }
  async function attemptCancellation(old){
    if (!old || !old.traccar_command_id || old.traccar_command_id <= 0) return
    try { await traccar.cancelQueuedCommand(old.traccar_command_id); old.cancellation_state = 'confirmed' }
    catch (e) { if (e.status === 404) { old.cancellation_state = 'confirmed' } else { old.cancellation_state = 'pending' } }
  }
  async function createRequest({ deviceId, commandType, online = false }){
    traccar.online = online
    const requestedState = commandType === 'engineStop' ? 'stopped' : 'running'
    const latest = await getLatestCurrent(deviceId)
    if (latest && latest.requested_state === requestedState && ACTIONABLE.includes(latest.status)) return latest
    const newCmd = { id: db.nextId++, device_id: deviceId, command_type: commandType, requested_state: requestedState, status: 'pending', traccar_command_id: null, superseded_by_command_id: null, cancellation_state: null }
    db.rows.push(newCmd)
    let wasQueuedLive = false
    if (latest) {
      latest.superseded_by_command_id = newCmd.id
      wasQueuedLive = isQueuedLive(latest)
      if (wasQueuedLive) latest.cancellation_state = 'pending'
    }
    if (wasQueuedLive) await attemptCancellation(latest)
    newCmd.gateHeld = wasQueuedLive
    return newCmd
  }
  async function deliverOnce(cmd, online = false){
    traccar.online = online
    const gated = db.rows.some(r => r.device_id === cmd.device_id && r.cancellation_state === 'pending' && r.traccar_command_id > 0)
    if (gated) return cmd
    if (cmd.superseded_by_command_id != null) return cmd
    if (cmd.traccar_command_id != null) return cmd
    const res = await traccar.sendCommand(cmd.device_id, cmd.command_type)
    if (res.id > 0) { cmd.traccar_command_id = res.id; cmd.status = 'pending' }
    else { cmd.traccar_command_id = res.id; cmd.status = 'unconfirmed' }
    return cmd
  }
  return { db, traccar, createRequest, deliverOnce, attemptCancellation, getLatestCurrent }
}

async function main() {
  // 1. old queued RESUME + new STOP (online). Old must be cancelled before new sent.
  {
    const s = makeStore()
    const old = await s.createRequest({ deviceId: 16, commandType: 'engineResume', online: false })
    await s.deliverOnce(old, false)
    assert(old.traccar_command_id > 0, '1: old RESUME queued in Traccar')
    s.traccar.cancelResult = null
    const neu = await s.createRequest({ deviceId: 16, commandType: 'engineStop', online: true })
    assert(old.superseded_by_command_id === neu.id, '1: old superseded by new')
    assert(old.cancellation_state === 'confirmed', '1: old cancellation confirmed (204)')
    assert(!s.traccar.queue.has(old.traccar_command_id), '1: old removed from Traccar queue')
    await s.deliverOnce(neu, true)
    assert(s.traccar.sent.some(x => x.deviceId === 16 && x.type === 'engineStop'), '1: new STOP sent to Traccar')
  }
  // 2. DELETE 204
  {
    const s = makeStore()
    const old = await s.createRequest({ deviceId: 1, commandType: 'engineStop', online: false })
    await s.deliverOnce(old, false)
    s.traccar.cancelResult = null
    const neu = await s.createRequest({ deviceId: 1, commandType: 'engineResume', online: true })
    assert(old.cancellation_state === 'confirmed', '2: 204 -> confirmed')
    assert(!s.traccar.queue.has(old.traccar_command_id), '2: queued command removed')
  }
  // 3. DELETE 404
  {
    const s = makeStore()
    const old = await s.createRequest({ deviceId: 1, commandType: 'engineStop', online: false })
    await s.deliverOnce(old, false)
    s.traccar.cancelResult = 404
    const neu = await s.createRequest({ deviceId: 1, commandType: 'engineResume', online: true })
    assert(old.cancellation_state === 'confirmed', '3: 404 -> confirmed (not currently queued)')
  }
  // 4. DELETE 500 -> gate held, new NOT sent
  {
    const s = makeStore()
    const old = await s.createRequest({ deviceId: 1, commandType: 'engineStop', online: false })
    await s.deliverOnce(old, false)
    s.traccar.cancelResult = 'throw'
    const neu = await s.createRequest({ deviceId: 1, commandType: 'engineResume', online: true })
    assert(old.cancellation_state === 'pending', '4: 5xx -> gate stays pending')
    assert(neu.status === 'pending' && neu.traccar_command_id == null, '4: new command NOT sent to Traccar')
    await s.deliverOnce(neu, true)
    assert(!s.traccar.sent.some(x => x.type === 'engineResume'), '4: no RESUME sent while gate held')
  }
  // 5. crash after COMMIT before DELETE -> worker reconciles
  {
    const s = makeStore()
    const old = await s.createRequest({ deviceId: 1, commandType: 'engineStop', online: false })
    await s.deliverOnce(old, false)
    // simulate: supersede happens, but cancellation NOT attempted (crash)
    const neu = { id: s.db.nextId++, device_id: 1, command_type: 'engineResume', requested_state: 'running', status: 'pending', traccar_command_id: null, superseded_by_command_id: null, cancellation_state: null }
    s.db.rows.push(neu)
    old.superseded_by_command_id = neu.id
    old.cancellation_state = 'pending' // persisted before DELETE
    assert(old.cancellation_state === 'pending', '5: cancellation_state persisted before DELETE')
    // worker reconciliation: now cancellation succeeds
    s.traccar.cancelResult = null
    await s.attemptCancellation(old)
    assert(old.cancellation_state === 'confirmed', '5: worker reconciled cancellation')
    await s.deliverOnce(neu, true)
    assert(s.traccar.sent.some(x => x.type === 'engineResume'), '5: new sent after reconciliation')
  }
  // 6. crash after DELETE before DB confirm -> next retry 404 -> confirmed
  {
    const s = makeStore()
    const old = await s.createRequest({ deviceId: 1, commandType: 'engineStop', online: false })
    await s.deliverOnce(old, false)
    s.traccar.queue.delete(old.traccar_command_id) // DELETE succeeded (crash before DB update)
    old.cancellation_state = 'pending' // DB still says pending
    s.traccar.cancelResult = 404 // retry: already gone
    await s.attemptCancellation(old)
    assert(old.cancellation_state === 'confirmed', '6: 404 on retry -> confirmed (converges)')
  }
  // 7. worker vs createRequest race: deliverOnce re-checks superseded
  {
    const s = makeStore()
    const old = await s.createRequest({ deviceId: 1, commandType: 'engineStop', online: false })
    await s.deliverOnce(old, false)
    // new supersedes old (cancellation succeeds)
    s.traccar.cancelResult = null
    const neu = await s.createRequest({ deviceId: 1, commandType: 'engineResume', online: true })
    // now a stale worker tries to deliver old again
    const before = s.traccar.sent.length
    await s.deliverOnce(old, true)
    assert(s.traccar.sent.length === before, '7: superseded old NOT re-sent by worker')
  }
  // 8. reconnect during cancellation -> 204 or 404 both release gate
  {
    const s = makeStore()
    const old = await s.createRequest({ deviceId: 1, commandType: 'engineStop', online: false })
    await s.deliverOnce(old, false)
    s.traccar.cancelResult = 404 // old already fired on reconnect
    const neu = await s.createRequest({ deviceId: 1, commandType: 'engineResume', online: true })
    assert(old.cancellation_state === 'confirmed', '8: reconnect-during-cancel resolves')
    await s.deliverOnce(neu, true)
    assert(s.traccar.sent.some(x => x.type === 'engineResume'), '8: new sent after reconnect')
  }
  // 9. two users opposite commands -> last write wins, both recorded
  {
    const s = makeStore()
    const a = await s.createRequest({ deviceId: 1, commandType: 'engineStop', online: true })
    const b = await s.createRequest({ deviceId: 1, commandType: 'engineResume', online: true })
    assert(a.superseded_by_command_id === b.id, '9: first superseded by second')
    const latest = await s.getLatestCurrent(1)
    assert(latest.id === b.id, '9: latest intent is second command')
  }
  // 10. two tabs opposite commands -> last write wins
  {
    const s = makeStore()
    const a = await s.createRequest({ deviceId: 1, commandType: 'engineStop', online: true })
    const b = await s.createRequest({ deviceId: 1, commandType: 'engineResume', online: true })
    assert(a.superseded_by_command_id === b.id, '10: tab1 superseded by tab2')
    assert(b.superseded_by_command_id == null, '10: tab2 is current intent')
  }
  // Bonus: command #1 semantics -- unconfirmed tid=0 does NOT block new STOP
  {
    const s = makeStore()
    const c1 = { id: s.db.nextId++, device_id: 16, command_type: 'engineResume', requested_state: 'running', status: 'unconfirmed', traccar_command_id: 0, superseded_by_command_id: null, cancellation_state: null }
    s.db.rows.push(c1)
    const neu = await s.createRequest({ deviceId: 16, commandType: 'engineStop', online: true })
    assert(c1.superseded_by_command_id === neu.id, '#1: unconfirmed tid=0 superseded naturally')
    assert(neu.gateHeld === false, '#1: no gate for unconfirmed tid=0 (not QUEUED_LIVE)')
    await s.deliverOnce(neu, true)
    assert(s.traccar.sent.some(x => x.type === 'engineStop'), '#1: STOP sent immediately (no deadlock)')
  }

  console.log('\\n' + passed + ' passed, ' + failed + ' failed')
  if (failed > 0) process.exitCode = 1
}

main().catch(e => { console.error(e); process.exitCode = 1 })
