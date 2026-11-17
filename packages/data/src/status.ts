import type { ApprovalDecision, Capability, Needs, Platform, Reversible, RunStatus, StepStatus } from './types'
import { APPROVAL_EXPIRY_MS, ONLINE_MS } from './types'

export interface StepStatusContext {
  ownerName: string
  deviceOnline: boolean
}

export function stepStatusText(step: { status: StepStatus }, ctx: StepStatusContext): string {
  switch (step.status) {
    case 'pending':
      return 'Waiting'
    case 'ready':
      return ctx.deviceOnline ? 'Waiting' : `Waiting for ${ctx.ownerName}'s Claude`
    case 'claimed':
    case 'running':
      return 'Running'
    case 'awaiting_approval':
      return `Asking ${ctx.ownerName}`
    case 'done':
      return 'Done'
    case 'failed':
      return 'Failed'
    case 'stalled':
      return 'Stalled'
    case 'skipped':
      return 'Skipped'
    case 'stopped':
      return 'Stopped'
    case 'not_run':
      return 'Not run'
  }
}

export function runStatusText(run: { status: RunStatus }): string {
  switch (run.status) {
    case 'running':
      return 'Running'
    case 'succeeded':
      return 'Succeeded'
    case 'failed':
      return 'Failed'
    case 'stopped':
      return 'Stopped'
  }
}

export function isOnline(lastSeenAt: string | null, now: number): boolean {
  return lastSeenAt !== null && now - Date.parse(lastSeenAt) < ONLINE_MS
}

export interface BindableDevice {
  id: string
  name: string
  platform: Platform
  capabilities: Capability[]
  online: boolean
  allowed?: boolean
  revoked_at?: string | null
}

export interface BindingOption<D extends BindableDevice = BindableDevice> {
  device: D
  disabled: boolean
  reason: string | null
  online: boolean
  label: string
}

const PLATFORM_LABEL: Record<Platform, string> = { macos: 'Mac', windows: 'Windows', linux: 'Linux' }

export const SCREEN_REASON = 'Screen steps need a Mac with computer use'

export function deviceCanDo(needs: Needs, device: { platform: Platform; capabilities: Capability[] }): boolean {
  if (needs === 'screen') return device.platform === 'macos' && device.capabilities.includes('screen')
  return true
}

export function deviceBindingOptions<D extends BindableDevice>(step: { needs: Needs }, devices: D[]): BindingOption<D>[] {
  return devices
    .filter((d) => d.allowed !== false && !d.revoked_at)
    .map((device) => {
      const ok = deviceCanDo(step.needs, device)
      return {
        device,
        disabled: !ok,
        reason: ok ? null : SCREEN_REASON,
        online: device.online,
        label: `${device.name} (${PLATFORM_LABEL[device.platform]}, ${device.online ? 'online' : 'offline'})`,
      }
    })
}

export function sharedRoleWarning(
  steps: { id: string; role: string; order?: number }[],
  role: string,
  exceptStepId?: string,
): string | null {
  const nums = steps
    .map((s, i) => ({ s, n: s.order ?? i + 1 }))
    .filter(({ s }) => s.role === role && s.id !== exceptStepId)
    .map(({ n }) => String(n))
  if (nums.length === 0) return null
  const list = nums.length === 1 ? nums[0] : `${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`
  return `Also changes step${nums.length === 1 ? '' : 's'} ${list}.`
}

export type ApprovalState = 'pending' | 'decided' | 'expired' | 'not_owner'

export interface ApprovalViewInput {
  decision: ApprovalDecision | null
  requested_at: string
  device_owner_id: string
  reversible: Reversible
}

export interface ApprovalView {
  state: ApprovalState
  showButtons: boolean
  passkeyRequired: Record<ApprovalDecision, boolean>
}

export function passkeyRequired(decision: ApprovalDecision, reversible: Reversible): boolean {
  if (decision === 'approved_run') return true
  if (decision === 'approved') return reversible !== 'yes'
  return false
}

export function approvalViewState(approval: ApprovalViewInput, now: number, userId: string): ApprovalView {
  let state: ApprovalState
  if (approval.decision !== null) state = 'decided'
  else if (now - Date.parse(approval.requested_at) >= APPROVAL_EXPIRY_MS) state = 'expired'
  else if (approval.device_owner_id !== userId) state = 'not_owner'
  else state = 'pending'
  const r = approval.reversible
  return {
    state,
    showButtons: state === 'pending',
    passkeyRequired: {
      approved: passkeyRequired('approved', r),
      approved_run: passkeyRequired('approved_run', r),
      denied: passkeyRequired('denied', r),
    },
  }
}
