import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  ChevronLeft, Zap, ZapOff, MapPin, Clock, Activity, Battery,
  Gauge, Share2, Copy, CheckCheck, Loader2, Map, Route as RouteIcon, Terminal
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import ConfirmModal from '../../components/ConfirmModal'
import { getDeviceStatusKey, timeAgo } from '../../components/ui'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import SubscriptionBadge from '../../components/SubscriptionBadge'
import SubscriptionRenewalModal from '../../components/SubscriptionRenewalModal'
import GeoapifyTileLayer from '../../components/GeoapifyTileLayer'

function finiteCoordinate(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function validPosition(lat, lng) {
  return (
    lat !== null &&
    lng !== null &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

function speedColor(s) {
  if (s > 120) return '#FF3B30'
  if (s > 80)  return '#FF9500'
  return '#00D97E'
}

function FitRoute({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 1) map.fitBounds(positions, { padding:[40,40], animate:true })
  }, [positions.length])
  return null
}

const TABS = [
  { key:'info',     Icon: MapPin,      ar: 'المعلومات',  fr: 'Infos'    },
  { key:'route',    Icon: RouteIcon,   ar: 'الرحلات',    fr: 'Trajets'  },
  { key:'commands', Icon: Terminal,    ar: 'الأوامر',    fr: 'Commandes'},
  { key:'share',    Icon: Share2,      ar: 'مشاركة',     fr: 'Partager' },
]

const COMMANDS = [
  { type:'engine_stop',  ar:'إيقاف المحرك',    fr:'Couper moteur', color:'#FF3B30', Icon: ZapOff },
  { type:'engine_start', ar:'تشغيل المحرك',    fr:'Démarrer moteur', color:'#00D97E', Icon: Zap   },
]

export default function DeviceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { devices, clientAuth, lang } = useApp()
  const [tab, setTab] = useState('info')
  const [device, setDevice] = useState(devices.find(d => String(d.id) === String(id)) || null)
  const [loading, setLoading] = useState(!device)
  const [trips, setTrips] = useState([])
  const [tripsLoading, setTripsLoading] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [sending, setSending] = useState(false)
  const [showRenew, setShowRenew] = useState(false)
  const [tripsError, setTripsError] = useState('')
  const [cmdMsg, setCmdMsg] = useState('')
  const [shareErr, setShareErr] = useState('')
  const [imeiCopied, setImeiCopied] = useState(false)
  const isAr = lang === 'ar'
  const trackingEnabled = device?.trackingEnabled !== false
  const latitude = finiteCoordinate(device?.lat) ?? finiteCoordinate(device?.last_lat)
  const longitude = finiteCoordinate(device?.lng) ?? finiteCoordinate(device?.last_lng)
  const currentSpeed = device?.speed ?? device?.last_speed
  const ignition = device?.ignition ?? device?.engineOn
  const lastUpdate = device?.lastUpdate ?? device?.last_update
  const canControlEngine = !clientAuth?.parentClientId || ['owner', 'manager'].includes(clientAuth?.role)
  const tabs = canControlEngine
    ? TABS
    : TABS.filter(tabItem => tabItem.key !== 'commands')

  const st = getDeviceStatusKey(device || {})
  const stColor = { moving:'#00D97E', idle:'#FF9500', stopped:'#FF3B30', offline:'#6b7280' }[st] || '#6b7280'
  const stLabel = { moving: isAr?'يتحرك':'En mouvement', idle:isAr?'خمول':'Ralenti', stopped:isAr?'متوقف':'Arrêté', offline:isAr?'غير متصل':'Hors ligne' }[st] || st

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      try { setDevice(await api.devices.get(id)) } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetch()
    const iv = setInterval(fetch, 10000)
    return () => clearInterval(iv)
  }, [id])

  useEffect(() => {
    if (tab !== 'route' || !trackingEnabled) return
    async function loadTrips() {
      setTripsLoading(true); setTripsError('')
      try {
        const now  = new Date()
        const from = new Date(now); from.setHours(0, 0, 0, 0)
        const data = await api.reports.get(id, from.toISOString(), now.toISOString())
        setTrips(data.trips || [])
      } catch (e) { setTripsError(isAr ? 'تعذّر تحميل الرحلات. تحقق من اتصالك وأعد المحاولة.' : 'Impossible de charger les trajets. Vérifiez votre connexion.') }
      finally { setTripsLoading(false) }
    }
    loadTrips()
  }, [tab, id, trackingEnabled])

  async function sendCommand(type) {
    setSending(true)
    try {
      await api.devices.sendCommand(id, type)
      setCmdMsg(isAr ? 'تم إرسال الأمر بنجاح ✓' : 'Commande envoyée avec succès ✓')
    } catch (e) { setCmdMsg(isAr ? 'تعذّر إرسال الأمر. حاول مرة أخرى.' : 'Erreur lors de la commande. Réessayez.') }
    finally { setSending(false); setConfirm(null) }
  }

  async function generateShareLink() {
    try {
      const data = await api.sharing.create(id, 24)
      const token = data.token || data.share_token || data.shareToken
      if (token) setShareLink(window.location.origin + '/share/' + token)
    } catch (e) { setShareErr(isAr ? 'تعذّر إنشاء الرابط. حاول مرة أخرى.' : 'Impossible de créer le lien. Réessayez.') }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const positions = trips
    .map(p => [finiteCoordinate(p.latitude), finiteCoordinate(p.longitude)])
    .filter(([lat, lng]) => validPosition(lat, lng))
  const speedData = trips.slice(-40).map((p, i) => ({ i, speed: Math.round(p.speed || 0) }))
  const cardStyle = { background:'#ffffff', border:'1px solid #e2e8f0', boxShadow:'0 4px 16px rgba(23,50,77,.04)' }

  if (loading && !device) return (
      <div className="client-app min-h-screen flex items-center justify-center bg-[#f5f7f8]">
       <div className="w-9 h-9 rounded-full border-2 animate-spin" style={{ borderColor:'#e4b56b', borderTopColor:'transparent' }}/>
    </div>
  )

  return (
    <div className="client-app min-h-screen bg-[#f5f7f8] pb-28" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />

      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
         <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-200 bg-white"
           >
           <ChevronLeft size={20} className="text-primary-500" style={{ transform: isAr ? 'rotate(180deg)' : 'none' }}/>
        </button>
        <div className="flex-1 min-w-0">
           <h1 className="text-primary-500 font-extrabold text-lg truncate">{device?.name || '...'}</h1>
           {device?.plate && <p className="text-xs font-mono text-slate-500">{device.plate}</p>}
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0"
          style={{ background: stColor + '1a', border:'1px solid ' + stColor + '44' }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background:stColor }}/>
             <span className="text-xs font-bold" style={{ color:stColor }}>{stLabel}</span>
        </div>
      </div>

      {/* Status bar */}
      <div className="h-0.5 mx-5 rounded-full mb-4" style={{ background: stColor, opacity:0.6 }}/>

      <div className="px-5 mb-4">
        <SubscriptionBanner device={device} lang={lang} onRenew={() => setShowRenew(true)} />
      </div>

      {/* Quick stats */}
      {device && (
        <div className="flex gap-2.5 px-5 mb-4 overflow-x-auto" style={{ scrollbarWidth:'none' }}>
          {[
             { Icon:Gauge,   label:isAr?'السرعة':'Vitesse', val: currentSpeed != null ? Math.round(currentSpeed)+' km/h' : '—', color:'#16866d' },
             { Icon:Battery, label:isAr?'البطارية':'Batterie', val: device.battery != null ? device.battery+'%' : '—', color: device.battery < 30 ? '#b64949' : '#16866d' },
            { Icon:Activity,label:isAr?'المحرك':'Moteur', val: ignition ? (isAr?'شغّال':'Marche') : (isAr?'موقوف':'Arrêt'), color: ignition ? '#00D97E' : '#6b7280' },
            { Icon:Clock,   label:isAr?'آخر تحديث':'Mis à jour', val: timeAgo(lastUpdate), color:'rgba(255,255,255,0.5)' },
          ].map(({ Icon, label, val, color },i) => (
            <div key={i} className="flex-shrink-0 flex flex-col items-center p-3.5 rounded-2xl min-w-20"
              style={cardStyle}>
              <Icon size={16} style={{ color }} className="mb-1.5"/>
               <span className="text-xs font-bold text-slate-800">{val}</span>
               <span className="text-[9px] mt-0.5 text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 px-5 mb-4 overflow-x-auto" style={{ scrollbarWidth:'none' }}>
        {tabs.map(({ key, Icon, ar, fr }) => (
          <motion.button key={key} whileTap={{ scale:0.94 }} onClick={() => setTab(key)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all"
               style={tab===key
               ? { background:'#17324d', color:'white' }
               : { background:'white', color:'#64748b', border:'1px solid #e2e8f0' }}>
            <Icon size={12}/>{isAr ? ar : fr}
          </motion.button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-5">
        <AnimatePresence mode="wait">
          {/* INFO */}
          {tab === 'info' && device && (
            <motion.div key="info" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} className="space-y-3">
              <div className="flex items-center justify-between">
                 <span className="text-xs text-slate-500">{isAr ? 'اشتراك الجهاز' : 'Abonnement appareil'}</span>
                <SubscriptionBadge device={device} lang={lang} dark />
              </div>
              {/* Offline / stale data guidance */}
              {device.status !== 'online' && lastUpdate && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl" style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
                  <span className="text-red-400 flex-shrink-0">⚡</span>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {isAr
                      ? `آخر اتصال منذ ${timeAgo(lastUpdate, lang)}. تحقق من طاقة الجهاز وتغطية الشبكة.`
                      : `Dernier signal il y a ${timeAgo(lastUpdate, lang)}. Vérifiez l'alimentation et la couverture réseau.`}
                  </p>
                </div>
              )}
              {/* Mini map */}
              {trackingEnabled && validPosition(latitude, longitude) && (
                <div className="rounded-2xl overflow-hidden" style={{ height:180 }}>
                  <MapContainer center={[latitude, longitude]} zoom={14} style={{ height:'100%',width:'100%' }} zoomControl={false}>
                    <GeoapifyTileLayer />
                    <Marker position={[latitude, longitude]}
                      icon={L.divIcon({ className:'', html:'<div style="width:14px;height:14px;border-radius:50%;background:'+stColor+';border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>', iconSize:[14,14], iconAnchor:[7,7] })}/>
                  </MapContainer>
                </div>
              )}
              {/* Detail rows */}
              <div className="rounded-2xl overflow-hidden" style={cardStyle}>
                {[
                  { label: isAr?'الجهاز':'Appareil', val: device.name },
                  { label: isAr?'اللوحة':'Plaque', val: device.plate || '—' },
                  { label: isAr?'السائق':'Conducteur', val: device.driver || '—' },
                  { label: isAr?'الموقع':'Position', val: validPosition(latitude, longitude) ? latitude.toFixed(5)+', '+longitude.toFixed(5) : '—' },
                  { label: isAr?'IMEI':'IMEI', val: device.imei ? (device.imei.slice(0,6)+'✦✦✦✦✦✦'+device.imei.slice(-4)) : '—', copy: device.imei },
                  { label: isAr?'آخر تحديث':'Dernier signal', val: lastUpdate ? timeAgo(lastUpdate, lang) : (isAr?'لا توجد بيانات':'Aucune donnée') },
                ].map((row,i,arr) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3"
                     style={{ borderBottom: i<arr.length-1 ? '1px solid #f1f5f9' : 'none' }}>
                     <span className="text-xs text-slate-500">{row.label}</span>
                     <div className="flex items-center gap-2">
                       <span className="text-xs font-semibold text-slate-800 text-right max-w-40 truncate">{row.val}</span>
                       {row.copy && (
                         <button
                           onClick={() => { navigator.clipboard.writeText(row.copy).catch(()=>{}); setImeiCopied(true); setTimeout(()=>setImeiCopied(false),2000) }}
                           aria-label={isAr?'نسخ IMEI':'Copier IMEI'}
                           className="flex-shrink-0 p-1 rounded-lg text-slate-400 transition-colors"
                         >
                           {imeiCopied ? <CheckCheck size={12} className="text-emerald-600"/> : <Copy size={12}/>}
                         </button>
                       )}
                     </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ROUTE */}
          {tab === 'route' && (
            <motion.div key="route" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} className="space-y-3">
              {!trackingEnabled ? (
                <SubscriptionBanner device={device} lang={lang} onRenew={() => setShowRenew(true)} />
              ) : tripsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor:'#e4b56b', borderTopColor:'transparent' }}/>
                </div>
              ) : tripsError ? (
                <div className="flex flex-col items-center p-6 rounded-2xl text-center" style={cardStyle}>
                  <p className="text-xs font-semibold text-red-500 mb-3">{tripsError}</p>
                  <button
                    onClick={() => { setTrips([]); setTripsError(''); setTab('info'); setTimeout(()=>setTab('route'),80) }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background:'#17324d' }}>
                    {isAr?'إعادة المحاولة':'Réessayer'}
                  </button>
                </div>
              ) : trips.length === 0 ? (
                <div className="flex flex-col items-center py-14" style={cardStyle}>
                  <RouteIcon size={32} className="mb-3 text-slate-300"/>
                  <p className="text-sm font-semibold text-slate-500">{isAr?'لا توجد رحلات مسجلة اليوم':'Aucun trajet enregistré aujourd\'hui'}</p>
                </div>
              ) : (
                <>
                  {positions.length > 0 && (
                    <div className="rounded-2xl overflow-hidden" style={{ height:200 }}>
                      <MapContainer center={positions[0]} zoom={12} style={{ height:'100%',width:'100%' }} zoomControl={false}>
                        <GeoapifyTileLayer />
                        <Polyline positions={positions} color="#16866d" weight={3} opacity={0.8}/>
                        <FitRoute positions={positions}/>
                      </MapContainer>
                    </div>
                  )}
                  {speedData.length > 0 && (
                    <div className="p-4 rounded-2xl" style={cardStyle}>
                      <p className="text-xs font-bold tracking-wide uppercase mb-3 text-slate-500">
                        {isAr ? 'منحنى السرعة' : 'Vitesse'}
                      </p>
                      <ResponsiveContainer width="100%" height={100}>
                        <LineChart data={speedData} margin={{ top:0,right:0,left:-20,bottom:0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                          <XAxis dataKey="i" hide/>
                          <YAxis tick={{ fill:'#94a3b8',fontSize:9 }} axisLine={false} tickLine={false}/>
                          <Tooltip contentStyle={{ background:'#17324d', border:'1px solid #31516e', borderRadius:10, color:'white', fontSize:11 }}/>
                          <Line type="monotone" dataKey="speed" stroke="#16866d" strokeWidth={2} dot={false}/>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* COMMANDS */}
          {tab === 'commands' && (
            <motion.div key="cmds" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} className="space-y-3">
              {cmdMsg && (
                <div className={`text-xs text-center px-4 py-2.5 rounded-xl font-medium ${cmdMsg.includes('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {cmdMsg}
                </div>
              )}
              {COMMANDS.map(({ type, ar, fr, color, Icon }) => (
                <motion.button key={type} whileTap={{ scale:0.97 }}
                  onClick={() => setConfirm({ type, label: isAr ? ar : fr })}
                  disabled={sending}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl disabled:opacity-50 transition-all"
                  style={{ background: color+'18', border:'1.5px solid '+color+'44' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: color+'22' }}>
                    <Icon size={22} style={{ color }}/>
                  </div>
                  <div className="text-left">
                    <p className="text-slate-800 font-bold text-sm">{isAr ? ar : fr}</p>
                    <p className="text-xs mt-0.5 text-slate-500">
                      {type === 'engine_stop' ? (isAr?'إيقاف المحرك عن بعد':'Coupure moteur à distance') : (isAr?'تشغيل المحرك عن بعد':'Démarrage moteur à distance')}
                    </p>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* SHARE */}
          {tab === 'share' && (
            <motion.div key="share" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} className="space-y-3">
              <div className="p-5 rounded-2xl text-center" style={cardStyle}>
                 <Share2 size={32} className="mx-auto mb-3 text-primary-500"/>
                 {shareErr && <p className="text-xs text-red-500 mb-2">{shareErr}</p>}
                 <p className="text-slate-800 font-extrabold mb-1">{isAr ? 'مشاركة الموقع المباشر' : 'Partage de localisation live'}</p>
                 <p className="text-xs mb-4 text-slate-500">
                  {isAr ? 'أنشئ رابطاً مؤقتاً لمشاركة الموقع المباشر للجهاز' : 'Créez un lien temporaire pour partager la position en temps réel'}
                </p>
                {!trackingEnabled ? (
                  <SubscriptionBanner device={device} lang={lang} onRenew={() => setShowRenew(true)} />
                ) : !shareLink ? (
                  <motion.button whileTap={{ scale:0.96 }} onClick={generateShareLink}
                    className="px-6 py-3 rounded-xl text-sm font-bold text-white"
                    style={{ background:'linear-gradient(135deg,#00D97E,#00b86a)', boxShadow:'0 4px 16px rgba(0,217,126,0.3)' }}>
                    {isAr ? 'إنشاء رابط' : 'Créer le lien'}
                  </motion.button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 rounded-xl text-left break-all"
                     style={{ background:'#f0faf6', border:'1px solid #bfe4d7' }}>
                       <p className="flex-1 text-xs text-slate-700 break-all">{shareLink}</p>
                    </div>
                    <button onClick={copyLink}
                      className="flex items-center gap-2 mx-auto px-4 py-2.5 rounded-xl text-xs font-semibold"
                      style={{ background: copied ? '#e8f5f0' : '#f8fafc', color: copied ? '#16866d' : '#17324d', border: '1px solid #e2e8f0' }}>
                      {copied ? <CheckCheck size={14}/> : <Copy size={14}/>}
                      {copied ? (isAr?'تم النسخ!':'Copié !') : (isAr?'نسخ الرابط':'Copier le lien')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirm modal */}
      {confirm && (
        <ConfirmModal
          title={isAr ? 'تأكيد الأمر' : 'Confirmer la commande'}
          message={(isAr ? 'هل تريد تنفيذ: ' : 'Exécuter : ') + confirm.label + ' ?'}
          onConfirm={() => sendCommand(confirm.type)}
          onCancel={() => setConfirm(null)}
          lang={lang}
        />
      )}

      <SubscriptionRenewalModal
        open={showRenew}
        device={device}
        lang={lang}
        onClose={() => setShowRenew(false)}
        onSaved={result => setDevice(current => ({ ...current, ...result, trackingEnabled: true, subscriptionStatus: 'active' }))}
      />

      <ClientNav/>
    </div>
  )
}
