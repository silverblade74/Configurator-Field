const CACHE_NAME = 'volunteerhub-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
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
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  // Skip non-GET and Firebase/API requests
  if (request.method !== 'GET') return
  if (request.url.includes('firestore.googleapis.com')) return
  if (request.url.includes('identitytoolkit.googleapis.com')) return
  if (request.url.includes('securetoken.googleapis.com')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response.ok && request.url.match(/\.(js|css|png|jpg|svg|woff2?)$/)) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => {
        // Serve from cache if offline
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // For navigation requests, serve index.html
          if (request.mode === 'navigate') {
            return caches.match('/index.html')
          }
        })
      })
  )
})
