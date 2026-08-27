import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const carouselSlides = [
  {
    id: 1,
    title: { ar: 'شارك التطبيق، احصل على شهر مجاني!', fr: 'Partagez l’application, gagnez un mois gratuit !' },
    subtitle: { ar: 'ادع أصدقاءك لتركيب GPS واحصل على خصم حصري', fr: 'Invitez vos amis à installer un GPS et profitez d’une remise exclusive.' },
    bg: 'linear-gradient(135deg, #0F2044 0%, #1a3a6e 100%)',
    accent: '#1d4ed8',
    icon: '★',
    cta: { ar: 'شارك الآن', fr: 'Partager' }
  },
  {
    id: 2,
    title: { ar: 'تتبع أجهزتك في الوقت الفعلي', fr: 'Suivez vos appareils en temps réel' },
    subtitle: { ar: 'راقب موقع وسرعة جميع مركباتك من مكان واحد', fr: 'Consultez la position et la vitesse de tous vos véhicules au même endroit.' },
    bg: 'linear-gradient(135deg, #006644 0%, #1d4ed8 100%)',
    accent: '#ffffff',
    icon: '●',
    cta: { ar: 'اكتشف المزيد', fr: 'Découvrir' }
  },
  {
    id: 3,
    title: { ar: 'تنبيهات فورية على هاتفك', fr: 'Des alertes instantanées sur votre téléphone' },
    subtitle: { ar: 'احصل على إشعارات فورية عند تجاوز السرعة أو الخروج من المنطقة', fr: 'Recevez une alerte en cas d’excès de vitesse ou de sortie de zone.' },
    bg: 'linear-gradient(135deg, #7B2D00 0%, #FF9500 100%)',
    accent: '#ffffff',
    icon: '!',
    cta: { ar: 'ضبط التنبيهات', fr: 'Configurer' }
  },
  {
    id: 4,
    title: { ar: 'قطع المحرك عن بعد', fr: 'Coupez le moteur à distance' },
    subtitle: { ar: 'أوقف مركبتك من أي مكان في حالة السرقة أو الطوارئ', fr: 'Immobilisez votre véhicule à distance en cas de vol ou d’urgence.' },
    bg: 'linear-gradient(135deg, #1a0a2e 0%, #6B21A8 100%)',
    accent: '#1d4ed8',
    icon: '✓',
    cta: { ar: 'معرفة المزيد', fr: 'En savoir plus' }
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
  const { lang } = useApp()
  const isAr = lang === 'ar'
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
            <p className="text-white font-bold text-sm leading-tight mb-1">{slide.title[isAr ? 'ar' : 'fr']}</p>
            <p className="text-white/70 text-xs leading-tight line-clamp-2">{slide.subtitle[isAr ? 'ar' : 'fr']}</p>
          </div>
          {/* CTA */}
          <button
            onClick={() => navigate(SLIDE_ROUTES[current] || '/client/devices')}
            className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl active:scale-90 transition-transform"
            style={{ background: slide.accent, color: slide.bg.includes('006644') ? 'white' : '#0F2044' }}
          >
            {slide.cta[isAr ? 'ar' : 'fr']}
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
