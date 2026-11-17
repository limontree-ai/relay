import { describe, expect, it } from 'vitest'
import { ApiError, playFakeDevice, type BroadcastEvent } from '../src'
import { setup, start, statuses, toRunning } from './helpers'

const code = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    if (e instanceof ApiError) return e.code
    throw e
  }
  return 'ok'
}

describe('seed', () => {
  it('has a room with 3 members, 3 devices and a 3 step workflow', async () => {
    const { maya, ids } = setup()
    const room = await maya.getRoom('demo-day-crew')
    expect(room?.id).toBe(ids.room)
    expect(await maya.listMembers(ids.room)).toHaveLength(3)
    const rd = await maya.listRoomDevices(ids.room)
    expect(rd).toHaveLength(3)
    expect(rd.find((d) => d.device.platform === 'windows')).toBeTruthy()
    expect(rd.filter((d) => !d.online).map((d) => d.device.id)).toEqual([ids.samMini])
    expect((await maya.getWorkflow(ids.workflow))?.doc.steps).toHaveLength(3)
  })
  it('never exposes token hashes', async () => {
    const { maya } = setup()
    expect(JSON.stringify(await maya.listDevices())).not.toContain('token_hash')
  })
})

describe('startRun', () => {
  it('inserts steps and marks step 1 ready', async () => {
    const { maya, wf, ids } = setup()
    const run = await start(maya, wf)
    expect(run.status).toBe('running')
    expect(run.short_id).toHaveLength(6)
    expect(await statuses(maya, run.id)).toEqual(['ready', 'pending', 'pending'])
    const s = await maya.listRunSteps(run.id)
    expect(s.map((x) => x.device_id)).toEqual([ids.jaredMac, ids.jaredMac, ids.mayaWindows])
  })
  it('saves a version first when the workflow is dirty', async () => {
    const { maya, wf } = setup()
    const doc = (await maya.getWorkflow(wf))!.doc
    await maya.updateWorkflowDoc(wf, { ...doc, name: 'Changed' })
    expect((await maya.getWorkflow(wf))?.dirty).toBe(true)
    const run = await start(maya, wf)
    const w = await maya.getWorkflow(wf)
    expect(w?.dirty).toBe(false)
    expect(run.commit_sha).toBe(w?.head_commit_sha)
    expect(await maya.listVersions(wf)).toHaveLength(2)
  })
  it('rejects an unbound role', async () => {
    const { maya, wf } = setup()
    const w = (await maya.getWorkflow(wf))!
    const doc = { ...w.doc, steps: w.doc.steps.map((s, i) => (i === 2 ? { ...s, role: 'nobody' } : s)) }
    expect(await code(maya.startRun({ workflow_id: wf, commit_sha: 'abc', doc }))).toBe('role_unbound')
  })
  it('rejects a device that cannot do the needs', async () => {
    const { maya, wf } = setup()
    const w = (await maya.getWorkflow(wf))!
    const doc = { ...w.doc, steps: w.doc.steps.map((s, i) => (i === 0 ? { ...s, role: 'maya-laptop', needs: 'screen' as const } : s)) }
    expect(await code(maya.startRun({ workflow_id: wf, commit_sha: 'abc', doc }))).toBe('device_cannot')
  })
  it('rejects a revoked device, an empty workflow and a second active run', async () => {
    const { maya, jared, wf, ids } = setup()
    await jared.revokeDevice(ids.jaredMac)
    expect(await code(start(maya, wf))).toBe('device_revoked')
    const s = setup()
    const { id } = await s.maya.createWorkflow({ room_id: s.ids.room, slug: 'empty', name: 'Empty' })
    expect(await code(s.maya.runWorkflow(id))).toBe('empty_workflow')
    await start(s.maya, s.wf)
    expect(await code(start(s.maya, s.wf))).toBe('run_active')
  })
  it('blocks viewers and outsiders', async () => {
    const { maya, sam, wf, ids } = setup()
    await maya.setMemberRole(ids.room, ids.sam, 'viewer')
    expect(await code(start(sam, wf))).toBe('forbidden')
    const out = maya.asUser('someone-else')
    expect(await code(out.listRunSteps('x'))).toBe('not_found')
    expect(await code(out.listWorkflows(ids.room))).toBe('forbidden')
  })
  it('binding rules: screen steps cannot bind to windows, device must be on for the room', async () => {
    const { maya, wf, ids } = setup()
    expect(await code(maya.setRoleBinding(wf, 'jared-mac', ids.mayaWindows))).toBe('device_cannot')
    await maya.asUser(ids.sam).setRoomDeviceAllowed(ids.room, ids.samMini, false)
    expect(await code(maya.setRoleBinding(wf, 'jared-mac', ids.samMini))).toBe('device_not_allowed')
    expect(await code(maya.setRoleBinding(wf, 'maya-laptop', ids.jaredMac))).toBe('ok')
  })
})

