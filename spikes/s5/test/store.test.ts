import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSubStore, isSub } from '../src/store.js'

const sub = (e: string) => ({ endpoint: `https://push.example/${e}`, keys: { p256dh: 'p', auth: 'a' } })
const file = () => join(mkdtempSync(join(tmpdir(), 's5-')), 'subs.json')

describe('sub store', () => {
  it('de-dupes by endpoint', () => {
    const s = createSubStore(file())
    expect(s.add(sub('a'))).toBe(true)
    expect(s.add({ ...sub('a'), keys: { p256dh: 'new', auth: 'a' } })).toBe(false)
    s.add(sub('b'))
    expect(s.all()).toHaveLength(2)
    expect(s.all()[0].keys.p256dh).toBe('new')
  })
  it('removes', () => {
    const s = createSubStore(file())
    s.add(sub('a'))
    expect(s.remove('https://push.example/a')).toBe(true)
    expect(s.remove('https://push.example/a')).toBe(false)
    expect(s.all()).toEqual([])
  })
  it('validates', () => {
    expect(isSub(sub('a'))).toBe(true)
    expect(isSub({ endpoint: 'http://x', keys: { p256dh: 'p', auth: 'a' } })).toBe(false)
    expect(isSub({ endpoint: 'https://x' })).toBe(false)
    expect(isSub(null)).toBe(false)
  })
})
