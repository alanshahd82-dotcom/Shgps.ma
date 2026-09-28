// The tracker answers an engine command with a text in the position attribute
// `result`. Texts seen in production (GT06 fleet):
//   "Cut off the fuel supply: Success!"
//   "Restore fuel supply: Success!"
//   "Already in the state of fuel supply to resume, The command is not running!"
//   "GPS not fixed, Cut off the fuel supply operation delay execution!"
// This module only READS and classifies that text. It never changes a command.

const MAX_TEXT = 200

/** Classify one device reply text. Unknown texts are reported as 'unknown'. */
export function classifyDeviceReply(text) {
  const raw = typeof text === 'string' ? text.trim().slice(0, MAX_TEXT) : ''
  if (!raw) return null
  const lower = raw.toLowerCase()
  const kind = /restore|resume/.test(lower) ? 'resume' : /cut off|cut-off|stop/.test(lower) ? 'cut' : null
  let outcome = 'unknown'
  if (/gps not fixed|delay execution|delayed/.test(lower)) outcome = 'delayed_no_gps'
  else if (/already in the state|not running/.test(lower)) outcome = 'already'
  else if (/success/.test(lower)) outcome = 'success'
  else if (/fail|error|not support|invalid/.test(lower)) outcome = 'failed'
  return { outcome, kind, text: raw }
}

function positionTime(position) {
  const t = Date.parse(position?.deviceTime || position?.serverTime || position?.fixTime || '')
  return Number.isFinite(t) ? t : null
}

/**
 * The newest device reply that arrived at or after the command was created and
 * belongs to the same kind of command (a cut reply never answers a resume).
 * `positions` are Traccar positions (any order). Returns null when none.
 */
export function findDeviceReply(positions, command) {
  if (!Array.isArray(positions) || !command) return null
  const createdAt = Date.parse(command.created_at)
  if (!Number.isFinite(createdAt)) return null
  const wanted = command.requested_state === 'running' ? 'resume' : command.requested_state === 'stopped' ? 'cut' : null
  let best = null
  for (const position of positions) {
    const reply = classifyDeviceReply(position?.attributes?.result)
    if (!reply) continue
    const at = positionTime(position)
    if (at == null || at < createdAt - 5000) continue
    if (reply.kind && wanted && reply.kind !== wanted) continue
    if (!best || at > best.at) best = { ...reply, at }
  }
  return best ? { outcome: best.outcome, kind: best.kind, text: best.text, at: new Date(best.at).toISOString() } : null
}