describe('step transitions', () => {
  it('ready -> claimed -> awaiting_approval -> running -> done, next step ready', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    const c = await jared.claimStep(ids.jaredMac)
    expect(c?.run_step.status).toBe('claimed')
    expect(c?.previous).toEqual([])
    expect(c?.never_automate).toHaveLength(1)
    expect((await statuses(maya, run.id))[0]).toBe('claimed')
    const r = await jared.requestApproval(ids.jaredMac, c!.run_step.id, 'my plan')
    expect(r).toMatchObject({ stop: false, decision: null })
    expect((await statuses(maya, run.id))[0]).toBe('awaiting_approval')
    if (r.stop) throw new Error()
    await jared.decideApproval(r.approval_id, 'approved')
    const [s1] = await maya.listRunSteps(run.id)
    expect(s1?.status).toBe('running')
    expect(s1?.approved_by).toBe(ids.jared)
    const f = await jared.finishStep(ids.jaredMac, s1!.id, 'done', 'ok', { n: 1 }, false)
    expect(f).toEqual({ ok: true, stop: false, run_status: 'running' })
    expect(await statuses(maya, run.id)).toEqual(['done', 'ready', 'pending'])
    const next = await jared.claimStep(ids.jaredMac)
    expect(next?.previous).toMatchObject([{ order: 1, status: 'done', summary: 'ok', outputs: { n: 1 } }])
  })
  it('denied: awaiting_approval -> failed, run fails, later steps not_run', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    const c = await jared.claimStep(ids.jaredMac)
    const r = await jared.requestApproval(ids.jaredMac, c!.run_step.id, 'p')
    if (r.stop) throw new Error()
    await jared.decideApproval(r.approval_id, 'denied')
    expect(await statuses(maya, run.id)).toEqual(['failed', 'not_run', 'not_run'])
    expect((await maya.getRun(run.id))?.status).toBe('failed')
    expect((await maya.getRun(run.id))?.ended_at).not.toBeNull()
  })
  it('running -> failed fails the run', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    const { claimed } = await toRunning(jared, jared, ids.jaredMac)
    const f = await jared.finishStep(ids.jaredMac, claimed.run_step.id, 'failed', 'tests broke', null, false)
    expect(f.run_status).toBe('failed')
    expect(await statuses(maya, run.id)).toEqual(['failed', 'not_run', 'not_run'])
    expect((await maya.listRunSteps(run.id))[0]?.error).toBe('tests broke')
  })
  it('last step done -> run succeeded', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    for (const [d, owner, did] of [[jared, jared, ids.jaredMac], [jared, jared, ids.jaredMac], [maya, maya, ids.mayaWindows]] as const) {
      const { claimed } = await toRunning(d, owner, did)
      await d.finishStep(did, claimed.run_step.id, 'done', 'x', null, false)
    }
    expect((await maya.getRun(run.id))?.status).toBe('succeeded')
    expect(await statuses(maya, run.id)).toEqual(['done', 'done', 'done'])
  })
  it('stop_run on a done step ends the run stopped and the rest not_run', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    const { claimed } = await toRunning(jared, jared, ids.jaredMac)
    const f = await jared.finishStep(ids.jaredMac, claimed.run_step.id, 'done', 'x', null, true)
    expect(f.run_status).toBe('stopped')
    expect(await statuses(maya, run.id)).toEqual(['done', 'not_run', 'not_run'])
  })
  it('cannot finish before approval', async () => {
    const { maya, jared, wf, ids } = setup()
    await start(maya, wf)
    const c = await jared.claimStep(ids.jaredMac)
    expect(await jared.finishStep(ids.jaredMac, c!.run_step.id, 'done', 'x', null, false)).toEqual({ ok: false, stop: true, run_status: null })
  })
  it('approved_run approves the next step at once', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    const c = await jared.claimStep(ids.jaredMac)
    const r = await jared.requestApproval(ids.jaredMac, c!.run_step.id, 'p')
    if (r.stop) throw new Error()
    await jared.decideApproval(r.approval_id, 'approved_run')
    await jared.finishStep(ids.jaredMac, c!.run_step.id, 'done', 'x', null, false)
    const c2 = await jared.claimStep(ids.jaredMac)
    const r2 = await jared.requestApproval(ids.jaredMac, c2!.run_step.id, 'p2')
    expect(r2).toMatchObject({ stop: false, decision: 'approved_run' })
    expect((await statuses(maya, run.id))[1]).toBe('running')
    expect((await maya.listRunSteps(run.id))[1]?.approved_by).toBe(ids.jared)
  })
})

