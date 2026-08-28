import { useEffect, useState } from 'react'
import { loadMapboxToken } from '../config/map'

const cache = new Map()
const TTL = 10 * 60 * 1000

export function useReverseGeocode(lat, lng, fallback = null) {
  const [text, setText] = useState(fallback)
  const geoKey = (lat != null && lng != null)
    ? `${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`
    : null

  useEffect(() => {
    if (fallback) { setText(fallback); return }
    if (!geoKey) { setText(null); return }
    const hit = cache.get(geoKey)
    if (hit && Date.now() - hit.ts < TTL) { setText(hit.text); return }
    let cancelled = false
    loadMapboxToken().then(token => {
      if (!token || cancelled) return null
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${Number(lng)},${Number(lat)}.json?access_token=${token}&limit=1&language=ar`
      return fetch(url)
    }).then(r => r?.ok ? r.json() : null).then(d => {
      if (cancelled || !d) return
      const t = d?.features?.[0]?.text || null
      cache.set(geoKey, { ts: Date.now(), text: t })
      setText(t)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [geoKey, fallback])
  return text
}
