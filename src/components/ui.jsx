/**
 * ATHAR GPS Design System — Shared UI primitives
 * No emoji. Mobile-first. Dark mode aware. RTL-safe.
 */
import React from 'react'
import { Loader2, AlertCircle, WifiOff } from 'lucide-react'
import { markerFor } from '../utils/vehicleAssets'

// ── Vehicle type icon ─────────────────────────────────────────────────────────
export function VehicleIcon({ type = 'car', iconSize = 18, className = '' }) {
  const marker = markerFor(type)
  const pad = iconSize + 14
  const label = type === 'bike' ? 'Motorcycle' : type === 'truck' ? 'Truck' : 'Car'
  return (
    <div
      className={`flex items-center justify-center rounded-xl flex-shrink-0 ${className}`}
      style={{
        background: 'linear-gradient(145deg, #102b5b, #08152d)',
        width: pad,
        height: pad,
        overflow: 'hidden',
      }}
      aria-label={label}
      title={label}
    >
      <img
        src={marker.url}
        alt=""
        aria-hidden="true"
        style={{
          width: `${Math.max(iconSize + 8, 28)}px`,
          height: `${Math.max(iconSize + 8, 28)}px`,
          objectFit: 'contain',
        }}
      />
    </div>
  )
}

export function getVoltageColor(value) {
  const voltage = Number(value)
  if (!Number.isFinite(voltage) || voltage <= 0) return '#94A3B8'
  if (voltage >= 12.4) return '#1DBF73'
  if (voltage >= 11.8) return '#FF9500'
  return '#FF3B30'
}

// Shows the same backend-provided voltage state everywhere. The formatter
// never infers disconnection from a missing voltage or from a stale UI clock.
export function formatVoltage(value, lang = 'ar', _lastUpdate = null, powerDisconnected = false) {
  const voltage = Number(value)
  if (Number.isFinite(voltage) && voltage > 0) return `${voltage.toFixed(1)} V`
  return powerDisconnected
    ? (lang === 'ar' ? 'مفصول' : 'Déconnecté')
    : '—'
}

export function VehicleTypeControl({ value = 'bike', onChange, lang = 'ar', className = '' }) {
  const options = [
    { value: 'car', ar: 'سيارة', fr: 'Voiture' },
    { value: 'bike', ar: 'دراجة نارية', fr: 'Moto' },
    { value: 'truck', ar: 'شاحنة', fr: 'Camion' },
  ]
  return (
    <div className={`grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 ${className}`} role="group" aria-label={lang === 'ar' ? 'نوع المركبة' : 'Type de véhicule'}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-lg px-2 py-2 text-xs font-bold transition-colors ${
            value === option.value
              ? 'bg-white text-primary-500 shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {lang === 'ar' ? option.ar : option.fr}
        </button>
      ))}
    </div>
  )
}

// ── Device status computation ─────────────────────────────────────────────────
export function hasGpsPosition(device) {
  const lat = Number(device?.lat ?? device?.last_lat)
  const lng = Number(device?.lng ?? device?.last_lng)
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90
    && lng >= -180 && lng <= 180
    && !(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)
}

export function getDeviceStatusKey(device) {
  if (!device) return 'offline'
  if (device.status !== 'online') return 'offline'
  if (!hasGpsPosition(device)) return 'awaiting_gps'
  const speed = device.speed ?? device.last_speed ?? 0
  if (speed > 2) return 'moving'
  const eng = device.engineOn ?? device.ignition ?? false
  if (eng) return 'idle'
  return 'stopped'
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  moving:   { dot: '#22c55e', bg: 'rgba(34,197,94,0.12)',   text: '#16a34a' },
  online:   { dot: '#22c55e', bg: 'rgba(34,197,94,0.12)',   text: '#16a34a' },
  idle:     { dot: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  text: '#b45309' },
  stopped:  { dot: '#ef4444', bg: 'rgba(239,68,68,0.12)',   text: '#dc2626' },
  offline:  { dot: '#94a3b8', bg: 'rgba(148,163,184,0.12)', text: '#64748b' },
  noSignal: { dot: '#94a3b8', bg: 'rgba(148,163,184,0.12)', text: '#64748b' },
}

