import { defineConfig } from 'vite'
    import react from '@vitejs/plugin-react'

    export default defineConfig({
    plugins: [react()],
    base: '/',
    build: {
      outDir: 'dist',
      rollupOptions: {},
    },
    server: {
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
    