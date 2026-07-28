import pg from 'pg'
    import { config } from './config.js'

    const { Pool } = pg

    export const db = new Pool({
    connectionString: config.databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })

    db.on('error', (err) => console.error('DB connection error:', err))
    