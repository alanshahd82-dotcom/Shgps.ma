import test from 'node:test'
import assert from 'node:assert/strict'
import { describeDeviceReply } from '../../src/utils/deviceReply.js'

test('no reply gives nothing to show', () => {
  assert.equal(describeDeviceReply(null, 'ar'), null)
  assert.equal(describeDeviceReply({}, 'ar'), null)
})

test('success differs for cut and resume, and follows the language', () => {
  assert.match(describeDeviceReply({ outcome: 'success', kind: 'cut' }, 'ar').text, /قطع/)
  assert.match(describeDeviceReply({ outcome: 'success', kind: 'resume' }, 'ar').text, /إعادة/)
  assert.match(describeDeviceReply({ outcome: 'success', kind: 'cut' }, 'fr').text, /coupé/)
})

test('a postponed cut (no GPS) is a waiting message, a rejection is a warning', () => {
  const wait = describeDeviceReply({ outcome: 'delayed_no_gps', kind: 'cut' }, 'fr')
  assert.equal(wait.tone, 'wait')
  assert.match(wait.text, /GPS/)
  assert.equal(describeDeviceReply({ outcome: 'failed' }, 'ar').tone, 'warn')
})

test('unknown reply text is shown as the device reply', () => {
  assert.match(describeDeviceReply({ outcome: 'unknown', text: 'OK' }, 'fr').text, /Réponse de l'appareil: OK/)
  assert.equal(describeDeviceReply({ outcome: 'unknown' }, 'fr'), null)
})
