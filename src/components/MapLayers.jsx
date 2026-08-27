import React, { useEffect, useRef, useState } from 'react'
import MapTileLayer from './MapTileLayer'

const TILE_LOADING_TIMEOUT_MS = 2500

/**
 * الواجهة الموحّدة للبلاطات فكل الخرائط الداخلية.
 * البلاطات كاملة من Mapbox (شوف src/config/map.js)، والاحتياطي OSM.
 */
export default function MapLayers({ satellite = false, onSatelliteTimeout }) {
  const [tileLoaded, setTileLoaded] = useState(false)
  const readyRef = useRef(false)

  useEffect(() => {
    readyRef.current = false
    setTileLoaded(false)
  }, [satellite])

  useEffect(() => {
    if (!satellite) return undefined
    const timeout = window.setTimeout(() => {
      if (!readyRef.current) onSatelliteTimeout?.()
    }, 3000)
    return () => window.clearTimeout(timeout)
  }, [onSatelliteTimeout, satellite])

  useEffect(() => {
    // الخريطة ما خاصهاش تحجب الأزرار ولا المسار إلا تأخرت البلاطات
    const timeout = window.setTimeout(() => {
      setTileLoaded(true)
      if (satellite && !readyRef.current) onSatelliteTimeout?.()
    }, TILE_LOADING_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [onSatelliteTimeout, satellite])

  function handleTileLoad() {
    readyRef.current = true
    setTileLoaded(true)
  }

  return (
    <>
      {!tileLoaded && (
        <div className="athar-map-loading-surface" aria-hidden="true">
          <span className="athar-map-spinner" />
        </div>
      )}
      <MapTileLayer satellite={satellite} onTileLoad={handleTileLoad} />
    </>
  )
}
