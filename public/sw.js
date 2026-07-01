/* Fey service worker — Web Push delivery + PWA installability.
   Intentionally minimal (no offline caching yet) to avoid serving stale app
   shells; its job is push notifications and satisfying the installable criteria. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

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
