import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js'
import { MAX_PAYLOAD, type SendResult, type Transport } from './provider.js'

export function supabaseTransport(url: string, key: string, eventsPerSecond: number): Transport {
  const client: SupabaseClient = createClient(url, key, { realtime: { params: { eventsPerSecond } } })
  const cbs = new Map<string, ((p: any) => void)[]>()
  const statusCbs: ((up: boolean) => void)[] = []
  let ch: RealtimeChannel | undefined
  let up = false
  const setUp = (v: boolean) => {
    if (up === v) return
    up = v
    statusCbs.forEach((c) => c(v))
  }
  return {
    on: (e, cb) => void cbs.set(e, [...(cbs.get(e) ?? []), cb]),
    onStatus: (cb) => void statusCbs.push(cb),
    connect: () =>
      new Promise<void>((resolve, reject) => {
        const c = client.channel('wf:spike', { config: { broadcast: { self: false } } })
        for (const [event, list] of cbs) c.on('broadcast', { event }, ({ payload }) => list.forEach((f) => f(payload)))
        let settled = false
        c.subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            setUp(true)
            if (!settled) (settled = true), resolve()
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setUp(false)
            if (!settled) (settled = true), reject(err ?? new Error(status))
          }
        })
        ch = c
      }),
    disconnect: async () => {
      setUp(false)
      if (ch) await client.removeChannel(ch)
      ch = undefined
    },
    send: async (event, payload): Promise<SendResult> => {
      if (!up || !ch) return 'offline'
      if (Buffer.byteLength(JSON.stringify(payload)) > MAX_PAYLOAD) return 'too_large'
      return (await ch.send({ type: 'broadcast', event, payload })) === 'ok' ? 'ok' : 'error'
    },
  }
}
