-- ═══════════════════════════════════════════════════════════════════════
-- Migration 003 — Sub-users support. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS parent_client_id INTEGER,
  ADD COLUMN IF NOT EXISTS role             VARCHAR(20) DEFAULT 'owner';

DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_users_parent_client_id' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_parent_client_id
      FOREIGN KEY (parent_client_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $body$;

CREATE INDEX IF NOT EXISTS idx_users_parent_client_id ON users(parent_client_id);

CREATE TABLE IF NOT EXISTS user_device_access (
  id          SERIAL PRIMARY KEY,
  sub_user_id INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  device_id   INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(sub_user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_device_access_sub ON user_device_access(sub_user_id);
