// backend/src/config.js
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
  console.error('[FATAL] JWT_SECRET is not set. Please set it in your .env file.')
  process.exit(1)
}
if (jwtSecret.length < 32) {
  console.warn('[WARN] JWT_SECRET is shorter than 32 characters. Consider using a longer secret.')
}

export const config = {
  port:        process.env.PORT || 3001,
  jwtSecret,
  jwtExpiry:   '7d',
  databaseUrl: process.env.DATABASE_URL,
  traccar: {
    url:      process.env.TRACCAR_URL            || 'http://localhost:8082',
    email:    process.env.TRACCAR_ADMIN_EMAIL    || '',
    password: process.env.TRACCAR_ADMIN_PASSWORD || '',
  },
  frontendUrl: process.env.FRONTEND_URL || '',
}
