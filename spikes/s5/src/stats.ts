export type Latency = { id: string; kind: string; sentAt: number; ackAt: number; ms: number; endpoint?: string }

export function latencyStats(values: number[]) {
  if (!values.length) return { n: 0, min: 0, p50: 0, p95: 0, max: 0, mean: 0, under10s: 0 }
  const v = [...values].sort((a, b) => a - b)
  const q = (p: number) => v[Math.min(v.length - 1, Math.ceil(p * v.length) - 1)]
  return {
    n: v.length,
    min: v[0],
    p50: q(0.5),
    p95: q(0.95),
    max: v[v.length - 1],
    mean: Math.round(v.reduce((a, b) => a + b, 0) / v.length),
    under10s: v.filter((x) => x < 10000).length,
  }
}
