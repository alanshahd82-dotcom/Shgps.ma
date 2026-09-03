// Focused real-module smoke test for engineCommands.js
// Exercises createRequest + getActiveCommand + reconfirmCommand + cancelActiveCommand
// against an ISOLATED TEST database. Does NOT call Traccar (deliverOnce is not invoked).
//
// SAFETY: Refuses to run unless TEST_DATABASE_URL is set and the database name
// contains "test", "validation", or "staging".
//
// Run: TEST_DATABASE_URL="postgresql://user:pass@host:5432/shgps_test" \
//      node --test test/engineCommands.smoke.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
const { Pool } = pg;

// Set synthetic test-only JWT_SECRET before importing the real module.
// config.js only checks presence — it does not validate the value.
// This is NOT the production secret; it only allows the module to load.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-not-for-production';
}

// ── Safety gate ──
const TEST_DB_URL = process.env.TEST_DATABASE_URL;
let pool = null;
let fixtureUserId = null;
let fixtureDeviceId = null;
const createdCommandIds = new Set();

const FIXTURE_EMAIL = 'smoke-test@example.invalid';
const FIXTURE_NAME = 'Smoke Test User';
const FIXTURE_PASSWORD_HASH = 'smoke-test-no-real-password-hash';
const FIXTURE_DEVICE_NAME = 'Smoke Test Device';
const FIXTURE_IMEI = 'SMOKE-TEST-0001';
const IDEMPOTENCY_PREFIX = 'smoke-test-';

function checkTestDb() {
  if (!TEST_DB_URL) return false;
  let dbName = '';
  try { dbName = new URL(TEST_DB_URL).pathname.replace('/', '').toLowerCase(); } catch { return false; }
  if (['prod', 'production', 'live'].some(p => dbName.includes(p))) return false;
  if (!['test', 'validation', 'staging'].some(p => dbName.includes(p))) {
    if (process.env.ALLOW_ANY_DB !== '1') return false;
  }
  return true;
}

async function setupFixtures() {
  const userRes = await pool.query(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id',
    [FIXTURE_EMAIL, FIXTURE_PASSWORD_HASH, FIXTURE_NAME]
  );
  fixtureUserId = userRes.rows[0].id;

  const deviceRes = await pool.query(
    'INSERT INTO devices (user_id, name, imei) VALUES ($1, $2, $3) ON CONFLICT (imei) DO UPDATE SET name = EXCLUDED.name RETURNING id',
    [fixtureUserId, FIXTURE_DEVICE_NAME, FIXTURE_IMEI]
  );
  fixtureDeviceId = deviceRes.rows[0].id;
}

