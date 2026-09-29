import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function nextRoute() {
  sessionStorage.setItem('athargps_intro_seen', 'true')
  return localStorage.getItem('athargps_onboarding_seen') === 'true' ? '/client/login' : '/client/start'
}

export default function CinematicIntro() {
  const navigate = useNavigate()
  const [showSkip, setShowSkip] = useState(false)

  useEffect(() => {
    // أظهر زر التخطي بعد ثانيتين
    const timer = setTimeout(() => setShowSkip(true), 2000)

    // انتقل إلى الشاشة التالية بعد انتهاء الفيديو (10 ثواني)
    const transitionTimer = setTimeout(() => {
      navigate(nextRoute(), { replace: true })
    }, 10000)

    return () => {
      clearTimeout(timer)
      clearTimeout(transitionTimer)
    }
  }, [navigate])

  const handleSkip = () => {
    navigate(nextRoute(), { replace: true })
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      {/* الشاشة السينمائية */}
      <div style={{
        width: '100%',
        height: '100%',
        background: '#050b18',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <iframe
          src="/cinematic-intro.html"
          style={{
            border: 'none',
            width: '390px',
            height: '844px',
            maxWidth: '100%',
            maxHeight: '100vh',
          }}
          title="ATHAR GPS Cinematic Intro"
          allow="autoplay"
        />
      </div>

      {/* زر التخطي */}
      {showSkip && (
        <button
          onClick={handleSkip}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '10px 20px',
            background: 'rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            zIndex: 1000,
            backdropFilter: 'blur(8px)',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.3)'
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.8)'
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.2)'
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)'
          }}
        >
          تخطي ←
        </button>
      )}
    </div>
  )
}
