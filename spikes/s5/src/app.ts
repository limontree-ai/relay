import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { approvalPage } from './approval-page.js'
import { buildPayload, kinds, type Kind } from './payload.js'
import { sendToAll, type Sender } from './push.js'
import { latencyStats, type Latency } from './stats.js'
import { isSub, readJson, writeJson, type createSubStore } from './store.js'

export type Deps = {
  publicDir: string
  latencyFile: string
  store: ReturnType<typeof createSubStore>
  sender: Sender
  vapidPublicKey: string
  log?: (m: string) => void
  sleep?: (ms: number) => Promise<void>
}

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
}

async function body(req: IncomingMessage): Promise<any> {
  let s = ''
  for await (const c of req) s += c
  try {
    return s ? JSON.parse(s) : {}
  } catch {
    return null
  }
}

export function createApp(d: Deps) {
  const log = d.log ?? console.log
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const json = (res: ServerResponse, code: number, data: unknown) => {
    res.writeHead(code, { 'content-type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  async function push(kind: Kind, delayMs: number, endpoint?: string) {
    const id = randomUUID().slice(0, 8)
    if (delayMs > 0) await sleep(delayMs)
    const sentAt = Date.now()
    const subs = d.store.all().filter((s) => !endpoint || s.endpoint === endpoint)
    const text = JSON.stringify(buildPayload(kind, id, sentAt))
    log(`send ${kind} id=${id} sentAt=${new Date(sentAt).toISOString()} subs=${subs.length}`)
    const results = await sendToAll(subs, text, d.sender, (e) => d.store.remove(e), log)
    return { id, kind, sentAt, results }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const path = url.pathname
    try {
      if (req.method === 'GET' && path === '/vapid-public-key') {
        res.writeHead(200, { 'content-type': 'text/plain' })
        return res.end(d.vapidPublicKey)
      }
      if (req.method === 'GET' && path === '/latency') return json(res, 200, readJson<Latency[]>(d.latencyFile, []))
      if (req.method === 'GET' && path === '/stats') return json(res, 200, latencyStats(readJson<Latency[]>(d.latencyFile, []).map((l) => l.ms)))
      if (req.method === 'GET' && path.startsWith('/a/')) {
        res.writeHead(200, { 'content-type': types['.html'] })
        return res.end(approvalPage(decodeURIComponent(path.slice(3)), url.searchParams.has('passkey')))
      }
      if (req.method === 'POST') {
        const b = await body(req)
        if (b === null) return json(res, 400, { error: 'bad json' })
        if (path === '/subscribe') {
          if (!isSub(b)) return json(res, 400, { error: 'not a push subscription' })
          const created = d.store.add({ endpoint: b.endpoint, keys: b.keys, ua: req.headers['user-agent'] })
          return json(res, created ? 201 : 200, { ok: true, created })
        }
        if (path === '/send') {
          const kind = (b.kind ?? 'approval') as Kind
          if (!kinds.includes(kind)) return json(res, 400, { error: 'kind must be approval, ready or stalled' })
          const delayMs = Math.min(Math.max(Number(b.delayMs) || 0, 0), 600000)
          return json(res, 200, await push(kind, delayMs, b.endpoint))
        }
        if (path === '/test-notification') return json(res, 200, await push('ready', 0, b.endpoint))
        if (path === '/ack') {
          const sentAt = Number(b.sentAt)
          const ackAt = Number(b.ackAt)
          if (!Number.isFinite(sentAt) || !Number.isFinite(ackAt)) return json(res, 400, { error: 'sentAt and ackAt required' })
          const rows = readJson<Latency[]>(d.latencyFile, [])
          const row: Latency = { id: String(b.id), kind: String(b.kind), sentAt, ackAt, ms: ackAt - sentAt }
          rows.push(row)
          writeJson(d.latencyFile, rows)
          log(`ack id=${row.id} latency=${row.ms}ms`)
          return json(res, 200, row)
        }
        if (path === '/decide') {
          if (!['approve', 'approve_rest', 'deny'].includes(b.decision)) return json(res, 400, { error: 'bad decision' })
          log(`decide id=${b.id} ${b.decision}`)
          return json(res, 200, { ok: true, id: b.id, decision: b.decision })
        }
      }
      if (req.method === 'GET' || req.method === 'HEAD') {
        const file = normalize(path === '/' ? '/index.html' : path)
        if (file.includes('..')) return json(res, 404, { error: 'not found' })
        const data = await readFile(join(d.publicDir, file)).catch(() => null)
        if (data) {
          res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' })
          return res.end(data)
        }
      }
      json(res, 404, { error: 'not found' })
    } catch (e: any) {
      log(`error ${e?.message}`)
      json(res, 500, { error: 'server error' })
    }
  })
  return server
}
