-- Migration 003: Add sub-users support
-- Run manually: psql -d $DB_NAME -f 003_sub_users.sql

-- Add parent_client_id and role columns to users table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='parent_client_id') THEN
    ALTER TABLE users ADD COLUMN parent_client_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
    ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'owner';
  END IF;
END $$;

-- Index for quick lookups of sub-users by parent
CREATE INDEX IF NOT EXISTS idx_users_parent_client_id ON users(parent_client_id);

-- Optional: user_device_access table for fine-grained per-device permissions
CREATE TABLE IF NOT EXISTS user_device_access (
  id           SERIAL PRIMARY KEY,
  sub_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id    INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  created_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(sub_user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_device_access_sub ON user_device_access(sub_user_id);
