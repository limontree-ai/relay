import * as Y from 'yjs'
import { MAX_PAYLOAD, type Transport } from './provider.js'
import { FakeHub } from './fake.js'
import { supabaseTransport } from './supabase.js'
import { SimClient, ties, canonical, lostEdits, orderedIds, stepsOf } from './clients.js'

const argv = process.argv.slice(2)
const flag = (k: string) => argv.includes(`--${k}`)
const arg = (k: string, d: string) => {
  const i = argv.indexOf(`--${k}`)
  return i >= 0 ? argv[i + 1] : d
}
const mode = flag('local') ? 'local' : flag('supabase') ? 'supabase' : arg('mode', 'local')
const clients = Number(arg('clients', '3'))
const seconds = arg('seconds', '') ? Number(arg('seconds', '')) : Number(arg('minutes', '10')) * 60
const disconnectEvery = Number(arg('disconnect-every', '0'))
const disconnectMs = Number(arg('disconnect-ms', '2000'))
const editMs = Number(arg('edit-ms', '400'))
const cursorHz = Number(arg('cursor-hz', '5'))
const batchMs = Number(arg('batch-ms', '50'))
const awarenessMs = Number(arg('awareness-ms', '100'))
const latency = Number(arg('latency-ms', '40'))
const drop = Number(arg('drop', '0'))
const rateLimit = Number(arg('rate-limit', '100'))

type Count = { sent: Record<string, number>; recv: Record<string, number> }
const per: Count[] = []
const buckets: number[] = []
const awBuckets: number[] = []
const sizes: number[] = []
let t0 = 0
const bump = (arr: number[]) => {
  if (!t0) return
  const s = Math.floor((Date.now() - t0) / 1000)
  while (arr.length <= s) arr.push(0)
  arr[s]++
}

function metered(inner: Transport, c: Count): Transport {
  return {
    ...inner,
    on: (e, cb) =>
      inner.on(e, (p) => {
        c.recv[e] = (c.recv[e] ?? 0) + 1
        bump(buckets)
        if (e === 'awareness') bump(awBuckets)
        cb(p)
      }),
    send: async (e, p) => {
      c.sent[e] = (c.sent[e] ?? 0) + 1
      bump(buckets)
      if (e === 'awareness') bump(awBuckets)
      if (e === 'yjs-update') sizes.push(Buffer.byteLength(JSON.stringify(p)))
      return inner.send(e, p)
    },
  }
}

const hub = mode === 'local' ? new FakeHub({ latencyMs: latency, dropRate: drop, rateLimit }) : undefined
const env = (k: string) => {
  const v = process.env[k]
  if (!v) throw new Error(`set ${k}`)
  return v
}
const baseTransport = () => (hub ? hub.transport() : supabaseTransport(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), 100))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pct = (xs: number[], p: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] : 0)
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)

const svMap = (d: Y.Doc) => Y.decodeStateVector(Y.encodeStateVector(d))
const covers = (d: Y.Doc, target: Map<number, number>) => {
  const sv = svMap(d)
  return [...target].every(([c, k]) => (sv.get(c) ?? 0) >= k)
}
const targetOf = (docs: Y.Doc[]) => {
  const t = new Map<number, number>()
  for (const d of docs) for (const [c, k] of svMap(d)) t.set(c, Math.max(t.get(c) ?? 0, k))
  return t
}
async function waitCovered(docs: Y.Doc[], target: Map<number, number>, maxMs: number) {
  const s = Date.now()
  while (Date.now() - s < maxMs) {
    if (docs.every((d) => covers(d, target))) return Date.now() - s
    await sleep(25)
  }
  return null
}

