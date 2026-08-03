-- ═══════════════════════════════════════════════════════════════════════
-- Migration 002 — Geonix Features
-- Adds extra columns for advanced GPS SaaS features. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_start DATE,
  ADD COLUMN IF NOT EXISTS subscription_end   DATE,
  ADD COLUMN IF NOT EXISTS plan               VARCHAR(20) DEFAULT 'basic';

ALTER TABLE share_links
  ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_maintenance_device_id ON maintenance_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token     ON share_links(token);
