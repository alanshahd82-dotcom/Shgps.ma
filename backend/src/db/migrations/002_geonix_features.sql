-- ═══════════════════════════════════════════════════
-- Migration 002: GeonixPro Feature Completion
-- ═══════════════════════════════════════════════════

-- Maintenance table
CREATE TABLE IF NOT EXISTS maintenance (
  id          SERIAL PRIMARY KEY,
  device_id   INTEGER NOT NULL,
  client_id   INTEGER NOT NULL,
  type        VARCHAR(50) NOT NULL,
  date        DATE NOT NULL,
  next_date   DATE,
  cost        DECIMAL(10,2) DEFAULT 0,
  notes       TEXT,
  status      VARCHAR(20) DEFAULT 'completed',
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Share links table
CREATE TABLE IF NOT EXISTS share_links (
  id          SERIAL PRIMARY KEY,
  token       UUID DEFAULT gen_random_uuid() UNIQUE,
  device_id   INTEGER NOT NULL,
  client_id   INTEGER NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  views       INTEGER DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Client subscription fields
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS subscription_start DATE,
  ADD COLUMN IF NOT EXISTS subscription_end   DATE,
  ADD COLUMN IF NOT EXISTS max_devices        INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS plan               VARCHAR(20) DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS is_active          BOOLEAN DEFAULT true;

-- Driver behavior scores cache
CREATE TABLE IF NOT EXISTS driver_behavior_scores (
  id               SERIAL PRIMARY KEY,
  device_id        INTEGER NOT NULL,
  client_id        INTEGER NOT NULL,
  date             DATE NOT NULL,
  score            INTEGER DEFAULT 100,
  speeding_events  INTEGER DEFAULT 0,
  harsh_braking    INTEGER DEFAULT 0,
  driving_hours    DECIMAL(5,2) DEFAULT 0,
  details          JSONB,
  UNIQUE(device_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_maintenance_device   ON maintenance(device_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_client   ON maintenance(client_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token    ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_device   ON share_links(device_id);
CREATE INDEX IF NOT EXISTS idx_driver_scores_device ON driver_behavior_scores(device_id, date);
