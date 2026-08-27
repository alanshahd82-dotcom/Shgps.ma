import React from 'react'
import MapTileLayer from './MapTileLayer'

/**
 * محفوظ بالاسم القديم باش ما نكسروش الصفحات اللي كاتستوردو،
 * ولكن دابا كايرجّع طبقة Mapbox الموحّدة.
 */
export default function GeoapifyTileLayer({ style, onTileError, onTileLoad }) {
  const satellite = typeof style === 'string' && /hybrid|satellite/i.test(style)
  return <MapTileLayer satellite={satellite} onTileError={onTileError} onTileLoad={onTileLoad} />
}
