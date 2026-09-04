const CACHE_NAME = 'pos-app-cache-v1'
const urlsToCache = ['/', '/manifest.json']

// When the service worker installs, pre-cache the core pages
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  )
  self.skipWaiting()
})

// Clean up old caches when a new version of the service worker activates
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

// Intercept every network request
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Got a real network response — save a copy for offline use, then return it
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone)
        })
        return response
      })
      .catch(() => {
        // Network failed — serve whatever we have cached instead
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/')
        })
      })
  )
})