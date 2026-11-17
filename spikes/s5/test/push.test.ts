import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { sendToAll } from '../src/push.js'
import { createSubStore } from '../src/store.js'

const sub = (e: string) => ({ endpoint: `https://push.example/${e}`, keys: { p256dh: 'p', auth: 'a' } })

describe('sendToAll', () => {
  it.each([404, 410, 403, 400])('deletes the subscription on %i and prints the reason', async (code) => {
    const store = createSubStore(join(mkdtempSync(join(tmpdir(), 's5-')), 'subs.json'))
    store.add(sub('a'))
    const log = vi.fn()
    const send = vi.fn().mockRejectedValue({ statusCode: code, body: '{"reason":"BadJwtToken"}' })
    const [r] = await sendToAll(store.all(), 'x', send, store.remove, log)
    expect(r).toMatchObject({ ok: false, status: code, removed: true })
    expect(store.all()).toEqual([])
    expect(log.mock.calls[0][0]).toContain('BadJwtToken')
  })
  it('keeps the subscription on 500 and on network errors', async () => {
    const store = createSubStore(join(mkdtempSync(join(tmpdir(), 's5-')), 'subs.json'))
    store.add(sub('a'))
    await sendToAll(store.all(), 'x', vi.fn().mockRejectedValue({ statusCode: 500, body: 'boom' }), store.remove, () => {})
    await sendToAll(store.all(), 'x', vi.fn().mockRejectedValue(new Error('ECONNRESET')), store.remove, () => {})
    expect(store.all()).toHaveLength(1)
  })
  it('reports success', async () => {
    const [r] = await sendToAll([sub('a')], 'x', vi.fn().mockResolvedValue({}), () => {}, () => {})
    expect(r.ok).toBe(true)
  })
})
