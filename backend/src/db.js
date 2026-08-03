import pg from 'pg'
import { config } from './config.js'

const { Pool } = pg

const useSSL = config.databaseUrl?.includes('sslmode=require')
export const db = new Pool({
  connectionString: config.databaseUrl,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
})

db.on('error', (err) => console.error('DB connection error:', err))
