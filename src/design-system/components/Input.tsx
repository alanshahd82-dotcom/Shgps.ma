import React from 'react'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string
  onChange?: (value: string) => void
  error?: string
  icon?: React.ReactNode
}

export function Input({ label, placeholder, value, onChange, onBlur, error, icon, className = '', id, required, ...props }: InputProps) {
  const inputId = id || `input-${label?.replace(/\s+/g, '-').toLowerCase() || 'field'}`
  return (
    <div className={`space-y-2 ${className}`} dir="rtl">
      {label && <label htmlFor={inputId} className="block text-xs text-slate-500">{label}{required && <span className="ms-1 text-red-500" aria-hidden="true">*</span>}</label>}
      <div className="relative">
        {icon && <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
        <input {...props} id={inputId} required={required} placeholder={placeholder} value={value} onChange={event => onChange?.(event.target.value)} onBlur={onBlur} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : undefined} className={`h-11 w-full rounded-[10px] border bg-white px-4 py-2 text-sm text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 ${icon ? 'ps-11' : ''} ${error ? 'border-red-500' : 'border-border'}`} />
      </div>
      {error && <p id={`${inputId}-error`} className="text-xs text-red-500" role="alert">{error}</p>}
    </div>
  )
}