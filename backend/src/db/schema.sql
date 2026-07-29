-- Athar GPS Database Schema

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  phone         VARCHAR(50),
  city          VARCHAR(100),
  subscription  VARCHAR(50) DEFAULT 'Basic',
  is_admin      BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  traccar_id    INTEGER UNIQUE,
  avatar        VARCHAR(10),
  alert_settings JSONB DEFAULT '{"speed":true,"geofence":true,"battery":true}',
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id              SERIAL PRIMARY KEY,
  traccar_id      INTEGER UNIQUE,
  user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  imei            VARCHAR(20)  UNIQUE NOT NULL,
  type            VARCHAR(50)  DEFAULT 'car',
  plate           VARCHAR(50),
  protocol        VARCHAR(50)  DEFAULT 'GT06',
  activation_code VARCHAR(10)  UNIQUE,
  is_activated    BOOLEAN      DEFAULT FALSE,
  created_at      TIMESTAMP    DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS system_settings (
  key   VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL
);

-- Default admin  (password: Admin@1234 — CHANGE THIS IN PRODUCTION)
INSERT INTO users (email, password_hash, name, is_admin, avatar)
VALUES (
  'admin@athar-gps.ma',
  '$2b$10$ZvUexuJI0dAHaSm6hq2jZOPjS5wlvvIHLywBCz.8hK72GQSMu2z1m',
  'مدير النظام', true, 'م'
) ON CONFLICT (email) DO NOTHING;

-- Default system settings
INSERT INTO system_settings (key, value) VALUES
  ('company', '{"name":"Athar GPS","supportEmail":"support@athar-gps.ma","supportPhone":"+212 5 XX XX XX XX","logo":""}'),
  ('plans', '[{"name":"Basic","price":99,"device_limit":3},{"name":"Pro","price":199,"device_limit":10},{"name":"Enterprise","price":399,"device_limit":50}]')
ON CONFLICT (key) DO NOTHING;
