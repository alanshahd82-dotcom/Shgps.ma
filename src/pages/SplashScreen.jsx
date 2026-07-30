import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function SplashScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/client/login'), 2500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(150deg, #0F2044 0%, #0a1628 60%, #0d2240 100%)' }}
    >
      {/* Animated background rings */}
      <div className="absolute inset-0 overflow-hidden">
        {[1, 2, 3].map(i => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-accent/10"
            style={{
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: i * 200, height: i * 200,
            }}
            animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
          />
        ))}
      </div>

      {/* Logo area */}
      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 200, delay: 0.1 }}
      >
        {/* SVG Logo icon */}
        <motion.img src="/icon.png" alt="AtharGPS" style={{ borderRadius: 20 }}
          width={100}
          height={100}
          viewBox="0 0 48 48"
          fill="none"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <rect width="48" height="48" rx="14" fill="rgba(255,255,255,0.08)" />
          <path
            d="M24 8C17.373 8 12 13.373 12 20C12 28.5 24 42 24 42C24 42 36 28.5 36 20C36 13.373 30.627 8 24 8Z"
            fill="#00D97E"
          />
          <circle cx="24" cy="20" r="4.5" fill="#0F2044" />
          <path d="M18 11C15.3 13.1 13.5 16.4 13.5 20" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <path d="M30 11C32.7 13.1 34.5 16.4 34.5 20" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        </motion.svg>

        <motion.h1
          className="mt-4 text-4xl font-extrabold text-white tracking-tight"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          AtharGPS
        </motion.h1>

        <motion.p
          className="mt-2 text-white/60 text-sm font-medium tracking-widest uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          GPS Tracking Pro
        </motion.p>
      </motion.div>

      {/* Loading bar */}
      <motion.div
        className="absolute bottom-16 left-1/2 -translate-x-1/2 w-24 h-0.5 bg-white/10 rounded-full overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <motion.div
          className="h-full bg-accent rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 1.8, delay: 0.5, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  )
}
