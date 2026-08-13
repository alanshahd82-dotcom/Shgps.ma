import { useEffect, useRef, useState } from 'react'
import { TileLayer } from 'react-leaflet'

// سلسلة بدائل: إذا فشل مزوّد البلاطات يتحول تلقائياً للتالي
const CHAINS = {
  satellite: [
    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', max: 19, attribution: '© Esri' },
    { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, attribution: '© OpenStreetMap' },
  ],
  normal: [
    { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, attribution: '© OpenStreetMap' },
    { url: 'https://a.tile.openstreetmap.de/{z}/{x}/{y}.png', max: 19, attribution: '© OpenStreetMap DE' },
  ],
}

// بكسل شفاف بدل مربعات "غير متوفر" الرمادية/السوداء
const BLANK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

export default function ResilientTiles({ satellite = false }) {
  const [idx, setIdx] = useState(0)
  const errorsRef = useRef(0)
  const windowRef = useRef(Date.now())
  const chain = CHAINS[satellite ? 'satellite' : 'normal']
  const current = chain[Math.min(idx, chain.length - 1)]

  useEffect(() => { setIdx(0); errorsRef.current = 0 }, [satellite])

  function handleError() {
    const now = Date.now()
    if (now - windowRef.current > 5000) { errorsRef.current = 0; windowRef.current = now }
    errorsRef.current += 1
    if (errorsRef.current >= 6 && idx < chain.length - 1) {
      errorsRef.current = 0
      windowRef.current = now
      setIdx(i => Math.min(i + 1, chain.length - 1))
    }
  }

  return (
    <TileLayer
      key={`${satellite}-${idx}`}
      url={current.url}
      maxNativeZoom={current.max}
      attribution={current.attribution}
      keepBuffer={4}
      updateWhenIdle
      errorTileUrl={BLANK}
      eventHandlers={{ tileerror: handleError }}
    />
  )
}
