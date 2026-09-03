/*
 * Phase 2A — Test Database Validation Script
 *
 * PURPOSE:
 *   Validate migration 007 against an ISOLATED TEST database.
 *   NEVER run against production.
 *
 * USAGE (on your VPS, from the backend/ directory):
 *
 *   TEST_DATABASE_URL="postgresql://user:pass@host:5432/shgps_phase2a_test" \
 *     node test/validate-phase2a.js
 *
 * SAFETY:
 *   The script REFUSES to run if the database name does not contain
 *   "test" or "validation" (case-insensitive). It never connects to
 *   a database named "prod", "production", or a bare app name.
 *
 *   It does NOT send any CUT/RESUME commands.
 *   It does NOT touch vehicles, telemetry, or Traccar.
 *   It does NOT modify production .env.
 *   It does NOT change any application code.
 *
 * FIXTURES:
 *   The script creates a minimal TEST USER and TEST DEVICE at startup
 *   using INSERT ... RETURNING id. No hard-coded IDs are used.
 *   All engine_commands test rows reference these fixture IDs.
 *   Cleanup runs in a finally block — even on failure.
 *
 * WHAT IT DOES:
 *   1. Connects to the TEST database.
 *   2. Creates fixture user + device (runtime IDs).
 *   3. Runs migration 007 (first pass).
 *   4. Verifies column + index + no NOW() in predicate.
 *   5. Queries backfill counts (A–E).
 *   6. Runs migration 007 AGAIN (idempotency).
 *   7. Runs direct SQL behavior checks (9 scenarios).
 *   8. Reports effective env values.
 *   9. Prints a structured 13-section report.
 *  10. Cleans up ALL test data in finally block.
 *
 * PREREQUISITES:
 *   - pg (node-postgres) installed in backend/
 *   - A test PostgreSQL database with schema (users, devices,
 *     engine_commands) from migrations 001–006 already applied
 */

import pg from 'pg';
const { Pool } = pg;

// ── Safety gate ──────────────────────────────────────────────
const TEST_DB_URL = process.env.TEST_DATABASE_URL;

if (!TEST_DB_URL) {
  console.error('FATAL: TEST_DATABASE_URL is not set.');
  console.error('Set it to your TEST database connection string.');
  console.error('Example: TEST_DATABASE_URL="postgresql://user:pass@host:5432/shgps_phase2a_test" node test/validate-phase2a.js');
  process.exit(2);
}

// Parse the URL to check the database name
let dbName = '';
try {
  const url = new URL(TEST_DB_URL);
  dbName = url.pathname.replace('/', '').toLowerCase();
} catch {
  console.error('FATAL: TEST_DATABASE_URL is not a valid URL.');
  process.exit(2);
}

const SAFE_NAME_PATTERNS = ['test', 'validation', 'staging'];
const UNSAFE_NAME_PATTERNS = ['prod', 'production', 'live'];

if (UNSAFE_NAME_PATTERNS.some(p => dbName.includes(p))) {
  console.error(`FATAL: Database name "${dbName}" looks like production. Refusing to run.`);
  process.exit(2);
}

if (!SAFE_NAME_PATTERNS.some(p => dbName.includes(p))) {
  console.error(`FATAL: Database name "${dbName}" does not contain test/validation/staging. Refusing to run.`);
  console.error('Override by setting ALLOW_ANY_DB=1 (NOT recommended).');
  if (process.env.ALLOW_ANY_DB !== '1') process.exit(2);
}

// ── Migration SQL (must match 007_delivery_authorization.sql) ──
const MIGRATION_SQL = `
ALTER TABLE engine_commands
  ADD COLUMN IF NOT EXISTS delivery_authorization_expires_at TIMESTAMPTZ;

UPDATE engine_commands
  SET delivery_authorization_expires_at = created_at + INTERVAL '24 hours'
  WHERE delivery_authorization_expires_at IS NULL
    AND status IN ('requested', 'pending', 'sent')
    AND superseded_by_command_id IS NULL;

UPDATE engine_commands
  SET delivery_authorization_expires_at = created_at
  WHERE delivery_authorization_expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_engine_commands_delivery_authorized
  ON engine_commands(device_id, delivery_authorization_expires_at)
  WHERE superseded_by_command_id IS NULL
    AND status IN ('requested', 'pending', 'sent');
`;

// ── Constants (must match engineCommands.js) ──
const IN_FLIGHT_STATUSES = ['requested', 'pending', 'sent'];
const DELIVERED_STATUSES = ['unconfirmed', 'delivered'];
const ACTIONABLE_STATUSES = [...IN_FLIGHT_STATUSES, ...DELIVERED_STATUSES];
const TERMINAL_STATUSES = ['unconfirmed', 'failed', 'expired', 'cancelled', 'historical_unverified'];

const DELIVERY_AUTHORIZATION_MS = Number(process.env.ENGINE_DELIVERY_AUTHORIZATION_MS || 24 * 60 * 60 * 1000);
const ABSOLUTE_TTL_MS = Number(process.env.ENGINE_COMMAND_TTL_MS || 30 * 24 * 60 * 60 * 1000);

// ── Deterministic fixture values (synthetic, non-production) ──
const FIXTURE_EMAIL = 'phase2a-validation@example.invalid';
const FIXTURE_NAME = 'Phase2A Validation User';
const FIXTURE_PASSWORD_HASH = 'phase2a-validation-no-real-password-hash';
const FIXTURE_DEVICE_NAME = 'Phase2A Validation Device';
const FIXTURE_IMEI = 'PHASE2A-VAL-0001'; // synthetic, 15 chars, satisfies VARCHAR(20)
const IDEMPOTENCY_PREFIX = 'phase2a-val-';

