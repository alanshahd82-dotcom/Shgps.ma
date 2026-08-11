import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

const carouselSlides = [
  {
    id: 1,
    title: 'شارك التطبيق، احصل على شهر مجاني!',
    subtitle: 'ادع أصدقاءك لتركيب GPS واحصل على خصم حصري',
    bg: 'linear-gradient(135deg, #0F2044 0%, #1a3a6e 100%)',
    accent: '#00D97E',
    icon: '🎁',
    cta: 'شارك الآن'
  },
  {
    id: 2,
    title: 'تتبع أجهزتك في الوقت الفعلي',
    subtitle: 'راقب موقع وسرعة جميع مركباتك من مكان واحد',
    bg: 'linear-gradient(135deg, #006644 0%, #00D97E 100%)',
    accent: '#ffffff',
    icon: '📍',
    cta: 'اكتشف المزيد'
  },
  {
    id: 3,
    title: 'تنبيهات فورية على هاتفك',
    subtitle: 'احصل على إشعارات فورية عند تجاوز السرعة أو الخروج من المنطقة',
    bg: 'linear-gradient(135deg, #7B2D00 0%, #FF9500 100%)',
    accent: '#ffffff',
    icon: '🔔',
    cta: 'ضبط التنبيهات'
  },
  {
    id: 4,
    title: 'قطع المحرك عن بعد',
    subtitle: 'أوقف مركبتك من أي مكان في حالة السرقة أو الطوارئ',
    bg: 'linear-gradient(135deg, #1a0a2e 0%, #6B21A8 100%)',
    accent: '#00D97E',
    icon: '🔒',
    cta: 'معرفة المزيد'
  }
]

const SLIDE_ROUTES = [
  '/client/devices',
  '/client/devices',
  '/client/alerts',
  '/client/devices',
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
