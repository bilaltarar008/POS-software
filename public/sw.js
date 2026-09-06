const CACHE_NAME = 'pos-app-cache-v3'
const urlsToCache = [
  '/',
  '/manifest.json',
  '/products/new',
  '/invoices/new',
  '/payments/new',
  '/capital/new',
  '/parties',
  '/dashboard',

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
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
  // Only handle actual full-page navigations (typing a URL, reloading the page).
  // Everything else — API calls, Supabase requests, Next.js internal data
  // fetches — passes straight through untouched.
  if (event.request.mode !== 'navigate') {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone)
        })
        return response
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/')
        })
      })
  )
})