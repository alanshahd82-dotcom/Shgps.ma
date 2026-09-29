// Where the app talks to. In the browser the page and the API share one origin,
// so relative URLs work. Inside the phone app (Capacitor) the page is served from
// the app itself (https://localhost), so every address must point at the real server.
// A build-time VITE_* value still wins, for staging builds.

import { Capacitor } from '@capacitor/core'

export const PRODUCTION_ORIGIN = 'https://athargps.com'

export function isNativeApp(capacitor = Capacitor) {
  try { return Boolean(capacitor?.isNativePlatform?.()) } catch { return false }
}

export function resolveApiBase({ envUrl = '', native = isNativeApp() } = {}) {
  if (envUrl) return envUrl
  return native ? `${PRODUCTION_ORIGIN}/api` : '/api'
}

export function resolveWsBase({ envUrl = '', native = isNativeApp(), location = (typeof window !== 'undefined' ? window.location : { protocol: 'https:', host: 'athargps.com' }) } = {}) {
  if (envUrl) return envUrl
  if (native) return `wss://${new URL(PRODUCTION_ORIGIN).host}/api/socket`
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/socket`
}

// Public links (share links) must always use the public website, never the app's own origin.
export function publicOrigin({ native = isNativeApp(), origin = (typeof window !== 'undefined' ? window.location.origin : PRODUCTION_ORIGIN) } = {}) {
  return native ? PRODUCTION_ORIGIN : origin
}
