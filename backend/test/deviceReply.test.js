import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyDeviceReply, findDeviceReply } from '../src/services/deviceReply.js'

test('classifies the real tracker replies', () => {
  assert.deepEqual(classifyDeviceReply('Cut off the fuel supply: Success!'), { outcome: 'success', kind: 'cut', text: 'Cut off the fuel supply: Success!' })
  assert.equal(classifyDeviceReply('Restore fuel supply: Success!').kind, 'resume')
  assert.equal(classifyDeviceReply('Restore fuel supply: Success!').outcome, 'success')
  assert.equal(classifyDeviceReply('Already in the state of fuel supply to resume, The command is not running!').outcome, 'already')
  const delayed = classifyDeviceReply('GPS not fixed, Cut off the fuel supply operation delay execution!')
  assert.equal(delayed.outcome, 'delayed_no_gps')
  assert.equal(delayed.kind, 'cut')
})

test('empty or non-text replies are ignored, unknown text is unknown', () => {
  assert.equal(classifyDeviceReply(undefined), null)
  assert.equal(classifyDeviceReply(''), null)
  assert.equal(classifyDeviceReply(42), null)
  assert.equal(classifyDeviceReply('hello').outcome, 'unknown')
})

const cmd = { created_at: '2026-09-28T10:00:00.000Z', requested_state: 'stopped' }
const p = (time, result) => ({ deviceTime: time, attributes: result === undefined ? {} : { result } })

test('only a reply after the command and of the same kind counts', () => {
  const positions = [
    p('2026-09-28T09:00:00.000Z', 'Cut off the fuel supply: Success!'), // before the command
    p('2026-09-28T10:00:30.000Z', 'Restore fuel supply: Success!'),     // other kind
    p('2026-09-28T10:00:40.000Z'),                                       // no reply
  ]
  assert.equal(findDeviceReply(positions, cmd), null)
  positions.push(p('2026-09-28T10:01:00.000Z', 'Cut off the fuel supply: Success!'))
  const reply = findDeviceReply(positions, cmd)
  assert.equal(reply.outcome, 'success')
  assert.equal(reply.at, '2026-09-28T10:01:00.000Z')
})

test('the newest reply wins (delayed first, success later)', () => {
  const reply = findDeviceReply([
    p('2026-09-28T10:00:20.000Z', 'GPS not fixed, Cut off the fuel supply operation delay execution!'),
    p('2026-09-28T10:05:00.000Z', 'Cut off the fuel supply: Success!'),
  ], cmd)
  assert.equal(reply.outcome, 'success')
})

test('bad input never throws', () => {
  assert.equal(findDeviceReply(null, cmd), null)
  assert.equal(findDeviceReply([], null), null)
  assert.equal(findDeviceReply([p('x', 'Cut off the fuel supply: Success!')], cmd), null)
})
