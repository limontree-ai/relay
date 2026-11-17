import { MAX_PAYLOAD, type SendResult, type Transport } from './provider.js'

export interface FakeOpts {
  latencyMs?: number
  jitterMs?: number
  dropRate?: number
  maxPayload?: number
  rateLimit?: number
}

type Member = { cbs: Map<string, ((p: any) => void)[]>; up: boolean }

export class FakeHub {
  readonly stats = { sends: 0, deliveries: 0, dropped: 0, rateDropped: 0, tooLarge: 0 }
  private members = new Set<Member>()
  private win = 0
  private count = 0
  private o: Required<FakeOpts>

  constructor(opts: FakeOpts = {}) {
    this.o = { latencyMs: 40, jitterMs: 20, dropRate: 0, maxPayload: MAX_PAYLOAD, rateLimit: 100, ...opts }
  }

  transport(): Transport {
    const me: Member = { cbs: new Map(), up: false }
    const statusCbs: ((up: boolean) => void)[] = []
    const setUp = (up: boolean) => {
      me.up = up
      statusCbs.forEach((c) => c(up))
    }
    this.members.add(me)
    return {
      on: (e, cb) => void me.cbs.set(e, [...(me.cbs.get(e) ?? []), cb]),
      onStatus: (cb) => void statusCbs.push(cb),
      connect: async () => {
        await this.delay()
        setUp(true)
      },
      disconnect: async () => setUp(false),
      send: async (event, payload): Promise<SendResult> => {
        if (!me.up) return 'offline'
        const json = JSON.stringify(payload)
        if (Buffer.byteLength(json) > this.o.maxPayload) {
          this.stats.tooLarge++
          return 'too_large'
        }
        this.stats.sends++
        const others = [...this.members].filter((m) => m !== me)
        if (!this.admit(1 + others.length)) {
          this.stats.rateDropped++
          return 'ok'
        }
        if (Math.random() < this.o.dropRate) {
          this.stats.dropped++
          return 'ok'
        }
        for (const m of others) {
          setTimeout(() => {
            if (!m.up) return
            this.stats.deliveries++
            m.cbs.get(event)?.forEach((cb) => cb(JSON.parse(json)))
          }, this.lat())
        }
        return 'ok'
      },
    }
  }

  private admit(cost: number) {
    const w = Math.floor(Date.now() / 1000)
    if (w !== this.win) {
      this.win = w
      this.count = 0
    }
    if (this.count + cost > this.o.rateLimit) return false
    this.count += cost
    return true
  }

  private lat() {
    return this.o.latencyMs + Math.random() * this.o.jitterMs
  }

  private delay() {
    return new Promise((r) => setTimeout(r, this.lat()))
  }
}
