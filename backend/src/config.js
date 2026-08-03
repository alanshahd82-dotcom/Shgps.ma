// backend/src/config.js
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production'
if (!process.env.JWT_SECRET) {
  console.warn('[WARN] JWT_SECRET not set in environment. Using insecure default — set it in .env for production!')
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
  geoapify: {
    apiKey: process.env.GEOAPIFY_API_KEY || '',
    style: process.env.GEOAPIFY_MAP_STYLE || 'osm-bright',
  },
}