describe('claim rules', () => {
  it('only the bound device claims', async () => {
    const { maya, jared, wf, ids } = setup()
    await start(maya, wf)
    expect(await maya.claimStep(ids.mayaWindows)).toBeNull()
    expect(await jared.claimStep(ids.samMini)).toBeNull()
    expect(await jared.claimStep(ids.jaredMac)).not.toBeNull()
  })
  it('needs room_devices.allowed', async () => {
    const { maya, jared, wf, ids } = setup()
    await jared.setRoomDeviceAllowed(ids.room, ids.jaredMac, false)
    await start(maya, wf)
    expect(await jared.claimStep(ids.jaredMac)).toBeNull()
    await jared.setRoomDeviceAllowed(ids.room, ids.jaredMac, true)
    expect(await jared.claimStep(ids.jaredMac)).not.toBeNull()
  })
  it('needs capabilities to cover needs', async () => {
    const { maya, jared, wf, ids } = setup()
    await start(maya, wf)
    const c = await jared.claimStep(ids.jaredMac)
    await jared.finishStep(ids.jaredMac, c!.run_step.id, 'done', 'x', null, false)
    await jared.joinRoom(ids.jaredMac, 'demo-day-crew', ['shell'])
    expect(await jared.claimStep(ids.jaredMac)).toBeNull()
  })
  it('a device runs one step at a time', async () => {
    const { maya, jared, wf, ids } = setup()
    await start(maya, wf)
    await jared.claimStep(ids.jaredMac)
    expect(await jared.claimStep(ids.jaredMac)).toBeNull()
  })
  it('revoked devices are rejected', async () => {
    const { maya, jared, ids } = setup()
    await jared.revokeDevice(ids.jaredMac)
    expect(await code(maya.claimStep(ids.jaredMac))).toBe('device_revoked')
  })
})

describe('approvals', () => {
  it('only the device owner can decide', async () => {
    const { maya, jared, sam, wf, ids } = setup()
    await start(maya, wf)
    const c = await jared.claimStep(ids.jaredMac)
    const r = await jared.requestApproval(ids.jaredMac, c!.run_step.id, 'p')
    if (r.stop) throw new Error()
    expect(await code(maya.decideApproval(r.approval_id, 'approved'))).toBe('forbidden')
    expect(await code(sam.decideApproval(r.approval_id, 'approved'))).toBe('forbidden')
    expect((await maya.getApproval(r.approval_id))?.approval.decision).toBeNull()
    expect(await code(jared.decideApproval(r.approval_id, 'approved'))).toBe('ok')
    expect(await code(jared.decideApproval(r.approval_id, 'denied'))).toBe('already_decided')
  })
  it('getApproval returns the detail for the page', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    const c = await jared.claimStep(ids.jaredMac)
    const r = await jared.requestApproval(ids.jaredMac, c!.run_step.id, 'the plan')
    if (r.stop) throw new Error()
    const d = await maya.getApproval(r.approval_id)
    expect(d).toMatchObject({ approval: { plan: 'the plan' }, workflow: { name: 'Demo day submit' }, device_owner: { id: ids.jared }, started_by: { id: ids.maya }, run: { id: run.id } })
    expect(await maya.asUser('x').getApproval(r.approval_id)).toBeNull()
  })
  it('expires after 5 minutes', async () => {
    const { maya, jared, clock, wf, ids } = setup()
    await start(maya, wf)
    const c = await jared.claimStep(ids.jaredMac)
    const r = await jared.requestApproval(ids.jaredMac, c!.run_step.id, 'p')
    if (r.stop) throw new Error()
    clock.advance(5 * 60_000)
    expect(await code(jared.decideApproval(r.approval_id, 'approved'))).toBe('expired')
  })
  it('device polling gets the decision and stop flag', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    const c = await jared.claimStep(ids.jaredMac)
    const r = await jared.requestApproval(ids.jaredMac, c!.run_step.id, 'p')
    if (r.stop) throw new Error()
    expect(await jared.getApprovalDecision(ids.jaredMac, r.approval_id)).toEqual({ decision: null, note: 'go', stop: false })
    await maya.stopRun(run.id)
    expect((await jared.getApprovalDecision(ids.jaredMac, r.approval_id)).stop).toBe(true)
  })
})

