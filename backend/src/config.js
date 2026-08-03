// backend/src/config.js
const jwtSecret = process.env.JWT_SECRET || ''
const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production'

const KNOWN_INSECURE_SECRETS = [
  'dev-secret-change-in-production',
  'dev-secret-change-in-production-min-32ch',
  'secret', 'jwt-secret', 'changeme', 'your-secret-key',
]

if (!jwtSecret) {
  if (isProduction) {
    console.error('[FATAL] JWT_SECRET is not set. Refusing to start in production without a secret.')
    process.exit(1)
  } else {
    console.warn('[WARN] JWT_SECRET not set — using insecure dev fallback. Never use this in production!')
  }
} else if (jwtSecret.length < 32) {
  if (isProduction) {
    console.error(`[FATAL] JWT_SECRET is too short (${jwtSecret.length} chars). Production requires at least 32 characters.`)
    process.exit(1)
  } else {
    console.warn(`[WARN] JWT_SECRET is only ${jwtSecret.length} chars — use at least 32 chars in production.`)
  }
} else if (isProduction && KNOWN_INSECURE_SECRETS.some(k => jwtSecret === k)) {
  console.error('[FATAL] JWT_SECRET is a known insecure placeholder. Generate a real secret: openssl rand -hex 32')
  process.exit(1)
}

export const config = {
  port:        process.env.PORT || 3001,
  jwtSecret:   jwtSecret || 'dev-secret-change-in-production-min-32ch',
  jwtExpiry:   '7d',
  databaseUrl: process.env.DATABASE_URL,
  traccar: {
    url:      process.env.TRACCAR_URL            || 'http://localhost:8082',
    email:    process.env.TRACCAR_ADMIN_EMAIL    || '',
    password: process.env.TRACCAR_ADMIN_PASSWORD || '',
  },
  frontendUrl: process.env.FRONTEND_URL || '',
}
