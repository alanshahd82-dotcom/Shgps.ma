// Who may call the API from a browser page. The website (FRONTEND_URL) and the
// phone app: Capacitor serves the packaged app from https://localhost (Android)
// or capacitor://localhost (iOS). Requests without an Origin header (same-origin
// pages, server-to-server) are not CORS requests and are unaffected.
export const NATIVE_APP_ORIGINS = ['https://localhost', 'capacitor://localhost']

export function allowedOrigins(frontendUrl = process.env.FRONTEND_URL) {
  return [frontendUrl, ...NATIVE_APP_ORIGINS].filter(Boolean)
}

export function corsOriginCheck(frontendUrl) {
  const list = allowedOrigins(frontendUrl)
  return (origin, callback) => callback(null, !origin || list.includes(origin))
}
