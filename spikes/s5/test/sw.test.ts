import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

const self: any = {}
new Function('self', readFileSync(new URL('../public/sw-logic.js', import.meta.url), 'utf8'))(self)
const { handlePush, buildNotification, clickTarget } = self.swLogic

const run = (raw: string | null, maxActions = 0, showImpl?: () => Promise<void>) => {
  const reg = { showNotification: vi.fn<(t: string, o: any) => Promise<void>>(showImpl ?? (() => Promise.resolve())) }
  const ack = vi.fn()
  let waited: Promise<unknown> | undefined
  const event = { data: raw === null ? null : { text: () => raw }, waitUntil: (p: Promise<unknown>) => (waited = p) }
  return { reg, ack, done: handlePush(event, reg, maxActions, ack).then(() => waited) }
}

describe('push handler', () => {
  it('shows the payload and acks after showing', async () => {
    const { reg, ack, done } = run(JSON.stringify({ id: 'x1', kind: 'ready', title: 'T', body: 'B', sentAt: 5 }))
    await done
    expect(reg.showNotification).toHaveBeenCalledWith('T', expect.objectContaining({ body: 'B', data: { id: 'x1', url: '/a/x1', kind: 'ready', sentAt: 5 } }))
    expect(ack).toHaveBeenCalledWith(expect.objectContaining({ id: 'x1' }), expect.any(Number))
  })
  it.each([['not json {'], [''], [null], ['null'], ['"str"'], ['[1,2]'], ['{"title":5,"body":{}}']])('still shows a notification for malformed payload %j', async (raw) => {
    const { reg, done } = run(raw as string | null)
    await done
    expect(reg.showNotification).toHaveBeenCalledTimes(1)
    const [title, opts] = reg.showNotification.mock.calls[0]!
    expect(title).toBeTruthy()
    expect(opts.body).toBeTruthy()
  })
  it('does not throw if the ack fails', async () => {
    const reg = { showNotification: vi.fn().mockResolvedValue(undefined) }
    const event = { data: null, waitUntil: vi.fn() }
    await expect(handlePush(event, reg, 0, () => Promise.reject(new Error('offline')))).resolves.toBeUndefined()
    expect(reg.showNotification).toHaveBeenCalled()
  })
  it('calls waitUntil synchronously', () => {
    const waitUntil = vi.fn()
    handlePush({ data: null, waitUntil }, { showNotification: () => Promise.resolve() }, 0, null)
    expect(waitUntil).toHaveBeenCalledTimes(1)
  })
  it('adds actions only when maxActions > 0 and kind is approval', () => {
    const raw = JSON.stringify({ id: 'a', kind: 'approval' })
    expect(buildNotification(raw, 0).options.actions).toBeUndefined()
    expect(buildNotification(raw, 2).options.actions.map((a: any) => a.action)).toEqual(['approve', 'deny'])
    expect(buildNotification(JSON.stringify({ id: 'a', kind: 'ready' }), 2).options.actions).toBeUndefined()
  })
  it('ignores off-site urls and builds click targets', () => {
    expect(buildNotification(JSON.stringify({ id: 'a', url: 'https://evil.example' }), 0).options.data.url).toBe('/a/a')
    expect(clickTarget({ url: '/a/q' }, '')).toBe('/a/q')
    expect(clickTarget({ url: '/a/q' }, 'deny')).toBe('/a/q?action=deny')
    expect(clickTarget(undefined, '')).toBe('/')
  })
})
