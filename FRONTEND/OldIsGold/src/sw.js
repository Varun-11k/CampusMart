import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

async function handleNavigation({ request }) {
  try {
    return await fetch(request)
  } catch {
    const offlinePage = await matchPrecache('/offline.html')
    return offlinePage || new Response('CampusMart is offline. Reconnect and try again.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

registerRoute(new NavigationRoute(handleNavigation, {
  denylist: [/^\/api(?:\/|$)/],
}))
