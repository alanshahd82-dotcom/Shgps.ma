-- Migration 004: Engine relay command state machine (device_commands)
-- Run manually: psql -d $DB_NAME -f 004_device_commands.sql
-- (Also created idempotently at boot via runMigrations() in src/index.js.)
--
-- Phase 2A: database + command state model + idempotency + conflict protection.
-- Non-destructive, repeatable. No DROP, no destructive ALTER, no data deletion.

CREATE TABLE IF NOT EXISTS device_commands (
  id                  BIGSERIAL PRIMARY KEY,
  device_id           INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  command_type        VARCHAR(20)  NOT NULL,            -- engineStop | engineResume
  requested_state     VARCHAR(20)  NOT NULL,            -- stopped | running
  status              VARCHAR(24)  NOT NULL DEFAULT 'pending',
  idempotency_key     VARCHAR(160) NOT NULL,
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
  CONSTRAINT device_commands_status_chk CHECK (status IN
    ('requested','pending','sent','delivered','unconfirmed','failed','expired','cancelled')),
  CONSTRAINT device_commands_type_chk CHECK (command_type IN ('engineStop','engineResume')),
  CONSTRAINT device_commands_state_chk CHECK (requested_state IN ('stopped','running'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_device_commands_idempotency_key
  ON device_commands(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_device_commands_device_created
  ON device_commands(device_id, created_at DESC);

-- Partial index for the active-command lookup (conflict + idempotency checks).
CREATE INDEX IF NOT EXISTS idx_device_commands_active
  ON device_commands(device_id)
  WHERE status IN ('requested','pending','sent','delivered','unconfirmed');
