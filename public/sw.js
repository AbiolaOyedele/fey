/* Fey service worker — Web Push delivery + PWA installability + ML model cache.
   Deliberately does NOT cache the app shell, to avoid serving stale pages; the
   only thing it stores is immutable, version-pinned ML model files (see below). */

/* ── ML model cache ───────────────────────────────────────────────────────────
   Ruff Tools' background remover downloads an ~88 MB ONNX model. Its library
   (@imgly) keeps no client-side cache of its own and leans on the HTTP disk
   cache, which phones evict aggressively — so the model can re-download every
   few visits. Mirroring it into Cache Storage makes it durable.

   Cache-first with no revalidation is safe here specifically because the URLs
   are version-pinned and their contents immutable; bump MODEL_CACHE to roll.
   (transformers.js — the Best engine — already manages its own Cache Storage
   under "transformers-cache", so it is intentionally left alone.) */
const MODEL_CACHE = 'fey-ml-models-v1'
const MODEL_CACHE_PREFIX = 'fey-ml-models-'
const MODEL_ASSET_PREFIXES = ['https://staticimgly.com/@imgly/background-removal-data/']

function isModelAsset(url) {
  return MODEL_ASSET_PREFIXES.some((prefix) => url.startsWith(prefix))
}

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop only our own superseded model caches — never touch other buckets
      // (notably "transformers-cache", which is not ours to manage).
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith(MODEL_CACHE_PREFIX) && name !== MODEL_CACHE)
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || !isModelAsset(request.url)) return
  // Range requests address a slice, not the resource — leave them to the
  // network so we never mistake a fragment for the whole file.
  if (request.headers.has('range')) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(MODEL_CACHE)
      const hit = await cache.match(request)
      if (hit) return hit

      const response = await fetch(request)
      // Strictly 200: `ok` would also accept a 206 partial, and an opaque
      // (status 0) response can neither be validated nor passed to Cache.put.
      if (response.status === 200 && response.type !== 'opaque') {
        // Deliberately not awaited — the download shouldn't block on the write.
        void cache.put(request, response.clone()).catch(() => undefined)
      }
      return response
    })(),
  )
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }
  const title = data.title || 'Fey'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
  }
  // Some browsers (notably Safari/WebKit) can reject an unsupported icon/badge
  // format and never show the notification at all. Retry once without images
  // so a bad asset can never silently swallow the whole notification.
  event.waitUntil(
    self.registration.showNotification(title, options).catch(() => {
      const { icon, badge, ...fallback } = options
      return self.registration.showNotification(title, fallback)
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) { try { client.navigate(url) } catch (e) { /* cross-origin */ } }
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