const STATUS_LABEL = {
  moving:   { ar: 'يتحرك',    fr: 'En mouvement' },
  online:   { ar: 'متصل',     fr: 'En ligne'      },
  idle:     { ar: 'خامل',     fr: 'Ralenti'       },
  stopped:  { ar: 'متوقف',    fr: 'Arrêté'        },
  offline:  { ar: 'غير متصل', fr: 'Hors ligne'    },
  noSignal: { ar: 'لا إشارة', fr: 'Sans signal'   },
}

export function StatusDot({ status = 'offline', size = 8, className = '' }) {
  const { dot } = STATUS_CFG[status] || STATUS_CFG.offline
  return (
    <span
      className={`ds-status-dot ds-status-dot--${status} flex-shrink-0 ${className}`}
      style={{ width: size, height: size, background: dot }}
      role="img"
      aria-label={STATUS_LABEL[status]?.ar || status}
    />
  )
}

export function StatusBadge({ status = 'offline', lang = 'ar' }) {
  const { dot, bg, text } = STATUS_CFG[status] || STATUS_CFG.offline
  const label = STATUS_LABEL[status]?.[lang] ?? status
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: bg, color: text }}
    >
      <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: dot }} />
      {label}
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 24, className = '' }) {
  return <Loader2 size={size} className={`animate-spin text-accent ${className}`} />
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, className = '', onClick, padding = 'p-4' }) {
  const base = `ath-card ${padding}`
  if (onClick) {
    return (
      <button
        type="button"
        className={`${base} w-full text-start active:scale-[0.98] transition-transform ${className}`}
        onClick={onClick}
      >
        {children}
      </button>
    )
  }
  return <div className={`${base} ${className}`}>{children}</div>
}

// ── Section title row ─────────────────────────────────────────────────────────
export function SectionTitle({ children, action }) {
  return (
    <div className="ath-section-title flex items-center justify-between mb-2.5 px-1">
      <p className="font-bold text-primary-500 dark:text-white text-sm">{children}</p>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
export function Section({ children, className = '' }) {
  return <div className={`mx-3 mb-3 ${className}`}>{children}</div>
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, subtitle, action, className = '' }) {
  return (
    <div className={`ds-empty-state flex flex-col items-center justify-center py-14 px-6 text-center ${className}`}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <Icon size={26} className="text-slate-400" strokeWidth={1.5} />
        </div>
      )}
      <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{title}</p>
      {subtitle && (
        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1.5 leading-relaxed">{subtitle}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────
export function ErrorState({ message, onRetry, lang = 'ar' }) {
  return (
    <div className="ds-error-state flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
        <AlertCircle size={26} className="text-red-400" strokeWidth={1.5} />
      </div>
      <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-1">
        {lang === 'ar' ? 'حدث خطأ' : 'Une erreur est survenue'}
      </p>
      {message && <p className="text-slate-400 dark:text-slate-500 text-xs">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="ds-button ds-button--primary mt-4 px-5 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform"
        >
          {lang === 'ar' ? 'إعادة المحاولة' : 'Réessayer'}
        </button>
      )}
    </div>
  )
}

// ── Page header (gradient) ────────────────────────────────────────────────────
export function PageHeader({ children, className = '' }) {
  return (
    <div
      className={`ath-page-header flex-shrink-0 pb-4 px-4 ${className}`}
      style={{
        paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
        background: 'linear-gradient(160deg, var(--ds-color-navy) 0%, var(--ds-color-surface-soft) 100%)',
      }}
    >
      {children}
    </div>
  )
}

// ── Offline banner ────────────────────────────────────────────────────────────
export function OfflineBanner({ lang = 'ar' }) {
  return (
    <div className="ds-offline flex items-center gap-2 rounded-xl px-3 py-2.5 mx-4 mb-3">
      <WifiOff size={14} className="text-amber-500 flex-shrink-0" />
      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
        {lang === 'ar' ? 'تعذّر الاتصال بالخادم' : 'Impossible de joindre le serveur'}
      </p>
    </div>
  )
}

// ── Time-ago helper ───────────────────────────────────────────────────────────
export function timeAgo(iso, lang = 'ar') {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1)  return lang === 'ar' ? 'الآن'   : 'À l\'instant'
  if (diff < 60) return lang === 'ar' ? `${diff} د` : `${diff} min`
  const h = Math.floor(diff / 60)
  if (h < 24)    return lang === 'ar' ? `${h} س`  : `${h} h`
  return lang === 'ar' ? `${Math.floor(h / 24)} ي` : `${Math.floor(h / 24)} j`
}
