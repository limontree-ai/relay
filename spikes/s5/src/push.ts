import type { Sub } from './store.js'

export const deadCodes = [404, 410, 403, 400]

export type Sender = (sub: Sub, body: string) => Promise<unknown>
export type SendResult = { endpoint: string; ok: boolean; status?: number; reason?: string; removed?: boolean }

export async function sendToAll(
  subs: Sub[],
  body: string,
  send: Sender,
  remove: (endpoint: string) => void,
  log: (m: string) => void = console.log,
): Promise<SendResult[]> {
  return Promise.all(
    subs.map(async (sub): Promise<SendResult> => {
      const tail = sub.endpoint.slice(-12)
      try {
        await send(sub, body)
        log(`sent ${new Date().toISOString()} ...${tail}`)
        return { endpoint: sub.endpoint, ok: true }
      } catch (e: any) {
        const status: number | undefined = e?.statusCode
        const reason: string = typeof e?.body === 'string' && e.body ? e.body : String(e?.message ?? e)
        const removed = status !== undefined && deadCodes.includes(status)
        if (removed) remove(sub.endpoint)
        log(`failed ${status ?? 'no status'} ...${tail} reason=${reason}${removed ? ' (subscription deleted)' : ''}`)
        return { endpoint: sub.endpoint, ok: false, status, reason, removed }
      }
    }),
  )
}
