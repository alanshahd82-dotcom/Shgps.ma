-- Migration 005: Engine command supersession + cancellation gate (Phase 2F)
-- Additive, idempotent, non-destructive. No DROP, no DELETE, no rename.
-- Existing command #1 (engineResume / unconfirmed / traccar_command_id=0) is
-- NOT touched and NOT backfilled; it becomes superseded naturally by the next
-- explicit STOP, which is safe because it is NOT QUEUED_LIVE (tid=0 = sent).
-- Run manually or idempotently at boot via runMigrations() in src/index.js.

ALTER TABLE engine_commands
  ADD COLUMN IF NOT EXISTS superseded_by_command_id BIGINT REFERENCES engine_commands(id) ON DELETE SET NULL;

ALTER TABLE engine_commands
  ADD COLUMN IF NOT EXISTS cancellation_state VARCHAR(16);

ALTER TABLE engine_commands
  ADD COLUMN IF NOT EXISTS cancellation_confirmed_at TIMESTAMPTZ;

-- Current-intent lookup: latest non-superseded, actionable command per device.
CREATE INDEX IF NOT EXISTS idx_engine_commands_current_intent
  ON engine_commands(device_id)
  WHERE superseded_by_command_id IS NULL
    AND status IN ('requested','pending','sent','unconfirmed','delivered');

-- Reconciliation pass: find pending cancellations fast.
CREATE INDEX IF NOT EXISTS idx_engine_commands_cancel_pending
  ON engine_commands(device_id)
  WHERE cancellation_state = 'pending' AND traccar_command_id > 0;
