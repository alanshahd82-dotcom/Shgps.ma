import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Circle, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { LocateFixed, Loader2 } from 'lucide-react'

const ME_ICON = L.divIcon({
  className: 'athar-me-icon',
  html: '<span class="athar-me"><span class="athar-me__pulse"></span><span class="athar-me__dot"></span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

const TEXT = {
  ar: {
    label: 'موقعي',
    denied: 'لم يُسمح بالوصول إلى موقعك. فعّل إذن الموقع للتطبيق ثم أعد المحاولة.',
    failed: 'تعذّر تحديد موقعك حالياً. تأكد من تشغيل GPS في هاتفك وحاول مرة أخرى.',
    unsupported: 'هذا الجهاز لا يدعم تحديد الموقع.',
  },
  fr: {
    label: 'Ma position',
    denied: "L'accès à votre position est refusé. Autorisez la localisation puis réessayez.",
    failed: 'Impossible de déterminer votre position. Activez le GPS du téléphone et réessayez.',
    unsupported: "Cet appareil ne prend pas en charge la localisation.",
  },
}

// "My location": shows the phone's own GPS position as a blue dot with an
// accuracy circle, and keeps it updated while active. Rendered inside a Leaflet
// <MapContainer>. Tapping again re-centres on the phone.
export default function MyLocationControl({ isAr = true }) {
  const map = useMap()
  const t = isAr ? TEXT.ar : TEXT.fr
  const [status, setStatus] = useState('idle') // idle | locating | active
  const [me, setMe] = useState(null) // { lat, lng, accuracy }
  const [message, setMessage] = useState('')
  const watchRef = useRef(null)
  const firstFixRef = useRef(false)
  const meRef = useRef(null)

  const stop = useCallback(() => {
    if (watchRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = null
  }, [])

  useEffect(() => stop, [stop])
  useEffect(() => {
    if (!message) return undefined
    const id = window.setTimeout(() => setMessage(''), 6000)
    return () => window.clearTimeout(id)
  }, [message])

  const flyToMe = useCallback(point => {
    try { map.flyTo([point.lat, point.lng], Math.max(map.getZoom?.() ?? 15, 16), { duration: 0.8 }) } catch { /* map not ready */ }
  }, [map])

  const start = useCallback((auto = false) => {
    if (!navigator.geolocation) { if (!auto) setMessage(t.unsupported); return }
    if (watchRef.current != null) return
    setStatus('locating')
    setMessage('')
    // Auto-start (permission already granted) shows the dot without moving the map.
    firstFixRef.current = auto
    watchRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const point = { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }
        meRef.current = point
        setMe(point)
        setStatus('active')
        if (!firstFixRef.current) { firstFixRef.current = true; flyToMe(point) }
      },
      error => {
        stop()
        setStatus('idle')
        setMe(null)
        meRef.current = null
        if (!auto) setMessage(error?.code === 1 ? t.denied : t.failed)
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
  }, [flyToMe, stop, t.denied, t.failed, t.unsupported])

  // Ask for the position as soon as the map opens (the browser / OS shows its
  // one-time prompt). Only a permission the user already denied is left alone.
  useEffect(() => {
    let cancelled = false
    const begin = () => { if (!cancelled) start(true) }
    if (!navigator.permissions?.query) { begin(); return () => { cancelled = true } }
    navigator.permissions.query({ name: 'geolocation' })
      .then(result => { if (result.state !== 'denied') begin() })
      .catch(begin)
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onClick = event => {
    event.stopPropagation()
    if (status === 'active' && meRef.current) { flyToMe(meRef.current); return }
    if (status === 'locating') return
    start(false)
  }

  return (
    <>
      {me && <Circle center={[me.lat, me.lng]} radius={Math.min(Math.max(me.accuracy || 0, 5), 500)} pathOptions={{ color: '#2563eb', weight: 1, fillColor: '#2563eb', fillOpacity: 0.12 }} interactive={false} />}
      {me && <Marker position={[me.lat, me.lng]} icon={ME_ICON} interactive={false} keyboard={false} zIndexOffset={1000} />}
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={event => event.stopPropagation()}
        aria-label={t.label}
        title={t.label}
        aria-pressed={status === 'active'}
        className={`absolute bottom-[calc(80px+env(safe-area-inset-bottom))] end-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${status === 'active' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-primary hover:bg-slate-50'}`}
      >
        {status === 'locating' ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : <LocateFixed className="h-6 w-6" aria-hidden="true" />}
      </button>
      {message && (
        <div role="alert" dir={isAr ? 'rtl' : 'ltr'} className="pointer-events-none absolute inset-x-4 bottom-[calc(148px+env(safe-area-inset-bottom))] z-30 rounded-2xl bg-slate-900/90 px-4 py-3 text-center text-xs font-semibold leading-5 text-white shadow-lg">
          {message}
        </div>
      )}
    </>
  )
}
