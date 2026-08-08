import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png?url'
import markerIcon from 'leaflet/dist/images/marker-icon.png?url'
import markerShadow from 'leaflet/dist/images/marker-shadow.png?url'

// Fix Leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// إخفاء شاشة البداية بعد تحميل React
if (typeof window.__hideSplash === 'function') {
  window.__hideSplash()
}
