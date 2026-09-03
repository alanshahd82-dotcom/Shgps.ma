-- Migration 007: Delivery authorization (Phase 2A)
-- Additive, idempotent, non-destructive. No DROP, no DELETE, no rename.
-- Adds delivery_authorization_expires_at to engine_commands.
-- Also applied idempotently at boot via runMigrations() in src/index.js.
--
-- Safety:
--   delivery_authorization_expires_at controls AUTOMATIC delivery only.
--   The original created_at establishes an absolute maximum lifetime of 30 days.
--   Reconfirmation may extend the authorization window by up to 24h, BUT NEVER
--   beyond created_at + 30 days. After that, the command is terminally expired.

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
