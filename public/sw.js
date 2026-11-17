// NovaWallet service worker — enables app install + fast repeat loads.
// Strategy: navigations are network-first (a new deploy is never masked by a
// stale page), hashed /assets/ files are cache-first (they are immutable).
const CACHE = 'novawallet-pwa-v1'
const INDEX = new URL('index.html', self.registration.scope)

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const copy = r.clone()
          caches.open(CACHE).then(c => c.put(INDEX, copy))
          return r
        })
        .catch(() => caches.match(INDEX))
    )
    return
  }
  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        const copy = r.clone()
        caches.open(CACHE).then(c => c.put(e.request, copy))
        return r
      }))
    )
  }
})
