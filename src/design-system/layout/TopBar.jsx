import React from 'react'
import { ChevronLeft } from 'lucide-react'

export function TopBar({ title, left, right, transparent = false, onBack }) {
  return (
    <header
      className={`absolute inset-x-0 top-0 z-40 box-border flex h-[calc(56px+env(safe-area-inset-top))] items-end justify-between px-4 pb-2 pt-[env(safe-area-inset-top)] ${transparent ? 'bg-white/70 backdrop-blur-md' : 'border-b border-border bg-white'}`}
      dir="rtl"
    >
      <div className="flex min-w-0 flex-1 items-center justify-start gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="رجوع"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-primary transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
          </button>
        )}
        {left}
        {title && <h1 className="truncate text-base font-semibold text-primary">{title}</h1>}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">{right}</div>
    </header>
  )
}

export default TopBar