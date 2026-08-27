/**
 * ATHAR GPS — إعدادات الخريطة (المرجع الوحيد لكل الخرائط فالتطبيق)
 *
 * المفتاح ديال Mapbox ما كايتكتبش فالكود: كايتقرا من السيرفر عبر
 * `GET /api/map/config` (متغير MAPBOX_TOKEN فملف .env ديال السيرفر).
 * إلا ما كانش المفتاح، الخريطة كاتخدم بـ OpenStreetMap تلقائياً.
 */

export const MAPBOX_ATTRIBUTION =
  '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'

/** ستايلات Mapbox المستعملة فالتطبيق */
export const MAPBOX_STYLES = {
  streets: 'streets-v12',
  light: 'light-v11',
  dark: 'dark-v11',
  satellite: 'satellite-streets-v12',
}

export const MAP_MAX_ZOOM = 20
export const MAP_MAX_NATIVE_ZOOM = 19

/** بكسل شفاف بدل مربعات "غير متوفر" */
export const BLANK_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

/** المزوّد الاحتياطي (بلا مفتاح) */
export const FALLBACK_TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
  maxNativeZoom: 19,
}

export function resolveStyle({ satellite = false, dark = false } = {}) {
  if (satellite) return MAPBOX_STYLES.satellite
  return dark ? MAPBOX_STYLES.dark : MAPBOX_STYLES.streets
}

export function mapboxTileUrl(styleId, token) {
  if (!token) return null
  return `https://api.mapbox.com/styles/v1/mapbox/${styleId}/tiles/512/{z}/{x}/{y}{r}?access_token=${token}`
}

// ── جلب المفتاح مرة واحدة فقط وتخزينه فالذاكرة ────────────────────────────
let cachedToken = null
let inflight = null

export function getCachedMapboxToken() {
  if (cachedToken !== null) return cachedToken
  if (typeof window !== 'undefined' && window.__ATHAR_MAPBOX_TOKEN__) {
    cachedToken = window.__ATHAR_MAPBOX_TOKEN__
    return cachedToken
  }
  const envToken = import.meta.env?.VITE_MAPBOX_TOKEN
  if (envToken) {
    cachedToken = envToken
    return cachedToken
  }
  return null
}

export async function loadMapboxToken() {
  const cached = getCachedMapboxToken()
  if (cached !== null) return cached
  if (inflight) return inflight
  inflight = fetch('/api/map/config')
    .then(res => (res.ok ? res.json() : null))
    .then(data => {
      cachedToken = data?.mapboxToken || ''
      if (typeof window !== 'undefined') window.__ATHAR_MAPBOX_TOKEN__ = cachedToken
      return cachedToken
    })
    .catch(() => {
      cachedToken = ''
      return ''
    })
    .finally(() => { inflight = null })
  return inflight
}
