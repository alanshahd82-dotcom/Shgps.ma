-- Migration 004: Engine relay command state machine (engine_commands)
-- Run manually: psql -d $DB_NAME -f 004_engine_commands.sql
-- (Also created idempotently at boot via runMigrations() in src/index.js.)
--
-- Phase 2A.1: new command-state table. The legacy device_commands table (508
-- historical rows) is intentionally NOT touched, renamed, dropped, or altered.
-- Non-destructive, repeatable. No DROP, no destructive ALTER, no data deletion.

CREATE TABLE IF NOT EXISTS engine_commands (
  id                  BIGSERIAL PRIMARY KEY,
  device_id           INTEGER REFERENCES devices(id) ON DELETE SET NULL,
  user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  command_type        VARCHAR(20)  NOT NULL,            -- engineStop | engineResume
  requested_state     VARCHAR(20)  NOT NULL,            -- stopped | running
  status              VARCHAR(32)  NOT NULL DEFAULT 'pending',
  idempotency_key     VARCHAR(160) NOT NULL,
  legacy_id           BIGINT,                            -- backfill traceability (NULL for new rows)
  traccar_command_id  BIGINT,                            -- Traccar command id (Phase 2B)
  traccar_device_id   BIGINT,                            -- Traccar device id (audit)
  protocol            VARCHAR(50),                       -- protocol at request time (audit)
  command_profile     VARCHAR(60),                       -- resolved relay profile (audit)
  error               TEXT,
  ip_address          VARCHAR(64),                       -- requester IP (audit)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ,                        -- when reached a terminal state
  CONSTRAINT engine_commands_status_chk CHECK (status IN
    ('requested','pending','sent','delivered','unconfirmed','failed','expired','cancelled','historical_unverified')),
  CONSTRAINT engine_commands_type_chk CHECK (command_type IN ('engineStop','engineResume')),
  CONSTRAINT engine_commands_state_chk CHECK (requested_state IN ('stopped','running'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_engine_commands_idempotency_key
  ON engine_commands(idempotency_key);

-- Partial unique index: backfill idempotency. NULL legacy_id allowed for new rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_engine_commands_legacy_id
  ON engine_commands(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_engine_commands_device_created
  ON engine_commands(device_id, created_at DESC);

-- Partial index for the active-command lookup (conflict + idempotency checks).
-- Excludes historical_unverified/failed/cancelled so backfilled rows never block new commands.
CREATE INDEX IF NOT EXISTS idx_engine_commands_active
  ON engine_commands(device_id)
  WHERE status IN ('requested','pending','sent','delivered','unconfirmed');
