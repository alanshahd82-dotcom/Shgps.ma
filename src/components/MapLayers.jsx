import React, { useEffect, useRef, useState } from 'react'
import { TileLayer } from 'react-leaflet'
import GeoapifyTileLayer from './GeoapifyTileLayer'

const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const CARTO_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const STREET_PROXY_URL = '/api/map/street-tiles/{z}/{x}/{y}.png'
const TILE_ERROR_LIMIT = 5
const TILE_ERROR_WINDOW_MS = 4000
const TILE_LOADING_TIMEOUT_MS = 2500

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

function CartoLayer({ onTileError, onTileLoad }) {
  return (
    <TileLayer
      url={CARTO_URL}
      subdomains="abcd"
      maxZoom={20}
      eventHandlers={{ tileerror: onTileError, tileload: onTileLoad }}
      attribution="© OpenStreetMap contributors © CARTO"
    />
  )
}

function StreetProxyLayer({ onTileError, onTileLoad }) {
  return (
    <TileLayer
      url={STREET_PROXY_URL}
      maxZoom={19}
      eventHandlers={{ tileerror: onTileError, tileload: onTileLoad }}
      attribution="© Esri"
    />
  )
}

export default function MapLayers({ satellite = false, onSatelliteTimeout, stable = false }) {
  const [sourceIndex, setSourceIndex] = useState(0)
  const [tileLoaded, setTileLoaded] = useState(false)
  const sourceIndexRef = useRef(0)
  const errorTimesRef = useRef([])
  const satelliteReadyRef = useRef(false)

  const sources = stable
    ? ['osm']
    : satellite
      ? ['esri', 'geoapify-hybrid', 'osm']
      : ['street', 'carto', 'geoapify', 'osm']

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

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      // A basemap is helpful, but it must never block the route, marker, or
      // replay controls. This is especially important when a tile provider
      // is unavailable or the app is opened offline.
      setTileLoaded(true)
      if (satellite && !satelliteReadyRef.current) onSatelliteTimeout?.()
    }, TILE_LOADING_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [onSatelliteTimeout, satellite, sourceIndex])

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
    } else if (recent.length > TILE_ERROR_LIMIT) {
      // A route and its controls are still useful without basemap imagery.
      // Do not leave an opaque spinner covering the replay forever.
      setTileLoaded(true)
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
  if (source === 'carto') {
    return (<>{loadingSurface}<CartoLayer key={source} onTileError={handleTileError} onTileLoad={handleTileLoad} /></>)
  }
  if (source === 'street') {
    return (<>{loadingSurface}<StreetProxyLayer key={source} onTileError={handleTileError} onTileLoad={handleTileLoad} /></>)
  }
  return (<>{loadingSurface}<OpenStreetMapLayer key={source} onTileError={handleTileError} onTileLoad={handleTileLoad} /></>)
}
