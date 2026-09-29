import test from 'node:test'
import assert from 'node:assert/strict'
import { corsOriginCheck, allowedOrigins } from '../src/utils/corsOrigins.js'
import { resolveApiBase, resolveWsBase, publicOrigin, PRODUCTION_ORIGIN } from '../../src/utils/apiBase.js'

const check = (fn, origin) => new Promise(resolve => fn(origin, (_e, ok) => resolve(ok)))

test('the website and the phone app may call the API; strangers may not', async () => {
  const fn = corsOriginCheck('https://athargps.com')
  assert.equal(await check(fn, 'https://athargps.com'), true)
  assert.equal(await check(fn, 'https://localhost'), true)
  assert.equal(await check(fn, 'capacitor://localhost'), true)
  assert.equal(await check(fn, 'https://evil.example'), false)
  assert.equal(await check(fn, 'http://localhost:5173'), false)
  assert.equal(await check(fn, undefined), true, 'requests without Origin are not CORS requests')
})

test('without FRONTEND_URL only the phone app origins remain (never a wildcard)', () => {
  assert.deepEqual(allowedOrigins(''), ['https://localhost', 'capacitor://localhost'])
})

test('browser keeps relative addresses, the phone app points at the real server', () => {
  assert.equal(resolveApiBase({ native: false }), '/api')
  assert.equal(resolveApiBase({ native: true }), `${PRODUCTION_ORIGIN}/api`)
  assert.equal(resolveApiBase({ native: true, envUrl: 'https://staging.example/api' }), 'https://staging.example/api')
  assert.equal(resolveWsBase({ native: false, location: { protocol: 'https:', host: 'athargps.com' } }), 'wss://athargps.com/api/socket')
  assert.equal(resolveWsBase({ native: false, location: { protocol: 'http:', host: '127.0.0.1:5173' } }), 'ws://127.0.0.1:5173/api/socket')
  assert.equal(resolveWsBase({ native: true }), 'wss://athargps.com/api/socket')
})

test('share links use the public website, also from the phone app', () => {
  assert.equal(publicOrigin({ native: true, origin: 'https://localhost' }), 'https://athargps.com')
  assert.equal(publicOrigin({ native: false, origin: 'https://athargps.com' }), 'https://athargps.com')
})
