import React, { useEffect, useRef, useState } from 'react'
import { TileLayer } from 'react-leaflet'
import GeoapifyTileLayer from './GeoapifyTileLayer'

const PROXY_SAT_URL = '/api/map/sat-tiles/{z}/{x}/{y}.png'
const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ERROR_LIMIT = 5
const TILE_ERROR_WINDOW_MS = 4000

function OpenStreetMapLayer({ onTileError, onTileLoad }) {
  return (
    <TileLayer
      url={OSM_URL}
      subdomains="abc"
      maxZoom={19}
      eventHandlers={{ tileerror: onTileError, tileload: onTileLoad }}
      attribution="© OpenStreetMap contributors"
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
    ? ['proxy-sat', 'esri', 'geoapify-hybrid', 'osm']
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
    const recent = errorTimesRef.current.filter(t => now - t < TILE_ERROR_WINDOW_MS)
    recent.push(now)
    errorTimesRef.current = recent
    if (recent.length > TILE_ERROR_LIMIT && sourceIndexRef.current < sources.length - 1) {
      const next = sourceIndexRef.current + 1
      sourceIndexRef.current = next
      errorTimesRef.current = []
      satelliteReadyRef.current = false
      setSourceIndex(next)
    }
  }

  const source = sources[sourceIndex] || sources[0]
  const loadingSurface = !tileLoaded && (
    <div className="athar-map-loading-surface" aria-hidden="true">
      <span className="athar-map-spinner" />
    </div>
  )

  if (source === 'proxy-sat') {
    return (
      <>
        {loadingSurface}
        <TileLayer key={source} url={PROXY_SAT_URL} maxZoom={19}
          eventHandlers={{ tileerror: handleTileError, tileload: handleTileLoad }}
          attribution="© Esri — via Athar GPS proxy" />
      </>
    )
  }
  if (source === 'esri') {
    return (
      <>
        {loadingSurface}
        <TileLayer key={source} url={SATELLITE_URL} maxZoom={19}
          eventHandlers={{ tileerror: handleTileError, tileload: handleTileLoad }}
          attribution="© Esri" />
      </>
    )
  }
  if (source === 'geoapify-hybrid') {
    return (<>{loadingSurface}<GeoapifyTileLayer key={source} style="hybrid" onTileError={handleTileError} onTileLoad={handleTileLoad} /></>)
  }
  if (source === 'geoapify') {
    return (<>{loadingSurface}<GeoapifyTileLayer key={source} onTileError={handleTileError} onTileLoad={handleTileLoad} /></>)
  }
  return (<>{loadingSurface}<OpenStreetMapLayer key={source} onTileError={handleTileError} onTileLoad={handleTileLoad} /></>)
}
