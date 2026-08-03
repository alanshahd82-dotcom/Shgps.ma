-- SHGPS Database Schema — Canonical Reference
-- Do NOT run this file directly — use: node src/db/init.js

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    VARCHAR(50) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id                   SERIAL PRIMARY KEY,
  email                VARCHAR(255) UNIQUE NOT NULL,
  password_hash        VARCHAR(255) NOT NULL,
  name                 VARCHAR(255) NOT NULL,
  phone                VARCHAR(50),
  city                 VARCHAR(100),
  subscription         VARCHAR(50) DEFAULT 'Basic',
  is_admin             BOOLEAN DEFAULT FALSE,
  is_active            BOOLEAN DEFAULT TRUE,
  max_devices          INTEGER DEFAULT 5,
  expiry_date          TIMESTAMP,
  traccar_id           INTEGER UNIQUE,
  avatar               VARCHAR(10),
  must_change_password BOOLEAN DEFAULT FALSE,
  notification_prefs   JSONB DEFAULT '{}',
  parent_client_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role                 VARCHAR(20) DEFAULT 'owner',
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id          SERIAL PRIMARY KEY,
  traccar_id  INTEGER UNIQUE,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  imei        VARCHAR(20)  UNIQUE NOT NULL,
  type        VARCHAR(50)  DEFAULT 'car',
  plate       VARCHAR(50),
  phone       VARCHAR(20),
  last_lat    DOUBLE PRECISION,
  last_lng    DOUBLE PRECISION,
  last_speed  NUMERIC(8,2),
  last_update TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS activation_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS is_activated BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS local_geofences (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id)   ON DELETE CASCADE,
  device_id    INTEGER REFERENCES devices(id) ON DELETE SET NULL,
  name         VARCHAR(255) NOT NULL,
  type         VARCHAR(20)  NOT NULL DEFAULT 'circle',
  coords       JSONB        NOT NULL,
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
  mileage          NUMERIC(10,2),
  date             TIMESTAMP DEFAULT NOW(),
  next_due_mileage NUMERIC(10,2),
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS share_links (
  id         SERIAL PRIMARY KEY,
  token      VARCHAR(64) UNIQUE NOT NULL,
  device_id  INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  views      INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id         SERIAL PRIMARY KEY,
  device_id  INTEGER REFERENCES devices(id)  ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id)    ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  message    TEXT NOT NULL,
  data       JSONB,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  plan         VARCHAR(50) NOT NULL DEFAULT 'Basic',
  device_limit INTEGER NOT NULL DEFAULT 3,
  start_date   TIMESTAMP NOT NULL DEFAULT NOW(),
  end_date     TIMESTAMP NOT NULL,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_resets (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used       BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS driver_behavior_scores (
  id              SERIAL PRIMARY KEY,
  device_id       INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  user_id         INTEGER REFERENCES users(id)   ON DELETE CASCADE,
  score           INTEGER NOT NULL,
  speeding_events INTEGER DEFAULT 0,
  idle_min        INTEGER DEFAULT 0,
  trip_count      INTEGER DEFAULT 0,
  recorded_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(device_id, recorded_date)
);

CREATE TABLE IF NOT EXISTS leads (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  phone      VARCHAR(20)  NOT NULL,
  email      VARCHAR(100),
  package    VARCHAR(50),
  message    TEXT,
  status     VARCHAR(20) DEFAULT 'new',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
  key   VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS user_device_access (
  id          SERIAL PRIMARY KEY,
  sub_user_id INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  device_id   INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(sub_user_id, device_id)
);

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

CREATE TABLE IF NOT EXISTS device_licenses (
  device_id         INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  status            VARCHAR(20) NOT NULL DEFAULT 'expired'
                    CHECK (status IN ('active', 'expiring_soon', 'expired', 'suspended')),
  subscription_type VARCHAR(20),
  start_date        TIMESTAMP,
  end_date          TIMESTAMP,
  suspended_at      TIMESTAMP,
  suspended_reason  TEXT,
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_subscriptions (
  id          SERIAL PRIMARY KEY,
  device_id   INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  plan_months INTEGER NOT NULL CHECK (plan_months IN (3, 6, 12)),
  price_mad   INTEGER NOT NULL CHECK (price_mad IN (70, 120, 220)),
  start_date  TIMESTAMP NOT NULL,
  end_date    TIMESTAMP NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (
    (plan_months = 3 AND price_mad = 70) OR
    (plan_months = 6 AND price_mad = 120) OR
    (plan_months = 12 AND price_mad = 220)
  ),
  CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS renewal_requests (
  id              SERIAL PRIMARY KEY,
  device_id       INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  customer_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_name   VARCHAR(255) NOT NULL,
  customer_email  VARCHAR(255) NOT NULL,
  customer_phone  VARCHAR(50),
  device_name     VARCHAR(255) NOT NULL,
  imei            VARCHAR(20) NOT NULL,
  plan_months     INTEGER NOT NULL CHECK (plan_months IN (3, 6, 12)),
  price_mad       INTEGER NOT NULL CHECK (price_mad IN (70, 120, 220)),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMP,
  reviewed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  CHECK (
    (plan_months = 3 AND price_mad = 70) OR
    (plan_months = 6 AND price_mad = 120) OR
    (plan_months = 12 AND price_mad = 220)
  )
);

-- Default admin (password: Admin@1234 — CHANGE IN PRODUCTION)
INSERT INTO users (email, password_hash, name, is_admin, avatar)
VALUES (
  'admin@athar-gps.ma',
  '$2b$10$ZvUexuJI0dAHaSm6hq2jZOPjS5wlvvIHLywBCz.8hK72GQSMu2z1m',
  'مدير النظام', true, 'م'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO system_settings (key, value) VALUES
  ('company', '{"name":"Athar GPS","supportEmail":"support@athar-gps.ma","supportPhone":"+212 5 XX XX XX XX","logo":""}'),
  ('plans', '[{"name":"Basic","price":99,"device_limit":3},{"name":"Pro","price":199,"device_limit":10},{"name":"Enterprise","price":399,"device_limit":50}]')
ON CONFLICT (key) DO NOTHING;
