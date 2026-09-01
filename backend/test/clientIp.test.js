// Regression tests for client IP extraction used by the brute-force rate
// limiters. Key security property: a client-supplied (spoofable) FIRST
// X-Forwarded-For entry must NEVER be used as the rate-limit key — otherwise an
// attacker rotates the header to bypass protection. The real client IP comes
// from X-Real-IP (nginx overwrites it) or the LAST X-Forwarded-For entry (nginx
// appends the real IP at the end).
import test from 'node:test'
import assert from 'node:assert/strict'
import { getClientIp } from '../src/utils/clientIp.js'

test('prefers X-Real-IP even when X-Forwarded-For has a spoofed first entry', () => {
  const ip = getClientIp({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })
  assert.equal(ip, '203.0.113.9')
})

test('uses the LAST X-Forwarded-For entry when X-Real-IP is absent', () => {
  const ip = getClientIp({ 'x-forwarded-for': 'spoofed.example, 198.51.100.7' })
  assert.equal(ip, '198.51.100.7')
})

test('never uses the spoofable FIRST X-Forwarded-For entry', () => {
  const ip = getClientIp({ 'x-forwarded-for': 'spoofed.example, 198.51.100.7' })
  assert.notEqual(ip, 'spoofed.example')
})

test('single X-Forwarded-For entry is returned', () => {
  assert.equal(getClientIp({ 'x-forwarded-for': '198.51.100.7' }), '198.51.100.7')
})

test('trims whitespace around IPs', () => {
  assert.equal(getClientIp({ 'x-real-ip': '  203.0.113.9  ' }), '203.0.113.9')
  assert.equal(getClientIp({ 'x-forwarded-for': ' 198.51.100.7 , 203.0.113.9 ' }), '203.0.113.9')
})

test('returns empty string when no proxy headers are present', () => {
  assert.equal(getClientIp({}), '')
  assert.equal(getClientIp(), '')
})

test('ignores an empty X-Real-IP and falls back to X-Forwarded-For', () => {
  assert.equal(getClientIp({ 'x-real-ip': '  ', 'x-forwarded-for': '198.51.100.7' }), '198.51.100.7')
})

test('ignores empty X-Forwarded-For parts', () => {
  assert.equal(getClientIp({ 'x-forwarded-for': ' , , 203.0.113.9 ,' }), '203.0.113.9')
})
