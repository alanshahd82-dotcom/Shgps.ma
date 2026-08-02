import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Navigation, Wifi, WifiOff, ChevronUp } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import MapView from '../../components/MapView'
import ClientNav from '../../components/ClientNav'
import { VehicleIcon, StatusDot, timeAgo, getDeviceStatusKey } from '../../components/ui'

const PANEL_PEEK = 88
const PANEL_OPEN = 270

export default function LiveMap() {
  const navigate = useNavigate()
  const { devices, lang, wsConnected } = useApp()
  const isAr = lang === 'ar'

  const [search, setSearch]       = useState('')
  const [focusId, setFocusId]     = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return devices
    return devices.filter(d =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.plate || '').toLowerCase().includes(q)
    )
  }, [devices, search])

  const onlineCount = devices.filter(d => d.status === 'online').length

  return (
    <div className="relative flex flex-col dark:bg-slate-900" style={{ height: '100dvh' }}>

      {/* ── Full-screen map ──────────────────────────────────────────────── */}
      <div className="absolute inset-0" style={{ bottom: 56 }}>
        <MapView
          showAllDevices
          deviceId={focusId}
          height="100%"
          zoom={focusId ? 15 : 11}
        />
      </div>

      {/* ── Floating top bar ─────────────────────────────────────────────── */}
      <div
        className="absolute left-0 right-0 z-20 flex flex-col gap-2 px-3"
        style={{ top: 'env(safe-area-inset-top, 0px)', paddingTop: 12 }}
      >
        {/* WS pill */}
        <div className="self-end">
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold"
            style={{
              background: wsConnected ? 'rgba(34,197,94,0.92)' : 'rgba(245,158,11,0.92)',
              color: 'white',
              backdropFilter: 'blur(8px)',
            }}
          >
            {wsConnected
              ? <><Wifi size={9} /> LIVE</>
              : <><WifiOff size={9} className="animate-pulse" /> {isAr ? 'إعادة الاتصال' : 'Reconnexion...'}</>
            }
          </div>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2.5 rounded-2xl px-4 py-3"
          style={{
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          <Search size={15} className="text-slate-400 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث عن مركبة...' : 'Rechercher un véhicule...'}
            className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
            dir={isAr ? 'rtl' : 'ltr'}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Stats chip */}
        <div
          className="self-start flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold"
          style={{ background: 'rgba(15,32,68,0.88)', color: 'white', backdropFilter: 'blur(8px)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          {onlineCount}/{devices.length} {isAr ? 'متصل' : 'en ligne'}
        </div>
      </div>

      {/* ── Focus chip ───────────────────────────────────────────────────── */}
      {focusId && (() => {
        const d = devices.find(x => x.id === focusId)
        if (!d) return null
        return (
          <div
            className="absolute z-20 flex items-center gap-2 px-3 py-2 rounded-2xl"
            style={{
              bottom: 155,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15,32,68,0.92)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Navigation size={11} className="text-accent" />
            <span className="text-white text-xs font-semibold whitespace-nowrap">{d.name}</span>
            <button onClick={() => setFocusId(null)} className="text-white/60 ml-1">
              <X size={11} />
            </button>
          </div>
        )
      })()}

      {/* ── Bottom vehicle drawer ─────────────────────────────────────────── */}
      <div
        className="absolute left-0 right-0 z-20"
        style={{
          bottom: 56,
          height: panelOpen ? PANEL_OPEN : PANEL_PEEK,
          transition: 'height 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div
          className="mx-2 h-full flex flex-col rounded-t-3xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          }}
        >
          {/* Handle */}
          <button
            className="w-full flex flex-col items-center pt-2.5 pb-2 flex-shrink-0"
            onClick={() => setPanelOpen(v => !v)}
            aria-label="Toggle vehicle list"
          >
            <div className="w-9 h-1 rounded-full bg-slate-300" />
            <div className="flex items-center gap-1.5 mt-1.5">
              <ChevronUp
                size={12}
                className="text-slate-400 transition-transform duration-300"
                style={{ transform: panelOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
              <span className="text-[11px] text-slate-500 font-medium">
                {filtered.length} {isAr ? 'مركبة' : 'véhicules'}
              </span>
            </div>
          </button>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
            {filtered.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-4">
                {isAr ? 'لا توجد نتائج' : 'Aucun résultat'}
              </p>
            ) : filtered.map(device => {
              const st = getDeviceStatusKey(device)
              const isFocused = focusId === device.id
              return (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => { setFocusId(isFocused ? null : device.id); setPanelOpen(false) }}
                  className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-start transition-all"
                  style={{
                    background: isFocused ? 'rgba(0,217,126,0.10)' : 'rgba(248,250,252,1)',
                    border: `1.5px solid ${isFocused ? 'rgba(0,217,126,0.40)' : 'rgba(226,232,240,1)'}`,
                  }}
                >
                  <VehicleIcon type={device.type} iconSize={14} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary-500 text-sm truncate">{device.name}</p>
                    <p className="text-slate-400 text-[10px]">{device.plate || '—'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <StatusDot status={st} size={7} />
                    {device.speed > 0 && (
                      <span className="text-[9px] font-bold text-slate-500">{device.speed} {t(lang, 'kmh')}</span>
                    )}
                    <span className="text-[9px] text-slate-400">{timeAgo(device.lastUpdate, lang)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom nav ───────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <ClientNav />
      </div>
    </div>
  )
}
