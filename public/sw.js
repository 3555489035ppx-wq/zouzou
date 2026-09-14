// Build replaces this marker. Only public static assets enter this cache.
const CACHE = 'zouzou-static-__BUILD_SHA__'
const OFFLINE = '/offline.html'
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE)))
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Old hashed assets remain available to already-open tabs until the next update.
    const names = (await caches.keys()).filter(name => name.startsWith('zouzou-static-'))
    await Promise.all(names.slice(0, -2).filter(name => name !== CACHE).map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting()
})
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)))
    return
  }
  // Only Vite fingerprinted files are immutable. Brand/cover paths can change
  // without changing their filename, so they must not use cache-first.
  if (!/^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|webp|svg)$/.test(url.pathname)) return
  event.respondWith((async () => {
    const cached = await caches.match(event.request)
    if (cached) return cached
    const response = await fetch(event.request)
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE)
      await cache.put(event.request, response.clone())
    }
    return response
  })())
})
