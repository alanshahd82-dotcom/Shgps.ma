import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Zap, ZapOff, MapPin, Clock, Activity, Battery, Signal, Gauge, Navigation, Share2, Copy, CheckCheck, Loader2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import MapView from '../../components/MapView'
import ConfirmModal from '../../components/ConfirmModal'

function StatBadge({ label, value, icon: Icon, color = 'primary' }) {
  const colors = {
    primary: 'bg-primary-50 text-primary-500',
    green: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-500',
    red: 'bg-red-50 text-red-500',
  }
  return (
    <div className={`rounded-2xl p-3 ${colors[color]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={13} />
        <span className="text-[10px] font-medium opacity-70">{label}</span>
      </div>
      <p className="text-base font-bold">{value}</p>
    </div>
  )
}

export default function DeviceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { devices, toggleEngine, saveGeofence, removeGeofence, lang } = useApp()

  // id from useParams() is always a string; db ids may be numbers — coerce both sides
  const deviceFromCtx = devices.find(d => String(d.id) === String(id))

  const [activeTab, setActiveTab] = useState('map')
  const [showEngineModal, setShowEngineModal] = useState(false)
  const [geofenceCenter, setGeofenceCenter] = useState(null)
  const [geofenceRadius, setGeofenceRadius] = useState(500)
  const [geofenceLoading, setGeofenceLoading] = useState(false)
  const [geofenceError, setGeofenceError] = useState(null)
  const [engineSuccess, setEngineSuccess] = useState(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareLink, setShareLink] = useState(null)
  const [shareCopied, setShareCopied] = useState(false)

  // Fallback: if devices haven't loaded yet (e.g. page refresh), fetch this device directly
  const [fetchedDevice, setFetchedDevice] = useState(null)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    if (deviceFromCtx) return              // already in context — no need to fetch
    if (devices.length > 0) {             // context loaded but id not found → not found
      setFetchError(true)
      return
    }
    // context still loading (empty array on first render) → hit API directly
    api.devices.get(id)
      .then(d => setFetchedDevice(d))
      .catch(() => setFetchError(true))
  }, [id, deviceFromCtx, devices.length]) // eslint-disable-line

  const device = deviceFromCtx || fetchedDevice

  if (fetchError && !device) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-400">
        <p>{t(lang, 'noData')}</p>
        <button onClick={() => navigate(-1)} className="text-xs text-primary-400 underline">
          {lang === 'ar' ? 'رجوع' : 'Retour'}
        </button>
      </div>
    )
  }

  if (!device) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-400">
        <Loader2 size={28} className="animate-spin mb-2" />
        <p className="text-sm">{t(lang, 'loading')}</p>
      </div>
    )
  }

  const isOnline = device.status === 'online'
  const geofenceActive = !!device.geofenceActive

  const handleEngineToggle = () => {
    toggleEngine(device.id)
    setShowEngineModal(false)
    setEngineSuccess(device.engineOn ? t(lang, 'engineCutSuccess') : t(lang, 'engineStartSuccess'))
    setTimeout(() => setEngineSuccess(null), 3000)
  }

  const handleMapClick = (e) => {
    if (activeTab === 'geofence') {
      setGeofenceCenter([e.latlng.lat, e.latlng.lng])
    }
  }

  const handleToggleGeofence = async () => {
    setGeofenceError(null)
    setGeofenceLoading(true)
    try {
      if (geofenceActive) {
        // إلغاء السياج الجغرافي
        await removeGeofence(device.id, device.activeGeofenceId)
      } else {
        // تفعيل السياج الجغرافي
        const center = geofenceCenter || [device.lat, device.lng]
        await saveGeofence(device.id, {
          name: `${device.name}-geofence`,
          latitude: center[0],
          longitude: center[1],
          radius: geofenceRadius,
        })
      }
    } catch (e) {
      setGeofenceError(e.message || 'حدث خطأ، يرجى المحاولة مجدداً')
    } finally {
      setGeofenceLoading(false)
    }
  }

  const handleShareLocation = async () => {
    setShareLoading(true)
    setShareLink(null)
    try {
      const { token } = await api.sharing.create(device.id)
      const base = window.location.origin + window.location.pathname.replace('index.html', '')
      setShareLink(`${base}#/share/${token}`)
    } catch (e) {
      setEngineSuccess('❌ ' + (e.message || (lang === 'ar' ? 'فشل إنشاء الرابط' : 'Échec de la création du lien')))
      setTimeout(() => setEngineSuccess(null), 3000)
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopyLink = () => {
    if (!shareLink) return
    navigator.clipboard?.writeText(shareLink).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2500)
    })
  }

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div
          className="flex-shrink-0 pt-14 px-4 pb-4"
          style={{ background: 'linear-gradient(160deg, #0F2044 0%, #162d5e 100%)' }}
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
              { label: t(lang, 'speed'), val: `${device.speed}`, unit: t(lang, 'kmh'), icon: '⚡' },
              { label: t(lang, 'battery'), val: `${device.battery}`, unit: '%', icon: '🔋' },
              { label: t(lang, 'signal'), val: `${device.signal}`, unit: '/4', icon: '📶' },
              { label: t(lang, 'fuel'), val: `${device.fuel}`, unit: '%', icon: '⛽' },
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
              { key: 'map',      label: t(lang, 'liveTracking') },
              { key: 'trips',    label: t(lang, 'tripHistory') },
              { key: 'engine',   label: t(lang, 'engineControl') },
              { key: 'geofence', label: t(lang, 'geofence') },
              { key: 'share',    label: lang === 'ar' ? 'مشاركة' : 'Partager' },
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
              {/* Live indicator */}
              <div className="absolute top-3 left-3 glass rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm z-20">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-primary-500">{t(lang, 'liveTracking')}</span>
              </div>
              {/* Speed HUD */}
              {isOnline && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass rounded-2xl px-5 py-3 shadow-lg z-20 flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-black text-primary-500">{device.speed}</p>
                    <p className="text-[10px] text-slate-400">{t(lang, 'kmh')}</p>
                  </div>
                  <div className="w-px h-10 bg-gray-200" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-primary-500">{(device.totalDistance / 1000).toFixed(1)}</p>
                    <p className="text-[10px] text-slate-400">{lang === 'ar' ? 'ألف كم' : 'Mille km'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TRIPS TAB */}
          {activeTab === 'trips' && (
            <div className="h-full overflow-y-auto mobile-scroll pb-20 p-4 space-y-3">
              {device.trips.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                  <Navigation size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">{t(lang, 'noData')}</p>
                </div>
              ) : device.trips.map((trip, i) => (
                <motion.div
                  key={trip.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-primary-500 bg-primary-50 px-2 py-1 rounded-lg">{formatDate(trip.date)}</span>
                    <span className="text-xs text-slate-400">{trip.start} — {trip.end}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      <div className="w-0.5 h-8 bg-gray-200 my-0.5" />
                      <div className="w-2 h-2 rounded-full bg-primary-500" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <p className="text-[10px] text-slate-400">{t(lang, 'from')}</p>
                        <p className="text-xs font-semibold text-primary-500">{trip.from}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">{t(lang, 'to')}</p>
                        <p className="text-xs font-semibold text-primary-500">{trip.to}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-primary-500">{trip.distance}</p>
                      <p className="text-[10px] text-slate-400">{t(lang, 'km')}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* ENGINE TAB */}
          {activeTab === 'engine' && (
            <div className="h-full overflow-y-auto mobile-scroll pb-20 p-5">
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 text-center">
                <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center mb-4 ${
                  device.engineOn
                    ? 'bg-gradient-to-br from-emerald-400 to-accent shadow-lg shadow-emerald-200'
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
                      : 'bg-gradient-to-r from-accent to-emerald-500 text-primary-500'
                  }`}
                >
                  {device.engineOn ? t(lang, 'cutEngine') : t(lang, 'startEngine')}
                </button>
              </div>

              {/* Status log */}
              <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-slate-400 mb-3">
                  {lang === 'ar' ? 'سجل التحكم' : 'Journal de contrôle'}
                </p>
                {[
                  { time: '10:45', action: lang === 'ar' ? 'تشغيل المحرك' : 'Démarrage moteur', by: lang === 'ar' ? 'المستخدم' : 'Utilisateur' },
                  { time: '08:00', action: lang === 'ar' ? 'تشغيل المحرك' : 'Démarrage moteur', by: lang === 'ar' ? 'المستخدم' : 'Utilisateur' },
                  { time: '07:55', action: lang === 'ar' ? 'إيقاف المحرك' : 'Arrêt moteur', by: lang === 'ar' ? 'الأدمن' : 'Admin' },
                ].map((log, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-primary-500">{log.action}</p>
                      <p className="text-[10px] text-slate-400">{log.by}</p>
                    </div>
                    <span className="text-[10px] text-slate-400">{log.time}</span>
                  </div>
                ))}
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
                  showGeofence={geofenceActive}
                  geofenceCenter={geofenceCenter || [device.lat, device.lng]}
                  geofenceRadius={geofenceRadius}
                  onMapClick={handleMapClick}
                />
                {!geofenceCenter && !geofenceActive && (
                  <div className="absolute inset-x-4 top-3 glass rounded-2xl px-4 py-2.5 text-center z-20 shadow-sm">
                    <p className="text-xs font-semibold text-primary-500">📍 {t(lang, 'geofenceDesc')}</p>
                  </div>
                )}
                {geofenceActive && (
                  <div className="absolute inset-x-4 top-3 bg-accent/90 rounded-2xl px-4 py-2.5 text-center z-20">
                    <p className="text-xs font-bold text-primary-500">✅ {t(lang, 'geofenceActive')}</p>
                  </div>
                )}
              </div>

              <div className="bg-white px-4 py-3 shadow-t border-t border-gray-100 pb-20 space-y-3">
                {/* Radius slider */}
                {!geofenceActive && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-400">
                        {lang === 'ar' ? 'نصف القطر' : 'Rayon'}
                      </span>
                      <span className="text-xs font-bold text-primary-500">{geofenceRadius} م</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={5000}
                      step={100}
                      value={geofenceRadius}
                      onChange={e => setGeofenceRadius(Number(e.target.value))}
                      className="w-full accent-primary-500"
                    />
                  </div>
                )}

                {/* Error message */}
                {geofenceError && (
                  <p className="text-xs text-red-500 text-center">{geofenceError}</p>
                )}

                {/* Action button */}
                <button
                  onClick={handleToggleGeofence}
                  disabled={geofenceLoading}
                  className={`w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                    geofenceActive
                      ? 'bg-red-500 text-white'
                      : 'bg-primary-500 text-white'
                  }`}
                >
                  {geofenceLoading
                    ? (lang === 'ar' ? 'جاري التنفيذ...' : 'En cours...')
                    : geofenceActive
                      ? t(lang, 'deactivateGeofence')
                      : t(lang, 'activateGeofence')
                  }
                </button>
              </div>
            </div>
          )}

          {/* SHARE TAB */}
          {activeTab === 'share' && (
            <div className="h-full overflow-y-auto mobile-scroll pb-20 p-5 flex flex-col gap-4">
              <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/40 text-center">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                  <Share2 size={24} className="text-accent" />
                </div>
                <h3 className="text-white font-bold text-base mb-1">
                  {lang === 'ar' ? 'مشاركة الموقع المباشر' : 'Partager la position en direct'}
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  {lang === 'ar'
                    ? 'يولّد رابطاً مؤقتاً صالحاً لمدة 24 ساعة يعرض موقع المركبة دون الحاجة لتسجيل الدخول.'
                    : 'Génère un lien temporaire valable 24h pour partager la position du véhicule sans connexion.'}
                </p>
                <button
                  onClick={handleShareLocation}
                  disabled={shareLoading}
                  className="w-full py-3 bg-accent text-slate-900 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-transform"
                >
                  {shareLoading
                    ? <><Loader2 size={16} className="animate-spin" /> {lang === 'ar' ? 'جاري الإنشاء...' : 'Création...'}</>
                    : <><Share2 size={16} /> {lang === 'ar' ? 'إنشاء رابط المشاركة' : 'Créer un lien de partage'}</>}
                </button>
              </div>

              <AnimatePresence>
                {shareLink && (
                  <motion.div
                    className="bg-slate-800/60 rounded-2xl p-4 border border-accent/30"
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  >
                    <p className="text-xs text-slate-400 mb-2">
                      {lang === 'ar' ? '✅ الرابط جاهز — صالح لـ 24 ساعة:' : '✅ Lien prêt — valable 24h :'}
                    </p>
                    <div className="flex gap-2 items-center">
                      <p className="flex-1 text-[11px] text-accent break-all leading-relaxed">{shareLink}</p>
                      <button onClick={handleCopyLink}
                        className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 active:scale-90 transition-transform">
                        {shareCopied ? <CheckCheck size={15} className="text-accent" /> : <Copy size={15} className="text-accent" />}
                      </button>
                    </div>
                    {shareCopied && <p className="text-[10px] text-accent mt-1">{lang === 'ar' ? 'تم النسخ!' : 'Copié!'}</p>}
                  </motion.div>
                )}
              </AnimatePresence>
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

        {/* Success toast */}
        <AnimatePresence>
          {engineSuccess && (
            <motion.div
              className="absolute bottom-24 inset-x-4 bg-primary-500 text-white rounded-2xl px-4 py-3 text-center text-sm font-semibold shadow-xl z-50"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              ✅ {engineSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        <ClientNav />
      </div>
    </div>
  )
}
