import React from 'react'
import { TileLayer } from 'react-leaflet'

const TILE_URL = '/api/map/tiles/{z}/{x}/{y}.png?style=dark-matter'

export default function GeoapifyTileLayer() {
  return (
    <TileLayer
      url={TILE_URL}
      maxZoom={20}
      attribution={'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · © <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>'}
    />
  )
}