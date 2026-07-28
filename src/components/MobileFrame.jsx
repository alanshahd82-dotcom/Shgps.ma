import React from 'react'

export default function MobileFrame({ children }) {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 p-4 md:p-8">
      {/* Phone frame */}
      <div
        className="relative bg-black rounded-[48px] shadow-2xl"
        style={{
          width: 390,
          minHeight: 844,
          boxShadow: '0 0 0 2px #1e293b, 0 0 0 4px #334155, 0 30px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Side buttons */}
        <div className="absolute -left-1.5 top-28 w-1 h-10 bg-slate-600 rounded-l-md" />
        <div className="absolute -left-1.5 top-44 w-1 h-16 bg-slate-600 rounded-l-md" />
        <div className="absolute -left-1.5 top-64 w-1 h-16 bg-slate-600 rounded-l-md" />
        <div className="absolute -right-1.5 top-36 w-1 h-20 bg-slate-600 rounded-r-md" />

        {/* Screen */}
        <div className="relative overflow-hidden rounded-[46px]" style={{ height: 844 }}>
          {/* Dynamic Island */}
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 bg-black z-50 rounded-full"
            style={{ width: 120, height: 34 }}
          >
            {/* Camera */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            </div>
          </div>

          {/* Status bar */}
          <div className="absolute top-0 left-0 right-0 h-14 z-40 flex items-end px-8 pb-1">
            <div className="flex justify-between items-center w-full text-white text-xs font-semibold">
              <span>9:41</span>
              <div className="flex items-center gap-1.5">
                {/* Signal */}
                <div className="flex items-end gap-0.5 h-3">
                  {[2, 3, 4, 5, 6].map((h, i) => (
                    <div key={i} className={`w-1 rounded-sm ${i < 4 ? 'bg-white' : 'bg-white/30'}`} style={{ height: h }} />
                  ))}
                </div>
                {/* WiFi */}
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                  <path d="M7 8.5L8.5 7C7.67 6.33 6.33 6.33 5.5 7L7 8.5Z" fill="white"/>
                  <path d="M7 6L10 3.5C8.34 2.17 5.66 2.17 4 3.5L7 6Z" fill="white" opacity="0.7"/>
                  <path d="M7 3.5L11.5 0.5C9.07 -0.83 4.93 -0.83 2.5 0.5L7 3.5Z" fill="white" opacity="0.4"/>
                </svg>
                {/* Battery */}
                <div className="flex items-center gap-0.5">
                  <div className="border border-white rounded-sm w-6 h-3 flex items-center p-0.5">
                    <div className="bg-white rounded-sm h-full" style={{ width: '80%' }} />
                  </div>
                  <div className="bg-white rounded-r-sm h-1.5 w-0.5" />
                </div>
              </div>
            </div>
          </div>

          {/* App content */}
          <div className="h-full bg-gray-50 overflow-hidden">
            {children}
          </div>

          {/* Home indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-black/30 rounded-full z-50" />
        </div>
      </div>
    </div>
  )
}