async function cleanup() {
  if (!pool) return;
  try {
    if (createdCommandIds.size > 0) {
      const ids = Array.from(createdCommandIds).filter(id => id != null);
      if (ids.length > 0) {
        await pool.query('DELETE FROM engine_commands WHERE id = ANY($1::bigint[])', [ids]);
      }
    }
    await pool.query('DELETE FROM engine_commands WHERE idempotency_key LIKE $1', [IDEMPOTENCY_PREFIX + '%']);
    await pool.query('DELETE FROM devices WHERE imei = $1', [FIXTURE_IMEI]);
    await pool.query('DELETE FROM users WHERE email = $1', [FIXTURE_EMAIL]);
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
}

// ── Tests ──
test('createRequest creates a pending command with 24h delivery authorization', async (t) => {
  if (!checkTestDb()) { t.skip('TEST_DATABASE_URL not set or not a test database'); return; }
  pool = new Pool({ connectionString: TEST_DB_URL });
  t.after(async () => { await cleanup(); await pool.end(); });
  await setupFixtures();

  const engineCommands = await import('../src/services/engineCommands.js');

  const cmd = await engineCommands.createRequest({
    deviceId: fixtureDeviceId,
    userId: fixtureUserId,
    commandType: 'engineStop',
    idempotencyKey: IDEMPOTENCY_PREFIX + 'create-1',
    ip: '127.0.0.1',
    traccarDeviceId: 999999,
  });
  createdCommandIds.add(cmd.id);

  assert.equal(cmd.status, 'pending');
  assert.equal(cmd.command_type, 'engineStop');
  assert.equal(cmd.requested_state, 'stopped');
  assert.ok(cmd.delivery_authorization_expires_at, 'must have delivery authorization expiry');
  // Authorization should be ~24h from now
  const authMs = new Date(cmd.delivery_authorization_expires_at).getTime() - Date.now();
  assert.ok(authMs > 23 * 60 * 60 * 1000, 'authorization should be >23h');
  assert.ok(authMs < 25 * 60 * 60 * 1000, 'authorization should be <25h');
});

test('getActiveCommand returns the created command', async (t) => {
  if (!checkTestDb()) { t.skip('TEST_DATABASE_URL not set or not a test database'); return; }
  pool = new Pool({ connectionString: TEST_DB_URL });
  t.after(async () => { await cleanup(); await pool.end(); });
  await setupFixtures();

  const engineCommands = await import('../src/services/engineCommands.js');

  const cmd = await engineCommands.createRequest({
    deviceId: fixtureDeviceId,
    userId: fixtureUserId,
    commandType: 'engineStop',
    idempotencyKey: IDEMPOTENCY_PREFIX + 'getactive-1',
    ip: '127.0.0.1',
    traccarDeviceId: 999999,
  });
  createdCommandIds.add(cmd.id);

  const active = await engineCommands.getActiveCommand(fixtureDeviceId);
  assert.ok(active, 'should have an active command');
  assert.equal(active.id, cmd.id);
  assert.equal(active.command_type, 'engineStop');
});

test('reconfirmCommand extends delivery authorization (capped at 30d)', async (t) => {
  if (!checkTestDb()) { t.skip('TEST_DATABASE_URL not set or not a test database'); return; }
  pool = new Pool({ connectionString: TEST_DB_URL });
  t.after(async () => { await cleanup(); await pool.end(); });
  await setupFixtures();

  const engineCommands = await import('../src/services/engineCommands.js');

  const cmd = await engineCommands.createRequest({
    deviceId: fixtureDeviceId,
    userId: fixtureUserId,
    commandType: 'engineStop',
    idempotencyKey: IDEMPOTENCY_PREFIX + 'reconfirm-1',
    ip: '127.0.0.1',
    traccarDeviceId: 999999,
  });
  createdCommandIds.add(cmd.id);

  const reconfirmed = await engineCommands.reconfirmCommand(cmd.id, fixtureDeviceId);
  assert.ok(reconfirmed.delivery_authorization_expires_at);
  // Reconfirm should set auth to ~24h from now (not past created_at + 30d)
  const authMs = new Date(reconfirmed.delivery_authorization_expires_at).getTime() - Date.now();
  assert.ok(authMs > 23 * 60 * 60 * 1000, 'reconfirmed authorization should be >23h');
  const absoluteExpiry = new Date(cmd.created_at).getTime() + 30 * 24 * 60 * 60 * 1000;
  assert.ok(new Date(reconfirmed.delivery_authorization_expires_at).getTime() <= absoluteExpiry,
    'reconfirmed authorization must not exceed created_at + 30d');
});

test('cancelActiveCommand cancels a pending command', async (t) => {
  if (!checkTestDb()) { t.skip('TEST_DATABASE_URL not set or not a test database'); return; }
  pool = new Pool({ connectionString: TEST_DB_URL });
  t.after(async () => { await cleanup(); await pool.end(); });
  await setupFixtures();

  const engineCommands = await import('../src/services/engineCommands.js');

  const cmd = await engineCommands.createRequest({
    deviceId: fixtureDeviceId,
    userId: fixtureUserId,
    commandType: 'engineStop',
    idempotencyKey: IDEMPOTENCY_PREFIX + 'cancel-1',
    ip: '127.0.0.1',
    traccarDeviceId: 999999,
  });
  createdCommandIds.add(cmd.id);

  const cancelled = await engineCommands.cancelActiveCommand(fixtureDeviceId);
  assert.ok(cancelled);
  assert.equal(cancelled.status, 'cancelled');

  // Active command should now be null (cancelled is not actionable)
  const active = await engineCommands.getActiveCommand(fixtureDeviceId);
  assert.equal(active, null);
});

test('RESUME supersedes an existing CUT command', async (t) => {
  if (!checkTestDb()) { t.skip('TEST_DATABASE_URL not set or not a test database'); return; }
  pool = new Pool({ connectionString: TEST_DB_URL });
  t.after(async () => { await cleanup(); await pool.end(); });
  await setupFixtures();

  const engineCommands = await import('../src/services/engineCommands.js');

  const cutCmd = await engineCommands.createRequest({
    deviceId: fixtureDeviceId,
    userId: fixtureUserId,
    commandType: 'engineStop',
    idempotencyKey: IDEMPOTENCY_PREFIX + 'supersede-cut',
    ip: '127.0.0.1',
    traccarDeviceId: 999999,
  });
  createdCommandIds.add(cutCmd.id);

  const resumeCmd = await engineCommands.createRequest({
    deviceId: fixtureDeviceId,
    userId: fixtureUserId,
    commandType: 'engineResume',
    idempotencyKey: IDEMPOTENCY_PREFIX + 'supersede-resume',
    ip: '127.0.0.1',
    traccarDeviceId: 999999,
  });
  createdCommandIds.add(resumeCmd.id);

  const active = await engineCommands.getActiveCommand(fixtureDeviceId);
  assert.ok(active);
  assert.equal(active.command_type, 'engineResume');
  assert.equal(active.id, resumeCmd.id);
});
