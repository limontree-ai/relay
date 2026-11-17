import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { createSubStore } from '../src/store.js'

const dir = mkdtempSync(join(tmpdir(), 's5-'))
const store = createSubStore(join(dir, 'subs.json'))
const sender = vi.fn()
const server = createApp({ publicDir: new URL('../public', import.meta.url).pathname, latencyFile: join(dir, 'lat.json'), store, sender, vapidPublicKey: 'KEY', log: () => {} })
let base = ''
beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => void server.close())
const post = (p: string, b: unknown) => fetch(base + p, { method: 'POST', body: JSON.stringify(b) })
const sub = { endpoint: 'https://push.example/a', keys: { p256dh: 'p', auth: 'a' } }

describe('server', () => {
  it('serves key and static files', async () => {
    expect(await (await fetch(base + '/vapid-public-key')).text()).toBe('KEY')
    expect((await fetch(base + '/')).headers.get('content-type')).toContain('text/html')
    expect((await fetch(base + '/sw.js')).status).toBe(200)
    expect((await fetch(base + '/manifest.webmanifest')).headers.get('content-type')).toContain('manifest')
    expect((await fetch(base + '/../package.json')).status).toBe(404)
  })
  it('subscribes once per endpoint and rejects junk', async () => {
    expect((await post('/subscribe', sub)).status).toBe(201)
    expect((await post('/subscribe', sub)).status).toBe(200)
    expect((await post('/subscribe', { endpoint: 'x' })).status).toBe(400)
    expect(store.all()).toHaveLength(1)
  })
  it('sends, acks and records latency', async () => {
    sender.mockResolvedValue({})
    const r = await (await post('/send', { kind: 'approval' })).json()
    expect(r.results[0].ok).toBe(true)
    expect(JSON.parse(sender.mock.calls[0][1]).url).toBe(`/a/${r.id}`)
    await post('/ack', { id: r.id, kind: 'approval', sentAt: r.sentAt, ackAt: r.sentAt + 1234 })
    expect((await (await fetch(base + '/latency')).json())[0].ms).toBe(1234)
    expect((await (await fetch(base + '/stats')).json()).n).toBe(1)
    expect((await post('/send', { kind: 'nope' })).status).toBe(400)
  })
  it('deletes the subscription on 410', async () => {
    sender.mockRejectedValue({ statusCode: 410, body: 'gone' })
    const r = await (await post('/test-notification', {})).json()
    expect(r.results[0]).toMatchObject({ status: 410, removed: true })
    expect(store.all()).toEqual([])
  })
  it('serves the approval page variants and decide', async () => {
    const plain = await (await fetch(base + '/a/abc')).text()
    expect(plain).toContain('Approve the rest of this run')
    expect(plain).not.toContain('needs passkey</span>')
    expect(await (await fetch(base + '/a/abc?passkey=1')).text()).toContain('needs passkey</span>')
    expect(await (await post('/decide', { id: 'abc', decision: 'deny' })).json()).toMatchObject({ decision: 'deny' })
    expect((await post('/decide', { id: 'abc', decision: 'x' })).status).toBe(400)
  })
})
