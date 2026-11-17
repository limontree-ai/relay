importScripts('/sw-logic.js')
const { handlePush, clickTarget } = self.swLogic

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

const ack = (data, at) =>
  fetch('/ack', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: data.id, kind: data.kind, sentAt: data.sentAt, ackAt: at, ua: 'sw' }),
  })

self.addEventListener('push', (event) => {
  handlePush(event, self.registration, Number(self.Notification && Notification.maxActions) || 0, ack)
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(clickTarget(event.notification.data, event.action), self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c && 'navigate' in c) return c.focus().then(() => c.navigate(url))
      return self.clients.openWindow(url)
    }),
  )
})

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const key = await (await fetch('/vapid-public-key')).text()
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
      await fetch('/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub.toJSON()) })
    })(),
  )
})
