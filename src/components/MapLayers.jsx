import React, { useEffect, useRef, useState } from 'react'
import { TileLayer } from 'react-leaflet'
import GeoapifyTileLayer from './GeoapifyTileLayer'

const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const LABELS_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ERROR_LIMIT = 10
const TILE_ERROR_WINDOW_MS = 5000

function OpenStreetMapLayer({ onTileError, onTileLoad, labels = false }) {
  return (
    <TileLayer
      url={labels ? LABELS_URL : OSM_URL}
      subdomains="abc"
      maxZoom={19}
      opacity={labels ? 0.28 : 1}
      eventHandlers={{ tileerror: onTileError, tileload: onTileLoad }}
      attribution={'© OpenStreetMap contributors'}
    />
  )
}

export default function MapLayers({ satellite = false, onSatelliteTimeout }) {
  const [sourceIndex, setSourceIndex] = useState(0)
  const [tileLoaded, setTileLoaded] = useState(false)
  const sourceIndexRef = useRef(0)
  const errorTimesRef = useRef([])
  const satelliteReadyRef = useRef(false)

  const sources = satellite
    ? ['esri', 'geoapify-hybrid', 'osm']
    : ['geoapify', 'osm']

  useEffect(() => {
    sourceIndexRef.current = 0
    errorTimesRef.current = []
    satelliteReadyRef.current = false
    setSourceIndex(0)
    setTileLoaded(false)
  }, [satellite])

  useEffect(() => {
    if (!satellite) return undefined
    const timeout = window.setTimeout(() => {
      if (!satelliteReadyRef.current) onSatelliteTimeout?.()
    }, 3000)
    return () => window.clearTimeout(timeout)
  }, [onSatelliteTimeout, satellite])

  function handleTileLoad() {
    satelliteReadyRef.current = true
    errorTimesRef.current = []
    setTileLoaded(true)
  }

  function handleTileError() {
    const now = Date.now()
    const recentErrors = errorTimesRef.current.filter((time) => now - time < TILE_ERROR_WINDOW_MS)
    recentErrors.push(now)
    errorTimesRef.current = recentErrors

    if (recentErrors.length > TILE_ERROR_LIMIT && sourceIndexRef.current < sources.length - 1) {
      const nextIndex = sourceIndexRef.current + 1
      sourceIndexRef.current = nextIndex
      errorTimesRef.current = []
      satelliteReadyRef.current = false
      setSourceIndex(nextIndex)
    }
  }

  const source = sources[sourceIndex] || sources[0]
  const loadingSurface = !tileLoaded && (
    <div className="athar-map-loading-surface" aria-hidden="true">
      <span className="athar-map-spinner" />
    </div>
  )
  if (source === 'esri') {
    return (
      <>
        {loadingSurface}
        <TileLayer
          key={source}
          url={SATELLITE_URL}
          maxZoom={19}
          eventHandlers={{ tileerror: handleTileError, tileload: handleTileLoad }}
          attribution={'© Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'}
        />
      </>
    )
  }
  if (source === 'geoapify-hybrid') {
    return (
      <>
        {loadingSurface}
        <GeoapifyTileLayer
          key={source}
          style="hybrid"
          onTileError={handleTileError}
          onTileLoad={handleTileLoad}
        />
      </>
    )
  }
  if (source === 'geoapify') {
    return (
      <>
        {loadingSurface}
        <GeoapifyTileLayer
          key={source}
          onTileError={handleTileError}
          onTileLoad={handleTileLoad}
        />
      </>
    )
  }
  return (
    <>
      {loadingSurface}
      <OpenStreetMapLayer key={source} onTileError={handleTileError} onTileLoad={handleTileLoad} />
    </>
  )
}