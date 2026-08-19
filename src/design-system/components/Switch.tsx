import React from 'react'

export interface SwitchProps {
  label?: string
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  description?: string
}

export function Switch({ label, checked = false, onChange, disabled, description }: SwitchProps) {
  return (
    <label className={`flex items-center justify-between gap-4 ${disabled ? 'opacity-50' : 'cursor-pointer'}`} dir="rtl">
      <span>{label && <span className="block text-sm font-medium text-primary">{label}</span>}{description && <span className="block text-xs text-slate-500">{description}</span>}</span>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange?.(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${checked ? 'bg-accent' : 'bg-border'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-0.5' : 'translate-x-5'}`} />
      </button>
    </label>
  )
}