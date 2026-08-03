export const config = {
  port:       process.env.PORT       || 3001,
  jwtSecret:  process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiry:  '7d',
  databaseUrl: process.env.DATABASE_URL,
  traccar: {
    url:      process.env.TRACCAR_URL            || 'http://localhost:8082',
    email:    process.env.TRACCAR_ADMIN_EMAIL    || '',
    password: process.env.TRACCAR_ADMIN_PASSWORD || '',
  },
  frontendUrl: process.env.FRONTEND_URL || '*',
}
