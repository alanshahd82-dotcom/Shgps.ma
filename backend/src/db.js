import pg from 'pg'
    import { config } from './config.js'

    const { Pool } = pg

    // Only use SSL if explicitly requested in the connection string (not based on NODE_ENV,
// since Docker-internal postgres doesn't support SSL regardless of environment)
const useSSL = config.databaseUrl?.includes('sslmode=require')
export const db = new Pool({
    connectionString: config.databaseUrl,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
    })

    db.on('error', (err) => console.error('DB connection error:', err))
    