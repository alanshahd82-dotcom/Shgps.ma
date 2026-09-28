import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React itself gets its own chunk: it was being bundled inside the
          // "leaflet" chunk, which made React errors look like map errors.
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor'
          if (id.includes('node_modules/recharts')) return 'recharts'
          if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) return 'leaflet'
          if (id.includes('node_modules/framer-motion')) return 'framer-motion'
          return undefined
        },
      },
    },
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.BACKEND_PORT || 3001}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `ws://localhost:${process.env.BACKEND_PORT || 3001}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
    