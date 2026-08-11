#!/usr/bin/env node
// backend/src/db/migrate-audit-log.js
// Manual one-time migration. Run after deployment:
//   node src/db/migrate-audit-log.js

import dotenv from 'dotenv'
import { db }  from '../db.js'

dotenv.config()

console.log('Creating audit_logs table...')

await db.query(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id   INTEGER,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMP DEFAULT NOW()
  )
`)
await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id)`)
await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action)`)
await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`)

console.log('✅ audit_logs table ready.')
process.exit(0)
