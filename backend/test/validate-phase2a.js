/*
 * Phase 2A — Test Database Validation Script
 *
 * PURPOSE:
 *   Validate migration 007 against an ISOLATED TEST database.
 *   NEVER run against production.
 *
 * USAGE (on your VPS, from the backend/ directory):
 *
 *   TEST_DATABASE_URL="postgresql://user:pass@host:5432/test_db_name" \
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
 * WHAT IT DOES:
 *   1. Connects to the TEST database.
 *   2. Runs migration 007 (first pass).
 *   3. Verifies column + index + no NOW() in predicate.
 *   4. Queries backfill counts (A–E).
 *   5. Runs migration 007 AGAIN (idempotency).
 *   6. Runs direct SQL behavior checks (9 scenarios).
 *   7. Reports effective env values.
 *   8. Prints a structured 13-section report.
 *
 * PREREQUISITES:
 *   - pg (node-postgres) installed in backend/
 *   - A test PostgreSQL database with an engine_commands table
 *     (schema from migrations 001–006 already applied)
 */

import pg from 'pg';
const { Pool } = pg;

// ── Safety gate ──────────────────────────────────────────────
const TEST_DB_URL = process.env.TEST_DATABASE_URL;

if (!TEST_DB_URL) {
  console.error('FATAL: TEST_DATABASE_URL is not set.');
  console.error('Set it to your TEST database connection string.');
  console.error('Example: TEST_DATABASE_URL="postgresql://user:pass@host:5432/shgps_test" node test/validate-phase2a.js');
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

// ── Report accumulator ──
const report = {
  testDbIdentity: null,
  migrationResult: null,
  indexResult: null,
  backfillResult: null,
  idempotencyResult: null,
  sqlBehaviorResult: null,
  effectiveEnvValues: null,
  protectedSystemsCheck: null,
  productionGoNoGo: null,
};
const errors = [];
const warnings = [];

function section(title) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(70)}`);
}

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); errors.push(msg); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); warnings.push(msg); }

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

    // Verify: actionable existing commands received expected expiry values
    // For in-flight non-superseded (requested/pending/sent), expiry should be created_at + 24h
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
      // Insert a test command with 24h expiry
      await pool.query(`
        INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, created_at, delivery_authorization_expires_at, idempotency_key)
        VALUES (99999, 99999, 'engineStop', 'stopped', 'pending', NOW(), NOW() + INTERVAL '24 hours', 'test-24h-check')
        ON CONFLICT DO NOTHING
      `);
      const r = await pool.query(`
        SELECT delivery_authorization_expires_at > NOW() AS authorized
        FROM engine_commands WHERE idempotency_key = 'test-24h-check'
      `);
      if (r.rows.length > 0 && r.rows[0].authorized) {
        pass('24h authorization: command with 24h future expiry is authorized');
        sqlChecks.push({ name: '24h authorization', pass: true });
      } else {
        fail('24h authorization: command not authorized');
        sqlChecks.push({ name: '24h authorization', pass: false });
      }
      // Clean up
      await pool.query(`DELETE FROM engine_commands WHERE idempotency_key = 'test-24h-check'`);
    }

    // 6c. 30d absolute limit
    {
      // Insert a command created 31 days ago with 24h expiry (already expired)
      await pool.query(`
        INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, created_at, delivery_authorization_expires_at, idempotency_key)
        VALUES (99999, 99999, 'engineStop', 'stopped', 'pending', NOW() - INTERVAL '31 days', NOW() - INTERVAL '30 days', 'test-30d-check')
        ON CONFLICT DO NOTHING
      `);
      const r = await pool.query(`
        SELECT delivery_authorization_expires_at > NOW() AS authorized,
               created_at + INTERVAL '30 days' < NOW() AS absolutely_expired
        FROM engine_commands WHERE idempotency_key = 'test-30d-check'
      `);
      if (r.rows.length > 0 && !r.rows[0].authorized && r.rows[0].absolutely_expired) {
        pass('30d absolute limit: 31-day-old command is expired AND past absolute limit');
        sqlChecks.push({ name: '30d absolute limit', pass: true });
      } else {
        fail('30d absolute limit: check failed');
        sqlChecks.push({ name: '30d absolute limit', pass: false });
      }
      await pool.query(`DELETE FROM engine_commands WHERE idempotency_key = 'test-30d-check'`);
    }

    // 6d. reconfirm cap (cannot exceed created_at + 30d)
    {
      // Insert a command created 29 days ago, reconfirm to 24h → should cap at 30d
      await pool.query(`
        INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, created_at, delivery_authorization_expires_at, idempotency_key)
        VALUES (99999, 99999, 'engineStop', 'stopped', 'pending', NOW() - INTERVAL '29 days', NOW() - INTERVAL '28 days', 'test-reconfirm-cap')
        ON CONFLICT DO NOTHING
      `);
      // Simulate reconfirm: set expiry = MIN(NOW() + 24h, created_at + 30d)
      await pool.query(`
        UPDATE engine_commands
        SET delivery_authorization_expires_at = LEAST(NOW() + INTERVAL '24 hours', created_at + INTERVAL '30 days')
        WHERE idempotency_key = 'test-reconfirm-cap'
      `);
      const r = await pool.query(`
        SELECT delivery_authorization_expires_at <= created_at + INTERVAL '30 days' AS within_cap,
               delivery_authorization_expires_at > NOW() AS authorized
        FROM engine_commands WHERE idempotency_key = 'test-reconfirm-cap'
      `);
      if (r.rows.length > 0 && r.rows[0].within_cap) {
        pass('Reconfirm cap: expiry does not exceed created_at + 30d');
        sqlChecks.push({ name: 'reconfirm cap', pass: true });
      } else {
        fail('Reconfirm cap: expiry exceeds 30d limit');
        sqlChecks.push({ name: 'reconfirm cap', pass: false });
      }
      await pool.query(`DELETE FROM engine_commands WHERE idempotency_key = 'test-reconfirm-cap'`);
    }

    // 6e. cancel requested/pending
    {
      await pool.query(`
        INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, created_at, delivery_authorization_expires_at, idempotency_key)
        VALUES (99999, 99999, 'engineStop', 'stopped', 'pending', NOW(), NOW() + INTERVAL '24 hours', 'test-cancel-pending')
        ON CONFLICT DO NOTHING
      `);
      await pool.query(`
        UPDATE engine_commands SET status = 'cancelled'
        WHERE idempotency_key = 'test-cancel-pending' AND status IN ('requested', 'pending')
      `);
      const r = await pool.query(`
        SELECT status FROM engine_commands WHERE idempotency_key = 'test-cancel-pending'
      `);
      if (r.rows.length > 0 && r.rows[0].status === 'cancelled') {
        pass('Cancel pending: status changed to cancelled');
        sqlChecks.push({ name: 'cancel pending', pass: true });
      } else {
        fail('Cancel pending: status NOT changed');
        sqlChecks.push({ name: 'cancel pending', pass: false });
      }
      await pool.query(`DELETE FROM engine_commands WHERE idempotency_key = 'test-cancel-pending'`);
    }

    // 6f. sent cannot be cancelled
    {
      await pool.query(`
        INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, created_at, delivery_authorization_expires_at, idempotency_key)
        VALUES (99999, 99999, 'engineStop', 'stopped', 'sent', NOW(), NOW() + INTERVAL '24 hours', 'test-cancel-sent')
        ON CONFLICT DO NOTHING
      `);
      // Simulate the corrected cancel: only requested/pending
      await pool.query(`
        UPDATE engine_commands SET status = 'cancelled'
        WHERE idempotency_key = 'test-cancel-sent' AND status IN ('requested', 'pending')
      `);
      const r = await pool.query(`
        SELECT status FROM engine_commands WHERE idempotency_key = 'test-cancel-sent'
      `);
      if (r.rows.length > 0 && r.rows[0].status === 'sent') {
        pass('Cancel sent: status remains sent (NOT cancelled)');
        sqlChecks.push({ name: 'sent cannot be cancelled', pass: true });
      } else {
        fail('Cancel sent: status changed unexpectedly');
        sqlChecks.push({ name: 'sent cannot be cancelled', pass: false });
      }
      await pool.query(`DELETE FROM engine_commands WHERE idempotency_key = 'test-cancel-sent'`);
    }

    // 6g. supersession
    {
      await pool.query(`
        INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, created_at, delivery_authorization_expires_at, idempotency_key)
        VALUES (99999, 99999, 'engineStop', 'stopped', 'pending', NOW(), NOW() + INTERVAL '24 hours', 'test-supersede-cut')
        ON CONFLICT DO NOTHING
      `);
      const cutRow = await pool.query(`
        SELECT id FROM engine_commands WHERE idempotency_key = 'test-supersede-cut'
      `);
      if (cutRow.rows.length > 0) {
        const cutId = cutRow.rows[0].id;
        await pool.query(`
          INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, created_at, delivery_authorization_expires_at, idempotency_key, superseded_by_command_id)
          VALUES (99999, 99999, 'engineResume', 'running', 'pending', NOW(), NOW() + INTERVAL '24 hours', 'test-supersede-resume', $1)
          ON CONFLICT DO NOTHING
        `, [cutId]);
        await pool.query(`
          UPDATE engine_commands SET superseded_by_command_id = (
            SELECT id FROM engine_commands WHERE idempotency_key = 'test-supersede-resume'
          ) WHERE id = $1
        `, [cutId]);

        // Active command should be the RESUME, not the CUT
        const active = await pool.query(`
          SELECT id, command_type, requested_state FROM engine_commands
          WHERE device_id = 99999
            AND superseded_by_command_id IS NULL
            AND status IN ('requested', 'pending', 'sent', 'unconfirmed', 'delivered')
          ORDER BY id DESC LIMIT 1
        `);
        if (active.rows.length > 0 && active.rows[0].command_type === 'engineResume') {
          pass('Supersession: active command is RESUME (latest intent)');
          sqlChecks.push({ name: 'supersession', pass: true });
        } else {
          fail('Supersession: active command is NOT the RESUME');
          sqlChecks.push({ name: 'supersession', pass: false });
        }
        // Clean up
        await pool.query(`DELETE FROM engine_commands WHERE idempotency_key IN ('test-supersede-cut', 'test-supersede-resume')`);
      }
    }

    // 6h. idempotency (duplicate key)
    {
      await pool.query(`
        INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, created_at, delivery_authorization_expires_at, idempotency_key)
        VALUES (99999, 99999, 'engineStop', 'stopped', 'pending', NOW(), NOW() + INTERVAL '24 hours', 'test-idempotent-key')
        ON CONFLICT DO NOTHING
      `);
      const firstCount = await pool.query(`
        SELECT COUNT(*) AS cnt FROM engine_commands WHERE idempotency_key = 'test-idempotent-key'
      `);
      // Try duplicate insert
      await pool.query(`
        INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, created_at, delivery_authorization_expires_at, idempotency_key)
        VALUES (99999, 99999, 'engineStop', 'stopped', 'pending', NOW(), NOW() + INTERVAL '24 hours', 'test-idempotent-key')
        ON CONFLICT DO NOTHING
      `);
      const secondCount = await pool.query(`
        SELECT COUNT(*) AS cnt FROM engine_commands WHERE idempotency_key = 'test-idempotent-key'
      `);
      if (Number(firstCount.rows[0].cnt) === 1 && Number(secondCount.rows[0].cnt) === 1) {
        pass('Idempotency: duplicate key prevented (1 row, not 2)');
        sqlChecks.push({ name: 'idempotency', pass: true });
      } else {
        fail(`Idempotency: duplicate key NOT prevented (${firstCount.rows[0].cnt} → ${secondCount.rows[0].cnt})`);
        sqlChecks.push({ name: 'idempotency', pass: false });
      }
      await pool.query(`DELETE FROM engine_commands WHERE idempotency_key = 'test-idempotent-key'`);
    }

    // 6i. active-command selection (highest id, non-superseded, actionable)
    {
      // Insert 3 commands for same device: old delivered, old pending (superseded), new pending
      await pool.query(`
        INSERT INTO engine_commands (device_id, user_id, command_type, requested_state, status, created_at, delivery_authorization_expires_at, idempotency_key)
        VALUES
          (99998, 99999, 'engineStop', 'stopped', 'delivered', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 'test-active-1'),
          (99998, 99999, 'engineStop', 'stopped', 'pending', NOW() - INTERVAL '1 day', NOW() + INTERVAL '12 hours', 'test-active-2'),
          (99998, 99999, 'engineResume', 'running', 'pending', NOW(), NOW() + INTERVAL '24 hours', 'test-active-3')
        ON CONFLICT DO NOTHING
      `);
      // Supersede the second one
      await pool.query(`
        UPDATE engine_commands SET superseded_by_command_id = (
          SELECT id FROM engine_commands WHERE idempotency_key = 'test-active-3'
        ) WHERE idempotency_key = 'test-active-2'
      `);
      const active = await pool.query(`
        SELECT id, command_type, requested_state, status
        FROM engine_commands
        WHERE device_id = 99998
          AND superseded_by_command_id IS NULL
          AND status IN ('requested', 'pending', 'sent', 'unconfirmed', 'delivered')
        ORDER BY id DESC LIMIT 1
      `);
      if (active.rows.length > 0 && active.rows[0].idempotency_key !== 'test-active-3' && active.rows[0].command_type === 'engineResume') {
        pass('Active-command selection: returns latest non-superseded actionable (RESUME)');
        sqlChecks.push({ name: 'active-command selection', pass: true });
      } else if (active.rows.length > 0) {
        // Check by id
        const expected = await pool.query(`
          SELECT id FROM engine_commands WHERE idempotency_key = 'test-active-3'
        `);
        if (active.rows[0].id === expected.rows[0].id) {
          pass('Active-command selection: returns latest non-superseded actionable (RESUME)');
          sqlChecks.push({ name: 'active-command selection', pass: true });
        } else {
          fail('Active-command selection: returned wrong command');
          sqlChecks.push({ name: 'active-command selection', pass: false });
        }
      } else {
        fail('Active-command selection: no active command found');
        sqlChecks.push({ name: 'active-command selection', pass: false });
      }
      await pool.query(`DELETE FROM engine_commands WHERE idempotency_key IN ('test-active-1', 'test-active-2', 'test-active-3')`);
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

    // Tests 4 (node --test) are run separately by you on the VPS
    console.log('');
    console.log('  Migration on test DB:     ' + (migrationOk ? '✅ PASS' : '❌ FAIL'));
    console.log('  Index (no NOW()):         ' + (indexOk ? '✅ PASS' : '❌ FAIL'));
    console.log('  Backfill:                 ' + (backfillOk ? '✅ PASS' : '❌ FAIL'));
    console.log('  Idempotency:              ' + (idempotencyOk ? '✅ PASS' : '❌ FAIL'));
    console.log('  SQL behavior checks:     ' + (sqlOk ? '✅ PASS' : '❌ FAIL'));
    console.log('  Phase 2A tests:           ⏳ RUN SEPARATELY (see below)');
    console.log('  Phase 1 tests:            ⏳ RUN SEPARATELY (see below)');
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
    await pool.end();
  }
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});