describe('stall, retry, skip, stop', () => {
  async function stalled() {
    const s = setup()
    const run = await start(s.maya, s.wf)
    const { claimed } = await toRunning(s.jared, s.jared, s.ids.jaredMac)
    s.clock.advance(5 * 60_000 - 1)
    expect(await s.maya.markStalled()).toBe(0)
    s.clock.advance(1)
    expect(await s.maya.markStalled()).toBe(1)
    expect((await statuses(s.maya, run.id))[0]).toBe('stalled')
    return { ...s, run, stepId: claimed.run_step.id }
  }
  it('stalls a running step after 5 minutes without a tool call', stalled)
  it('post_status resets the stall timer', async () => {
    const s = setup()
    await start(s.maya, s.wf)
    const { claimed } = await toRunning(s.jared, s.jared, s.ids.jaredMac)
    s.clock.advance(4 * 60_000)
    await s.jared.postStatus(s.ids.jaredMac, claimed.run_step.id, 'still here')
    s.clock.advance(4 * 60_000)
    expect(await s.maya.markStalled()).toBe(0)
  })
  it('stalls a claimed step but never an awaiting_approval step', async () => {
    const s = setup()
    const run = await start(s.maya, s.wf)
    await s.jared.claimStep(s.ids.jaredMac)
    s.clock.advance(6 * 60_000)
    expect(await s.maya.markStalled()).toBe(1)
    await s.maya.retryStep((await s.maya.listRunSteps(run.id))[0]!.id)
    const c = await s.jared.claimStep(s.ids.jaredMac)
    await s.jared.requestApproval(s.ids.jaredMac, c!.run_step.id, 'p')
    s.clock.advance(60 * 60_000)
    expect(await s.maya.markStalled()).toBe(0)
    expect((await statuses(s.maya, run.id))[0]).toBe('awaiting_approval')
  })
  it('retry: stalled -> ready, can be claimed again', async () => {
    const { maya, jared, run, ids } = await stalled()
    const s = (await maya.listRunSteps(run.id))[0]!
    const r = await maya.retryStep(s.id)
    expect(r.status).toBe('ready')
    expect(r.last_status_at).toBeNull()
    expect((await jared.claimStep(ids.jaredMac))?.run_step.id).toBe(s.id)
  })
  it('skip: stalled -> skipped, next step ready', async () => {
    const { maya, run, stepId } = await stalled()
    const r = await maya.skipStep(stepId)
    expect(r.status).toBe('skipped')
    expect(await statuses(maya, run.id)).toEqual(['skipped', 'ready', 'pending'])
  })
  it('skipping the last step succeeds the run', async () => {
    const s = setup()
    const run = await start(s.maya, s.wf)
    for (let i = 0; i < 2; i++) {
      const { claimed } = await toRunning(s.jared, s.jared, s.ids.jaredMac)
      await s.jared.finishStep(s.ids.jaredMac, claimed.run_step.id, 'done', 'x', null, false)
    }
    await toRunning(s.maya, s.maya, s.ids.mayaWindows)
    s.clock.advance(5 * 60_000)
    await s.maya.markStalled()
    await s.maya.skipStep((await s.maya.listRunSteps(run.id))[2]!.id)
    expect((await s.maya.getRun(run.id))?.status).toBe('succeeded')
  })
  it('retry and skip only from stalled', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    const id = (await maya.listRunSteps(run.id))[0]!.id
    expect(await code(maya.retryStep(id))).toBe('not_stalled')
    expect(await code(maya.skipStep(id))).toBe('not_stalled')
    await toRunning(jared, jared, ids.jaredMac)
    expect(await code(maya.retryStep(id))).toBe('not_stalled')
  })
  it('stop: active steps stopped, waiting steps not_run, run stopped', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    await toRunning(jared, jared, ids.jaredMac)
    const r = await maya.stopRun(run.id)
    expect(r.status).toBe('stopped')
    expect(r.ended_at).not.toBeNull()
    expect(await statuses(maya, run.id)).toEqual(['stopped', 'not_run', 'not_run'])
    expect(await code(maya.stopRun(run.id))).toBe('run_ended')
  })
  it('stop also stops a stalled step', async () => {
    const { maya, run } = await stalled()
    await maya.stopRun(run.id)
    expect((await statuses(maya, run.id))[0]).toBe('stopped')
  })
  it('only editors can stop, retry and skip', async () => {
    const { maya, sam, wf, ids } = setup()
    const run = await start(maya, wf)
    await maya.setMemberRole(ids.room, ids.sam, 'viewer')
    expect(await code(sam.stopRun(run.id))).toBe('forbidden')
  })
})

