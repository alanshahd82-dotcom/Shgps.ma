import { readFileSync } from 'fs'
    import { fileURLToPath } from 'url'
    import { dirname, join } from 'path'
    import { db } from '../db.js'
    import dotenv from 'dotenv'

    dotenv.config()

    const __dirname = dirname(fileURLToPath(import.meta.url))
    const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')

    async function init() {
    console.log('⏳ Initialising database…')
    for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
      await db.query(stmt)
    }
    console.log('✅ Database ready')
    await db.end()
    }

    init().catch(err => { console.error('❌', err.message); process.exit(1) })
    