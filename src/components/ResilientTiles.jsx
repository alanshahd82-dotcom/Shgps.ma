import React from 'react'
import MapTileLayer from './MapTileLayer'

// محفوظ بالاسم القديم — دابا كايستعمل طبقة Mapbox الموحّدة مع احتياطي OSM
export default function ResilientTiles({ satellite = false }) {
  return <MapTileLayer satellite={satellite} />
}
