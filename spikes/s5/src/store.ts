import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export type Sub = { endpoint: string; keys: { p256dh: string; auth: string }; ua?: string; addedAt?: string }

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

export function writeJson(file: string, data: unknown) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2))
}

export function isSub(x: any): x is Sub {
  return !!x && typeof x.endpoint === 'string' && x.endpoint.startsWith('https://') && typeof x.keys?.p256dh === 'string' && typeof x.keys?.auth === 'string'
}

export function createSubStore(file: string) {
  const all = () => readJson<Sub[]>(file, [])
  return {
    all,
    add(sub: Sub) {
      const subs = all()
      const i = subs.findIndex((s) => s.endpoint === sub.endpoint)
      const next = { ...sub, addedAt: sub.addedAt ?? new Date().toISOString() }
      if (i >= 0) subs[i] = next
      else subs.push(next)
      writeJson(file, subs)
      return i < 0
    },
    remove(endpoint: string) {
      const subs = all()
      const rest = subs.filter((s) => s.endpoint !== endpoint)
      if (rest.length !== subs.length) writeJson(file, rest)
      return rest.length !== subs.length
    },
  }
}
