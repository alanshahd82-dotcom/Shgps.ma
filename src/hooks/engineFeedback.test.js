import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { statusMessage, resolveFeedbackChannel } from './engineFeedback.js'

describe('A) unconfirmed -> caution, not success', () => {
  test('resolveFeedbackChannel(unconfirmed) === caution', () => {
    assert.equal(resolveFeedbackChannel('unconfirmed'), 'caution')
  })
  test('resolveFeedbackChannel(unconfirmed) !== success', () => {
    assert.notEqual(resolveFeedbackChannel('unconfirmed'), 'success')
  })
})

describe('B) unconfirmed message says physical state cannot be confirmed', () => {
  test('EN contains cannot be confirmed', () => {
    const msg = statusMessage('unconfirmed', 'en')
    assert.ok(msg.includes('cannot be confirmed'), 'Expected cannot be confirmed in: ' + JSON.stringify(msg))
  })
  test('FR contains ne peut', () => {
    const msg = statusMessage('unconfirmed', 'fr')
    assert.ok(msg.includes('ne peut'), 'Expected ne peut in: ' + JSON.stringify(msg))
  })
  test('AR message is non-empty', () => {
    const msg = statusMessage('unconfirmed', 'ar')
    assert.ok(msg.length > 10, 'AR message must not be empty')
  })
  test('does NOT claim physical execution', () => {
    const msg = statusMessage('unconfirmed', 'en').toLowerCase()
    assert.ok(!msg.includes('success'), 'Must not say success')
    assert.ok(!msg.includes('executed'), 'Must not say executed')
    assert.ok(!msg.includes('activated'), 'Must not say activated')
    assert.ok(!msg.includes('resumed'), 'Must not say resumed')
    assert.ok(!msg.includes('stopped'), 'Must not say stopped')
  })
})

describe('C) pending/sent do not claim physical completion', () => {
  test('pending maps to caution', () => {
    assert.equal(resolveFeedbackChannel('pending'), 'caution')
  })
  test('requested maps to caution', () => {
    assert.equal(resolveFeedbackChannel('requested'), 'caution')
  })
  test('sent maps to caution', () => {
    assert.equal(resolveFeedbackChannel('sent'), 'caution')
  })
  test('pending message says waiting not delivered', () => {
    const msg = statusMessage('pending', 'en').toLowerCase()
    assert.ok(msg.includes('waiting'), 'Expected waiting')
    assert.ok(!msg.includes('delivered'), 'Must not say delivered')
  })
  test('sent message says sent not delivered', () => {
    const msg = statusMessage('sent', 'en').toLowerCase()
    assert.ok(msg.includes('sent'), 'Expected sent')
    assert.ok(!msg.includes('delivered'), 'Must not say delivered')
  })
})

describe('D) existing success behavior for confirmed states remains intact', () => {
  test('delivered maps to success', () => {
    assert.equal(resolveFeedbackChannel('delivered'), 'success')
  })
  test('delivered message says delivered', () => {
    const msg = statusMessage('delivered', 'en').toLowerCase()
    assert.ok(msg.includes('delivered'), 'Expected delivered')
  })
})

describe('E) existing error behavior remains intact', () => {
  test('empty status maps to unknown', () => {
    assert.equal(resolveFeedbackChannel(''), 'unknown')
  })
  test('null status maps to unknown', () => {
    assert.equal(resolveFeedbackChannel(null), 'unknown')
  })
  test('undefined status maps to unknown', () => {
    assert.equal(resolveFeedbackChannel(undefined), 'unknown')
  })
  test('failed status preserved as success channel', () => {
    assert.equal(resolveFeedbackChannel('failed'), 'success')
    const msg = statusMessage('failed', 'en').toLowerCase()
    assert.ok(msg.includes('failed'), 'Expected failed')
  })
  test('cancelled status preserved as success channel', () => {
    assert.equal(resolveFeedbackChannel('cancelled'), 'success')
    const msg = statusMessage('cancelled', 'en').toLowerCase()
    assert.ok(msg.includes('cancelled'), 'Expected cancelled')
  })
})