async function main() {
  const cs: SimClient[] = []
  for (let i = 0; i < clients; i++) {
    const c: Count = { sent: {}, recv: {} }
    per.push(c)
    cs.push(new SimClient(i, metered(baseTransport(), c), { editMs, cursorHz, batchMs, awarenessMs }))
  }
  console.log(`mode=${mode} clients=${clients} seconds=${seconds} disconnectEvery=${disconnectEvery}s batchMs=${batchMs} cursorHz=${cursorHz}`)
  await Promise.all(cs.map((c) => c.provider.start()))
  await sleep(300)
  t0 = Date.now()
  cs.forEach((c) => c.start())

  const docs = cs.map((c) => c.doc)
  const reconnects: (number | null)[] = []
  const pendingRecon: Promise<void>[] = []
  let dcTimer: ReturnType<typeof setInterval> | undefined
  if (disconnectEvery > 0) {
    let k = 0
    dcTimer = setInterval(() => {
      const c = cs[k++ % cs.length]
      pendingRecon.push(
        (async () => {
          await c.provider.goOffline()
          await sleep(disconnectMs)
          await c.provider.goOnline()
          const target = targetOf(docs)
          reconnects.push(await waitCovered(docs, target, 30000))
        })(),
      )
    }, disconnectEvery * 1000)
  }

  await sleep(seconds * 1000)
  clearInterval(dcTimer)
  await Promise.all(pendingRecon)
  const editSeconds = (Date.now() - t0) / 1000
  const total = buckets.slice(0, Math.floor(editSeconds))
  const aw = awBuckets.slice(0, Math.floor(editSeconds))
  await Promise.all(cs.map((c) => c.stopEditing()))
  const settleStart = Date.now()
  const settled = await waitCovered(docs, targetOf(docs), 30000)
  await sleep(500)
  const settleMs = settled === null ? null : Date.now() - settleStart
  const final = docs.map(canonical)
  const converged = final.every((j) => j === final[0])

  const expected = new Map(cs.flatMap((c) => [...c.expected]))
  const lost = lostEdits(docs, expected)
  const dupKeys = (() => {
    const ids = orderedIds(docs[0])
    const ks = ids.map((i) => stepsOf(docs[0]).get(i)!.get('order'))
    return ks.length - new Set(ks).size
  })()

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const f = (n: number) => n.toFixed(1)
  console.log(`\nedit phase ${f(editSeconds)}s, ${lost.total} edits recorded, ${docs[0].getMap('steps').size} steps`)
  console.log('\nper client msgs/s (sent / received, whole edit phase):')
  per.forEach((c, i) => console.log(`  client ${i}: ${f(sum(c.sent) / editSeconds)} sent, ${f(sum(c.recv) / editSeconds)} recv`))
  const sentAll = per.reduce((a, c) => a + sum(c.sent), 0)
  const recvAll = per.reduce((a, c) => a + sum(c.recv), 0)
  console.log(`total sent ${sentAll}, received (fan-out) ${recvAll}, sent+received ${sentAll + recvAll}`)
  console.log(`total incl. fan-out: avg ${f(avg(total))} msg/s, peak second ${Math.max(0, ...total)} msg/s (limit ${rateLimit})`)
  console.log(`awareness incl. fan-out: avg ${f(avg(aw))} msg/s, peak ${Math.max(0, ...aw)}; sent only ${f(per.reduce((a, c) => a + (c.sent.awareness ?? 0), 0) / editSeconds)} msg/s`)
  const over = sizes.filter((s) => s > MAX_PAYLOAD).length
  console.log(`yjs-update payload bytes: n=${sizes.length} p50=${pct(sizes, 0.5)} p95=${pct(sizes, 0.95)} max=${Math.max(0, ...sizes)} over256KB=${over}`)
  const tooLarge = cs.reduce((a, c) => a + c.provider.stats.tooLarge, 0)
  const resent = cs.reduce((a, c) => a + c.provider.stats.resent, 0)
  console.log(`provider: tooLarge=${tooLarge} resent=${resent} syncReply=${cs.reduce((a, c) => a + c.provider.stats.syncReply, 0)}`)
  if (hub) console.log(`fake hub: ${JSON.stringify(hub.stats)}`)
  const ok = reconnects.filter((x): x is number => x !== null)
  console.log(`reconnects: ${reconnects.length}, converged ${ok.length}, p50=${pct(ok, 0.5)}ms max=${Math.max(0, ...ok)}ms`)
  console.log(`settle after edits stop: ${settleMs === null ? 'DID NOT SETTLE' : settleMs + 'ms'}; docs converged: ${converged}; duplicate order keys: ${dupKeys}; tie repairs while editing: ${ties.n}`)
  console.log(`lost edits: ${lost.lostEverywhere} lost everywhere, ${lost.lostSomewhere} missing in at least one doc, of ${lost.total}`)

  const peak = Math.max(0, ...total)
  const rateOk = peak <= 100
  const noLoss = lost.lostSomewhere === 0 && converged
  const sizeOk = over === 0 && tooLarge === 0
  const verdict = !noLoss || !sizeOk ? 'STOP' : rateOk ? 'GO' : 'CHANGE'
  console.log(`\ncriteria: no lost edits ${noLoss ? 'pass' : 'FAIL'}; payloads under limit ${sizeOk ? 'pass' : 'FAIL'}; peak rate <= 100 msg/s ${rateOk ? 'pass' : 'FAIL'}${clients < 12 ? ' (only binding at 12 clients)' : ''}`)
  console.log(`verdict: ${verdict}${mode === 'local' ? ' (local fake only, not evidence for real Supabase)' : ''}`)
  await Promise.all(cs.map((c) => c.provider.stop()))
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
