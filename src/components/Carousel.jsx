import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { carouselSlides } from '../data/mockData'

const SLIDE_ROUTES = [
  '/client/devices',   // live tracking
  '/client/devices',   // geofence
  '/client/alerts',    // instant alerts
  '/client/devices',   // engine cut-off
]

export default function Carousel() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const timerRef = useRef(null)

  const startTimer = () => {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % carouselSlides.length)
    }, 3500)
  }

  useEffect(() => {
    startTimer()
    return () => clearInterval(timerRef.current)
  }, [])

  const goTo = (i) => {
    setCurrent(i)
    startTimer()
  }

  const slide = carouselSlides[current]

  return (
    <div className="mx-3 my-3 rounded-2xl overflow-hidden shadow-lg relative" style={{ height: 120 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          className="absolute inset-0 flex items-center px-5 gap-4"
          style={{ background: slide.bg }}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.35 }}
        >
          {/* Icon */}
          <div
            className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            {slide.icon}
          </div>
          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight mb-1">{slide.title}</p>
            <p className="text-white/70 text-xs leading-tight line-clamp-2">{slide.subtitle}</p>
          </div>
          {/* CTA */}
          <button
            onClick={() => navigate(SLIDE_ROUTES[current] || '/client/devices')}
            className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl active:scale-90 transition-transform"
            style={{ background: slide.accent, color: slide.bg.includes('006644') ? 'white' : '#0F2044' }}
          >
            {slide.cta}
          </button>
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {carouselSlides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="transition-all duration-300 rounded-full"
            style={{
              width: i === current ? 16 : 6,
              height: 6,
              background: i === current ? 'white' : 'rgba(255,255,255,0.4)'
            }}
          />
        ))}
      </div>
    </div>
  )
}
