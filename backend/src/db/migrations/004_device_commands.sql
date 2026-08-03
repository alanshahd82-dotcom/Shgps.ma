-- ═══════════════════════════════════════════════════════════════════════
-- Migration 004 — Device Commands Audit Log. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS device_commands (
  id          SERIAL PRIMARY KEY,
  device_id   INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  command     VARCHAR(50) NOT NULL,
  traccar_id  INTEGER,
  result      VARCHAR(20) DEFAULT 'sent',
  error_msg   TEXT,
  ip_address  VARCHAR(50),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_commands_device_id  ON device_commands(device_id);
CREATE INDEX IF NOT EXISTS idx_device_commands_user_id    ON device_commands(user_id);
CREATE INDEX IF NOT EXISTS idx_device_commands_created_at ON device_commands(created_at);
