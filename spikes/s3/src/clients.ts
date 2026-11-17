import * as Y from 'yjs'
import { generateKeyBetween } from 'fractional-indexing'
import { Provider, type ProviderOpts, type Transport } from './provider.js'

export interface ClientOpts extends ProviderOpts {
  editMs?: number
  cursorHz?: number
  maxSteps?: number
}

export type Edit = { kind: 'add' | 'reorder' | 'field' | 'type'; stepId: string }

export const stepsOf = (doc: Y.Doc) => doc.getMap<Y.Map<any>>('steps')
export const editsOf = (doc: Y.Doc) => doc.getMap<string>('edits')

export function orderedIds(doc: Y.Doc) {
  return [...stepsOf(doc).entries()]
    .sort(([ia, a], [ib, b]) => (a.get('order') < b.get('order') ? -1 : a.get('order') > b.get('order') ? 1 : ia < ib ? -1 : 1))
    .map(([id]) => id)
}

export const ties = { n: 0 }
// concurrent moves can leave two steps with the same key; then neighbours are not ordered, so place after the lower one
const between = (lo: string | null, hi: string | null) => {
  if (lo !== null && hi !== null && lo >= hi) {
    ties.n++
    return generateKeyBetween(lo, null)
  }
  return generateKeyBetween(lo, hi)
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

export class SimClient {
  readonly doc = new Y.Doc()
  readonly provider: Provider
  readonly expected = new Map<string, Edit>()
  private seq = 0
  private running = false
  private bursts = 0
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private cursor?: ReturnType<typeof setInterval>
  private o: Required<Pick<ClientOpts, 'editMs' | 'cursorHz' | 'maxSteps'>>

  constructor(readonly n: number, t: Transport, opts: ClientOpts = {}) {
    this.o = { editMs: 400, cursorHz: 5, maxSteps: 40, ...opts }
    this.provider = new Provider(this.doc, t, opts)
  }

  start() {
    this.running = true
    this.provider.awareness.setLocalState({ user: this.n, cursor: null })
    this.cursor = setInterval(() => this.moveCursor(), 1000 / this.o.cursorHz)
    this.later(rnd(0, this.o.editMs), () => this.loop())
  }

  async stopEditing() {
    this.running = false
    clearInterval(this.cursor)
    while (this.bursts > 0) await new Promise((r) => setTimeout(r, 50))
    this.timers.forEach(clearTimeout)
  }

  private later(ms: number, f: () => void) {
    const h = setTimeout(() => {
      this.timers.delete(h)
      f()
    }, ms)
    this.timers.add(h)
  }

  private loop() {
    if (!this.running) return
    this.edit()
    this.later(-Math.log(1 - Math.random()) * this.o.editMs, () => this.loop())
  }

  private marker() {
    return `c${this.n}-${this.seq++}`
  }

  private record(m: string, e: Edit) {
    this.expected.set(m, e)
  }

  private edit() {
    const ids = orderedIds(this.doc)
    const r = Math.random()
    if (!ids.length || (r < 0.1 && ids.length < this.o.maxSteps)) return this.add(ids)
    if (r < 0.35 && ids.length > 1) return this.reorder(ids)
    if (r < 0.5) return this.field(pick(ids))
    this.type(pick(ids))
  }

  private add(ids: string[]) {
    const m = this.marker()
    const id = `s-${m}`
    const steps = stepsOf(this.doc)
    const at = ids.length ? Math.floor(Math.random() * (ids.length + 1)) : 0
    const lo = at > 0 ? steps.get(ids[at - 1])!.get('order') : null
    const hi = at < ids.length ? steps.get(ids[at])!.get('order') : null
    this.doc.transact(() => {
      const s = new Y.Map<any>()
      s.set('order', between(lo, hi))
      s.set('name', `step ${m}`)
      s.set('kind', pick(['agent', 'approval', 'http']))
      s.set('action', new Y.Text())
      steps.set(id, s)
      editsOf(this.doc).set(m, 'add')
    })
    this.record(m, { kind: 'add', stepId: id })
  }

  private reorder(ids: string[]) {
    const m = this.marker()
    const steps = stepsOf(this.doc)
    const id = pick(ids)
    const rest = ids.filter((x) => x !== id)
    const at = Math.floor(Math.random() * (rest.length + 1))
    const lo = at > 0 ? steps.get(rest[at - 1])!.get('order') : null
    const hi = at < rest.length ? steps.get(rest[at])!.get('order') : null
    this.doc.transact(() => {
      steps.get(id)!.set('order', between(lo, hi))
      editsOf(this.doc).set(m, 'reorder')
    })
    this.record(m, { kind: 'reorder', stepId: id })
  }

  private field(id: string) {
    const m = this.marker()
    this.doc.transact(() => {
      stepsOf(this.doc).get(id)!.set('name', `step ${m}`)
      editsOf(this.doc).set(m, 'field')
    })
    this.record(m, { kind: 'field', stepId: id })
  }

  private type(id: string) {
    const m = this.marker()
    const text = `<${m}>`
    let i = 0
    this.bursts++
    const step = () => {
      const t = stepsOf(this.doc).get(id)!.get('action') as Y.Text
      t.insert(t.length, text[i++])
      if (i < text.length) return this.later(rnd(40, 120), step)
      editsOf(this.doc).set(m, 'type')
      this.record(m, { kind: 'type', stepId: id })
      this.bursts--
    }
    step()
  }

  private moveCursor() {
    const ids = orderedIds(this.doc)
    this.provider.awareness.setLocalState({
      user: this.n,
      cursor: ids.length ? { step: pick(ids), index: Math.floor(Math.random() * 50) } : null,
    })
  }
}

export function canonical(doc: Y.Doc): string {
  const walk = (v: any): any =>
    v instanceof Y.Text ? v.toString() : v instanceof Y.Map ? Object.fromEntries([...v.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, walk(x)])) : v
  return JSON.stringify(walk(doc.getMap('steps'))) + JSON.stringify(walk(doc.getMap('edits')))
}

// concurrent char-by-char typing at the same spot may interleave, so a typed marker counts as present when its chars appear in order
const isSubsequence = (needle: string, hay: string) => {
  let i = 0
  for (const ch of hay) if (ch === needle[i]) i++
  return i === needle.length
}

export function lostEdits(docs: Y.Doc[], expected: Map<string, Edit>) {
  const missing = (doc: Y.Doc, m: string, e: Edit) => {
    if (editsOf(doc).get(m) !== e.kind) return true
    const s = stepsOf(doc).get(e.stepId)
    if (!s) return true
    return e.kind === 'type' && !isSubsequence(`<${m}>`, (s.get('action') as Y.Text).toString())
  }
  let lostEverywhere = 0
  let lostSomewhere = 0
  for (const [m, e] of expected) {
    const n = docs.filter((d) => missing(d, m, e)).length
    if (n === docs.length) lostEverywhere++
    if (n > 0) lostSomewhere++
  }
  return { total: expected.size, lostEverywhere, lostSomewhere }
}
