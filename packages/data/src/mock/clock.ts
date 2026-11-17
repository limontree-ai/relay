export interface FakeClock {
  (): number
  advance(ms: number): void
  set(ms: number): void
}

export function createFakeClock(start = Date.parse('2026-11-17T12:00:00Z')): FakeClock {
  let t = start
  const clock = (() => t) as FakeClock
  clock.advance = (ms) => {
    t += ms
  }
  clock.set = (ms) => {
    t = ms
  }
  return clock
}
