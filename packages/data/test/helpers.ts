import { createFakeClock, createMockApi, SEED_IDS, type MockApi, type RunStep } from '../src'

export function setup() {
  const clock = createFakeClock()
  const maya = createMockApi({ clock, userId: SEED_IDS.maya })
  const jared = maya.asUser(SEED_IDS.jared)
  const sam = maya.asUser(SEED_IDS.sam)
  return { clock, maya, jared, sam, ids: SEED_IDS, wf: SEED_IDS.workflow }
}

export async function start(api: MockApi, wf: string) {
  return api.runWorkflow(wf, 'go')
}

export async function steps(api: MockApi, runId: string): Promise<RunStep[]> {
  return api.listRunSteps(runId)
}

export async function statuses(api: MockApi, runId: string) {
  return (await steps(api, runId)).map((s) => s.status)
}

export async function toRunning(device: MockApi, owner: MockApi, deviceId: string, plan = 'plan') {
  const c = await device.claimStep(deviceId)
  if (!c) throw new Error('nothing to claim')
  const r = await device.requestApproval(deviceId, c.run_step.id, plan)
  if (r.stop) throw new Error('stop')
  await owner.decideApproval(r.approval_id, 'approved')
  return { claimed: c, approvalId: r.approval_id }
}
