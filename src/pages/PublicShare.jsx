import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { MapContainer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import GeoapifyTileLayer from '../components/GeoapifyTileLayer'
import 'leaflet/dist/leaflet.css'
import { Navigation, Car, Clock, AlertTriangle } from 'lucide-react'
import { api } from '../api/index.js'
import { markerFor } from '../utils/vehicleAssets'

function formatSpeed(value) {
  const speed = Number(value)
  return Number.isFinite(speed) ? `${Math.round(speed)} km/h` : 'السرعة غير متاحة / Vitesse indisponible'
}

// Fix default Leaflet icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function PublicShare() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)

  const fetchData = async () => {
    try {
      const d = await api.sharing.get(token)
      setData(d)
      setLoading(false)
    } catch (err) {
      setError(err.message || 'خطأ في الاتصال / Erreur de connexion')
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 15000)
    return () => clearInterval(intervalRef.current)
  }, [token]) // eslint-disable-line

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a1628' }}>
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm">جاري التحميل... / Chargement...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#0a1628' }}>
      <div className="text-center space-y-3 max-w-xs">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <p className="text-white font-semibold">الرابط منتهي أو غير صالح</p>
        <p className="text-slate-400 text-sm">Lien expiré ou invalide</p>
        <p className="text-red-400 text-xs">{error}</p>
      </div>
    </div>
  )

  const rawPosition = data.position
  const lat = rawPosition?.lat == null || rawPosition?.lat === '' ? NaN : Number(rawPosition.lat)
  const lng = rawPosition?.lng == null || rawPosition?.lng === '' ? NaN : Number(rawPosition.lng)
  const pos = Number.isFinite(lat) && Number.isFinite(lng)
    ? { ...rawPosition, lat, lng }
    : null
  const center = pos ? [pos.lat, pos.lng] : [33.9716, -6.8498]
  const expired = new Date(data.expiresAt) < new Date()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a1628' }}>
      {/* Header */}
      <div className="px-4 py-4 flex items-center gap-3" style={{ background: 'linear-gradient(160deg,#0F2044 0%,#162d5e 100%)' }}>
        <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
          <img src={markerFor(data.type).url} alt="" className="h-9 w-9 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base leading-tight truncate">{data.deviceName}</p>
          <p className="text-blue-200/60 text-xs">{data.plate || 'ATHAR GPS — موقع مباشر'}</p>
        </div>
        {expired && (
          <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded-full font-medium">
            منتهي / Expiré
          </span>
        )}
      </div>

      {/* Info bar */}
      {pos && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/50 text-xs text-slate-400 gap-3">
          <div className="flex items-center gap-1.5">
            <Navigation size={12} className="text-accent" />
            <span>{formatSpeed(pos.speed)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={12} />
            <span>{pos.fixTime ? new Date(pos.fixTime).toLocaleTimeString('ar-MA') : '—'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse inline-block" />
            <span>مباشر / En direct</span>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="flex-1" style={{ minHeight: 'calc(100vh - 120px)' }}>
        {pos ? (
          <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false} preferCanvas>
            <GeoapifyTileLayer />
            <Marker position={center} icon={L.divIcon({
              className: 'athar-public-vehicle',
              html: `<img src="${markerFor(data.type).url}" alt="" style="width:96px;height:64px;object-fit:contain;transform:rotate(${markerFor(data.type).offset}deg);filter:drop-shadow(0 4px 6px rgba(0,0,0,.45))" />`,
              iconSize: [96, 64],
              iconAnchor: [48, 64],
            })}>
              <Popup>
                <div className="text-sm font-semibold">{data.deviceName}</div>
                <div className="text-xs text-gray-500">{formatSpeed(pos.speed)}</div>
              </Popup>
            </Marker>
          </MapContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <img src={markerFor(data.type).url} alt="" className="h-16 w-24 object-contain opacity-30 mx-auto" />
              <p className="text-slate-400 text-sm">لا يوجد موقع حالي / Position indisponible</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="py-2 px-4 text-center text-[10px] text-slate-600">
        ATHAR GPS · {new Date(data.expiresAt).toLocaleDateString('fr-MA')} ·&nbsp;
        <a href="/" className="text-accent/60 hover:text-accent">athargps.ma</a>
      </div>
    </div>
  )
}
