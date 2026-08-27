import React, { lazy, Suspense, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Polyline } from 'react-leaflet'
import { CalendarRange, Loader2, Play, Wifi, WifiOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { VehicleIcon } from '../../components/ui'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'
import MapView from '../../components/MapView'
import MapStyleToggle from '../../components/MapStyleToggle'
const TripReplay = lazy(() => import('../../components/TripReplay'))
import { api } from '../../api/index.js'

export default function GlobalMap() {
  const { devices, clientList, lang, wsConnected } = useApp()
  const navigate = useNavigate()
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
  const [replayDevice, setReplayDevice] = useState(null)
  const [replayPositions, setReplayPositions] = useState([])
  const [replayLoading, setReplayLoading] = useState(false)
  const [replayError, setReplayError] = useState('')
  const [todayRoute, setTodayRoute] = useState([])
  const [routeLoadingDeviceId, setRouteLoadingDeviceId] = useState(null)
  const [routeError, setRouteError] = useState('')
  const defaultStart = useMemo(() => { const date = new Date(); date.setHours(0, 0, 0, 0); return date.toISOString().slice(0, 16) }, [])
  const defaultEnd = useMemo(() => new Date().toISOString().slice(0, 16), [])
  const [replayFrom, setReplayFrom] = useState(defaultStart)
  const [replayTo, setReplayTo] = useState(defaultEnd)
  const [satelliteMode, setSatelliteMode] = useState(() => localStorage.getItem('athargps_map_style') === 'satellite')
  const [autoFollow, setAutoFollow] = useState(() => localStorage.getItem('athargps_auto_follow') !== 'false')
  const online = devices.filter(d => d.status === 'online')
  const offline = devices.filter(d => d.status !== 'online')

  const getClient = (clientId) => clientList.find(c => c.id === clientId)

  const changeSatelliteMode = value => {
    setSatelliteMode(value)
    localStorage.setItem('athargps_map_style', value ? 'satellite' : 'map')
  }

  const changeAutoFollow = value => {
    setAutoFollow(value)
    localStorage.setItem('athargps_auto_follow', String(value))
  }

  async function showTodayRoute(device) {
    if (routeLoadingDeviceId) return
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    setRouteLoadingDeviceId(device.id)
    setRouteError('')
    try {
      const points = await api.stats.getPositions(device.id, from.toISOString(), new Date().toISOString(), 1500)
      const route = points
        .map(point => [Number(point?.latitude ?? point?.lat), Number(point?.longitude ?? point?.lng)])
        .filter(([lat, lng]) =>
          Number.isFinite(lat) && Number.isFinite(lng)
          && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
        )
      if (route.length < 2) {
        setTodayRoute([])
        setRouteError(lang === 'ar' ? 'لا توجد نقاط كافية لمسار اليوم.' : 'Pas assez de points pour le trajet du jour.')
      } else {
        setTodayRoute(route)
      }
    } catch {
      setTodayRoute([])
      setRouteError(lang === 'ar' ? 'تعذّر تحميل مسار اليوم.' : 'Impossible de charger le trajet du jour.')
    } finally {
      setRouteLoadingDeviceId(null)
    }
  }

  return (
    <AdminLayout>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] lg:h-screen">
        {/* Sidebar */}
        <div className="lg:w-72 flex-shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-gray-100 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10">
            <h2 className="font-bold text-primary-500">{t(lang, 'globalMap')}</h2>
            <div className="flex gap-3 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                {online.length} {lang === 'ar' ? 'متصل' : 'en ligne'}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold">
                <span className="w-2 h-2 bg-gray-300 rounded-full" />
                {offline.length} {lang === 'ar' ? 'غير متصل' : 'hors ligne'}
              </div>
            </div>
          </div>

          {selectedDeviceId && (
            <div className="mx-3 mb-3 rounded-2xl border border-primary-100 bg-primary-50/50 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-primary-500"><CalendarRange size={14} />{t(lang, 'replay')}</div>
              <label className="mb-1 block text-[10px] text-slate-500">{t(lang, 'from')}</label>
              <input type="datetime-local" value={replayFrom} onChange={event => setReplayFrom(event.target.value)} className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] text-primary-500" />
              <label className="mb-1 block text-[10px] text-slate-500">{t(lang, 'to')}</label>
              <input type="datetime-local" value={replayTo} onChange={event => setReplayTo(event.target.value)} className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] text-primary-500" />
              {replayError && <p className="mb-2 text-[10px] font-semibold text-red-500">{replayError}</p>}
              {routeError && <p className="mb-2 text-[10px] font-semibold text-amber-600">{routeError}</p>}
              <button onClick={async () => {
                const device = devices.find(item => String(item.id) === String(selectedDeviceId))
                if (!device) return
                setReplayLoading(true); setReplayError('')
                try {
                   const points = await api.stats.getPositions(device.id, new Date(replayFrom).toISOString(), new Date(replayTo).toISOString(), 1500)
                  if (!Array.isArray(points) || points.length < 2) throw new Error('empty')
                  setReplayPositions(points); setReplayDevice(device)
                } catch {
                  setReplayError(lang === 'ar' ? 'لا توجد نقاط كافية في هذه الفترة.' : 'Pas assez de points sur cette période.')
                } finally { setReplayLoading(false) }
              }} disabled={replayLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-60">
                {replayLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                 {t(lang, 'replay')}
              </button>
            </div>
          )}

          {/* Device list */}
          <div className="p-3 space-y-1">
            {devices.map(device => {
              const client = getClient(device.clientId)
              const isOnline = device.status === 'online'
              const isSelected = selectedDeviceId === device.id
              return (
                <motion.button
                  key={device.id}
                  onClick={() => setSelectedDeviceId(isSelected ? null : device.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-primary-500 text-white'
                      : 'hover:bg-gray-50 text-primary-500'
                  }`}
                  whileTap={{ scale: 0.97 }}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                    isSelected ? 'bg-white/15' : isOnline ? 'bg-primary-50' : 'bg-gray-100'
                  }`}>
                    <VehicleIcon type={device.type} iconSize={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-primary-500'}`}>
                      {device.name}
                    </p>
                    <p className={`text-[10px] truncate ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                      {client?.name}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    {isOnline
                      ? <Wifi size={12} className={isSelected ? 'text-emerald-300' : 'text-emerald-500'} />
                      : <WifiOff size={12} className={isSelected ? 'text-white/50' : 'text-gray-300'} />
                    }
                    {isOnline && (
                      <span className={`text-[9px] font-bold ${isSelected ? 'text-white/80' : 'text-primary-400'}`}>
                        {device.speed} km/h
                      </span>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {/* Live badge */}
           <div className={`absolute top-4 right-4 z-20 rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm ${wsConnected ? 'bg-emerald-50' : 'bg-amber-50'}`}>
             <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
             <span className={`text-xs font-bold ${wsConnected ? 'text-emerald-700' : 'text-amber-700'}`}>{wsConnected ? t(lang, 'live') : t(lang, 'reconnecting')}</span>
          </div>
          <MapStyleToggle
            lang={lang}
            satellite={satelliteMode}
            onSatelliteChange={changeSatelliteMode}
            autoFollow={autoFollow}
            onAutoFollowChange={changeAutoFollow}
            style={{ top: 16, left: 16 }}
          />

             <MapView
            showAllDevices={!selectedDeviceId}
            deviceId={selectedDeviceId}
            height="100%"
            zoom={selectedDeviceId ? 14 : 6}
            satelliteMode={satelliteMode}
            autoFollow={autoFollow}
            onDeviceClick={device => {
              navigate('/client/vehicle/' + device.id)
            }}
            onRouteRequest={showTodayRoute}
            routeLoadingDeviceId={routeLoadingDeviceId}
            children={todayRoute.length > 1 ? (
              <>
                <Polyline positions={todayRoute} pathOptions={{ color: '#ffffff', weight: 7, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} />
                <Polyline positions={todayRoute} pathOptions={{ color: '#1e40af', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }} />
              </>
            ) : null}
          />
        </div>
      </div>
      {replayDevice && (
        <Suspense fallback={<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#0B1220]"><div className="h-9 w-9 animate-spin rounded-full border-2 border-[#35d39a] border-t-transparent" /></div>}>
          <TripReplay deviceId={replayDevice.id} deviceName={replayDevice.name} deviceType={replayDevice.type} startTime={replayFrom} endTime={replayTo} positions={replayPositions} onClose={() => { setReplayDevice(null); setReplayPositions([]) }} />
        </Suspense>
      )}
    </AdminLayout>
  )
}
