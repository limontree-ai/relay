import type { ClaimedStep, DeviceApi } from '../api'
import type { ApprovalDecision, Json } from '../types'

type Maybe<T> = T | ((c: ClaimedStep) => T)

export interface FakeScript {
  plan?: Maybe<string>
  statuses?: Maybe<string[]>
  outcome?: Maybe<'done' | 'failed'>
  summary?: Maybe<string>
  outputs?: Maybe<Json | null>
  stopRun?: boolean
  pollMs?: number
  maxPolls?: number
  sleep?: (ms: number) => Promise<void>
  onApproval?: (approvalId: string, step: ClaimedStep) => void | Promise<void>
  onStatus?: (message: string, notes: string[]) => void | Promise<void>
}

export type FakeStepEnd = 'done' | 'failed' | 'denied' | 'stopped' | 'approval_timeout'

export interface FakeStepResult {
  claimed: ClaimedStep
  end: FakeStepEnd
  decision: ApprovalDecision | null
  notes: string[]
}

export interface FakeDevice {
  runNext(): Promise<FakeStepResult | null>
  runAll(max?: number): Promise<FakeStepResult[]>
  notes: string[]
}

const pick = <T>(v: Maybe<T> | undefined, c: ClaimedStep, d: T): T => (v === undefined ? d : typeof v === 'function' ? (v as (c: ClaimedStep) => T)(c) : v)

export function playFakeDevice(api: DeviceApi, deviceId: string, script: FakeScript = {}): FakeDevice {
  const sleep = script.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const notes: string[] = []

  async function runNext(): Promise<FakeStepResult | null> {
    await api.heartbeat(deviceId)
    const claimed = await api.claimStep(deviceId)
    if (!claimed) return null
    const id = claimed.run_step.id
    const got: string[] = []
    const result = (end: FakeStepEnd, decision: ApprovalDecision | null = null): FakeStepResult => ({ claimed, end, decision, notes: got })

    const req = await api.requestApproval(deviceId, id, pick(script.plan, claimed, `I will do step ${claimed.run_step.order}.`))
    if (req.stop) return result('stopped')
    let decision = req.decision
    if (!decision) await script.onApproval?.(req.approval_id, claimed)
    for (let i = 0; !decision; i++) {
      if (i >= (script.maxPolls ?? 600)) return result('approval_timeout')
      const r = await api.getApprovalDecision(deviceId, req.approval_id)
      if (r.decision) decision = r.decision
      else if (r.stop) return result('stopped')
      else await sleep(script.pollMs ?? 1000)
    }
    if (decision === 'denied') return result('denied', decision)

    for (const message of pick(script.statuses, claimed, [`Working on step ${claimed.run_step.order}`])) {
      const s = await api.postStatus(deviceId, id, message)
      got.push(...s.notes)
      notes.push(...s.notes)
      await script.onStatus?.(message, s.notes)
      if (s.stop) return result('stopped', decision)
      await sleep(script.pollMs ?? 1000)
    }
    const outcome = pick(script.outcome, claimed, 'done')
    const fin = await api.finishStep(deviceId, id, outcome, pick(script.summary, claimed, `Finished step ${claimed.run_step.order}.`), pick(script.outputs, claimed, null), script.stopRun ?? false)
    if (fin.stop) return result('stopped', decision)
    return result(outcome, decision)
  }

  async function runAll(max = 50) {
    const out: FakeStepResult[] = []
    for (let i = 0; i < max; i++) {
      const r = await runNext()
      if (!r) break
      out.push(r)
      if (r.end !== 'done') break
    }
    return out
  }

  return { runNext, runAll, notes }
}
