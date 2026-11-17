import webpush from 'web-push'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { createApp } from './app.js'
import { createSubStore } from './store.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env
if (!pub || !priv || !subject) {
  console.error('missing VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY or VAPID_SUBJECT. run: npm run keys')
  process.exit(1)
}
webpush.setVapidDetails(subject, pub, priv)

const store = createSubStore(join(root, 'data/subs.json'))
const server = createApp({
  publicDir: join(root, 'public'),
  latencyFile: join(root, 'data/latency.json'),
  store,
  vapidPublicKey: pub,
  sender: (sub, body) => webpush.sendNotification(sub, body, { TTL: 60, urgency: 'high' }),
})
const port = Number(process.env.PORT ?? 3000)
server.listen(port, () => console.log(`s5 spike on http://localhost:${port}`))
