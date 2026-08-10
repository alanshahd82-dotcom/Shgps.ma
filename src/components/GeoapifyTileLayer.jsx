import React from 'react'
import { TileLayer } from 'react-leaflet'

export default function GeoapifyTileLayer({
  style = 'osm-bright',
  onTileError,
  onTileLoad,
}) {
  return (
    <TileLayer
      url={`/api/map/tiles/{z}/{x}/{y}.png?style=${encodeURIComponent(style)}`}
      maxZoom={19}
      eventHandlers={{ tileerror: onTileError, tileload: onTileLoad }}
      attribution={'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · © <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>'}
    />
  )
}