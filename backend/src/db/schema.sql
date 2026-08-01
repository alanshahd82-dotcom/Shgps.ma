-- SHGPS Database Schema

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
    max_devices   INTEGER DEFAULT 5,
    expiry_date   TIMESTAMP,
    traccar_id    INTEGER UNIQUE,
    avatar        VARCHAR(10),
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS devices (
    id         SERIAL PRIMARY KEY,
    traccar_id INTEGER UNIQUE,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    imei       VARCHAR(20)  UNIQUE NOT NULL,
    type       VARCHAR(50)  DEFAULT 'car',
    plate      VARCHAR(50),
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

    -- Default admin  (password: Admin@1234 — CHANGE THIS IN PRODUCTION)
    INSERT INTO users (email, password_hash, name, is_admin, avatar)
    VALUES (
    'admin@shgps.ma',
    '$2b$10$ZvUexuJI0dAHaSm6hq2jZOPjS5wlvvIHLywBCz.8hK72GQSMu2z1m',
    'مدير النظام', true, 'م'
    ) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
    