describe('late device calls', () => {
  it('after stall + retry the old reply returns stop and changes nothing', async () => {
    const { maya, jared, clock, wf, ids } = setup()
    const run = await start(maya, wf)
    const { claimed } = await toRunning(jared, jared, ids.jaredMac)
    const id = claimed.run_step.id
    clock.advance(5 * 60_000)
    await maya.markStalled()
    expect(await jared.postStatus(ids.jaredMac, id, 'late')).toEqual({ stop: true, notes: [] })
    expect(await jared.finishStep(ids.jaredMac, id, 'done', 'late', null, false)).toEqual({ ok: false, stop: true, run_status: null })
    await maya.retryStep(id)
    expect(await jared.finishStep(ids.jaredMac, id, 'done', 'late', null, false)).toMatchObject({ stop: true })
    expect(await jared.requestApproval(ids.jaredMac, id, 'late')).toEqual({ stop: true })
    const s = (await maya.listRunSteps(run.id))[0]!
    expect(s.status).toBe('ready')
    expect(s.summary).toBeNull()
    expect((await maya.listRunEvents(run.id)).some((e) => e.message === 'late')).toBe(false)
  })
  it('after stop, calls return stop', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    const { claimed } = await toRunning(jared, jared, ids.jaredMac)
    await maya.stopRun(run.id)
    expect((await jared.postStatus(ids.jaredMac, claimed.run_step.id, 'x')).stop).toBe(true)
    expect((await jared.finishStep(ids.jaredMac, claimed.run_step.id, 'done', 'x', null, false)).stop).toBe(true)
    expect((await statuses(maya, run.id))[0]).toBe('stopped')
  })
  it('another device cannot report on a step', async () => {
    const { maya, jared, wf, ids } = setup()
    await start(maya, wf)
    const { claimed } = await toRunning(jared, jared, ids.jaredMac)
    expect((await maya.postStatus(ids.mayaWindows, claimed.run_step.id, 'x')).stop).toBe(true)
  })
})

describe('notes and status feed', () => {
  it('notes are delivered once on the next status call', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    const { claimed } = await toRunning(jared, jared, ids.jaredMac)
    const note = await maya.sendNote(run.id, 'use the final branch')
    expect(note).toMatchObject({ kind: 'note', run_step_id: claimed.run_step.id, delivered_at: null, author_id: ids.maya })
    expect(await jared.postStatus(ids.jaredMac, claimed.run_step.id, 'a')).toEqual({ stop: false, notes: ['use the final branch'] })
    expect((await jared.postStatus(ids.jaredMac, claimed.run_step.id, 'b')).notes).toEqual([])
    const ev = await maya.listRunEvents(run.id)
    expect(ev.find((e) => e.kind === 'note')?.delivered_at).not.toBeNull()
    expect(ev.filter((e) => e.kind === 'status').map((e) => e.message)).toEqual(['a', 'b'])
  })
  it('caps status messages at 200 with one system event', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    const { claimed } = await toRunning(jared, jared, ids.jaredMac)
    for (let i = 0; i < 205; i++) await jared.postStatus(ids.jaredMac, claimed.run_step.id, `m${i}`)
    const ev = await maya.listRunEvents(run.id)
    expect(ev.filter((e) => e.kind === 'status')).toHaveLength(200)
    expect(ev.filter((e) => e.message.startsWith('Too many'))).toHaveLength(1)
  })
  it('no notes after the run ends', async () => {
    const { maya, wf } = setup()
    const run = await start(maya, wf)
    await maya.stopRun(run.id)
    expect(await code(maya.sendNote(run.id, 'x'))).toBe('run_ended')
  })
})

