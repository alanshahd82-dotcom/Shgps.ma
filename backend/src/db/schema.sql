-- ATHAR GPS Database Schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  city VARCHAR(100),
  subscription VARCHAR(50) DEFAULT 'Basic',
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  max_devices INTEGER DEFAULT 5,
  expiry_date TIMESTAMP,
  traccar_id INTEGER UNIQUE,
  avatar VARCHAR(10),
  must_change_password BOOLEAN DEFAULT FALSE,
  notification_prefs JSONB DEFAULT '{}',
  parent_client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'owner',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  traccar_id INTEGER UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  imei VARCHAR(20) UNIQUE NOT NULL,
  type VARCHAR(50) DEFAULT 'car',
  plate VARCHAR(50),
  subscription_plan_id VARCHAR(32),
  subscription_start_date DATE,
  subscription_end_date DATE,
  subscription_status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_lat DOUBLE PRECISION,
  last_lng DOUBLE PRECISION,
  last_speed NUMERIC(8,2),
  last_update TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS local_geofences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'circle',
  coords JSONB NOT NULL,
  radius NUMERIC(10,2),
  notify_enter BOOLEAN DEFAULT TRUE,
  notify_exit BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  note TEXT,
  mileage NUMERIC(12,2),
  date TIMESTAMP DEFAULT NOW(),
  next_due_mileage NUMERIC(12,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS share_links (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) UNIQUE NOT NULL,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_behavior_scores (
  id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 100,
  speeding_events INTEGER DEFAULT 0,
  idle_min INTEGER DEFAULT 0,
  trip_count INTEGER DEFAULT 0,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (device_id, recorded_date)
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  package VARCHAR(50),
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- NOTE: No default admin account is seeded here.
-- Run `node src/setup-admin.js` after first deployment to create an admin account.

INSERT INTO app_settings (key, value)
VALUES (
  'support_contacts',
  '{"email":"support@athargps.ma","phone":"+212600000000","whatsapp":"212600000000","hours":"كل يوم من 09:00 إلى 18:00"}'
) ON CONFLICT (key) DO NOTHING;