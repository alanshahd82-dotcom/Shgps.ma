import React, { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'

export interface SheetProps {
  isOpen: boolean
  onClose: () => void
  stage?: 'collapsed' | 'peek' | 'full'
  children: React.ReactNode
  title?: string
}

const heights = { collapsed: 'calc(60px)', peek: '40vh', full: '85vh' }

export function Sheet({ isOpen, onClose, stage = 'peek', children, title }: SheetProps) {
  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button type="button" aria-label="Close sheet" className="fixed inset-0 z-40 cursor-default bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.section role="dialog" aria-modal="true" aria-label={title} className="fixed inset-x-0 bottom-0 z-50 overflow-auto rounded-t-[24px] bg-white shadow-2xl" style={{ height: heights[stage] }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
            <div className="flex items-center justify-between px-5 pb-3 pt-2" dir="rtl">
              {title ? <h2 className="text-base font-semibold text-primary">{title}</h2> : <span />}
              <IconButton icon={<X className="h-5 w-5" />} label="Close sheet" variant="ghost" size="sm" onClick={onClose} />
            </div>
            <div className="px-5 pb-8">{children}</div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  )
}