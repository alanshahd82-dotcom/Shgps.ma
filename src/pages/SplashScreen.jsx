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
      style={{ background: 'linear-gradient(150deg, #0b1627 0%, #101d32 60%, #16283d 100%)' }}
    >
      {/* Animated background rings */}
      <div className="absolute inset-0 overflow-hidden">
        {[1, 2, 3].map(i => (
          <motion.div
            key={i}
               className="absolute rounded-full border border-[#e4b56b]/20"
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
        {/* App icon */}
        <motion.img
          src="/athar-gps-mark.svg"
          alt="ATHAR GPS"
          style={{ borderRadius: 20, width: 100, height: 100 }}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.h1
          className="mt-4 text-4xl font-extrabold text-white tracking-tight"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          ATHAR GPS
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
           className="h-full bg-[#e4b56b] rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 1.8, delay: 0.5, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  )
}
