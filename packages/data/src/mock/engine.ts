import {
  ApiError,
  type ApprovalDetail,
  type BroadcastEvent,
  type BroadcastTable,
  type ClaimedStep,
  type DataApi,
  type DeviceApi,
  type MemberView,
  type RoomDeviceView,
  type Unsubscribe,
  type VersionSummary,
} from '../api'
import { deviceCanDo, isOnline } from '../status'
import {
  ACTIVE_STEP_STATUSES,
  APPROVAL_EXPIRY_MS,
  STALL_MS,
  type Approval,
  type Device,
  type PublicDevice,
  type Room,
  type Run,
  type RunEvent,
  type RunStatus,
  type RunStep,
  type StepStatus,
  type Workflow,
  type WorkflowDoc,
} from '../types'
import { buildSeed, SEED_IDS } from './seed'
import type { Store } from './store'

export interface MockOptions {
  seed?: number | Partial<Store>
  clock?: () => number
  userId?: string
}

export interface MockApi extends DataApi, DeviceApi {
  asUser(userId: string): MockApi
  store: Store
  now(): number
}

const MAX_STATUS_PER_STEP = 200
const MAX_MEMBERS = 12
const MAX_ROOMS_PER_USER = 20
const MAX_WORKFLOWS = 50
const MAX_STEPS = 30

const clone = <T>(v: T): T => structuredClone(v)
const fail = (code: string, message: string): never => {
  throw new ApiError(code, message)
}

