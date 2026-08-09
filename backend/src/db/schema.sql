-- ATHAR GPS Database Schema
-- This file is the canonical reference. The runtime applies it via runMigrations()
-- in src/index.js which uses ALTER TABLE ADD COLUMN IF NOT EXISTS for safe idempotence.

CREATE TABLE IF NOT EXISTS users (
  id                 SERIAL PRIMARY KEY,
  email              VARCHAR(255) UNIQUE NOT NULL,
  password_hash      VARCHAR(255) NOT NULL,
  name               VARCHAR(255) NOT NULL,
  phone              VARCHAR(50),
  city               VARCHAR(100),
  subscription       VARCHAR(50) DEFAULT 'Basic',
  is_admin           BOOLEAN DEFAULT FALSE,
  is_active          BOOLEAN DEFAULT TRUE,
  max_devices        INTEGER DEFAULT 5,
  expiry_date        TIMESTAMP,
  traccar_id         INTEGER UNIQUE,
  avatar             VARCHAR(10),
  must_change_password BOOLEAN DEFAULT FALSE,
  notification_prefs JSONB DEFAULT '{}',
  -- Sub-user support
  parent_client_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role               VARCHAR(20) DEFAULT 'owner',
  -- Sub-admin support
  is_sub_admin       BOOLEAN DEFAULT FALSE,
  parent_admin_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  admin_permissions  JSONB DEFAULT '{"add_clients":true,"add_devices":true,"view_reports":true,"view_map":true,"view_alerts":true,"device_setup":false,"support_settings":false}',
  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id                     SERIAL PRIMARY KEY,
  traccar_id             INTEGER UNIQUE,
  user_id                INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name                   VARCHAR(255) NOT NULL,
  imei                   VARCHAR(20) UNIQUE NOT NULL,
  type                   VARCHAR(50) DEFAULT 'car',
  plate                  VARCHAR(50),
  driver                 VARCHAR(120),
  phone                  VARCHAR(20),
  subscription_plan_id   VARCHAR(32),
  subscription_start_date DATE,
  subscription_end_date  DATE,
  subscription_status    VARCHAR(20) DEFAULT 'active',
  created_at             TIMESTAMP DEFAULT NOW(),
  updated_at             TIMESTAMP DEFAULT NOW(),
  last_lat               DOUBLE PRECISION,
  last_lng               DOUBLE PRECISION,
  last_speed             NUMERIC(8,2),
  last_update            TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
  id         SERIAL PRIMARY KEY,
  device_id  INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  message    TEXT NOT NULL,
  data       JSONB,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS local_geofences (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  device_id    INTEGER REFERENCES devices(id) ON DELETE SET NULL,
  name         VARCHAR(255) NOT NULL,
  type         VARCHAR(20) NOT NULL DEFAULT 'circle',
  coords       JSONB NOT NULL,
  radius       NUMERIC(10,2),
  notify_enter BOOLEAN DEFAULT TRUE,
  notify_exit  BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id               SERIAL PRIMARY KEY,
  device_id        INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  type             VARCHAR(50) NOT NULL,
  note             TEXT,
  mileage          NUMERIC(12,2),
  date             TIMESTAMP DEFAULT NOW(),
  next_due_mileage NUMERIC(12,2),
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS share_links (
  id         SERIAL PRIMARY KEY,
  token      VARCHAR(64) UNIQUE NOT NULL,
  device_id  INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_behavior_scores (
  id              SERIAL PRIMARY KEY,
  device_id       INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
  score           INTEGER NOT NULL DEFAULT 100,
  speeding_events INTEGER DEFAULT 0,
  idle_min        INTEGER DEFAULT 0,
  trip_count      INTEGER DEFAULT 0,
  recorded_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (device_id, recorded_date)
);

CREATE TABLE IF NOT EXISTS leads (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  phone      VARCHAR(50) NOT NULL,
  email      VARCHAR(255),
  package    VARCHAR(50),
  message    TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sub-admin → client assignment
CREATE TABLE IF NOT EXISTS sub_admin_client_access (
  sub_admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (sub_admin_id, client_id)
);

-- Sub-user → specific device access (optional fine-grained control)
CREATE TABLE IF NOT EXISTS user_device_access (
  id          SERIAL PRIMARY KEY,
  sub_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id   INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(sub_user_id, device_id)
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_parent_client_id ON users(parent_client_id);
CREATE INDEX IF NOT EXISTS idx_devices_user_id        ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id         ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_device_id       ON alerts(device_id);

-- NOTE: No default admin account is seeded here.
-- Run `node src/setup-admin.js` after first deployment to create an admin account.

INSERT INTO app_settings (key, value)
VALUES (
  'support_contacts',
  '{"email":"support@athargps.ma","phone":"+212600000000","whatsapp":"212600000000","hours":"كل يوم من 09:00 إلى 18:00"}'
) ON CONFLICT (key) DO NOTHING;
