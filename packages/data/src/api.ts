import type {
  Approval,
  ApprovalDecision,
  Capability,
  Json,
  MemberRole,
  Profile,
  PublicDevice,
  RoleBinding,
  Room,
  RoomDevice,
  Run,
  RunEvent,
  RunStatus,
  RunStep,
  Visibility,
  Workflow,
  WorkflowDoc,
} from './types'

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export type BroadcastTable = 'runs' | 'run_steps' | 'run_events' | 'approvals' | 'devices'

export interface BroadcastEvent<T = Record<string, unknown>> {
  event: 'INSERT' | 'UPDATE' | 'DELETE'
  table: BroadcastTable
  record: T | null
  old_record: T | null
}

export type Unsubscribe = () => void

export interface MemberView {
  room_id: string
  user_id: string
  role: MemberRole
  profile: Profile
}

export interface RoomDeviceView {
  room_id: string
  allowed: boolean
  online: boolean
  device: PublicDevice
  owner: Profile
}

export interface VersionSummary {
  commit_sha: string
  message: string
  author: Profile
  created_at: string
  runs: number
  succeeded: number
  failed: number
}

export interface ApprovalDetail {
  approval: Approval
  run_step: RunStep
  run: Run
  workflow: { id: string; slug: string; name: string }
  device: PublicDevice
  device_owner: Profile
  started_by: Profile
}

export interface RunDetail {
  run: Run
  steps: RunStep[]
}

export interface DataApi {
  currentUserId(): string
  getProfile(userId: string): Promise<Profile | null>

  listRooms(): Promise<Room[]>
  getRoom(idOrSlug: string): Promise<Room | null>
  createRoom(input: { name: string; slug?: string; visibility?: Visibility }): Promise<Room>
  updateRoom(roomId: string, patch: Partial<Pick<Room, 'name' | 'visibility' | 'repo_full_name' | 'repo_branch' | 'github_installation_id'>>): Promise<Room>
  resetInviteCode(roomId: string): Promise<Room>
  joinRoomByInvite(code: string): Promise<Room>
  listMembers(roomId: string): Promise<MemberView[]>
  setMemberRole(roomId: string, userId: string, role: MemberRole): Promise<void>

  listWorkflows(roomId: string): Promise<Workflow[]>
  getWorkflow(workflowId: string): Promise<Workflow | null>
  getWorkflowBySlug(roomId: string, slug: string): Promise<Workflow | null>
  createWorkflow(input: { room_id: string; slug: string; name: string }): Promise<{ id: string }>
  updateWorkflowDoc(workflowId: string, doc: WorkflowDoc): Promise<Workflow>
  saveWorkflow(workflowId: string, message?: string): Promise<{ commit_sha: string }>
  listVersions(workflowId: string): Promise<VersionSummary[]>

  listRoleBindings(workflowId: string): Promise<RoleBinding[]>
  setRoleBinding(workflowId: string, role: string, deviceId: string): Promise<RoleBinding>

  listDevices(): Promise<PublicDevice[]>
  listRoomDevices(roomId: string): Promise<RoomDeviceView[]>
  renameDevice(deviceId: string, name: string): Promise<PublicDevice>
  revokeDevice(deviceId: string): Promise<void>
  setRoomDeviceAllowed(roomId: string, deviceId: string, allowed: boolean): Promise<RoomDevice>

  startRun(args: { workflow_id: string; commit_sha: string; doc: WorkflowDoc; note?: string | null }): Promise<Run>
  runWorkflow(workflowId: string, note?: string | null): Promise<Run>
  listRuns(roomId: string, workflowId?: string): Promise<Run[]>
  getRun(runId: string): Promise<Run | null>
  listRunSteps(runId: string): Promise<RunStep[]>
  listRunEvents(runId: string): Promise<RunEvent[]>
  listApprovals(runId: string): Promise<Approval[]>
  sendNote(runId: string, message: string): Promise<RunEvent>
  stopRun(runId: string): Promise<Run>
  retryStep(runStepId: string): Promise<RunStep>
  skipStep(runStepId: string): Promise<RunStep>
  getApproval(approvalId: string): Promise<ApprovalDetail | null>
  decideApproval(approvalId: string, decision: ApprovalDecision): Promise<Approval>

  subscribe(roomId: string, handler: (event: BroadcastEvent) => void): Unsubscribe
}

export interface ClaimedStep {
  run_step: RunStep
  run: Pick<Run, 'id' | 'short_id' | 'room_id' | 'workflow_id' | 'note' | 'started_by'>
  never_automate: string[]
  previous: { step_id: string; order: number; status: RunStep['status']; summary: string | null; outputs: Json | null }[]
}

export type StepCallResult<T> = { stop: true } | ({ stop: false } & T)

export interface DeviceApi {
  joinRoom(deviceId: string, room: string, capabilities: Capability[]): Promise<{ room: Room; allowed: boolean }>
  heartbeat(deviceId: string): Promise<{ ok: true }>
  claimStep(deviceId: string): Promise<ClaimedStep | null>
  requestApproval(deviceId: string, runStepId: string, plan: string): Promise<StepCallResult<{ approval_id: string; decision: ApprovalDecision | null }>>
  getApprovalDecision(deviceId: string, approvalId: string): Promise<{ decision: ApprovalDecision | null; note: string | null; stop: boolean }>
  postStatus(deviceId: string, runStepId: string, message: string): Promise<{ stop: boolean; notes: string[] }>
  finishStep(
    deviceId: string,
    runStepId: string,
    outcome: 'done' | 'failed',
    summary: string,
    outputs: Json | null,
    stopRun: boolean,
  ): Promise<{ ok: boolean; stop: boolean; run_status: RunStatus | null }>
  markStalled(): Promise<number>
}