export function createMockApi(opts: MockOptions = {}): MockApi {
  const clock = opts.clock ?? Date.now
  const rngSeed = typeof opts.seed === 'number' ? opts.seed : 1
  const store: Store = { ...buildSeed(clock()), ...(typeof opts.seed === 'object' ? opts.seed : {}) }
  let rs = rngSeed >>> 0
  const rand = () => {
    rs = (rs + 0x6d2b79f5) >>> 0
    let t = rs
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('')
  const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-8${hex(3)}-${hex(12)}`
  const code = (n: number) => Array.from({ length: n }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(rand() * 31)]).join('')
  let eventSeq = store.run_events.reduce((m, e) => Math.max(m, e.id), 0)
  const now = () => clock()
  const iso = () => new Date(now()).toISOString()

  const subs = new Map<string, Set<(e: BroadcastEvent) => void>>()

  function roomsFor(table: BroadcastTable, rec: Record<string, unknown>): string[] {
    const stepRoom = (runStepId: string) => {
      const s = store.run_steps.find((x) => x.id === runStepId)
      return s ? store.runs.find((r) => r.id === s.run_id)?.room_id : undefined
    }
    let r: string | undefined
    if (table === 'runs') r = rec.room_id as string
    else if (table === 'run_steps' || table === 'run_events') r = store.runs.find((x) => x.id === rec.run_id)?.room_id
    else if (table === 'approvals') r = stepRoom(rec.run_step_id as string)
    else return store.room_devices.filter((d) => d.device_id === rec.id).map((d) => d.room_id)
    return r ? [r] : []
  }

  function emit(table: BroadcastTable, event: BroadcastEvent['event'], record: object | null, old: object | null) {
    const ref = (record ?? old) as Record<string, unknown>
    for (const room of roomsFor(table, ref)) {
      for (const h of subs.get(room) ?? []) {
        try {
          h({ event, table, record: record ? clone(record) : null, old_record: old ? clone(old) : null } as BroadcastEvent)
        } catch {
          /* subscriber errors must not break the engine */
        }
      }
    }
  }

  function insert<T extends object>(table: BroadcastTable, rows: T[], row: T): T {
    rows.push(row)
    emit(table, 'INSERT', row, null)
    return row
  }

  function update<T extends object>(table: BroadcastTable, row: T, patch: Partial<T>): T {
    const old = clone(row)
    Object.assign(row, patch)
    emit(table, 'UPDATE', row, old)
    return row
  }

  function addEvent(run_id: string, run_step_id: string | null, kind: RunEvent['kind'], message: string, author_id: string | null = null): RunEvent {
    return insert('run_events', store.run_events, {
      id: ++eventSeq,
      run_id,
      run_step_id,
      kind,
      author_id,
      message,
      delivered_at: null,
      created_at: iso(),
    })
  }

  const profile = (id: string) => store.profiles.find((p) => p.id === id) ?? fail('not_found', 'Profile not found')
  const publicDevice = (d: Device): PublicDevice => {
    const rest: Partial<Device> = { ...d }
    delete rest.token_hash
    return clone(rest) as PublicDevice
  }
  const device = (id: string) => store.devices.find((d) => d.id === id) ?? fail('not_found', 'Device not found')
  const roomById = (id: string) => store.rooms.find((r) => r.id === id) ?? fail('not_found', 'Room not found')
  const memberOf = (roomId: string, userId: string) => store.room_members.find((m) => m.room_id === roomId && m.user_id === userId)
  const workflowById = (id: string) => store.workflows.find((w) => w.id === id) ?? fail('not_found', 'Workflow not found')
  const runById = (id: string) => store.runs.find((r) => r.id === id) ?? fail('not_found', 'Run not found')
  const stepById = (id: string) => store.run_steps.find((s) => s.id === id) ?? fail('not_found', 'Step not found')
  const stepsOf = (runId: string) => store.run_steps.filter((s) => s.run_id === runId).sort((a, b) => a.order - b.order)

  function canRead(roomId: string, userId: string) {
    return !!memberOf(roomId, userId) || roomById(roomId).visibility === 'public'
  }
  function needRead(roomId: string, userId: string) {
    if (!canRead(roomId, userId)) fail('forbidden', 'You are not in this room')
  }
  function needEditor(roomId: string, userId: string) {
    const m = memberOf(roomId, userId)
    if (!m || m.role === 'viewer') fail('forbidden', 'Only editors can do this')
  }
  function needOwner(roomId: string, userId: string) {
    if (memberOf(roomId, userId)?.role !== 'owner') fail('forbidden', 'Only the room owner can do this')
  }
  const runRoom = (runId: string) => runById(runId).room_id

  function endRun(run: Run, status: Exclude<RunStatus, 'running'>) {
    update('runs', run, { status, ended_at: iso() })
    for (const s of stepsOf(run.id)) {
      if (s.status === 'pending' || s.status === 'ready') update('run_steps', s, { status: 'not_run' })
    }
    addEvent(run.id, null, 'system', `Run ${status}`)
  }

  function advance(run: Run) {
    const next = stepsOf(run.id).find((s) => s.status === 'pending')
    if (!next) return endRun(run, 'succeeded')
    update('run_steps', next, { status: 'ready' })
    addEvent(run.id, next.id, 'system', `Step ${next.order} is ready`)
  }

  function touch(deviceId: string): Device {
    const d = device(deviceId)
    if (d.revoked_at) fail('device_revoked', 'This device was revoked')
    d.last_seen_at = iso()
    return d
  }

  function activeStep(deviceId: string, runStepId: string): RunStep | null {
    const s = store.run_steps.find((x) => x.id === runStepId)
    if (!s || s.device_id !== deviceId || !ACTIVE_STEP_STATUSES.includes(s.status)) return null
    return store.runs.find((r) => r.id === s.run_id)?.status === 'running' ? s : null
  }

  function startRunFor(userId: string, a: { workflow_id: string; commit_sha: string; doc: WorkflowDoc; note?: string | null }): Run {
    const wf = workflowById(a.workflow_id)
    needEditor(wf.room_id, userId)
    const steps = [...a.doc.steps].sort((x, y) => x.order - y.order)
    if (steps.length === 0) fail('empty_workflow', 'Add the first step before running')
    if (steps.length > MAX_STEPS) fail('too_many_steps', `A workflow can have up to ${MAX_STEPS} steps`)
    if (store.runs.some((r) => r.workflow_id === wf.id && r.status === 'running')) fail('run_active', 'This workflow already has a run in progress')
    const devs: string[] = []
    for (const st of steps) {
      const b = store.role_bindings.find((x) => x.workflow_id === wf.id && x.role === st.role)
      if (!b) return fail('role_unbound', `Step ${st.order} needs a device for the role ${st.role}`)
      const d = device(b.device_id)
      if (d.revoked_at) fail('device_revoked', `Step ${st.order} is bound to a revoked device`)
      if (!deviceCanDo(st.needs, d)) fail('device_cannot', `Step ${st.order} needs ${st.needs}, which ${d.name} cannot do`)
      devs.push(d.id)
    }
    const run = insert('runs', store.runs, {
      id: uuid(),
      short_id: code(6),
      room_id: wf.room_id,
      workflow_id: wf.id,
      commit_sha: a.commit_sha,
      started_by: userId,
      note: a.note ?? null,
      status: 'running',
      started_at: iso(),
      ended_at: null,
      record_commit_sha: null,
      created_at: iso(),
    } satisfies Run)
    steps.forEach((st, i) => {
      insert('run_steps', store.run_steps, {
        id: uuid(),
        run_id: run.id,
        step_id: st.id,
        order: st.order,
        snapshot: clone(st),
        role: st.role,
        device_id: devs[i]!,
        status: i === 0 ? 'ready' : 'pending',
        claimed_at: null,
        last_status_at: null,
        approved_by: null,
        summary: null,
        outputs: null,
        error: null,
        started_at: null,
        ended_at: null,
        created_at: iso(),
      } satisfies RunStep)
    })
    addEvent(run.id, null, 'system', 'Run started')
    return clone(run)
  }

  function saveFor(userId: string, wf: Workflow, message?: string) {
    const sha = hex(7)
    store.versions.push({ commit_sha: sha, workflow_id: wf.id, message: message ?? 'Save version', author_id: userId, created_at: iso() })
    Object.assign(wf, { head_commit_sha: sha, head_doc_hash: hex(8), dirty: false, updated_at: iso() })
    return { commit_sha: sha }
  }

  function user(userId: string): MockApi {
    const api: MockApi = {
      store,
      now,
      asUser: user,
      currentUserId: () => userId,
      async getProfile(id) {
        const p = store.profiles.find((x) => x.id === id)
        return p ? clone(p) : null
      },

      async listRooms() {
        const ids = new Set(store.room_members.filter((m) => m.user_id === userId).map((m) => m.room_id))
        return clone(store.rooms.filter((r) => ids.has(r.id)))
      },
      async getRoom(idOrSlug) {
        const r = store.rooms.find((x) => x.id === idOrSlug || x.slug === idOrSlug)
        return r && canRead(r.id, userId) ? clone(r) : null
      },
      async createRoom({ name, slug, visibility }) {
        if (store.rooms.filter((r) => r.owner_id === userId).length >= MAX_ROOMS_PER_USER) fail('limit', `You can own up to ${MAX_ROOMS_PER_USER} rooms`)
        const base = (slug ?? name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'room'
        let s = base
        for (let i = 2; store.rooms.some((r) => r.slug === s); i++) s = `${base}-${i}`
        const room: Room = {
          id: uuid(),
          slug: s,
          name,
          visibility: visibility ?? 'private',
          owner_id: userId,
          invite_code: code(10),
          repo_full_name: null,
          repo_branch: null,
          github_installation_id: null,
          created_at: iso(),
        }
        store.rooms.push(room)
        store.room_members.push({ room_id: room.id, user_id: userId, role: 'owner', created_at: iso() })
        return clone(room)
      },
      async updateRoom(roomId, patch) {
        needOwner(roomId, userId)
        return clone(Object.assign(roomById(roomId), patch))
      },
      async resetInviteCode(roomId) {
        needOwner(roomId, userId)
        return clone(Object.assign(roomById(roomId), { invite_code: code(10) }))
      },
      async joinRoomByInvite(c) {
        const room = store.rooms.find((r) => r.invite_code === c) ?? fail('invalid_invite', 'This invite link does not work any more')
        if (!memberOf(room.id, userId)) {
          if (store.room_members.filter((m) => m.room_id === room.id).length >= MAX_MEMBERS) fail('limit', `A room can have up to ${MAX_MEMBERS} members`)
          store.room_members.push({ room_id: room.id, user_id: userId, role: 'editor', created_at: iso() })
        }
        return clone(room)
      },
      async listMembers(roomId) {
        needRead(roomId, userId)
        return store.room_members
          .filter((m) => m.room_id === roomId)
          .map((m): MemberView => ({ room_id: m.room_id, user_id: m.user_id, role: m.role, profile: clone(profile(m.user_id)) }))
      },
      async setMemberRole(roomId, uid, role) {
        needOwner(roomId, userId)
        const m = memberOf(roomId, uid) ?? fail('not_found', 'Member not found')
        if (m.role === 'owner') fail('forbidden', 'The owner role cannot be changed')
        m.role = role
      },

      async listWorkflows(roomId) {
        needRead(roomId, userId)
        return clone(store.workflows.filter((w) => w.room_id === roomId))
      },
      async getWorkflow(id) {
        const w = store.workflows.find((x) => x.id === id)
        return w && canRead(w.room_id, userId) ? clone(w) : null
      },
      async getWorkflowBySlug(roomId, slug) {
        needRead(roomId, userId)
        const w = store.workflows.find((x) => x.room_id === roomId && x.slug === slug)
        return w ? clone(w) : null
      },
      async createWorkflow({ room_id, slug, name }) {
        needEditor(room_id, userId)
        if (store.workflows.some((w) => w.room_id === room_id && w.slug === slug)) fail('slug_taken', 'A workflow with this name already exists')
        if (store.workflows.filter((w) => w.room_id === room_id).length >= MAX_WORKFLOWS) fail('limit', `A room can have up to ${MAX_WORKFLOWS} workflows`)
        const w: Workflow = {
          id: uuid(),
          room_id,
          slug,
          ydoc: null,
          doc: { format: 'relay/1', name, purpose: '', description: '', tags: [], inputs: [], steps: [], never_automate: [] },
          head_commit_sha: null,
          head_doc_hash: null,
          dirty: true,
          updated_at: iso(),
          created_at: iso(),
        }
        store.workflows.push(w)
        return { id: w.id }
      },
      async updateWorkflowDoc(id, doc) {
        const w = workflowById(id)
        needEditor(w.room_id, userId)
        Object.assign(w, { doc: clone(doc), dirty: true, updated_at: iso() })
        return clone(w)
      },
      async saveWorkflow(id, message) {
        const w = workflowById(id)
        needEditor(w.room_id, userId)
        return saveFor(userId, w, message)
      },
      async listVersions(id) {
        const w = workflowById(id)
        needRead(w.room_id, userId)
        return store.versions
          .filter((v) => v.workflow_id === id)
          .map((v): VersionSummary => {
            const runs = store.runs.filter((r) => r.workflow_id === id && r.commit_sha === v.commit_sha)
            return {
              commit_sha: v.commit_sha,
              message: v.message,
              author: clone(profile(v.author_id)),
              created_at: v.created_at,
              runs: runs.length,
              succeeded: runs.filter((r) => r.status === 'succeeded').length,
              failed: runs.filter((r) => r.status === 'failed').length,
            }
          })
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
      },

      async listRoleBindings(id) {
        needRead(workflowById(id).room_id, userId)
        return clone(store.role_bindings.filter((b) => b.workflow_id === id))
      },
      async setRoleBinding(workflowId, role, deviceId) {
        const w = workflowById(workflowId)
        needEditor(w.room_id, userId)
        const d = device(deviceId)
        if (d.revoked_at) fail('device_revoked', 'This device was revoked')
        const rd = store.room_devices.find((x) => x.room_id === w.room_id && x.device_id === deviceId)
        if (!rd?.allowed) fail('device_not_allowed', 'This device is not switched on for this room')
        for (const st of w.doc.steps) {
          if (st.role === role && !deviceCanDo(st.needs, d)) fail('device_cannot', `Step ${st.order} needs ${st.needs}, which ${d.name} cannot do`)
        }
        let b = store.role_bindings.find((x) => x.workflow_id === workflowId && x.role === role)
        if (b) b.device_id = deviceId
        else store.role_bindings.push((b = { workflow_id: workflowId, role, device_id: deviceId, created_at: iso() }))
        return clone(b)
      },

      async listDevices() {
        return store.devices.filter((d) => d.user_id === userId).map(publicDevice)
      },
      async listRoomDevices(roomId) {
        needRead(roomId, userId)
        const members = new Set(store.room_members.filter((m) => m.room_id === roomId).map((m) => m.user_id))
        return store.room_devices
          .filter((rd) => rd.room_id === roomId)
          .flatMap((rd): RoomDeviceView[] => {
            const d = device(rd.device_id)
            if (!members.has(d.user_id)) return []
            return [{ room_id: roomId, allowed: rd.allowed, online: !d.revoked_at && isOnline(d.last_seen_at, now()), device: publicDevice(d), owner: clone(profile(d.user_id)) }]
          })
      },
      async renameDevice(id, name) {
        const d = device(id)
        if (d.user_id !== userId) fail('forbidden', 'Only the device owner can rename it')
        update('devices', d, { name })
        return publicDevice(d)
      },
      async revokeDevice(id) {
        const d = device(id)
        if (d.user_id !== userId) fail('forbidden', 'Only the device owner can revoke it')
        update('devices', d, { revoked_at: iso() })
      },
      async setRoomDeviceAllowed(roomId, deviceId, allowed) {
        const d = device(deviceId)
        if (d.user_id !== userId) fail('forbidden', 'Only the device owner can switch it on or off')
        needRead(roomId, userId)
        let rd = store.room_devices.find((x) => x.room_id === roomId && x.device_id === deviceId)
        if (rd) rd.allowed = allowed
        else store.room_devices.push((rd = { room_id: roomId, device_id: deviceId, allowed, created_at: iso() }))
        return clone(rd)
      },

      async startRun(a) {
        return startRunFor(userId, a)
      },
      async runWorkflow(id, note) {
        const w = workflowById(id)
        needEditor(w.room_id, userId)
        if (w.dirty || !w.head_commit_sha) saveFor(userId, w)
        return startRunFor(userId, { workflow_id: id, commit_sha: w.head_commit_sha!, doc: clone(w.doc), note })
      },
      async listRuns(roomId, workflowId) {
        needRead(roomId, userId)
        return clone(store.runs.filter((r) => r.room_id === roomId && (!workflowId || r.workflow_id === workflowId)).sort((a, b) => b.started_at.localeCompare(a.started_at)))
      },
      async getRun(id) {
        const r = store.runs.find((x) => x.id === id)
        return r && canRead(r.room_id, userId) ? clone(r) : null
      },
      async listRunSteps(id) {
        needRead(runRoom(id), userId)
        return clone(stepsOf(id))
      },
      async listRunEvents(id) {
        needRead(runRoom(id), userId)
        return clone(store.run_events.filter((e) => e.run_id === id))
      },
      async listApprovals(id) {
        needRead(runRoom(id), userId)
        const ids = new Set(stepsOf(id).map((s) => s.id))
        return clone(store.approvals.filter((a) => ids.has(a.run_step_id)))
      },
      async sendNote(id, message) {
        const run = runById(id)
        needEditor(run.room_id, userId)
        if (run.status !== 'running') fail('run_ended', 'This run has ended')
        const active = stepsOf(id).find((s) => ACTIVE_STEP_STATUSES.includes(s.status))
        return clone(addEvent(id, active?.id ?? null, 'note', message, userId))
      },
      async stopRun(id) {
        const run = runById(id)
        needEditor(run.room_id, userId)
        if (run.status !== 'running') fail('run_ended', 'This run has already ended')
        for (const s of stepsOf(id)) {
          if (s.status === 'claimed' || s.status === 'awaiting_approval' || s.status === 'running' || s.status === 'stalled') {
            update('run_steps', s, { status: 'stopped', ended_at: iso() })
          }
        }
        endRun(run, 'stopped')
        return clone(run)
      },
      async retryStep(id) {
        const s = stepById(id)
        needEditor(runRoom(s.run_id), userId)
        if (s.status !== 'stalled') fail('not_stalled', 'Only a stalled step can be retried')
        update('run_steps', s, { status: 'ready', claimed_at: null, last_status_at: null, approved_by: null, started_at: null })
        addEvent(s.run_id, s.id, 'system', `Step ${s.order} was sent back to ready`, userId)
        return clone(s)
      },
      async skipStep(id) {
        const s = stepById(id)
        needEditor(runRoom(s.run_id), userId)
        if (s.status !== 'stalled') fail('not_stalled', 'Only a stalled step can be skipped')
        update('run_steps', s, { status: 'skipped', ended_at: iso() })
        addEvent(s.run_id, s.id, 'system', `Step ${s.order} was skipped`, userId)
        advance(runById(s.run_id))
        return clone(s)
      },
      async getApproval(id) {
        const approval = store.approvals.find((a) => a.id === id)
        if (!approval) return null
        const run_step = stepById(approval.run_step_id)
        const run = runById(run_step.run_id)
        if (!canRead(run.room_id, userId)) return null
        const d = device(approval.device_id)
        const wf = workflowById(run.workflow_id)
        return clone({
          approval,
          run_step,
          run,
          workflow: { id: wf.id, slug: wf.slug, name: wf.doc.name },
          device: publicDevice(d),
          device_owner: profile(d.user_id),
          started_by: profile(run.started_by),
        } satisfies ApprovalDetail)
      },
      async decideApproval(id, decision) {
        const a = store.approvals.find((x) => x.id === id) ?? fail('not_found', 'Approval not found')
        const d = device(a.device_id)
        if (d.user_id !== userId) fail('forbidden', 'Only the device owner can decide')
        if (a.decision) fail('already_decided', 'This was already decided')
        if (now() - Date.parse(a.requested_at) >= APPROVAL_EXPIRY_MS) fail('expired', 'This approval expired')
        const s = stepById(a.run_step_id)
        if (s.status !== 'awaiting_approval') fail('not_pending', 'This step is no longer waiting for approval')
        update('approvals', a, { decision, decided_by: userId, decided_at: iso() })
        if (decision === 'denied') {
          update('run_steps', s, { status: 'failed', error: 'Denied by the device owner', ended_at: iso() })
          addEvent(s.run_id, s.id, 'system', `Step ${s.order} was denied`, userId)
          endRun(runById(s.run_id), 'failed')
        } else {
          update('run_steps', s, { status: 'running', approved_by: userId, last_status_at: iso() })
          addEvent(s.run_id, s.id, 'system', `Step ${s.order} was approved`, userId)
        }
        return clone(a)
      },

      subscribe(roomId, handler) {
        let set = subs.get(roomId)
        if (!set) subs.set(roomId, (set = new Set()))
        set.add(handler)
        const unsub: Unsubscribe = () => {
          set.delete(handler)
        }
        return unsub
      },

      async joinRoom(deviceId, roomRef, capabilities) {
        const d = touch(deviceId)
        const room = store.rooms.find((r) => r.id === roomRef || r.slug === roomRef) ?? fail('not_found', 'Room not found')
        if (!memberOf(room.id, d.user_id)) fail('forbidden', 'You are not in this room')
        update('devices', d, { capabilities: [...capabilities], joined_room_id: room.id })
        return { room: clone(room), allowed: !!store.room_devices.find((x) => x.room_id === room.id && x.device_id === deviceId)?.allowed }
      },
      async heartbeat(deviceId) {
        const d = touch(deviceId)
        emit('devices', 'UPDATE', d, d)
        return { ok: true }
      },
      async claimStep(deviceId) {
        const d = touch(deviceId)
        if (store.run_steps.some((s) => s.device_id === deviceId && ACTIVE_STEP_STATUSES.includes(s.status))) return null
        const candidates = store.run_steps
          .filter((s) => {
            if (s.device_id !== deviceId || s.status !== 'ready') return false
            const run = runById(s.run_id)
            if (run.status !== 'running') return false
            if (!store.room_devices.find((x) => x.room_id === run.room_id && x.device_id === deviceId)?.allowed) return false
            return deviceCanDo(s.snapshot.needs, d)
          })
          .sort((a, b) => runById(a.run_id).started_at.localeCompare(runById(b.run_id).started_at) || a.order - b.order)
        const s = candidates[0]
        if (!s) return null
        const t = iso()
        update('run_steps', s, { status: 'claimed', claimed_at: t, last_status_at: t, started_at: t })
        const run = runById(s.run_id)
        addEvent(run.id, s.id, 'system', `Step ${s.order} was picked up by ${d.name}`)
        return clone<ClaimedStep>({
          run_step: s,
          run: { id: run.id, short_id: run.short_id, room_id: run.room_id, workflow_id: run.workflow_id, note: run.note, started_by: run.started_by },
          never_automate: workflowById(run.workflow_id).doc.never_automate,
          previous: stepsOf(run.id)
            .filter((p) => p.order < s.order)
            .map((p) => ({ step_id: p.step_id, order: p.order, status: p.status, summary: p.summary, outputs: p.outputs })),
        })
      },
      async requestApproval(deviceId, runStepId, plan) {
        touch(deviceId)
        const s = activeStep(deviceId, runStepId)
        if (!s || s.status !== 'claimed') return { stop: true }
        const prior = store.approvals.find((a) => {
          const ps = store.run_steps.find((x) => x.id === a.run_step_id)
          return ps?.run_id === s.run_id && a.device_id === deviceId && a.decision === 'approved_run'
        })
        const t = iso()
        const a = insert('approvals', store.approvals, {
          id: uuid(),
          run_step_id: s.id,
          device_id: deviceId,
          plan,
          requested_at: t,
          decision: prior ? 'approved_run' : null,
          decided_by: prior ? prior.decided_by : null,
          decided_at: prior ? t : null,
          created_at: t,
        } satisfies Approval)
        if (prior) {
          update('run_steps', s, { status: 'running', approved_by: prior.decided_by, last_status_at: t })
          addEvent(s.run_id, s.id, 'system', `Step ${s.order} was approved with the rest of the run`)
        } else {
          update('run_steps', s, { status: 'awaiting_approval', last_status_at: t })
          addEvent(s.run_id, s.id, 'system', `Step ${s.order} is waiting for approval`)
        }
        return { stop: false, approval_id: a.id, decision: a.decision }
      },
      async getApprovalDecision(deviceId, approvalId) {
        touch(deviceId)
        const a = store.approvals.find((x) => x.id === approvalId && x.device_id === deviceId)
        if (!a) return { decision: null, note: null, stop: true }
        const s = stepById(a.run_step_id)
        const run = runById(s.run_id)
        const stop = run.status !== 'running' || (s.status !== 'awaiting_approval' && s.status !== 'running')
        return { decision: a.decision, note: run.note, stop }
      },
      async postStatus(deviceId, runStepId, message) {
        touch(deviceId)
        const s = activeStep(deviceId, runStepId)
        if (!s) return { stop: true, notes: [] }
        update('run_steps', s, { last_status_at: iso() })
        const count = store.run_events.filter((e) => e.run_step_id === s.id && e.kind === 'status').length
        if (count < MAX_STATUS_PER_STEP) addEvent(s.run_id, s.id, 'status', message)
        else if (!store.run_events.some((e) => e.run_step_id === s.id && e.kind === 'system' && e.message.startsWith('Too many'))) addEvent(s.run_id, s.id, 'system', 'Too many status messages. Newer ones are dropped.')
        const notes = store.run_events.filter((e) => e.run_id === s.run_id && e.kind === 'note' && !e.delivered_at)
        for (const n of notes) update('run_events', n, { delivered_at: iso() })
        return { stop: false, notes: notes.map((n) => n.message) }
      },
      async finishStep(deviceId, runStepId, outcome, summary, outputs, stopRun) {
        touch(deviceId)
        const s = activeStep(deviceId, runStepId)
        if (!s || s.status !== 'running') return { ok: false, stop: true, run_status: null }
        const run = runById(s.run_id)
        if (outcome === 'done') {
          update('run_steps', s, { status: 'done', summary, outputs, ended_at: iso() })
          if (stopRun) endRun(run, 'stopped')
          else advance(run)
        } else {
          update('run_steps', s, { status: 'failed', summary, outputs, error: summary, ended_at: iso() })
          endRun(run, 'failed')
        }
        return { ok: true, stop: false, run_status: run.status }
      },
      async markStalled() {
        const t = now()
        let n = 0
        for (const s of store.run_steps) {
          if ((s.status === 'claimed' || s.status === 'running') && s.last_status_at && t - Date.parse(s.last_status_at) >= STALL_MS) {
            update('run_steps', s, { status: 'stalled' satisfies StepStatus })
            addEvent(s.run_id, s.id, 'system', `Step ${s.order} stalled`)
            n++
          }
        }
        return n
      },
    }
    return api
  }

  return user(opts.userId ?? SEED_IDS.maya)
}
