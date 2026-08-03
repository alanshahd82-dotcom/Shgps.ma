import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { db } from '../db.js'
import dotenv from 'dotenv'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))

const MIGRATIONS = [
  '001_baseline.sql',
  '002_geonix_features.sql',
  '003_sub_users.sql',
  '004_device_commands.sql',
]

export async function runMigrations() {
  // Ensure migrations table exists
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(50) PRIMARY KEY, applied_at TIMESTAMP DEFAULT NOW())`)
  const { rows: applied } = await db.query('SELECT version FROM schema_migrations')
  const appliedSet = new Set(applied.map(r => r.version))

  for (const file of MIGRATIONS) {
    if (appliedSet.has(file)) continue
    const sql = readFileSync(join(__dirname, 'migrations', file), 'utf-8')
    console.log(`[DB] Applying migration: ${file}`)
    await db.query(sql)
    await db.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file])
    console.log(`[DB] ✓ ${file}`)
  }
  console.log('[DB] All migrations applied')
}

// Allow running directly: node src/db/init.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => { console.log('✅ Database ready'); process.exit(0) })
    .catch(err => { console.error('❌', err.message); process.exit(1) })
}
