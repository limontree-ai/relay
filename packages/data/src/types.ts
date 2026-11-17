export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

export type Platform = 'macos' | 'windows' | 'linux'
export type Capability = 'shell' | 'browser' | 'screen'
export type Needs = 'none' | 'shell' | 'browser' | 'screen'
export type Reversible = 'yes' | 'no' | 'unsure'
export type Visibility = 'private' | 'public'
export type MemberRole = 'owner' | 'editor' | 'viewer'

export type RunStatus = 'running' | 'succeeded' | 'failed' | 'stopped'
export type StepStatus =
  | 'pending'
  | 'ready'
  | 'claimed'
  | 'awaiting_approval'
  | 'running'
  | 'stalled'
  | 'done'
  | 'failed'
  | 'skipped'
  | 'stopped'
  | 'not_run'
export type ApprovalDecision = 'approved' | 'approved_run' | 'denied'
export type EventKind = 'status' | 'note' | 'system'

export const FINAL_STEP_STATUSES: readonly StepStatus[] = ['done', 'failed', 'skipped', 'stopped', 'not_run']
export const ACTIVE_STEP_STATUSES: readonly StepStatus[] = ['claimed', 'awaiting_approval', 'running']

export interface Profile {
  id: string
  github_login: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export interface Room {
  id: string
  slug: string
  name: string
  visibility: Visibility
  owner_id: string
  invite_code: string
  repo_full_name: string | null
  repo_branch: string | null
  github_installation_id: number | null
  created_at: string
}

export interface RoomMember {
  room_id: string
  user_id: string
  role: MemberRole
  created_at: string
}

export interface Device {
  id: string
  user_id: string
  name: string
  platform: Platform
  capabilities: Capability[]
  token_hash: string
  last_seen_at: string | null
  joined_room_id: string | null
  revoked_at: string | null
  created_at: string
}

export interface RoomDevice {
  room_id: string
  device_id: string
  allowed: boolean
  created_at: string
}

export interface WorkflowStep {
  id: string
  order: number
  action: string
  role: string
  needs: Needs
  expected_result: string
  reversible: Reversible
  tools?: string[]
  inputs_used?: string[]
  approval: 'each'
}

export interface WorkflowDoc {
  format: 'relay/1'
  name: string
  purpose: string
  description: string
  tags: string[]
  inputs: { id: string; what: string; source: string; sensitivity: 'public' | 'internal' | 'confidential' | 'restricted' }[]
  steps: WorkflowStep[]
  never_automate: string[]
}

export interface Workflow {
  id: string
  room_id: string
  slug: string
  ydoc: null
  doc: WorkflowDoc
  head_commit_sha: string | null
  head_doc_hash: string | null
  dirty: boolean
  updated_at: string
  created_at: string
}

export interface RoleBinding {
  workflow_id: string
  role: string
  device_id: string
  created_at: string
}

export interface Run {
  id: string
  short_id: string
  room_id: string
  workflow_id: string
  commit_sha: string
  started_by: string
  note: string | null
  status: RunStatus
  started_at: string
  ended_at: string | null
  record_commit_sha: string | null
  created_at: string
}

export interface RunStep {
  id: string
  run_id: string
  step_id: string
  order: number
  snapshot: WorkflowStep
  role: string
  device_id: string
  status: StepStatus
  claimed_at: string | null
  last_status_at: string | null
  approved_by: string | null
  summary: string | null
  outputs: Json | null
  error: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
}

export interface Approval {
  id: string
  run_step_id: string
  device_id: string
  plan: string
  requested_at: string
  decision: ApprovalDecision | null
  decided_by: string | null
  decided_at: string | null
  created_at: string
}

export interface RunEvent {
  id: number
  run_id: string
  run_step_id: string | null
  kind: EventKind
  author_id: string | null
  message: string
  delivered_at: string | null
  created_at: string
}

export interface Version {
  commit_sha: string
  workflow_id: string
  message: string
  author_id: string
  created_at: string
}

export interface TableMap {
  profiles: Profile
  rooms: Room
  room_members: RoomMember
  devices: Device
  room_devices: RoomDevice
  workflows: Workflow
  role_bindings: RoleBinding
  runs: Run
  run_steps: RunStep
  approvals: Approval
  run_events: RunEvent
}

export type PublicDevice = Omit<Device, 'token_hash'>

export const APPROVAL_EXPIRY_MS = 5 * 60 * 1000
export const STALL_MS = 5 * 60 * 1000
export const ONLINE_MS = 60 * 1000
