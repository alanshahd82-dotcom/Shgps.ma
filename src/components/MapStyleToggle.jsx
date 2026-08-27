import React from 'react'
import { LocateFixed, Map, Satellite } from 'lucide-react'
import { t } from '../i18n/translations'

export default function MapStyleToggle({ lang, satellite, onSatelliteChange, autoFollow, onAutoFollowChange, style = {} }) {
  return (
    <div
      className="absolute z-[500] flex items-center gap-1 rounded-2xl p-1"
      style={{
        top: 118,
        left: 14,
        background: 'rgba(6,12,26,0.92)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(18px)',
        boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
        direction: 'ltr',
        ...style,
      }}
    >
      <button
        type="button"
        onClick={() => onSatelliteChange(false)}
        aria-pressed={!satellite}
        title={t(lang, 'map')}
        className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-bold transition-colors"
        style={{
          background: !satellite ? 'rgba(29, 78, 216,0.2)' : 'transparent',
          color: !satellite ? '#7ff3bf' : 'rgba(255,255,255,0.62)',
        }}
      >
        <Map size={14} />
        <span>{t(lang, 'map')}</span>
      </button>
      <button
        type="button"
        onClick={() => onSatelliteChange(true)}
        aria-pressed={satellite}
        title={t(lang, 'satellite')}
        className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-bold transition-colors"
        style={{
          background: satellite ? 'rgba(29, 78, 216,0.2)' : 'transparent',
          color: satellite ? '#7ff3bf' : 'rgba(255,255,255,0.62)',
        }}
      >
        <Satellite size={14} />
        <span>{t(lang, 'satellite')}</span>
      </button>
      {onAutoFollowChange && (
        <button
          type="button"
          onClick={() => onAutoFollowChange(!autoFollow)}
          aria-pressed={autoFollow}
          title={t(lang, 'autoFollow')}
          className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-bold transition-colors"
          style={{
            background: autoFollow ? 'rgba(29, 78, 216,0.2)' : 'transparent',
            color: autoFollow ? '#7ff3bf' : 'rgba(255,255,255,0.62)',
          }}
        >
          <LocateFixed size={14} />
          <span>{t(lang, 'autoFollow')}</span>
        </button>
      )}
    </div>
  )
}