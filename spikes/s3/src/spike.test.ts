import { expect, test } from 'vitest'
import { FakeHub } from './fake.js'
import { SimClient, canonical, lostEdits } from './clients.js'
import { run } from './persist-test.js'

test('3 clients converge with no lost edits on a clean channel', async () => {
  const hub = new FakeHub({ latencyMs: 5, jitterMs: 5, rateLimit: 1e9 })
  const cs = [0, 1, 2].map((i) => new SimClient(i, hub.transport(), { editMs: 60, syncEveryMs: 500 }))
  await Promise.all(cs.map((c) => c.provider.start()))
  cs.forEach((c) => c.start())
  await new Promise((r) => setTimeout(r, 2000))
  await Promise.all(cs.map((c) => c.stopEditing()))
  await new Promise((r) => setTimeout(r, 1000))
  const docs = cs.map((c) => c.doc)
  expect(new Set(docs.map(canonical)).size).toBe(1)
  expect(lostEdits(docs, new Map(cs.flatMap((c) => [...c.expected]))).lostSomewhere).toBe(0)
  await Promise.all(cs.map((c) => c.provider.stop()))
}, 15000)

test('oversize payload is rejected by the fake', async () => {
  const hub = new FakeHub({ maxPayload: 100 })
  const t = hub.transport()
  await t.connect()
  expect(await t.send('yjs-update', { u: 'x'.repeat(200) })).toBe('too_large')
})

test('persist: lock loses nothing, no lock loses updates', async () => {
  const r = await run(12, 5)
  expect(r.lockedLost).toBe(0)
  expect(r.unlockedLost).toBeGreaterThan(0)
  expect(r.orderIndependent).toBe(true)
})
