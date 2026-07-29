import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Zap, ZapOff, Navigation, Loader2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index'
import MobileFrame from '../../components/MobileFrame'
import ClientNav from '../../components/ClientNav'
import MapView from '../../components/MapView'
import ConfirmModal from '../../components/ConfirmModal'

export default function DeviceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { devices, toggleEngine, lang } = useApp()
  const device = devices.find(d => d.id === id)

  const [activeTab, setActiveTab] = useState('map')
  const [showEngineModal, setShowEngineModal] = useState(false)
  const [showGeofence, setShowGeofence] = useState(false)
  const [geofenceCenter, setGeofenceCenter] = useState(null)
  const [geofenceRadius] = useState(500)
  const [engineSuccess, setEngineSuccess] = useState(null)
  const [engineError, setEngineError] = useState(null)

  // Trips state
  const [trips, setTrips] = useState([])
  const [tripsLoading, setTripsLoading] = useState(false)
  const [tripsError, setTripsError] = useState(null)
  const [tripFilter, setTripFilter] = useState('week') // today / week / month / custom
  const [tripFrom, setTripFrom] = useState('')
  const [tripTo, setTripTo] = useState('')

  // Geofence saving state
  const [geoSaving, setGeoSaving] = useState(false)
  const [geoSaved, setGeoSaved] = useState(false)
  const [geoError, setGeoError] = useState(null)

  // Load existing geofence from device data
  useEffect(() => {
    if (device?.geofence) {
      setGeofenceCenter([device.geofence.lat, device.geofence.lng])
      setShowGeofence(true)
    }
  }, [device?.id])

  // Fetch trips when tab opens
  useEffect(() => {
    if (activeTab !== 'trips' || !id) return
    fetchTrips()
  }, [activeTab, id, tripFilter])

  const fetchTrips = async () => {
    setTripsLoading(true)
    setTripsError(null)
    try {
      const now = new Date()
      let from, to = now.toISOString()
      if (tripFilter === 'today') {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      } else if (tripFilter === 'week') {
        from = new Date(Date.now() - 7 * 24 * 3600000).toISOString()
      } else if (tripFilter === 'month') {
        from = new Date(Date.now() - 30 * 24 * 3600000).toISOString()
      } else if (tripFilter === 'custom' && tripFrom && tripTo) {
        from = new Date(tripFrom).toISOString()
        to   = new Date(tripTo + 'T23:59:59').toISOString()
      } else {
        from = new Date(Date.now() - 7 * 24 * 3600000).toISOString()
      }
      const data = await api.stats.trips({ deviceId: id, from, to })
      setTrips(Array.isArray(data) ? data : [])
    } catch (err) {
      setTripsError(err.message)
    } finally {
      setTripsLoading(false)
    }
  }

  const handleSaveGeofence = async () => {
    if (!geofenceCenter) return
    setGeoSaving(true)
    setGeoError(null)
    try {
      await api.devices.saveGeofence(id, {
        lat: geofenceCenter[0],
        lng: geofenceCenter[1],
        radius: geofenceRadius,
        name: lang === 'ar' ? `جيوفنس - ${device.name}` : `Geofence - ${device.name}`,
      })
      setGeoSaved(true)
      setTimeout(() => setGeoSaved(false), 3000)
    } catch (err) {
      setGeoError(err.message)
    } finally {
      setGeoSaving(false)
    }
  }

  if (!device) {
    return (
      <MobileFrame>
        <div className="h-full flex items-center justify-center text-slate-400">
          <p>{t(lang, 'noData')}</p>
        </div>
      </MobileFrame>
    )
  }

  const isOnline = device.status === 'online'

  const handleEngineToggle = async () => {
    setShowEngineModal(false)
    setEngineError(null)
    try {
      await toggleEngine(device.id)
      setEngineSuccess(device.engineOn ? t(lang, 'engineCutSuccess') : t(lang, 'engineStartSuccess'))
      setTimeout(() => setEngineSuccess(null), 3000)
    } catch (err) {
      setEngineError(err.message)
      setTimeout(() => setEngineError(null), 4000)
    }
  }

  const handleMapClick = (e) => {
    if (activeTab === 'geofence') {
      setGeofenceCenter([e.latlng.lat, e.latlng.lng])
    }
  }

  const formatDate = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatDuration = (mins) => {
    if (!mins) return '0 min'
    if (mins < 60) return `${mins} min`
    return `${Math.floor(mins / 60)}h ${mins % 60}min`
  }

  return (
    <MobileFrame>
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div
          className="flex-shrink-0 pt-14 px-4 pb-4"
          style={{ background: 'linear-gradient(160deg, #0B1F3A 0%, #162d5e 100%)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center"
            >
              <ChevronLeft size={18} className="text-white" />
            </button>
            <div className="flex-1">
              <h1 className="text-white font-bold text-base truncate">{device.name}</h1>
              <p className="text-white/50 text-xs">{device.plate}</p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isOnline ? 'bg-emerald-400/20 text-emerald-300' : 'bg-gray-400/20 text-gray-300'}`}>
              {isOnline ? '● ' + t(lang, 'online') : '● ' + t(lang, 'offline')}
            </span>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: t(lang, 'speed'), val: `${device.speed ?? 0}`, unit: t(lang, 'kmh'), icon: '⚡' },
              { label: t(lang, 'battery'), val: `${device.battery ?? '—'}`, unit: device.battery != null ? '%' : '', icon: '🔋' },
              { label: t(lang, 'signal'), val: `${device.signal ?? '—'}`, unit: device.signal != null ? '/4' : '', icon: '📶' },
              { label: t(lang, 'fuel'), val: `${device.fuel ?? '—'}`, unit: device.fuel != null ? '%' : '', icon: '⛽' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-2 text-center">
                <div className="text-base">{s.icon}</div>
                <div className="text-white font-bold text-sm">{s.val}<span className="text-[10px] font-normal opacity-60">{s.unit}</span></div>
                <div className="text-white/40 text-[9px]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4">
          <div className="flex overflow-x-auto gap-1 py-2 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
            {[
              { key: 'map', label: t(lang, 'liveTracking') },
              { key: 'trips', label: t(lang, 'tripHistory') },
              { key: 'engine', label: t(lang, 'engineControl') },
              { key: 'geofence', label: t(lang, 'geofence') },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-xl transition-all ${
                  activeTab === tab.key
                    ? 'bg-primary-500 text-white'
                    : 'text-slate-400 hover:text-primary-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">

          {/* MAP TAB */}
          {activeTab === 'map' && (
            <div className="h-full relative">
              <MapView deviceId={device.id} height="100%" zoom={15} />
              <div className="absolute top-3 left-3 glass rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm z-20">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-primary-500">{t(lang, 'liveTracking')}</span>
              </div>
              {isOnline && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass rounded-2xl px-5 py-3 shadow-lg z-20 flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-black text-primary-500">{device.speed ?? 0}</p>
                    <p className="text-[10px] text-slate-400">{t(lang, 'kmh')}</p>
                  </div>
                  <div className="w-px h-10 bg-gray-200" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-primary-500">{((device.totalDistance || 0) / 1000).toFixed(1)}</p>
                    <p className="text-[10px] text-slate-400">{lang === 'ar' ? 'ألف كم' : 'Mille km'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TRIPS TAB */}
          {activeTab === 'trips' && (
            <div className="h-full flex flex-col">
              {/* Filter bar */}
              <div className="bg-white border-b border-gray-100 px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none flex-shrink-0">
                {[
                  { key: 'today', label: lang === 'ar' ? 'اليوم' : "Auj." },
                  { key: 'week',  label: lang === 'ar' ? 'أسبوع' : 'Semaine' },
                  { key: 'month', label: lang === 'ar' ? 'شهر' : 'Mois' },
                  { key: 'custom', label: lang === 'ar' ? 'مخصص' : 'Perso.' },
                ].map(f => (
                  <button key={f.key} onClick={() => setTripFilter(f.key)}
                    className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-xl font-semibold transition-all ${
                      tripFilter === f.key ? 'bg-primary-500 text-white' : 'bg-gray-100 text-slate-500'
                    }`}
                  >{f.label}</button>
                ))}
              </div>

              {/* Custom date inputs */}
              {tripFilter === 'custom' && (
                <div className="bg-white border-b border-gray-100 px-4 py-2 flex gap-2 flex-shrink-0">
                  <input type="date" value={tripFrom} onChange={e => setTripFrom(e.target.value)}
                    className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary-400" />
                  <input type="date" value={tripTo} onChange={e => setTripTo(e.target.value)}
                    className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary-400" />
                  <button onClick={fetchTrips}
                    className="text-xs bg-primary-500 text-white px-3 py-2 rounded-xl font-semibold">
                    {lang === 'ar' ? 'بحث' : 'OK'}
                  </button>
                </div>
              )}

              {/* Trip list */}
              <div className="flex-1 overflow-y-auto mobile-scroll pb-20 p-4 space-y-3">
                {tripsLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 size={28} className="animate-spin text-primary-300" />
                  </div>
                ) : tripsError ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                    <Navigation size={32} className="mb-2 opacity-30" />
                    <p className="text-xs text-red-400">{tripsError}</p>
                    <button onClick={fetchTrips} className="mt-2 text-xs text-primary-500 font-semibold">
                      {lang === 'ar' ? 'إعادة المحاولة' : 'Réessayer'}
                    </button>
                  </div>
                ) : trips.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                    <Navigation size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">{t(lang, 'noData')}</p>
                  </div>
                ) : trips.map((trip, i) => (
                  <motion.div
                    key={trip.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-primary-500 bg-primary-50 px-2 py-1 rounded-lg">
                        {formatDate(trip.startTime)}
                      </span>
                      <span className="text-xs text-slate-400">{formatDuration(trip.duration)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full" style={{ background: '#1DBF73' }} />
                        <div className="w-0.5 h-8 bg-gray-200 my-0.5" />
                        <div className="w-2 h-2 rounded-full bg-primary-500" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="text-xs text-slate-500">
                          {new Date(trip.startTime).toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(trip.endTime).toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-primary-500">{trip.distance}</p>
                        <p className="text-[10px] text-slate-400">{t(lang, 'km')}</p>
                        <p className="text-[10px] text-emerald-500 mt-0.5">⚡ {trip.averageSpeed} {t(lang, 'kmh')}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* ENGINE TAB */}
          {activeTab === 'engine' && (
            <div className="h-full overflow-y-auto mobile-scroll pb-20 p-5">
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 text-center">
                <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center mb-4 ${
                  device.engineOn
                    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-200'
                    : 'bg-gradient-to-br from-gray-200 to-gray-300'
                }`}>
                  {device.engineOn
                    ? <Zap size={40} className="text-white" />
                    : <ZapOff size={40} className="text-gray-400" />
                  }
                </div>
                <h3 className="font-bold text-primary-500 text-lg mb-1">
                  {device.engineOn ? t(lang, 'engineOn') : t(lang, 'engineOff')}
                </h3>
                <p className="text-slate-400 text-xs mb-6 leading-relaxed">
                  {lang === 'ar'
                    ? 'يمكنك التحكم في محرك المركبة عن بعد. استخدم هذه الميزة بحذر.'
                    : 'Vous pouvez contrôler le moteur du véhicule à distance. Utilisez cette fonctionnalité avec précaution.'}
                </p>
                <button
                  onClick={() => setShowEngineModal(true)}
                  className={`w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-95 ${
                    device.engineOn
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-gradient-to-r from-emerald-400 to-emerald-600 text-white'
                  }`}
                >
                  {device.engineOn ? t(lang, 'cutEngine') : t(lang, 'startEngine')}
                </button>
              </div>
            </div>
          )}

          {/* GEOFENCE TAB */}
          {activeTab === 'geofence' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 relative">
                <MapView
                  deviceId={device.id}
                  height="100%"
                  zoom={13}
                  showGeofence={showGeofence}
                  geofenceCenter={geofenceCenter || [device.lat, device.lng]}
                  geofenceRadius={geofenceRadius}
                  onMapClick={handleMapClick}
                />
                {!geofenceCenter && (
                  <div className="absolute inset-x-4 top-3 glass rounded-2xl px-4 py-2.5 text-center z-20 shadow-sm">
                    <p className="text-xs font-semibold text-primary-500">📍 {t(lang, 'geofenceDesc')}</p>
                  </div>
                )}
                {geoSaved && (
                  <div className="absolute inset-x-4 top-3 bg-emerald-500/90 rounded-2xl px-4 py-2.5 text-center z-20">
                    <p className="text-xs font-bold text-white">✅ {lang === 'ar' ? 'تم حفظ الجيوفنس بنجاح' : 'Géofence sauvegardé'}</p>
                  </div>
                )}
                {geoError && (
                  <div className="absolute inset-x-4 top-3 bg-red-500/90 rounded-2xl px-4 py-2.5 text-center z-20">
                    <p className="text-xs font-bold text-white">❌ {geoError}</p>
                  </div>
                )}
              </div>
              <div className="bg-white px-4 py-3 shadow-t border-t border-gray-100 pb-20">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (!geofenceCenter) setGeofenceCenter([device.lat, device.lng])
                      setShowGeofence(!showGeofence)
                    }}
                    className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all ${
                      showGeofence
                        ? 'bg-red-500 text-white'
                        : 'bg-primary-500 text-white'
                    }`}
                  >
                    {showGeofence ? t(lang, 'deactivateGeofence') : t(lang, 'activateGeofence')}
                  </button>
                  {geofenceCenter && (
                    <button
                      onClick={handleSaveGeofence}
                      disabled={geoSaving}
                      className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all bg-emerald-500 text-white disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {geoSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                      {lang === 'ar' ? 'حفظ' : 'Enregistrer'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Engine confirmation modal */}
        <ConfirmModal
          open={showEngineModal}
          title={device.engineOn ? t(lang, 'engineCutConfirmTitle') : t(lang, 'engineStartConfirmTitle')}
          message={device.engineOn ? t(lang, 'engineCutConfirmMsg') : t(lang, 'engineStartConfirmMsg')}
          confirmLabel={device.engineOn ? t(lang, 'cutEngine') : t(lang, 'startEngine')}
          cancelLabel={t(lang, 'cancel')}
          onConfirm={handleEngineToggle}
          onCancel={() => setShowEngineModal(false)}
          danger={device.engineOn}
        />

        {/* Toast messages */}
        <AnimatePresence>
          {engineSuccess && (
            <motion.div
              className="absolute bottom-24 inset-x-4 bg-emerald-500 text-white rounded-2xl px-4 py-3 text-center text-sm font-semibold shadow-xl z-50"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            >✅ {engineSuccess}</motion.div>
          )}
          {engineError && (
            <motion.div
              className="absolute bottom-24 inset-x-4 bg-red-500 text-white rounded-2xl px-4 py-3 text-center text-sm font-semibold shadow-xl z-50"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            >❌ {engineError}</motion.div>
          )}
        </AnimatePresence>

        <ClientNav />
      </div>
    </MobileFrame>
  )
}
