# Phase 2A — Test Database Validation

## Overview

This directory contains a validation script for Phase 2A (delivery authorization)
that runs against an **isolated TEST database**. It never touches production.

## Files

- `validate-phase2a.js` — Database validation script (migration, backfill, idempotency, SQL behavior)
- `deliveryAuthorization.test.js` — Phase 2A model tests (27 tests)
- `activeCommand.test.js` — Phase 1 active-command tests

## How to Run (on your VPS)

### Prerequisites

1. A test PostgreSQL database with migrations 001–006 already applied.
2. The `pg` package installed (`npm install` in `backend/`).
3. The `phase-2a-delivery-authorization` branch checked out.

### Step 1: Database Validation

```bash
cd backend

# Set the TEST database URL (NOT production)
export TEST_DATABASE_URL="postgresql://user:pass@host:5432/your_test_db"

# Run the validation script
node test/validate-phase2a.js
```

The script will:
- Verify the database name contains "test", "validation", or "staging"
- Run migration 007 (first pass)
- Verify column + index + no NOW() in predicate
- Query backfill counts (A–E)
- Run migration 007 again (idempotency check)
- Run 9 direct SQL behavior checks
- Report effective env values
- Print a 13-section report

### Step 2: Run Test Suites

```bash
cd backend

# Phase 2A tests (27 tests)
node --test test/deliveryAuthorization.test.js

# Phase 1 tests
node --test test/activeCommand.test.js

# Full backend suite
node --test "test/*.test.js"
```

Report exact: tests, passed, failed, exit code for each.

### Step 3: Review Results

The validation script outputs a structured report with 13 sections:

1. TEST DATABASE IDENTITY
2. MIGRATION RESULT
3. INDEX RESULT
4. BACKFILL RESULT
5. IDEMPOTENCY RESULT
6. DELIVERY AUTHORIZATION SQL RESULT
7. DELIVERY AUTHORIZATION TESTS (run separately)
8. PHASE 1 TESTS (run separately)
9. FULL BACKEND SUITE (run separately)
10. PRE-EXISTING FAILURES
11. EFFECTIVE TEST ENV VALUES
12. PROTECTED SYSTEMS CHECK
13. PRODUCTION GO/NO-GO

## Safety

- The script **refuses** to connect to a database named "prod", "production", or "live".
- The script **requires** the database name to contain "test", "validation", or "staging".
- No CUT or RESUME commands are sent.
- No vehicles, telemetry, or Traccar configuration is touched.
- No production `.env` is read or modified.
- No application code is changed.
- All test data inserted by the script is cleaned up after each check.

## Production Decision

**NO-GO** unless ALL of the following pass:

- ✅ Migration succeeds on test DB
- ✅ Rerun is idempotent
- ✅ Phase 2A tests pass (27/27)
- ✅ Phase 1 tests pass
- ✅ SQL behavior checks pass (9/9)
- ✅ Full backend suite passes (excluding pre-existing failures)