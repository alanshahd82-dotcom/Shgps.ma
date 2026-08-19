import React from 'react'
import { motion } from 'framer-motion'

export function Fab({ icon, onClick, label, variant = 'accent' }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`absolute bottom-[calc(80px+env(safe-area-inset-bottom))] end-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${variant === 'white' ? 'bg-white text-primary hover:bg-slate-50' : 'bg-accent text-white hover:bg-accent-500'}`}
    >
      {icon}
    </motion.button>
  )
}

export default Fab