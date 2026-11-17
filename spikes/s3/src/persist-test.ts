import * as Y from 'yjs'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms + Math.random() * ms))

class Mutex {
  private tail: Promise<void> = Promise.resolve()
  async run<T>(f: () => Promise<T>): Promise<T> {
    let release!: () => void
    const prev = this.tail
    this.tail = new Promise((r) => (release = r))
    await prev
    try {
      return await f()
    } finally {
      release()
    }
  }
}

type Row = { state: Uint8Array | null }

const readRow = async (row: Row) => {
  await sleep(5)
  return row.state && new Uint8Array(row.state)
}
const writeRow = async (row: Row, s: Uint8Array) => {
  await sleep(5)
  row.state = s
}

async function persist(row: Row, update: Uint8Array, lock?: Mutex) {
  const rmw = async () => {
    const cur = await readRow(row)
    await writeRow(row, cur ? Y.mergeUpdates([cur, update]) : update)
  }
  return lock ? lock.run(rmw) : rmw()
}

function makeUpdates(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Y.Doc()
    let u!: Uint8Array
    d.on('update', (x: Uint8Array) => (u = x))
    d.getMap('edits').set(`edit-${i}`, 'x')
    return u
  })
}

async function trial(n: number, lock: boolean) {
  const row: Row = { state: null }
  const m = lock ? new Mutex() : undefined
  const updates = makeUpdates(n)
  await Promise.all(updates.map((u) => persist(row, u, m)))
  const d = new Y.Doc()
  Y.applyUpdate(d, row.state!)
  return n - d.getMap('edits').size
}

export async function run(n = 12, trials = 20) {
  const out = { unlockedLost: 0, lockedLost: 0, unlockedTrialsWithLoss: 0, lockedTrialsWithLoss: 0, trials, n, orderIndependent: true }
  for (let t = 0; t < trials; t++) {
    const a = await trial(n, false)
    const b = await trial(n, true)
    out.unlockedLost += a
    out.lockedLost += b
    if (a) out.unlockedTrialsWithLoss++
    if (b) out.lockedTrialsWithLoss++
  }
  const ups = makeUpdates(n)
  const docs = [ups, [...ups].reverse(), [...ups].sort(() => Math.random() - 0.5)].map((o) => {
    const d = new Y.Doc()
    Y.applyUpdate(d, Y.mergeUpdates(o))
    return JSON.stringify(d.getMap('edits').toJSON()) 
  })
  out.orderIndependent = docs.every((j) => JSON.stringify(Object.keys(JSON.parse(j)).sort()) === JSON.stringify(Object.keys(JSON.parse(docs[0])).sort()))
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await run(Number(process.argv[2] ?? 12), Number(process.argv[3] ?? 20))
  console.log(`${r.n} concurrent POSTs x ${r.trials} trials`)
  console.log(`(a) no lock: ${r.unlockedLost} updates lost (${r.unlockedTrialsWithLoss}/${r.trials} trials lost something)`)
  console.log(`(b) mutex (stands in for SELECT ... FOR UPDATE): ${r.lockedLost} updates lost (${r.lockedTrialsWithLoss}/${r.trials} trials)`)
  console.log(`mergeUpdates order independent: ${r.orderIndependent}`)
  console.log('why: mergeUpdates is commutative, associative and idempotent, so merging in any order gives the same doc and nothing is dropped by the merge itself.')
  console.log('the loss in (a) is the read-modify-write race: two requests read the same old row, each writes old+own update, and the later write overwrites the earlier one.')
  console.log('a row lock (or an append-only update log merged later) serializes the read-modify-write, so every update is in the row.')
}
