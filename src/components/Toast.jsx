import React, { useEffect } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

const TOAST_STYLES = {
  success: {
    Icon: CheckCircle2,
    accent: '#38bdf8',
    background: 'rgba(12, 55, 48, .96)',
  },
  error: {
    Icon: AlertCircle,
    accent: '#ff8b87',
    background: 'rgba(83, 29, 35, .97)',
  },
  info: {
    Icon: Info,
    accent: '#9bd8ff',
    background: 'rgba(16, 41, 69, .97)',
  },
}

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(onClose, 3000)
    return () => window.clearTimeout(timeout)
  }, [toast, onClose])

  if (!toast) return null

  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info
  const Icon = style.Icon

  return (
    <div
      role="status"
      aria-live="polite"
      className="athar-toast fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-[1100] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-2xl px-4 py-3 text-xs font-bold shadow-2xl"
      style={{ background: style.background, border: `1px solid ${style.accent}55`, color: '#edf4f2' }}
    >
      <Icon size={17} style={{ color: style.accent }} aria-hidden="true" />
      <span className="min-w-0 flex-1 text-center">{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close notification"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X size={14} />
      </button>
    </div>
  )
}