import React, { useEffect, useRef, useState } from 'react'
import { TileLayer } from 'react-leaflet'
import {
  BLANK_TILE,
  FALLBACK_TILES,
  MAPBOX_ATTRIBUTION,
  MAP_MAX_NATIVE_ZOOM,
  MAP_MAX_ZOOM,
  getCachedMapboxToken,
  loadMapboxToken,
  mapboxTileUrl,
  resolveStyle,
} from '../config/map'

const ERROR_LIMIT = 6
const ERROR_WINDOW_MS = 5000

/**
 * طبقة البلاطات الوحيدة فالتطبيق: Mapbox (بالمفتاح من السيرفر)
 * مع احتياطي OpenStreetMap إلا ما كانش المفتاح ولا طاح المزوّد.
 */
export default function MapTileLayer({
  satellite = false,
  dark = false,
  onTileError,
  onTileLoad,
}) {
  const [token, setToken] = useState(() => getCachedMapboxToken())
  const [failed, setFailed] = useState(false)
  const errorsRef = useRef(0)
  const windowRef = useRef(Date.now())
  const styleId = resolveStyle({ satellite, dark })

  useEffect(() => {
    if (token !== null) return undefined
    let alive = true
    loadMapboxToken().then(value => { if (alive) setToken(value) })
    return () => { alive = false }
  }, [token])

  useEffect(() => {
    setFailed(false)
    errorsRef.current = 0
  }, [satellite, dark])

  function handleError(event) {
    const now = Date.now()
    if (now - windowRef.current > ERROR_WINDOW_MS) {
      errorsRef.current = 0
      windowRef.current = now
    }
    errorsRef.current += 1
    if (errorsRef.current >= ERROR_LIMIT && !failed) setFailed(true)
    onTileError?.(event)
  }

  function handleLoad(event) {
    errorsRef.current = 0
    onTileLoad?.(event)
  }

  const url = failed ? null : mapboxTileUrl(styleId, token)

  if (!url) {
    return (
      <TileLayer
        key="osm-fallback"
        url={FALLBACK_TILES.url}
        attribution={FALLBACK_TILES.attribution}
        maxZoom={MAP_MAX_ZOOM}
        maxNativeZoom={FALLBACK_TILES.maxNativeZoom}
        keepBuffer={4}
        updateWhenIdle
        errorTileUrl={BLANK_TILE}
        eventHandlers={{ tileload: handleLoad }}
      />
    )
  }

  return (
    <TileLayer
      key={`mapbox-${styleId}`}
      url={url}
      attribution={MAPBOX_ATTRIBUTION}
      tileSize={512}
      zoomOffset={-1}
      maxZoom={MAP_MAX_ZOOM}
      maxNativeZoom={MAP_MAX_NATIVE_ZOOM}
      keepBuffer={4}
      updateWhenIdle
      errorTileUrl={BLANK_TILE}
      eventHandlers={{ tileerror: handleError, tileload: handleLoad }}
    />
  )
}
