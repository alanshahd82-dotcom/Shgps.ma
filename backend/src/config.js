// backend/src/config.js
if (!process.env.JWT_SECRET) {
  throw new Error('[FATAL] JWT_SECRET environment variable is required but not set. Set it in your .env file before starting the server.')
}

export const config = {
  port:        process.env.PORT || 3001,
  jwtSecret:   process.env.JWT_SECRET,
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