describe('realtime', () => {
  it('broadcasts every change to the room', async () => {
    const { maya, jared, wf, ids } = setup()
    const got: BroadcastEvent[] = []
    const unsub = maya.subscribe(ids.room, (e) => got.push(e))
    const other: BroadcastEvent[] = []
    maya.subscribe('other-room', (e) => other.push(e))
    const run = await start(maya, wf)
    expect(got.map((e) => `${e.event} ${e.table}`)).toEqual(['INSERT runs', 'INSERT run_steps', 'INSERT run_steps', 'INSERT run_steps', 'INSERT run_events'])
    got.length = 0
    const { claimed } = await toRunning(jared, jared, ids.jaredMac)
    const tables = new Set(got.map((e) => e.table))
    expect(tables).toEqual(new Set(['run_steps', 'run_events', 'approvals']))
    const upd = got.find((e) => e.table === 'run_steps' && e.event === 'UPDATE')
    expect(upd?.old_record).toMatchObject({ status: 'ready' })
    expect(upd?.record).toMatchObject({ id: claimed.run_step.id })
    got.length = 0
    await maya.stopRun(run.id)
    expect(got.some((e) => e.table === 'runs' && (e.record as { status: string }).status === 'stopped')).toBe(true)
    unsub()
    got.length = 0
    await jared.heartbeat(ids.jaredMac)
    expect(got).toEqual([])
    expect(other).toEqual([])
  })
  it('broadcasts device changes to rooms the device is in', async () => {
    const { maya, jared, ids } = setup()
    const got: BroadcastEvent[] = []
    maya.subscribe(ids.room, (e) => got.push(e))
    await jared.heartbeat(ids.jaredMac)
    await jared.revokeDevice(ids.jaredMac)
    expect(got.map((e) => e.table)).toEqual(['devices', 'devices'])
  })
})

describe('rooms', () => {
  it('create, join by invite, reset invite', async () => {
    const { maya, sam } = setup()
    maya.store.profiles.push({ id: 'new-user', github_login: 'nu', display_name: 'New', avatar_url: null, created_at: '' })
    const out = maya.asUser('new-user')
    const room = await out.createRoom({ name: 'My Room!' })
    expect(room).toMatchObject({ slug: 'my-room', owner_id: 'new-user', visibility: 'private' })
    expect((await out.createRoom({ name: 'My Room!' })).slug).toBe('my-room-2')
    const joiner = maya.asUser(sam.currentUserId())
    expect(await joiner.getRoom(room.id)).toBeNull()
    await joiner.joinRoomByInvite(room.invite_code)
    expect((await out.listMembers(room.id)).find((m) => m.user_id === sam.currentUserId())?.role).toBe('editor')
    const reset = await out.resetInviteCode(room.id)
    expect(reset.invite_code).not.toBe(room.invite_code)
    expect(await code(maya.asUser('third').joinRoomByInvite(room.invite_code))).toBe('invalid_invite')
    expect(await code(sam.resetInviteCode(room.id))).toBe('forbidden')
  })
  it('same seed gives same ids', async () => {
    const { createMockApi, createFakeClock } = await import('../src')
    const a = await createMockApi({ seed: 7, clock: createFakeClock() }).createRoom({ name: 'x' })
    const b = await createMockApi({ seed: 7, clock: createFakeClock() }).createRoom({ name: 'x' })
    expect(a.id).toBe(b.id)
  })
  it('versions count runs by outcome', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    await toRunning(jared, jared, ids.jaredMac)
    await maya.stopRun(run.id)
    const [v] = await maya.listVersions(wf)
    expect(v).toMatchObject({ commit_sha: '3f9c1e2', runs: 1, succeeded: 0, failed: 0 })
  })
})

