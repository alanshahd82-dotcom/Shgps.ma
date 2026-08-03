// ATHAR GPS Service Worker v4 — Network-first with offline fallback
const CACHE_NAME = 'athargps-v4'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/athar-gps-mark.svg',
  '/athar-gps-hero.svg',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const ext = url.pathname.split('.').pop()
          if (['js','css','png','svg','jpg','jpeg','webp','woff2'].includes(ext)) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()))
          }
        }
        return response
      }).catch(() => caches.match('/index.html'))
    })
  )
})
