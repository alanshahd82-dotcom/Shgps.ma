import React from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectProps {
  label?: string
  options: { value: string; label: string }[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  error?: string
  className?: string
}

export function Select({ label, options, value, onChange, placeholder, disabled, error, className = '' }: SelectProps) {
  const id = `select-${label?.replace(/\s+/g, '-').toLowerCase() || 'field'}`
  return (
    <div className={`space-y-2 ${className}`} dir="rtl">
      {label && <label htmlFor={id} className="block text-xs text-slate-500">{label}</label>}
      <div className="relative">
        <select id={id} disabled={disabled} value={value} onChange={event => onChange?.(event.target.value)} aria-invalid={Boolean(error)} className={`h-11 w-full appearance-none rounded-[10px] border bg-white px-4 py-2 pe-10 text-sm text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50 ${error ? 'border-red-500' : 'border-border'}`}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      </div>
      {error && <p className="text-xs text-red-500" role="alert">{error}</p>}
    </div>
  )
}