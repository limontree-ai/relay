import * as Y from 'yjs'
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness'
import { toBase64, fromBase64 } from 'lib0/buffer'

export const MAX_PAYLOAD = 256 * 1024
export type SendResult = 'ok' | 'offline' | 'too_large' | 'error'

export interface Transport {
  send(event: string, payload: unknown): Promise<SendResult>
  on(event: string, cb: (payload: any) => void): void
  onStatus(cb: (up: boolean) => void): void
  connect(): Promise<void>
  disconnect(): Promise<void>
}

export interface ProviderOpts {
  batchMs?: number
  awarenessMs?: number
  syncEveryMs?: number
}

const EMPTY_DIFF = 2

export class Provider {
  readonly awareness: Awareness
  readonly stats = { tooLarge: 0, resent: 0, syncReq: 0, syncReply: 0 }
  private id: number
  private up = false
  private pending: Uint8Array[] = []
  private flushTimer?: ReturnType<typeof setTimeout>
  private awTimer?: ReturnType<typeof setTimeout>
  private awLast = 0
  private syncTimer?: ReturnType<typeof setInterval>
  private replies = new Map<number, ReturnType<typeof setTimeout>>()
  private o: Required<ProviderOpts>

  constructor(readonly doc: Y.Doc, private t: Transport, opts: ProviderOpts = {}) {
    this.o = { batchMs: 50, awarenessMs: 100, syncEveryMs: 10000, ...opts }
    this.id = doc.clientID
    this.awareness = new Awareness(doc)
    doc.on('update', this.onDoc)
    this.awareness.on('update', this.onAwareness)
    t.on('yjs-update', (m) => this.apply(m.u))
    t.on('awareness', (m) => applyAwarenessUpdate(this.awareness, fromBase64(m.u), this))
    t.on('sync-req', (m) => this.onSyncReq(m))
    t.on('sync-reply', (m) => this.onSyncReply(m))
    t.onStatus((up) => this.onStatus(up))
  }

  async start() {
    await this.t.connect()
    this.syncTimer = setInterval(() => this.up && this.sendSyncReq(), this.o.syncEveryMs * (0.8 + Math.random() * 0.4))
  }

  async stop() {
    clearTimeout(this.flushTimer)
    clearTimeout(this.awTimer)
    clearInterval(this.syncTimer)
    this.replies.forEach(clearTimeout)
    this.doc.off('update', this.onDoc)
    this.awareness.destroy()
    await this.t.disconnect()
  }

  async goOffline() {
    await this.t.disconnect()
  }

  async goOnline() {
    await this.t.connect()
  }

  private apply(b64: string) {
    Y.applyUpdate(this.doc, fromBase64(b64), this)
  }

  private onDoc = (u: Uint8Array, origin: unknown) => {
    if (origin === this) return
    this.pending.push(u)
    if (this.up && !this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), this.o.batchMs)
  }

  private async flush() {
    this.flushTimer = undefined
    if (!this.up || !this.pending.length) return
    const merged = Y.mergeUpdates(this.pending)
    this.pending = []
    const r = await this.t.send('yjs-update', { u: toBase64(merged) })
    if (r === 'ok') return
    if (r === 'too_large') return void this.stats.tooLarge++
    this.pending.unshift(merged)
    this.stats.resent++
    if (this.up && !this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), 500)
  }

  private onStatus(up: boolean) {
    this.up = up
    if (!up) return
    this.sendSyncReq()
    this.sendAwareness()
    if (this.pending.length) this.flush()
  }

  private sendSyncReq() {
    this.stats.syncReq++
    this.t.send('sync-req', { from: this.id, sv: toBase64(Y.encodeStateVector(this.doc)) })
  }

  private onSyncReq(m: { from: number; sv: string }) {
    if (this.replies.has(m.from)) return
    const h = setTimeout(() => {
      this.replies.delete(m.from)
      const diff = Y.encodeStateAsUpdate(this.doc, fromBase64(m.sv))
      if (diff.length <= EMPTY_DIFF || !this.up) return
      this.stats.syncReply++
      this.t.send('sync-reply', { to: m.from, u: toBase64(diff), sv: toBase64(Y.encodeStateVector(this.doc)) })
    }, 20 + Math.random() * 180)
    this.replies.set(m.from, h)
  }

  private onSyncReply(m: { to: number; u: string; sv: string }) {
    const h = this.replies.get(m.to)
    if (h) (clearTimeout(h), this.replies.delete(m.to))
    if (m.to !== this.id) return
    this.apply(m.u)
    const back = Y.encodeStateAsUpdate(this.doc, fromBase64(m.sv))
    if (back.length > EMPTY_DIFF) this.t.send('yjs-update', { u: toBase64(back) })
  }

  private onAwareness = ({ added, updated }: { added: number[]; updated: number[] }, origin: unknown) => {
    if (origin !== 'local' || ![...added, ...updated].includes(this.id)) return
    if (this.awTimer) return
    const wait = Math.max(0, this.awLast + this.o.awarenessMs - Date.now())
    this.awTimer = setTimeout(() => this.sendAwareness(), wait)
  }

  private sendAwareness() {
    this.awTimer = undefined
    if (!this.up) return
    this.awLast = Date.now()
    this.t.send('awareness', { u: toBase64(encodeAwarenessUpdate(this.awareness, [this.id])) })
  }
}
