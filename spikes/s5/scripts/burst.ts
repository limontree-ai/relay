import webpush from 'web-push'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { buildPayload } from '../src/payload.js'
import { sendToAll } from '../src/push.js'
import { latencyStats, type Latency } from '../src/stats.js'
import { createSubStore, readJson } from '../src/store.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env
if (!pub || !priv || !subject) {
  console.error('missing VAPID env. run: npm run keys')
  process.exit(1)
}
webpush.setVapidDetails(subject, pub, priv)

const n = Number(process.argv[2] ?? 5)
const gapMs = Number(process.argv[3] ?? 2000)
const waitMs = Number(process.argv[4] ?? 20000)
const store = createSubStore(join(root, 'data/subs.json'))
const latencyFile = join(root, 'data/latency.json')
if (!store.all().length) {
  console.error('no subscriptions in data/subs.json. subscribe from a device first')
  process.exit(1)
}

const ids: string[] = []
for (let i = 0; i < n; i++) {
  const id = `burst${Date.now().toString(36)}${i}`
  ids.push(id)
  const payload = JSON.stringify({ ...buildPayload('approval', id, Date.now()), title: `Burst ${i + 1} of ${n}` })
  await sendToAll(store.all(), payload, (s, b) => webpush.sendNotification(s, b, { TTL: 60, urgency: 'high' }), store.remove)
  if (i < n - 1) await new Promise((r) => setTimeout(r, gapMs))
}

console.log(`waiting ${waitMs}ms for acks (server must be running for /ack)`)
const expected = ids.length * store.all().length
const t0 = Date.now()
let rows: Latency[] = []
while (Date.now() - t0 < waitMs) {
  rows = readJson<Latency[]>(latencyFile, []).filter((r) => ids.includes(r.id))
  if (rows.length >= expected) break
  await new Promise((r) => setTimeout(r, 500))
}
const s = latencyStats(rows.map((r) => r.ms))
console.log(`pushes sent: ${expected}, acks: ${rows.length}`)
console.log(`latency ms: min ${s.min} p50 ${s.p50} p95 ${s.p95} max ${s.max} mean ${s.mean}`)
console.log(`under 10s: ${s.under10s}/${s.n}`)
console.log(rows.length < expected ? 'FAIL: some pushes were not acked (not shown, or device offline)' : s.max < 10000 ? 'PASS: all under 10s' : 'FAIL: some over 10s')
console.log('note: latency uses the phone clock minus the server clock, so clock skew adds error')
