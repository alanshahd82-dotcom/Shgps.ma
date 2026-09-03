// Regression tests for protocol lookup fix in deliverOnce().
// Proves that when traccar.getDevice() returns protocol=null, deliverOnce()
// falls back to traccar.getAllPositions() to resolve the device protocol
// from its latest Position (stored in tc_positions).
//
// Tests:
//   A. getDevice->null + getAllPositions->gt06 => sends type=engineStop (standard path)
//   B. getDevice->null + getAllPositions->[]   => sends type=custom (fallback preserved)
//   C. dev.traccar_id=70 => sendCommand called with deviceId=70 (mapping unchanged)
//
// Uses mock.module() to intercept traccar.js HTTP calls.
// Node v20.x: mock.module(specifier, { namedExports: {...} }) — options object, NOT factory.
// Requires --experimental-test-module-mocks flag.
//
// Run: TEST_DATABASE_URL="postgresql://user:pass@host:5432/shgps_test" \
//      node --experimental-test-module-mocks --test test/protocolLookup.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import pg from 'pg';
const { Pool } = pg;

// ── Safety gate ──
const TEST_DB_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DB_URL) {
  console.error('FATAL: TEST_DATABASE_URL is not set.');
  process.exit(2);
}
let dbName = '';
try { dbName = new URL(TEST_DB_URL).pathname.replace('/', '').toLowerCase(); } catch {}
if (['prod', 'production', 'live'].some(p => dbName.includes(p))) {
  console.error('FATAL: Database looks like production. Refusing to run.');
  process.exit(2);
}
if (!['test', 'validation', 'staging'].some(p => dbName.includes(p))) {
  if (process.env.ALLOW_ANY_DB !== '1') {
    console.error('FATAL: Database name does not contain test/validation/staging. Refusing to run.');
    process.exit(2);
  }
}

// Set synthetic JWT_SECRET before importing the real module.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-not-for-production';
}
// Bridge TEST_DATABASE_URL to DATABASE_URL for the real db.js Pool.
if (TEST_DB_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DB_URL;
}

// ── Mock state (mutable across tests) ──
let sendCommandCalls = [];
const mockConfig = {
  getDeviceResult: { protocol: null, attributes: {} },
  allPositionsResult: [{ deviceId: 70, protocol: 'gt06' }],
};

// ── Register traccar.js mock BEFORE importing engineCommands ──
if (typeof mock.module !== 'function') {
  console.error('FATAL: mock.module is not available. Use Node >= 20.8 with --experimental-test-module-mocks.');
  process.exit(2);
}

mock.module('../src/services/traccar.js', {
  namedExports: {
  getDevice: async () => mockConfig.getDeviceResult,
  getAllPositions: async () => mockConfig.allPositionsResult,
  sendCommand: async (deviceId, type, attributes) => {
    sendCommandCalls.push({ deviceId, type, attributes });
    return { id: 12345 };
  },
  getCommandDeliveryMeta: () => ({ queueState: 'sent', commandId: 12345 }),
  // Mirror the real resolveEngineCommand logic for protocol routing.
  resolveEngineCommand: ({ type, protocol = '', deviceAttributes = {} }) => {
    const isStop = type === 'engineStop';
    const explicitKey = isStop ? 'engineStopCommand' : 'engineResumeCommand';
    const explicit = deviceAttributes?.[explicitKey];
    if (typeof explicit === 'string' && explicit.trim()) {
      return { type: 'custom', attributes: { data: explicit.trim() }, profile: 'traccar-attribute' };
    }
    const profile = String(
      deviceAttributes?.engineCommandProfile
        ?? deviceAttributes?.engine_command_profile
        ?? deviceAttributes?.relayCommandProfile
        ?? deviceAttributes?.relay_command_profile
        ?? '',
    ).trim().toLowerCase();
    if (profile === 'standard' || profile === 'traccar' || profile === 'gt06-standard') {
      return { type, attributes: {}, profile: 'traccar-standard' };
    }
    if (profile === 'legacy' || profile === 'relay-3' || profile === 'gt06-relay-3') {
      return { type: 'custom', attributes: { data: isStop ? 'RELAY,1,0#' : 'RELAY,1,1#' }, profile: 'legacy-relay-3' };
    }
    const normalizedProtocol = String(protocol).trim().toLowerCase();
    if (normalizedProtocol === 'gt06' && !profile) {
      return { type, attributes: {}, profile: 'traccar-standard' };
    }
    return { type: 'custom', attributes: { data: isStop ? 'Relay,1#' : 'Relay,0#' }, profile: profile || 'gs900-relay-1' };
  },
  // Other exports that engineCommands.js might reference.
  cleanPositions: (list) => list || [],
  invalidateTraccarCache: () => {},
  }
});

// ── Import engineCommands AFTER mock is registered ──
const engineCommands = await import('../src/services/engineCommands.js');

// ── Fixtures ──
let pool = null;
let fixtureUserId = null;
let fixtureDeviceId = null;

