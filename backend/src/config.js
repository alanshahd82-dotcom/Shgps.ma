// backend/src/config.js
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret || jwtSecret.length < 32) {
  console.error('[FATAL] JWT_SECRET must be set and at least 32 characters long.')
  process.exit(1)
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
