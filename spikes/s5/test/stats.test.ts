import { describe, expect, it } from 'vitest'
import { latencyStats } from '../src/stats.js'

describe('latencyStats', () => {
  it('computes percentiles and the under 10s count', () => {
    const s = latencyStats([100, 200, 300, 400, 12000])
    expect(s).toMatchObject({ n: 5, min: 100, p50: 300, p95: 12000, max: 12000, mean: 2600, under10s: 4 })
  })
  it('handles empty input', () => {
    expect(latencyStats([]).n).toBe(0)
  })
})