describe('fake device, full run', () => {
  const sleep = async () => {}
  it('runs 3 steps across 2 devices through claim, approval, status, result', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    const events: string[] = []
    maya.subscribe(ids.room, (e) => events.push(`${e.table}:${e.event}`))
    const jaredDev = playFakeDevice(jared, ids.jaredMac, {
      sleep,
      plan: (c) => `plan for ${c.run_step.step_id}`,
      statuses: ['one', 'two'],
      summary: 'ok',
      outputs: { link: 'x' },
      onApproval: async (id) => {
        await jared.decideApproval(id, 'approved')
      },
    })
    const first = await jaredDev.runAll()
    expect(first.map((r) => r.end)).toEqual(['done', 'done'])
    expect(await statuses(maya, run.id)).toEqual(['done', 'done', 'ready'])
    const mayaDev = playFakeDevice(maya, ids.mayaWindows, { sleep, onApproval: async (id) => void (await maya.decideApproval(id, 'approved')) })
    expect((await mayaDev.runAll()).map((r) => r.end)).toEqual(['done'])
    const r = await maya.getRun(run.id)
    expect(r?.status).toBe('succeeded')
    const steps = await maya.listRunSteps(run.id)
    expect(steps.map((s) => s.summary)).toEqual(['ok', 'ok', 'Finished step 3.'])
    expect(steps[0]?.outputs).toEqual({ link: 'x' })
    const approvals = await maya.listApprovals(run.id)
    expect(approvals.map((a) => a.plan)[0]).toBe('plan for s-1')
    expect(approvals).toHaveLength(3)
    const feed = (await maya.listRunEvents(run.id)).filter((e) => e.kind === 'status').map((e) => e.message)
    expect(feed).toEqual(['one', 'two', 'one', 'two', 'Working on step 3'])
    expect(events.length).toBeGreaterThan(10)
  })
  it('delivers a note to the fake device', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    const dev = playFakeDevice(jared, ids.jaredMac, {
      sleep,
      statuses: ['a', 'b'],
      onApproval: async (id) => {
        await jared.decideApproval(id, 'approved')
        await maya.sendNote(run.id, 'hello claude')
      },
    })
    const r = await dev.runNext()
    expect(r?.notes).toEqual(['hello claude'])
    expect(dev.notes).toEqual(['hello claude'])
  })
  it('stops when the run is stopped mid step', async () => {
    const { maya, jared, wf, ids } = setup()
    const run = await start(maya, wf)
    const dev = playFakeDevice(jared, ids.jaredMac, {
      sleep,
      statuses: ['a', 'b', 'c'],
      onApproval: async (id) => void (await jared.decideApproval(id, 'approved')),
      onStatus: async (m) => {
        if (m === 'a') await maya.stopRun(run.id)
      },
    })
    expect((await dev.runNext())?.end).toBe('stopped')
    expect(await statuses(maya, run.id)).toEqual(['stopped', 'not_run', 'not_run'])
  })
  it('reports denial and failure', async () => {
    const s = setup()
    const run = await start(s.maya, s.wf)
    const denied = playFakeDevice(s.jared, s.ids.jaredMac, { sleep, onApproval: async (id) => void (await s.jared.decideApproval(id, 'denied')) })
    expect((await denied.runNext())?.end).toBe('denied')
    const s2 = setup()
    await start(s2.maya, s2.wf)
    const failing = playFakeDevice(s2.jared, s2.ids.jaredMac, { sleep, outcome: 'failed', onApproval: async (id) => void (await s2.jared.decideApproval(id, 'approved')) })
    expect((await failing.runNext())?.end).toBe('failed')
    expect((await s2.maya.getRun((await s2.maya.listRuns(s2.ids.room))[0]!.id))?.status).toBe('failed')
    void run
  })
  it('keeps polling while the owner has not decided, and times out', async () => {
    const { maya, jared, wf, ids } = setup()
    await start(maya, wf)
    let sleeps = 0
    const dev = playFakeDevice(jared, ids.jaredMac, { sleep: async () => void sleeps++, maxPolls: 3 })
    expect((await dev.runNext())?.end).toBe('approval_timeout')
    expect(sleeps).toBe(3)
  })
  it('returns null when there is nothing to claim', async () => {
    const { jared, ids } = setup()
    expect(await playFakeDevice(jared, ids.jaredMac, { sleep }).runNext()).toBeNull()
  })
})