const FIXTURE_EMAIL = 'protocol-lookup-test@example.invalid';
const FIXTURE_NAME = 'Protocol Lookup Test User';
const FIXTURE_PASSWORD_HASH = 'protocol-lookup-no-real-password-hash';
const FIXTURE_DEVICE_NAME = 'Protocol Lookup Test Device';
const FIXTURE_IMEI = 'PROTO-LOOKUP-0001';
const IDEMPOTENCY_PREFIX = 'proto-lookup-';
const FIXTURE_TRACCAR_ID = 70;

async function setupFixtures() {
  const userRes = await pool.query(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id',
    [FIXTURE_EMAIL, FIXTURE_PASSWORD_HASH, FIXTURE_NAME]
  );
  fixtureUserId = userRes.rows[0].id;

  const deviceRes = await pool.query(
    'INSERT INTO devices (user_id, name, imei, type, traccar_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (imei) DO UPDATE SET name = EXCLUDED.name, traccar_id = EXCLUDED.traccar_id RETURNING id, traccar_id',
    [fixtureUserId, FIXTURE_DEVICE_NAME, FIXTURE_IMEI, 'bike', FIXTURE_TRACCAR_ID]
  );
  fixtureDeviceId = deviceRes.rows[0].id;
}

async function cleanup() {
  if (!pool) return;
  try {
    await pool.query('DELETE FROM engine_commands WHERE idempotency_key LIKE $1', [IDEMPOTENCY_PREFIX + '%']);
    await pool.query('DELETE FROM devices WHERE imei = $1', [FIXTURE_IMEI]);
    await pool.query('DELETE FROM users WHERE email = $1', [FIXTURE_EMAIL]);
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
}

async function createPendingCommand(keySuffix) {
  const cmd = await engineCommands.createRequest({
    deviceId: fixtureDeviceId,
    userId: fixtureUserId,
    commandType: 'engineStop',
    idempotencyKey: IDEMPOTENCY_PREFIX + keySuffix,
    ip: '127.0.0.1',
    traccarDeviceId: FIXTURE_TRACCAR_ID,
  });
  return { command: cmd, dev: { id: fixtureDeviceId, traccar_id: FIXTURE_TRACCAR_ID } };
}

// ═══════════════════════════════════════════════════════════════
// TEST A: Position protocol resolves to GT06 standard path
// ═══════════════════════════════════════════════════════════════
test('A: getDevice->null + getAllPositions->gt06 => sends type=engineStop (standard path)', async (t) => {
  pool = new Pool({ connectionString: TEST_DB_URL });
  t.after(async () => { await cleanup(); await pool.end(); });
  await setupFixtures();

  mockConfig.getDeviceResult = { protocol: null, attributes: {} };
  mockConfig.allPositionsResult = [{ deviceId: FIXTURE_TRACCAR_ID, protocol: 'gt06' }];
  sendCommandCalls = [];

  const { command, dev } = await createPendingCommand('test-a');
  await engineCommands.deliverOnce(command, dev);

  assert.ok(sendCommandCalls.length > 0, 'sendCommand must have been called');
  const call = sendCommandCalls[0];
  assert.equal(call.type, 'engineStop', 'must send type=engineStop (standard GT06 path), not custom');
  assert.notEqual(call.type, 'custom', 'must NOT fall into custom fallback');
  assert.deepEqual(call.attributes, {}, 'standard path sends empty attributes');
});

// ═══════════════════════════════════════════════════════════════
// TEST B: No position protocol => fallback behavior preserved
// ═══════════════════════════════════════════════════════════════
test('B: getDevice->null + getAllPositions->[] => sends type=custom (fallback preserved)', async (t) => {
  pool = new Pool({ connectionString: TEST_DB_URL });
  t.after(async () => { await cleanup(); await pool.end(); });
  await setupFixtures();

  mockConfig.getDeviceResult = { protocol: null, attributes: {} };
  mockConfig.allPositionsResult = [];
  sendCommandCalls = [];

  const { command, dev } = await createPendingCommand('test-b');
  await engineCommands.deliverOnce(command, dev);

  assert.ok(sendCommandCalls.length > 0, 'sendCommand must have been called');
  const call = sendCommandCalls[0];
  assert.equal(call.type, 'custom', 'must fall into custom fallback when no protocol available');
  assert.equal(call.attributes?.data, 'Relay,1#', 'fallback must produce Relay,1# for engineStop');
});

// ═══════════════════════════════════════════════════════════════
// TEST C: Device mapping (traccar_id=70) unchanged
// ═══════════════════════════════════════════════════════════════
test('C: dev.traccar_id=70 => sendCommand called with deviceId=70 (mapping unchanged)', async (t) => {
  pool = new Pool({ connectionString: TEST_DB_URL });
  t.after(async () => { await cleanup(); await pool.end(); });
  await setupFixtures();

  mockConfig.getDeviceResult = { protocol: null, attributes: {} };
  mockConfig.allPositionsResult = [{ deviceId: FIXTURE_TRACCAR_ID, protocol: 'gt06' }];
  sendCommandCalls = [];

  const { command, dev } = await createPendingCommand('test-c');
  await engineCommands.deliverOnce(command, dev);

  assert.ok(sendCommandCalls.length > 0, 'sendCommand must have been called');
  assert.equal(sendCommandCalls[0].deviceId, FIXTURE_TRACCAR_ID, 'sendCommand must use dev.traccar_id (70)');
});