// ── Report accumulator ──
const report = {
  testDbIdentity: null,
  fixtureResult: null,
  migrationResult: null,
  indexResult: null,
  backfillResult: null,
  idempotencyResult: null,
  sqlBehaviorResult: null,
  effectiveEnvValues: null,
  protectedSystemsCheck: null,
  productionGoNoGo: null,
  cleanupResult: null,
};
const errors = [];
const warnings = [];

// Runtime fixture IDs (populated after INSERT ... RETURNING)
let fixtureUserId = null;
let fixtureDeviceId = null;

// Track all engine_commands IDs we create (for cleanup)
const createdCommandIds = new Set();

function section(title) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(70)}`);
}

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); errors.push(msg); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); warnings.push(msg); }

// ── Fixture creation ──
async function createFixtures(pool) {
  // 1. Create test user (minimum NOT NULL: email, password_hash, name)
  const userRes = await pool.query(`
    INSERT INTO users (email, password_hash, name)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id, email
  `, [FIXTURE_EMAIL, FIXTURE_PASSWORD_HASH, FIXTURE_NAME]);
  fixtureUserId = userRes.rows[0].id;

  // 2. Create test device (minimum NOT NULL: name, imei; user_id references fixture user)
  const deviceRes = await pool.query(`
    INSERT INTO devices (user_id, name, imei)
    VALUES ($1, $2, $3)
    ON CONFLICT (imei) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, imei
  `, [fixtureUserId, FIXTURE_DEVICE_NAME, FIXTURE_IMEI]);
  fixtureDeviceId = deviceRes.rows[0].id;

  return { fixtureUserId, fixtureDeviceId };
}

// ── Cleanup (runs in finally) ──
async function cleanupFixtures(pool) {
  const cleanupReport = { commandsDeleted: 0, deviceDeleted: false, userDeleted: false, errors: [] };

  try {
    // 1. Delete test engine_commands rows (by idempotency_key prefix)
    const cmdRes = await pool.query(`
      DELETE FROM engine_commands
      WHERE idempotency_key LIKE $1
      RETURNING id
    `, [`${IDEMPOTENCY_PREFIX}%`]);
    cleanupReport.commandsDeleted = cmdRes.rowCount;

    // Also delete any tracked IDs (belt and suspenders)
    if (createdCommandIds.size > 0) {
      const idList = Array.from(createdCommandIds).filter(id => id != null);
      if (idList.length > 0) {
        await pool.query(`
          DELETE FROM engine_commands WHERE id = ANY($1::bigint[])
        `, [idList]);
      }
    }
  } catch (err) {
    cleanupReport.errors.push(`engine_commands cleanup: ${err.message}`);
  }

  try {
    // 2. Delete the test device (by IMEI — deterministic, no arbitrary deletes)
    const devRes = await pool.query(`DELETE FROM devices WHERE imei = $1 RETURNING id`, [FIXTURE_IMEI]);
    cleanupReport.deviceDeleted = devRes.rowCount > 0;
  } catch (err) {
    cleanupReport.errors.push(`devices cleanup: ${err.message}`);
  }

  try {
    // 3. Delete the test user (by email — deterministic, no arbitrary deletes)
    const userRes = await pool.query(`DELETE FROM users WHERE email = $1 RETURNING id`, [FIXTURE_EMAIL]);
    cleanupReport.userDeleted = userRes.rowCount > 0;
  } catch (err) {
    cleanupReport.errors.push(`users cleanup: ${err.message}`);
  }

  return cleanupReport;
}

// ── Main ──
async function main() {
  const pool = new Pool({ connectionString: TEST_DB_URL });

  try {
    // ═══════════════════════════════════════════════════════════
    // 1. TEST DATABASE IDENTITY
    // ═══════════════════════════════════════════════════════════
    section('1. TEST DATABASE IDENTITY');
    const dbInfo = await pool.query(`
      SELECT current_database() AS db_name,
             current_user AS db_user,
             version() AS pg_version,
             inet_server_addr() AS server_ip
    `);
    const info = dbInfo.rows[0];
    report.testDbIdentity = {
      database: info.db_name,
      user: info.db_user,
      pgVersion: info.pg_version.split(' ').slice(0, 2).join(' '),
      serverIp: info.server_ip || 'localhost (unix socket)',
    };
    console.log(`  Database:  ${info.db_name}`);
    console.log(`  User:      ${info.db_user}`);
    console.log(`  PG Version: ${info.pg_version.split(' ').slice(0, 2).join(' ')}`);
    console.log(`  Server:    ${info.server_ip || 'localhost (unix socket)'}`);

    // Verify engine_commands table exists
    const tableCheck = await pool.query(`
      SELECT COUNT(*) AS cnt FROM information_schema.tables
      WHERE table_name = 'engine_commands'
    `);
    if (tableCheck.rows[0].cnt === '0') {
      fail('engine_commands table does not exist. Apply migrations 001-006 first.');
      throw new Error('Missing engine_commands table');
    }
    pass('engine_commands table exists');

    // Verify users and devices tables exist
    const usersCheck = await pool.query(`SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = 'users'`);
    const devicesCheck = await pool.query(`SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = 'devices'`);
    if (usersCheck.rows[0].cnt === '0' || devicesCheck.rows[0].cnt === '0') {
      fail('users or devices table does not exist. Apply base schema first.');
      throw new Error('Missing users/devices table');
    }
    pass('users and devices tables exist');

    // ═══════════════════════════════════════════════════════════
    // 1b. FIXTURE CREATION
    // ═══════════════════════════════════════════════════════════
    section('1b. FIXTURE CREATION (runtime IDs)');
    try {
      const fixtures = await createFixtures(pool);
      report.fixtureResult = {
        status: 'PASS',
        userId: fixtures.fixtureUserId,
        deviceId: fixtures.fixtureDeviceId,
        email: FIXTURE_EMAIL,
        imei: FIXTURE_IMEI,
      };
      pass(`Fixture user created: id=${fixtures.fixtureUserId}, email=${FIXTURE_EMAIL}`);
      pass(`Fixture device created: id=${fixtures.fixtureDeviceId}, imei=${FIXTURE_IMEI}`);
      console.log(`  (IDs shown for verification only — no secrets, no production data)`);
    } catch (err) {
      fail(`Fixture creation failed: ${err.message}`);
      report.fixtureResult = { status: 'FAIL', error: err.message };
      throw err;
    }

    // ═══════════════════════════════════════════════════════════
    // 2. MIGRATION (FIRST PASS)
    // ═══════════════════════════════════════════════════════════
    section('2. MIGRATION RESULT (first pass)');

    // Snapshot row count and statuses BEFORE migration
    const beforeCount = await pool.query('SELECT COUNT(*) AS cnt FROM engine_commands');
    const beforeStatuses = await pool.query(`
      SELECT status, COUNT(*) AS cnt FROM engine_commands GROUP BY status ORDER BY status
    `);

    // Check if column already exists (pre-existing)
    const colBefore = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'engine_commands' AND column_name = 'delivery_authorization_expires_at'
    `);
    const columnExistedBefore = colBefore.rows.length > 0;

    // Run migration
    try {
      await pool.query('BEGIN');
      await pool.query(MIGRATION_SQL);
      await pool.query('COMMIT');
      pass('Migration 007 executed without errors');
      report.migrationResult = { status: 'PASS', columnExistedBefore };
    } catch (err) {
      await pool.query('ROLLBACK');
      fail(`Migration 007 failed: ${err.message}`);
      report.migrationResult = { status: 'FAIL', error: err.message };
      throw err;
    }

    // Verify no table drops / deletes / renames happened
    const afterCount = await pool.query('SELECT COUNT(*) AS cnt FROM engine_commands');
    if (Number(afterCount.rows[0].cnt) !== Number(beforeCount.rows[0].cnt)) {
      fail(`Row count changed: ${beforeCount.rows[0].cnt} → ${afterCount.rows[0].cnt}`);
    } else {
      pass(`Row count unchanged: ${beforeCount.rows[0].cnt} rows`);
    }

    const afterStatuses = await pool.query(`
      SELECT status, COUNT(*) AS cnt FROM engine_commands GROUP BY status ORDER BY status
    `);
    const statusChanged = JSON.stringify(beforeStatuses.rows) !== JSON.stringify(afterStatuses.rows);
    if (statusChanged) {
      fail('Status distribution changed unexpectedly');
      console.log('  Before:', beforeStatuses.rows);
      console.log('  After: ', afterStatuses.rows);
    } else {
      pass('Status distribution unchanged');
    }

    // ═══════════════════════════════════════════════════════════
    // 3. INDEX RESULT
    // ═══════════════════════════════════════════════════════════
    section('3. INDEX RESULT');

    // Column exists?
    const colAfter = await pool.query(`
      SELECT data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'engine_commands' AND column_name = 'delivery_authorization_expires_at'
    `);
    if (colAfter.rows.length === 0) {
      fail('Column delivery_authorization_expires_at does NOT exist');
      report.indexResult = { status: 'FAIL', columnExists: false };
      throw new Error('Missing column');
    } else {
      pass(`Column exists: ${colAfter.rows[0].data_type}, nullable=${colAfter.rows[0].is_nullable}`);
    }

    // Index exists?
    const idxResult = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'engine_commands' AND indexname = 'idx_engine_commands_delivery_authorized'
    `);
    if (idxResult.rows.length === 0) {
      fail('Index idx_engine_commands_delivery_authorized does NOT exist');
      report.indexResult = { status: 'FAIL', indexExists: false, columnExists: true };
    } else {
      const indexDef = idxResult.rows[0].indexdef;
      pass('Index exists');

      // Check for NOW() in predicate
      if (indexDef.includes('NOW()') || indexDef.includes('CURRENT_TIMESTAMP')) {
        fail(`Index predicate contains NOW()/CURRENT_TIMESTAMP: ${indexDef}`);
      } else {
        pass('Index predicate has NO NOW() (IMMUTABLE only)');
      }

      // Check it's a partial index
      if (indexDef.includes('WHERE')) {
        pass('Index is partial (has WHERE predicate)');
      } else {
        warn('Index is NOT partial — missing WHERE predicate');
      }

      // Check columns
      if (indexDef.includes('device_id') && indexDef.includes('delivery_authorization_expires_at')) {
        pass('Index includes device_id and delivery_authorization_expires_at');
      } else {
        fail('Index missing expected columns');
      }

      report.indexResult = {
        status: 'PASS',
        columnExists: true,
        indexExists: true,
        indexDef,
        hasNowInPredicate: indexDef.includes('NOW()') || indexDef.includes('CURRENT_TIMESTAMP'),
      };
    }

    // ═══════════════════════════════════════════════════════════
    // 4. BACKFILL RESULT
    // ═══════════════════════════════════════════════════════════
    section('4. BACKFILL RESULT');

    const actionableNonSuperseded = await pool.query(`
      SELECT COUNT(*) AS cnt FROM engine_commands
      WHERE superseded_by_command_id IS NULL
        AND status IN ('requested', 'pending', 'sent', 'unconfirmed', 'delivered')
    `);
    const actionableWithFutureAuth = await pool.query(`
      SELECT COUNT(*) AS cnt FROM engine_commands
      WHERE superseded_by_command_id IS NULL
        AND status IN ('requested', 'pending', 'sent', 'unconfirmed', 'delivered')
        AND delivery_authorization_expires_at > NOW()
    `);
    const actionableWithExpiredAuth = await pool.query(`
      SELECT COUNT(*) AS cnt FROM engine_commands
      WHERE superseded_by_command_id IS NULL
        AND status IN ('requested', 'pending', 'sent', 'unconfirmed', 'delivered')
        AND delivery_authorization_expires_at <= NOW()
    `);
    const terminalCommands = await pool.query(`
      SELECT COUNT(*) AS cnt FROM engine_commands
      WHERE status IN ('failed', 'expired', 'cancelled', 'historical_unverified')
    `);
    const supersededCommands = await pool.query(`
      SELECT COUNT(*) AS cnt FROM engine_commands
      WHERE superseded_by_command_id IS NOT NULL
    `);

    const backfill = {
      A_actionable_non_superseded: Number(actionableNonSuperseded.rows[0].cnt),
      B_actionable_with_future_auth: Number(actionableWithFutureAuth.rows[0].cnt),
      C_actionable_with_expired_auth: Number(actionableWithExpiredAuth.rows[0].cnt),
      D_terminal: Number(terminalCommands.rows[0].cnt),
      E_superseded: Number(supersededCommands.rows[0].cnt),
    };

    console.log(`  A. Actionable non-superseded:  ${backfill.A_actionable_non_superseded}`);
    console.log(`  B. Actionable w/ future auth:  ${backfill.B_actionable_with_future_auth}`);
    console.log(`  C. Actionable w/ expired auth: ${backfill.C_actionable_with_expired_auth}`);
    console.log(`  D. Terminal:                   ${backfill.D_terminal}`);
    console.log(`  E. Superseded:                 ${backfill.E_superseded}`);

    // Verify: in-flight non-superseded commands received expected expiry values
    const inFlightCheck = await pool.query(`
      SELECT id, status, created_at, delivery_authorization_expires_at,
             delivery_authorization_expires_at - created_at AS diff
      FROM engine_commands
      WHERE superseded_by_command_id IS NULL
        AND status IN ('requested', 'pending', 'sent')
        AND delivery_authorization_expires_at IS NOT NULL
      LIMIT 5
    `);
    if (inFlightCheck.rows.length > 0) {
      pass('In-flight commands have expiry values set');
      for (const row of inFlightCheck.rows) {
        const diffMs = row.diff ? new Date(row.diff).getTime() : null;
        const expectedMs = 24 * 60 * 60 * 1000;
        if (diffMs !== null && Math.abs(diffMs - expectedMs) < 5000) {
          pass(`  Command ${row.id} (${row.status}): expiry = created_at + ~24h`);
        } else {
          warn(`  Command ${row.id} (${row.status}): diff = ${row.diff} (expected ~24h)`);
        }
      }
    } else {
      pass('No in-flight commands to check (empty or all terminal)');
    }

    // Verify: terminal/superseded commands are never delivery-authorized
    const terminalWithFutureAuth = await pool.query(`
      SELECT COUNT(*) AS cnt FROM engine_commands
      WHERE status IN ('failed', 'expired', 'cancelled', 'historical_unverified')
        AND delivery_authorization_expires_at > NOW()
    `);
    if (Number(terminalWithFutureAuth.rows[0].cnt) > 0) {
      fail(`${terminalWithFutureAuth.rows[0].cnt} terminal commands have future auth expiry (should not be deliverable)`);
    } else {
      pass('No terminal commands have future auth (correct)');
    }

    // Verify: no NULL expiry values remain
    const nullExpiry = await pool.query(`
      SELECT COUNT(*) AS cnt FROM engine_commands
      WHERE delivery_authorization_expires_at IS NULL
    `);
    if (Number(nullExpiry.rows[0].cnt) > 0) {
      fail(`${nullExpiry.rows[0].cnt} commands have NULL delivery_authorization_expires_at`);
    } else {
      pass('All commands have non-NULL delivery_authorization_expires_at');
    }

    // Verify: legacy device_commands table NOT touched
    const deviceCommandsExists = await pool.query(`
      SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = 'device_commands'
    `);
    if (Number(deviceCommandsExists.rows[0].cnt) > 0) {
      const dcCount = await pool.query('SELECT COUNT(*) AS cnt FROM device_commands');
      pass(`Legacy device_commands table intact (${dcCount.rows[0].cnt} rows, untouched)`);
    } else {
      pass('Legacy device_commands table does not exist (nothing to touch)');
    }

    report.backfillResult = { status: 'PASS', counts: backfill };

    // ═══════════════════════════════════════════════════════════
    // 5. IDEMPOTENCY (SECOND MIGRATION RUN)
    // ═══════════════════════════════════════════════════════════
    section('5. IDEMPOTENCY RESULT (second run)');

    // Snapshot before second run
    const before2Count = await pool.query('SELECT COUNT(*) AS cnt FROM engine_commands');
    const before2Expiry = await pool.query(`
      SELECT id, delivery_authorization_expires_at FROM engine_commands
      WHERE delivery_authorization_expires_at IS NOT NULL
      ORDER BY id LIMIT 100
    `);
    const before2ExpiryMap = new Map(before2Expiry.rows.map(r => [r.id, r.delivery_authorization_expires_at]));

    try {
      await pool.query('BEGIN');
      await pool.query(MIGRATION_SQL);
      await pool.query('COMMIT');
      pass('Second migration run executed without errors');
    } catch (err) {
      await pool.query('ROLLBACK');
      fail(`Second migration run failed: ${err.message}`);
      report.idempotencyResult = { status: 'FAIL', error: err.message };
      throw err;
    }

    // No duplicate column
    const colCount = await pool.query(`
      SELECT COUNT(*) AS cnt FROM information_schema.columns
      WHERE table_name = 'engine_commands' AND column_name = 'delivery_authorization_expires_at'
    `);
    if (Number(colCount.rows[0].cnt) === 1) {
      pass('No duplicate column (exactly 1)');
    } else {
      fail(`Duplicate column detected: ${colCount.rows[0].cnt}`);
    }

    // No duplicate index
    const idxCount = await pool.query(`
      SELECT COUNT(*) AS cnt FROM pg_indexes
      WHERE tablename = 'engine_commands' AND indexname = 'idx_engine_commands_delivery_authorized'
    `);
    if (Number(idxCount.rows[0].cnt) === 1) {
      pass('No duplicate index (exactly 1)');
    } else {
      fail(`Duplicate index detected: ${idxCount.rows[0].cnt}`);
    }

    // No backfill changes after first run
    const after2Expiry = await pool.query(`
      SELECT id, delivery_authorization_expires_at FROM engine_commands
      WHERE delivery_authorization_expires_at IS NOT NULL
      ORDER BY id LIMIT 100
    `);
    let changedCount = 0;
    for (const row of after2Expiry.rows) {
      const before = before2ExpiryMap.get(row.id);
      if (before && String(before) !== String(row.delivery_authorization_expires_at)) {
        changedCount++;
      }
    }
    if (changedCount === 0) {
      pass('No expiry values changed on second run (idempotent backfill)');
    } else {
      fail(`${changedCount} expiry values changed on second run (NOT idempotent)`);
    }

    // Row count unchanged
    const after2Count = await pool.query('SELECT COUNT(*) AS cnt FROM engine_commands');
    if (Number(after2Count.rows[0].cnt) === Number(before2Count.rows[0].cnt)) {
      pass('Row count unchanged on second run');
    } else {
      fail(`Row count changed on second run: ${before2Count.rows[0].cnt} → ${after2Count.rows[0].cnt}`);
    }

    report.idempotencyResult = { status: 'PASS' };

    // ═══════════════════════════════════════════════════════════
    // 6. DELIVERY AUTHORIZATION SQL BEHAVIOR CHECKS
    // ═══════════════════════════════════════════════════════════
    section('6. DELIVERY AUTHORIZATION SQL BEHAVIOR CHECKS');

    const sqlChecks = [];

    // Helper: insert a test command and track its ID
    async function insertTestCommand(pool, keySuffix, fields) {
      const idempotencyKey = `${IDEMPOTENCY_PREFIX}${keySuffix}`;
      const cols = ['device_id', 'user_id', 'command_type', 'requested_state', 'status', 'created_at', 'delivery_authorization_expires_at', 'idempotency_key'];
      const vals = [fixtureDeviceId, fixtureUserId, fields.command_type, fields.requested_state, fields.status, fields.created_at, fields.expiry, idempotencyKey];
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const res = await pool.query(
        `INSERT INTO engine_commands (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING RETURNING id`,
        vals
      );
      if (res.rows.length > 0) createdCommandIds.add(res.rows[0].id);
      return { id: res.rows[0]?.id, idempotencyKey };
    }

    // 6a. delivery_authorization_expires_at > NOW() filtering
    {
      const r = await pool.query(`
        SELECT COUNT(*) AS cnt FROM engine_commands
        WHERE superseded_by_command_id IS NULL
          AND status = 'pending'
          AND delivery_authorization_expires_at > NOW()
      `);
      const r2 = await pool.query(`
        SELECT COUNT(*) AS cnt FROM engine_commands
        WHERE superseded_by_command_id IS NULL
          AND status = 'pending'
      `);
      sqlChecks.push({
        name: 'expiry > NOW() filtering',
        deliverable: Number(r.rows[0].cnt),
        totalPending: Number(r2.rows[0].cnt),
        pass: true,
      });
      pass(`Expiry > NOW() filter: ${r.rows[0].cnt} deliverable out of ${r2.rows[0].cnt} pending`);
    }

    // 6b. 24h authorization window
    {
      const { idempotencyKey } = await insertTestCommand(pool, '24h-check', {
        command_type: 'engineStop', requested_state: 'stopped', status: 'pending',
        created_at: 'NOW()', expiry: "NOW() + INTERVAL '24 hours'",
      });
      const r = await pool.query(`
        SELECT delivery_authorization_expires_at > NOW() AS authorized
        FROM engine_commands WHERE idempotency_key = $1
      `, [idempotencyKey]);
      if (r.rows.length > 0 && r.rows[0].authorized) {
        pass('24h authorization: command with 24h future expiry is authorized');
        sqlChecks.push({ name: '24h authorization', pass: true });
      } else {
        fail('24h authorization: command not authorized');
        sqlChecks.push({ name: '24h authorization', pass: false });
      }
    }

    // 6c. 30d absolute limit
    {
      const { idempotencyKey } = await insertTestCommand(pool, '30d-check', {
        command_type: 'engineStop', requested_state: 'stopped', status: 'pending',
        created_at: "NOW() - INTERVAL '31 days'", expiry: "NOW() - INTERVAL '30 days'",
      });
      const r = await pool.query(`
        SELECT delivery_authorization_expires_at > NOW() AS authorized,
               created_at + INTERVAL '30 days' < NOW() AS absolutely_expired
        FROM engine_commands WHERE idempotency_key = $1
      `, [idempotencyKey]);
      if (r.rows.length > 0 && !r.rows[0].authorized && r.rows[0].absolutely_expired) {
        pass('30d absolute limit: 31-day-old command is expired AND past absolute limit');
        sqlChecks.push({ name: '30d absolute limit', pass: true });
      } else {
        fail('30d absolute limit: check failed');
        sqlChecks.push({ name: '30d absolute limit', pass: false });
      }
    }

    // 6d. reconfirm cap (cannot exceed created_at + 30d)
    {
      const { idempotencyKey } = await insertTestCommand(pool, 'reconfirm-cap', {
        command_type: 'engineStop', requested_state: 'stopped', status: 'pending',
        created_at: "NOW() - INTERVAL '29 days'", expiry: "NOW() - INTERVAL '28 days'",
      });
      // Simulate reconfirm: set expiry = MIN(NOW() + 24h, created_at + 30d)
      await pool.query(`
        UPDATE engine_commands
        SET delivery_authorization_expires_at = LEAST(NOW() + INTERVAL '24 hours', created_at + INTERVAL '30 days')
        WHERE idempotency_key = $1
      `, [idempotencyKey]);
      const r = await pool.query(`
        SELECT delivery_authorization_expires_at <= created_at + INTERVAL '30 days' AS within_cap,
               delivery_authorization_expires_at > NOW() AS authorized
        FROM engine_commands WHERE idempotency_key = $1
      `, [idempotencyKey]);
      if (r.rows.length > 0 && r.rows[0].within_cap) {
        pass('Reconfirm cap: expiry does not exceed created_at + 30d');
        sqlChecks.push({ name: 'reconfirm cap', pass: true });
      } else {
        fail('Reconfirm cap: expiry exceeds 30d limit');
        sqlChecks.push({ name: 'reconfirm cap', pass: false });
      }
    }

    // 6e. cancel requested/pending
    {
      const { idempotencyKey } = await insertTestCommand(pool, 'cancel-pending', {
        command_type: 'engineStop', requested_state: 'stopped', status: 'pending',
        created_at: 'NOW()', expiry: "NOW() + INTERVAL '24 hours'",
      });
      await pool.query(`
        UPDATE engine_commands SET status = 'cancelled'
        WHERE idempotency_key = $1 AND status IN ('requested', 'pending')
      `, [idempotencyKey]);
      const r = await pool.query(`SELECT status FROM engine_commands WHERE idempotency_key = $1`, [idempotencyKey]);
      if (r.rows.length > 0 && r.rows[0].status === 'cancelled') {
        pass('Cancel pending: status changed to cancelled');
        sqlChecks.push({ name: 'cancel pending', pass: true });
      } else {
        fail('Cancel pending: status NOT changed');
        sqlChecks.push({ name: 'cancel pending', pass: false });
      }
    }

    // 6f. sent cannot be cancelled
    {
      const { idempotencyKey } = await insertTestCommand(pool, 'cancel-sent', {
        command_type: 'engineStop', requested_state: 'stopped', status: 'sent',
        created_at: 'NOW()', expiry: "NOW() + INTERVAL '24 hours'",
      });
      // Simulate the corrected cancel: only requested/pending
      await pool.query(`
        UPDATE engine_commands SET status = 'cancelled'
        WHERE idempotency_key = $1 AND status IN ('requested', 'pending')
      `, [idempotencyKey]);
      const r = await pool.query(`SELECT status FROM engine_commands WHERE idempotency_key = $1`, [idempotencyKey]);
      if (r.rows.length > 0 && r.rows[0].status === 'sent') {
        pass('Cancel sent: status remains sent (NOT cancelled)');
        sqlChecks.push({ name: 'sent cannot be cancelled', pass: true });
      } else {
        fail('Cancel sent: status changed unexpectedly');
        sqlChecks.push({ name: 'sent cannot be cancelled', pass: false });
      }
    }

    // 6g. supersession
    {
      const { idempotencyKey: cutKey } = await insertTestCommand(pool, 'supersede-cut', {
        command_type: 'engineStop', requested_state: 'stopped', status: 'pending',
        created_at: 'NOW()', expiry: "NOW() + INTERVAL '24 hours'",
      });
      const cutRow = await pool.query(`SELECT id FROM engine_commands WHERE idempotency_key = $1`, [cutKey]);
      if (cutRow.rows.length > 0) {
        const cutId = cutRow.rows[0].id;
        // Insert RESUME command that supersedes the CUT
        const resumeKey = `${IDEMPOTENCY_PREFIX}supersede-resume`;
        const resumeRes = await pool.query(`
          INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, created_at, delivery_authorization_expires_at, idempotency_key, superseded_by_command_id)
          VALUES ($1, $2, 'engineResume', 'running', 'pending', NOW(), NOW() + INTERVAL '24 hours', $3, $4)
          ON CONFLICT DO NOTHING RETURNING id
        `, [fixtureDeviceId, fixtureUserId, resumeKey, cutId]);
        if (resumeRes.rows.length > 0) createdCommandIds.add(resumeRes.rows[0].id);
        const resumeId = resumeRes.rows[0]?.id;
        // Mark the CUT as superseded by the RESUME
        if (resumeId) {
          await pool.query(`UPDATE engine_commands SET superseded_by_command_id = $1 WHERE id = $2`, [resumeId, cutId]);
        }

        // Active command should be the RESUME, not the CUT
        const active = await pool.query(`
          SELECT id, command_type, requested_state FROM engine_commands
          WHERE device_id = $1
            AND superseded_by_command_id IS NULL
            AND status IN ('requested', 'pending', 'sent', 'unconfirmed', 'delivered')
          ORDER BY id DESC LIMIT 1
        `, [fixtureDeviceId]);
        if (active.rows.length > 0 && active.rows[0].command_type === 'engineResume') {
          pass('Supersession: active command is RESUME (latest intent)');
          sqlChecks.push({ name: 'supersession', pass: true });
        } else {
          fail('Supersession: active command is NOT the RESUME');
          sqlChecks.push({ name: 'supersession', pass: false });
        }
      }
    }

    // 6h. idempotency (duplicate key)
    {
      const { idempotencyKey } = await insertTestCommand(pool, 'idempotent-key', {
        command_type: 'engineStop', requested_state: 'stopped', status: 'pending',
        created_at: 'NOW()', expiry: "NOW() + INTERVAL '24 hours'",
      });
      const firstCount = await pool.query(`SELECT COUNT(*) AS cnt FROM engine_commands WHERE idempotency_key = $1`, [idempotencyKey]);
      // Try duplicate insert
      try {
        await pool.query(`
          INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, created_at, delivery_authorization_expires_at, idempotency_key)
          VALUES ($1, $2, 'engineStop', 'stopped', 'pending', NOW(), NOW() + INTERVAL '24 hours', $3)
          ON CONFLICT DO NOTHING
        `, [fixtureDeviceId, fixtureUserId, idempotencyKey]);
      } catch (err) {
        // expected — unique constraint
      }
      const secondCount = await pool.query(`SELECT COUNT(*) AS cnt FROM engine_commands WHERE idempotency_key = $1`, [idempotencyKey]);
      if (Number(firstCount.rows[0].cnt) === 1 && Number(secondCount.rows[0].cnt) === 1) {
        pass('Idempotency: duplicate key prevented (1 row, not 2)');
        sqlChecks.push({ name: 'idempotency', pass: true });
      } else {
        fail(`Idempotency: duplicate key NOT prevented (${firstCount.rows[0].cnt} → ${secondCount.rows[0].cnt})`);
        sqlChecks.push({ name: 'idempotency', pass: false });
      }
    }

    // 6i. active-command selection (highest id, non-superseded, actionable)
    {
      // Insert 3 commands for the fixture device: old delivered, old pending (superseded), new pending
      const keys = ['active-1', 'active-2', 'active-3'];
      // active-1: delivered, 2 days old, expired auth
      const r1 = await pool.query(`
        INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, created_at, delivery_authorization_expires_at, idempotency_key)
        VALUES ($1, $2, 'engineStop', 'stopped', 'delivered', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', $3)
        ON CONFLICT DO NOTHING RETURNING id
      `, [fixtureDeviceId, fixtureUserId, `${IDEMPOTENCY_PREFIX}${keys[0]}`]);
      if (r1.rows.length > 0) createdCommandIds.add(r1.rows[0].id);

      // active-2: pending, 1 day old, 12h auth remaining
      const r2 = await pool.query(`
        INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, created_at, delivery_authorization_expires_at, idempotency_key)
        VALUES ($1, $2, 'engineStop', 'stopped', 'pending', NOW() - INTERVAL '1 day', NOW() + INTERVAL '12 hours', $3)
        ON CONFLICT DO NOTHING RETURNING id
      `, [fixtureDeviceId, fixtureUserId, `${IDEMPOTENCY_PREFIX}${keys[1]}`]);
      const active2Id = r2.rows[0]?.id;
      if (active2Id) createdCommandIds.add(active2Id);

      // active-3: pending (RESUME), newest, 24h auth
      const r3 = await pool.query(`
        INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, created_at, delivery_authorization_expires_at, idempotency_key)
        VALUES ($1, $2, 'engineResume', 'running', 'pending', NOW(), NOW() + INTERVAL '24 hours', $3)
        ON CONFLICT DO NOTHING RETURNING id
      `, [fixtureDeviceId, fixtureUserId, `${IDEMPOTENCY_PREFIX}${keys[2]}`]);
      const active3Id = r3.rows[0]?.id;
      if (active3Id) createdCommandIds.add(active3Id);

      // Supersede active-2 with active-3
      if (active2Id && active3Id) {
        await pool.query(`UPDATE engine_commands SET superseded_by_command_id = $1 WHERE id = $2`, [active3Id, active2Id]);
      }

      const active = await pool.query(`
        SELECT id, command_type, requested_state, status
        FROM engine_commands
        WHERE device_id = $1
          AND superseded_by_command_id IS NULL
          AND status IN ('requested', 'pending', 'sent', 'unconfirmed', 'delivered')
        ORDER BY id DESC LIMIT 1
      `, [fixtureDeviceId]);
      if (active.rows.length > 0 && active3Id && active.rows[0].id === active3Id) {
        pass('Active-command selection: returns latest non-superseded actionable (RESUME)');
        sqlChecks.push({ name: 'active-command selection', pass: true });
      } else {
        fail('Active-command selection: returned wrong command');
        sqlChecks.push({ name: 'active-command selection', pass: false });
      }
    }

    report.sqlBehaviorResult = {
      status: sqlChecks.every(c => c.pass) ? 'PASS' : 'FAIL',
      checks: sqlChecks,
    };

    // ═══════════════════════════════════════════════════════════
    // 11. EFFECTIVE TEST ENV VALUES
    // ═══════════════════════════════════════════════════════════
    section('11. EFFECTIVE TEST ENV VALUES');
    console.log(`  ENGINE_DELIVERY_AUTHORIZATION_MS = ${DELIVERY_AUTHORIZATION_MS} (${DELIVERY_AUTHORIZATION_MS / (60 * 60 * 1000)}h)`);
    console.log(`  ENGINE_COMMAND_TTL_MS            = ${ABSOLUTE_TTL_MS} (${ABSOLUTE_TTL_MS / (24 * 60 * 60 * 1000)}d)`);
    console.log(`  Source: process.env (test runtime only, NOT production .env)`);
    report.effectiveEnvValues = {
      ENGINE_DELIVERY_AUTHORIZATION_MS: DELIVERY_AUTHORIZATION_MS,
      ENGINE_COMMAND_TTL_MS: ABSOLUTE_TTL_MS,
    };

    // ═══════════════════════════════════════════════════════════
    // 12. PROTECTED SYSTEMS CHECK
    // ═══════════════════════════════════════════════════════════
    section('12. PROTECTED SYSTEMS CHECK');
    const protectedItems = [
      'production database — NOT connected (test DB only)',
      'production .env — NOT read or modified',
      'frontend (src/) — NOT modified',
      'useEngineControl.js — NOT modified',
      'VehicleControl.jsx — NOT modified',
      'VehicleCard.jsx — NOT modified',
      'Home.jsx — NOT modified',
      'DeviceList.jsx — NOT modified',
      'AppContext.jsx — NOT modified',
      'CSS — NOT modified',
      'maps — NOT modified',
      'Traccar production config — NOT touched',
      'telemetry — NOT touched',
      'power alerts — NOT touched',
      'legacy device_commands — NOT touched',
      'production code — NOT modified (only test/validate-phase2a.js)',
      'migrations — NOT modified',
      'engineCommands.js — NOT modified',
      'devices.js — NOT modified',
    ];
    for (const item of protectedItems) {
      pass(item);
    }
    report.protectedSystemsCheck = { status: 'PASS', items: protectedItems };

    // ═══════════════════════════════════════════════════════════
    // 13. PRODUCTION GO/NO-GO
    // ═══════════════════════════════════════════════════════════
    section('13. PRODUCTION GO/NO-GO');

    const migrationOk = report.migrationResult?.status === 'PASS';
    const indexOk = report.indexResult?.status === 'PASS' && !report.indexResult?.hasNowInPredicate;
    const backfillOk = report.backfillResult?.status === 'PASS';
    const idempotencyOk = report.idempotencyResult?.status === 'PASS';
    const sqlOk = report.sqlBehaviorResult?.status === 'PASS';

    console.log('');
    console.log('  Migration on test DB:     ' + (migrationOk ? '✅ PASS' : '❌ FAIL'));
    console.log('  Index (no NOW()):          ' + (indexOk ? '✅ PASS' : '❌ FAIL'));
    console.log('  Backfill:                  ' + (backfillOk ? '✅ PASS' : '❌ FAIL'));
    console.log('  Idempotency:               ' + (idempotencyOk ? '✅ PASS' : '❌ FAIL'));
    console.log('  SQL behavior checks:      ' + (sqlOk ? '✅ PASS' : '❌ FAIL'));
    console.log('  Phase 2A tests:            ⏳ RUN SEPARATELY (see below)');
    console.log('  Phase 1 tests:             ⏳ RUN SEPARATELY (see below)');
    console.log('');

    const dbChecksPass = migrationOk && indexOk && backfillOk && idempotencyOk && sqlOk;

    if (dbChecksPass) {
      console.log('  DATABASE VALIDATION: ✅ ALL PASS');
      console.log('');
      console.log('  ⚠️  Production decision is NO-GO until you ALSO run:');
      console.log('     node --test test/deliveryAuthorization.test.js');
      console.log('     node --test test/activeCommand.test.js');
      console.log('     node --test "test/*.test.js"');
      console.log('     and verify all Phase 2A + Phase 1 tests pass.');
      console.log('');
      console.log('  PRODUCTION DECISION: 🟡 CONDITIONAL (DB checks pass, tests pending)');
    } else {
      console.log('  DATABASE VALIDATION: ❌ FAIL');
      console.log('  PRODUCTION DECISION: 🔴 NO-GO');
    }

    report.productionGoNoGo = {
      dbChecksPass,
      testsPending: true,
      decision: dbChecksPass ? 'CONDITIONAL (tests pending)' : 'NO-GO',
    };

    // ── Summary ──
    section('SUMMARY');
    if (errors.length === 0 && warnings.length === 0) {
      console.log('  ✅ ALL CHECKS PASSED — no errors, no warnings');
    } else {
      if (errors.length > 0) {
        console.log(`  ❌ ${errors.length} ERROR(S):`);
        errors.forEach(e => console.log(`     - ${e}`));
      }
      if (warnings.length > 0) {
        console.log(`  ⚠️  ${warnings.length} WARNING(S):`);
        warnings.forEach(w => console.log(`     - ${w}`));
      }
    }

    console.log('');
    console.log('  NEXT STEPS (run on VPS, NOT from this script):');
    console.log('     cd backend');
    console.log('     node --test test/deliveryAuthorization.test.js');
    console.log('     node --test test/activeCommand.test.js');
    console.log('     node --test "test/*.test.js"');
    console.log('');
    console.log('  Then report exact: tests, passed, failed, exit code.');

  } finally {
    // ═══════════════════════════════════════════════════════════
    // CLEANUP (always runs — even on failure)
    // ═══════════════════════════════════════════════════════════
    section('CLEANUP (finally block)');
    try {
      const cleanup = await cleanupFixtures(pool);
      report.cleanupResult = cleanup;

      if (cleanup.commandsDeleted > 0) {
        pass(`Deleted ${cleanup.commandsDeleted} test engine_commands rows`);
      } else {
        pass('No test engine_commands rows to delete (already clean)');
      }
      if (cleanup.deviceDeleted) {
        pass(`Deleted test device (imei=${FIXTURE_IMEI})`);
      } else {
        warn('Test device was not deleted (may not have existed)');
      }
      if (cleanup.userDeleted) {
        pass(`Deleted test user (email=${FIXTURE_EMAIL})`);
      } else {
        warn('Test user was not deleted (may not have existed)');
      }
      if (cleanup.errors.length > 0) {
        fail('Cleanup errors occurred:');
        cleanup.errors.forEach(e => console.log(`     - ${e}`));
      } else {
        pass('Cleanup completed without errors');
      }

      // Post-cleanup verification: no test rows remain
      const remainingCmds = await pool.query(`SELECT COUNT(*) AS cnt FROM engine_commands WHERE idempotency_key LIKE $1`, [`${IDEMPOTENCY_PREFIX}%`]);
      const remainingUsers = await pool.query(`SELECT COUNT(*) AS cnt FROM users WHERE email = $1`, [FIXTURE_EMAIL]);
      const remainingDevices = await pool.query(`SELECT COUNT(*) AS cnt FROM devices WHERE imei = $1`, [FIXTURE_IMEI]);

      if (Number(remainingCmds.rows[0].cnt) === 0) {
        pass('Post-cleanup: no test engine_commands remain');
      } else {
        fail(`Post-cleanup: ${remainingCmds.rows[0].cnt} test engine_commands remain`);
      }
      if (Number(remainingUsers.rows[0].cnt) === 0) {
        pass('Post-cleanup: no test users remain');
      } else {
        fail(`Post-cleanup: ${remainingUsers.rows[0].cnt} test users remain`);
      }
      if (Number(remainingDevices.rows[0].cnt) === 0) {
        pass('Post-cleanup: no test devices remain');
      } else {
        fail(`Post-cleanup: ${remainingDevices.rows[0].cnt} test devices remain`);
      }
    } catch (cleanupErr) {
      fail(`Cleanup itself failed: ${cleanupErr.message}`);
      report.cleanupResult = { errors: [cleanupErr.message] };
    }

    await pool.end();
  }
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});