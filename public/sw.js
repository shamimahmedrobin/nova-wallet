// NovaWallet service worker — enables app install + fast repeat loads.
// Strategy: navigations are network-first (a new deploy is never masked by a
// stale page), hashed /assets/ files are cache-first (they are immutable).
const CACHE = 'novawallet-pwa-v8'
const INDEX = new URL('index.html', self.registration.scope)

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Web Push: show the notification the Worker sent (money received,
// approvals, support replies) even while the app is closed.
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { /* empty payload */ }
  const title = d.title || 'NovaWallet'
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { link: d.link || '/' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const link = (e.notification.data && e.notification.data.link) || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) { c.navigate(link).catch(() => {}); return c.focus() } }
      return self.clients.openWindow(link)
    })
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

// Notification click: focus the running app and open the exact section the
// notification points at (data.url), or open the app if it is not running.
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const target = (e.notification.data && e.notification.data.url) || self.registration.scope
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) { c.focus(); if ('navigate' in c) c.navigate(target); return }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})
