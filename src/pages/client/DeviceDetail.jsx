import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
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
import ConfirmModal from '../../components/ConfirmModal'
import { getDeviceStatusKey, timeAgo } from '../../components/ui'

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
  const { devices, lang } = useApp()
  const [tab, setTab] = useState('info')
  const [device, setDevice] = useState(devices.find(d => String(d.id) === String(id)) || null)
  const [loading, setLoading] = useState(!device)
  const [trips, setTrips] = useState([])
  const [tripsLoading, setTripsLoading] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [sending, setSending] = useState(false)
  const isAr = lang === 'ar'

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
    if (tab !== 'route') return
    async function loadTrips() {
      setTripsLoading(true)
      try {
        const data = await api.devices.get(id)
        setTrips(data.trips || data.route || [])
      } catch (e) { console.error(e) }
      finally { setTripsLoading(false) }
    }
    loadTrips()
  }, [tab, id])

  async function sendCommand(type) {
    setSending(true)
    try { await api.devices.sendCommand(id, type) } catch (e) { alert(e.message) }
    finally { setSending(false); setConfirm(null) }
  }

  async function generateShareLink() {
    try {
      const data = await api.devices.get(id)
      const token = data.share_token || data.shareToken
      if (token) setShareLink(window.location.origin + '/share/' + token)
    } catch (e) { alert(e.message) }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const positions = trips.filter(p => p.latitude && p.longitude).map(p => [Number(p.latitude), Number(p.longitude)])
  const speedData = trips.slice(-40).map((p, i) => ({ i, speed: Math.round(p.speed || 0) }))
  const cardStyle = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }

  if (loading && !device) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background:'#080f1f' }}>
      <div className="w-9 h-9 rounded-full border-2 animate-spin" style={{ borderColor:'#00D97E', borderTopColor:'transparent' }}/>
    </div>
  )

  return (
    <div className="min-h-screen pb-28" dir={isAr ? 'rtl' : 'ltr'}
      style={{ background:'linear-gradient(160deg,#080f1f 0%,#0F2044 100%)' }}>

      {/* Header */}
      <div className="px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background:'rgba(255,255,255,0.08)' }}>
          <ChevronLeft size={20} color="white" style={{ transform: isAr ? 'rotate(180deg)' : 'none' }}/>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg truncate">{device?.name || '...'}</h1>
          {device?.plate && <p className="text-xs font-mono" style={{ color:'rgba(255,255,255,0.35)' }}>{device.plate}</p>}
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0"
          style={{ background: stColor + '1a', border:'1px solid ' + stColor + '44' }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background:stColor }}/>
          <span className="text-xs font-semibold" style={{ color:stColor }}>{stLabel}</span>
        </div>
      </div>

      {/* Status bar */}
      <div className="h-0.5 mx-5 rounded-full mb-4" style={{ background: stColor, opacity:0.6 }}/>

      {/* Quick stats */}
      {device && (
        <div className="flex gap-2.5 px-5 mb-4 overflow-x-auto" style={{ scrollbarWidth:'none' }}>
          {[
            { Icon:Gauge,   label:isAr?'السرعة':'Vitesse', val: device.speed != null ? Math.round(device.speed)+' km/h' : '—', color:'#00D97E' },
            { Icon:Battery, label:isAr?'البطارية':'Batterie', val: device.battery != null ? device.battery+'%' : '—', color: device.battery < 30 ? '#FF3B30' : '#00D97E' },
            { Icon:Activity,label:isAr?'المحرك':'Moteur', val: device.ignition ? (isAr?'شغّال':'Marche') : (isAr?'موقوف':'Arrêt'), color: device.ignition ? '#00D97E' : '#6b7280' },
            { Icon:Clock,   label:isAr?'آخر تحديث':'Mis à jour', val: timeAgo(device.last_update), color:'rgba(255,255,255,0.5)' },
          ].map(({ Icon, label, val, color },i) => (
            <div key={i} className="flex-shrink-0 flex flex-col items-center p-3.5 rounded-2xl min-w-20"
              style={cardStyle}>
              <Icon size={16} style={{ color }} className="mb-1.5"/>
              <span className="text-xs font-bold text-white">{val}</span>
              <span className="text-[9px] mt-0.5" style={{ color:'rgba(255,255,255,0.3)' }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 px-5 mb-4 overflow-x-auto" style={{ scrollbarWidth:'none' }}>
        {TABS.map(({ key, Icon, ar, fr }) => (
          <motion.button key={key} whileTap={{ scale:0.94 }} onClick={() => setTab(key)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all"
            style={tab===key
              ? { background:'#00D97E', color:'#0F2044' }
              : { background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.48)', border:'1px solid rgba(255,255,255,0.1)' }}>
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
              {/* Mini map */}
              {device.lat && device.lng && (
                <div className="rounded-2xl overflow-hidden" style={{ height:180 }}>
                  <MapContainer center={[device.lat, device.lng]} zoom={14} style={{ height:'100%',width:'100%' }} zoomControl={false}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                    <Marker position={[device.lat, device.lng]}
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
                  { label: isAr?'الموقع':'Position', val: device.lat ? device.lat.toFixed(5)+', '+device.lng.toFixed(5) : '—' },
                  { label: isAr?'IMEI':'IMEI', val: device.imei || '—' },
                ].map((row,i,arr) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: i<arr.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <span className="text-xs" style={{ color:'rgba(255,255,255,0.38)' }}>{row.label}</span>
                    <span className="text-xs font-semibold text-white text-right max-w-48 truncate">{row.val}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ROUTE */}
          {tab === 'route' && (
            <motion.div key="route" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} className="space-y-3">
              {tripsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor:'#00D97E', borderTopColor:'transparent' }}/>
                </div>
              ) : (
                <>
                  {positions.length > 0 && (
                    <div className="rounded-2xl overflow-hidden" style={{ height:200 }}>
                      <MapContainer center={positions[0]} zoom={12} style={{ height:'100%',width:'100%' }} zoomControl={false}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                        <Polyline positions={positions} color="#00D97E" weight={3} opacity={0.8}/>
                        <FitRoute positions={positions}/>
                      </MapContainer>
                    </div>
                  )}
                  {speedData.length > 0 && (
                    <div className="p-4 rounded-2xl" style={cardStyle}>
                      <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color:'rgba(255,255,255,0.35)' }}>
                        {isAr ? 'منحنى السرعة' : 'Vitesse'}
                      </p>
                      <ResponsiveContainer width="100%" height={100}>
                        <LineChart data={speedData} margin={{ top:0,right:0,left:-20,bottom:0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                          <XAxis dataKey="i" hide/>
                          <YAxis tick={{ fill:'rgba(255,255,255,0.3)',fontSize:9 }} axisLine={false} tickLine={false}/>
                          <Tooltip contentStyle={{ background:'#0F2044', border:'1px solid rgba(255,255,255,0.15)', borderRadius:12, color:'white', fontSize:11 }}/>
                          <Line type="monotone" dataKey="speed" stroke="#00D97E" strokeWidth={2} dot={false}/>
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
                    <p className="text-white font-bold text-sm">{isAr ? ar : fr}</p>
                    <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.35)' }}>
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
                <Share2 size={32} className="mx-auto mb-3" style={{ color:'#00D97E' }}/>
                <p className="text-white font-semibold mb-1">{isAr ? 'مشاركة الموقع المباشر' : 'Partage de localisation live'}</p>
                <p className="text-xs mb-4" style={{ color:'rgba(255,255,255,0.38)' }}>
                  {isAr ? 'أنشئ رابطاً مؤقتاً لمشاركة الموقع المباشر للجهاز' : 'Créez un lien temporaire pour partager la position en temps réel'}
                </p>
                {!shareLink ? (
                  <motion.button whileTap={{ scale:0.96 }} onClick={generateShareLink}
                    className="px-6 py-3 rounded-xl text-sm font-bold text-white"
                    style={{ background:'linear-gradient(135deg,#00D97E,#00b86a)', boxShadow:'0 4px 16px rgba(0,217,126,0.3)' }}>
                    {isAr ? 'إنشاء رابط' : 'Créer le lien'}
                  </motion.button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 rounded-xl text-left break-all"
                      style={{ background:'rgba(0,217,126,0.08)', border:'1px solid rgba(0,217,126,0.2)' }}>
                      <p className="flex-1 text-xs text-white break-all">{shareLink}</p>
                    </div>
                    <button onClick={copyLink}
                      className="flex items-center gap-2 mx-auto px-4 py-2.5 rounded-xl text-xs font-semibold"
                      style={{ background: copied ? 'rgba(0,217,126,0.15)' : 'rgba(255,255,255,0.08)', color: copied ? '#00D97E' : 'white' }}>
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

      <ClientNav/>
    </div>
  )
}
