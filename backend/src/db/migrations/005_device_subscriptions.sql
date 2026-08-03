-- Migration 005 — Device-owned licenses, subscriptions, and renewal requests.
-- Additive and idempotent: legacy customer subscriptions remain readable.

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS activation_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS is_activated BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_activation_code
  ON devices(activation_code)
  WHERE activation_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS device_licenses (
  device_id       INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'expired'
                  CHECK (status IN ('active', 'expiring_soon', 'expired', 'suspended')),
  subscription_type VARCHAR(20),
  start_date      TIMESTAMP,
  end_date        TIMESTAMP,
  suspended_at    TIMESTAMP,
  suspended_reason TEXT,
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_licenses_status ON device_licenses(status);
CREATE INDEX IF NOT EXISTS idx_device_licenses_end_date ON device_licenses(end_date);

CREATE TABLE IF NOT EXISTS device_subscriptions (
  id              SERIAL PRIMARY KEY,
  device_id       INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  plan_months     INTEGER NOT NULL CHECK (plan_months IN (3, 6, 12)),
  price_mad       INTEGER NOT NULL CHECK (price_mad IN (70, 120, 220)),
  start_date      TIMESTAMP NOT NULL,
  end_date        TIMESTAMP NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (
    (plan_months = 3 AND price_mad = 70) OR
    (plan_months = 6 AND price_mad = 120) OR
    (plan_months = 12 AND price_mad = 220)
  ),
  CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_device_subscriptions_device
  ON device_subscriptions(device_id, end_date DESC);

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

CREATE INDEX IF NOT EXISTS idx_renewal_requests_status
  ON renewal_requests(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_renewal_requests_customer
  ON renewal_requests(customer_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_renewal_requests_device
  ON renewal_requests(device_id, requested_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_renewal_per_device
  ON renewal_requests(device_id)
  WHERE status = 'pending';

-- Ensure every existing GPS device has a license row. A valid legacy
-- customer-level expiry is bridged once below so existing customers do not
-- unexpectedly lose access during migration; all future renewals are device-owned.
INSERT INTO device_licenses (device_id, status)
SELECT id, 'expired'
FROM devices
ON CONFLICT (device_id) DO NOTHING;

-- Preserve access for legacy records that have a valid customer-level expiry.
-- This is a one-time compatibility bridge; all future renewals are device-owned.
INSERT INTO device_subscriptions
  (device_id, plan_months, price_mad, start_date, end_date)
SELECT d.id,
       CASE
         WHEN COALESCE(u.subscription_end::timestamp, u.expiry_date) -
              COALESCE(u.subscription_start::timestamp, NOW()) <= INTERVAL '100 days' THEN 3
         WHEN COALESCE(u.subscription_end::timestamp, u.expiry_date) -
              COALESCE(u.subscription_start::timestamp, NOW()) <= INTERVAL '250 days' THEN 6
         ELSE 12
       END,
       CASE
         WHEN COALESCE(u.subscription_end::timestamp, u.expiry_date) -
              COALESCE(u.subscription_start::timestamp, NOW()) <= INTERVAL '100 days' THEN 70
         WHEN COALESCE(u.subscription_end::timestamp, u.expiry_date) -
              COALESCE(u.subscription_start::timestamp, NOW()) <= INTERVAL '250 days' THEN 120
         ELSE 220
       END,
       COALESCE(u.subscription_start::timestamp, NOW()),
       COALESCE(u.subscription_end::timestamp, u.expiry_date)
  FROM devices d
  JOIN users u ON u.id = d.user_id
 WHERE COALESCE(u.subscription_end::timestamp, u.expiry_date) IS NOT NULL
   AND COALESCE(u.subscription_end::timestamp, u.expiry_date) > NOW()
   AND COALESCE(u.subscription_end::timestamp, u.expiry_date) >
       COALESCE(u.subscription_start::timestamp, NOW())
   AND NOT EXISTS (
     SELECT 1 FROM device_subscriptions ds WHERE ds.device_id = d.id
   );

UPDATE device_licenses dl
   SET status = CASE
                  WHEN ds.end_date <= NOW() THEN 'expired'
                  WHEN ds.end_date <= NOW() + INTERVAL '10 days' THEN 'expiring_soon'
                  ELSE 'active'
                END,
       subscription_type = ds.plan_months || ' Months',
       start_date = ds.start_date,
       end_date = ds.end_date,
       updated_at = NOW()
  FROM (
    SELECT DISTINCT ON (device_id) device_id, plan_months, start_date, end_date
      FROM device_subscriptions
     WHERE is_active = true
     ORDER BY device_id, end_date DESC, id DESC
  ) ds
 WHERE dl.device_id = ds.device_id;