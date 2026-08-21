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
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'var(--ath-bg)',
        backgroundImage: 'radial-gradient(circle at 50% 42%, rgba(224,179,111,.18), transparent 38%), linear-gradient(180deg, var(--ath-bg), var(--ath-bg2))',
      }}
    >
      {/* Logo area */}
      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
      >
        {/* App icon */}
        <img
          src="/app-icon.png"
          alt="ATHAR GPS"
          style={{
            borderRadius: 28,
            width: 104,
            height: 104,
            border: '1px solid rgba(224,179,111,.8)',
            boxShadow: '0 0 0 5px rgba(224,179,111,.08), 0 0 38px rgba(224,179,111,.24), 0 14px 36px rgba(0,0,0,.45)',
          }}
        />

        <motion.h1
          className="mt-5 text-4xl font-extrabold text-white tracking-tight"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          ATHAR <span style={{ color: 'var(--ath-gold)' }}>GPS</span>
        </motion.h1>

        <motion.p
          className="mt-2 text-sm font-medium uppercase tracking-[0.22em]"
          style={{ color: 'var(--ath-green2)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          FLEET INTELLIGENCE PLATFORM
        </motion.p>
      </motion.div>

      {/* Loading bar */}
      <motion.div
         className="absolute bottom-16 left-1/2 -translate-x-1/2 h-0.5 w-32 overflow-hidden rounded-full bg-white/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <motion.div
           className="h-full rounded-full"
           style={{ background: 'linear-gradient(90deg, #C8843C, #E0B36F, #FFF0C9)' }}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 1.8, delay: 0.5, ease: 'easeInOut' }}
        />
      </motion.div>
      <p className="absolute bottom-8 text-[11px] tracking-wide text-white/30">
        ATHAR GPS · Fleet Intelligence 2026 ©
      </p>
    </div>
  )
}
