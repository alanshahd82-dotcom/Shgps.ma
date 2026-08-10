import React from 'react'
import { TileLayer } from 'react-leaflet'
import GeoapifyTileLayer from './GeoapifyTileLayer'

const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const LABELS_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

export default function MapLayers({ satellite = false }) {
  if (!satellite) return <GeoapifyTileLayer />

  return (
    <>
      <TileLayer
        url={SATELLITE_URL}
        maxZoom={19}
        attribution={'© Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'}
      />
      <TileLayer
        url={LABELS_URL}
        subdomains="abc"
        maxZoom={19}
        opacity={0.28}
        attribution={'© OpenStreetMap contributors'}
      />
    </>
  )
}