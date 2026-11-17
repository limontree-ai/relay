import { describe, expect, it } from 'vitest'
import {
  approvalViewState,
  deviceBindingOptions,
  passkeyRequired,
  runStatusText,
  sharedRoleWarning,
  stepStatusText,
  type BindableDevice,
  type StepStatus,
} from '../src'

const online = { ownerName: 'Maya', deviceOnline: true }
const offline = { ownerName: 'Maya', deviceOnline: false }

describe('stepStatusText', () => {
  const cases: [StepStatus, typeof online, string][] = [
    ['pending', online, 'Waiting'],
    ['ready', online, 'Waiting'],
    ['ready', offline, "Waiting for Maya's Claude"],
    ['claimed', online, 'Running'],
    ['awaiting_approval', online, 'Asking Maya'],
    ['running', online, 'Running'],
    ['done', online, 'Done'],
    ['failed', online, 'Failed'],
    ['stalled', online, 'Stalled'],
    ['skipped', online, 'Skipped'],
    ['stopped', online, 'Stopped'],
    ['not_run', online, 'Not run'],
  ]
  it.each(cases)('%s -> %s', (status, ctx, text) => {
    expect(stepStatusText({ status }, ctx)).toBe(text)
  })
  it('covers every status', () => {
    expect(new Set(cases.map((c) => c[0])).size).toBe(11)
  })
  it('only uses the offline text when ready', () => {
    expect(stepStatusText({ status: 'pending' }, offline)).toBe('Waiting')
    expect(stepStatusText({ status: 'running' }, offline)).toBe('Running')
  })
})

describe('runStatusText', () => {
  it('maps all run statuses', () => {
    expect(runStatusText({ status: 'running' })).toBe('Running')
    expect(runStatusText({ status: 'succeeded' })).toBe('Succeeded')
    expect(runStatusText({ status: 'failed' })).toBe('Failed')
    expect(runStatusText({ status: 'stopped' })).toBe('Stopped')
  })
})

const dev = (over: Partial<BindableDevice>): BindableDevice => ({ id: 'd', name: 'D', platform: 'macos', capabilities: ['shell', 'browser', 'screen'], online: true, ...over })

describe('deviceBindingOptions', () => {
  const mac = dev({ id: 'mac', name: 'Mac' })
  const win = dev({ id: 'win', name: 'Win', platform: 'windows', capabilities: ['shell', 'browser'] })
  const macNoScreen = dev({ id: 'm2', name: 'Mac2', capabilities: ['shell'], online: false })
  it('greys out non Macs and Macs without computer use for screen steps', () => {
    const o = deviceBindingOptions({ needs: 'screen' }, [mac, win, macNoScreen])
    expect(o.map((x) => [x.device.id, x.disabled, x.reason])).toEqual([
      ['mac', false, null],
      ['win', true, 'Screen steps need a Mac with computer use'],
      ['m2', true, 'Screen steps need a Mac with computer use'],
    ])
  })
  it.each(['none', 'shell', 'browser'] as const)('allows every device for %s', (needs) => {
    expect(deviceBindingOptions({ needs }, [mac, win, macNoScreen]).every((x) => !x.disabled)).toBe(true)
  })
  it('shows platform and online state, hides revoked and switched off devices', () => {
    const o = deviceBindingOptions({ needs: 'shell' }, [mac, win, macNoScreen, dev({ id: 'x', allowed: false }), dev({ id: 'y', revoked_at: 'now' })])
    expect(o.map((x) => x.device.id)).toEqual(['mac', 'win', 'm2'])
    expect(o.map((x) => x.label)).toEqual(['Mac (Mac, online)', 'Win (Windows, online)', 'Mac2 (Mac, offline)'])
    expect(o[2]?.online).toBe(false)
  })
})

describe('sharedRoleWarning', () => {
  const steps = [
    { id: 's-1', role: 'a', order: 1 },
    { id: 's-2', role: 'b', order: 2 },
    { id: 's-3', role: 'a', order: 3 },
    { id: 's-4', role: 'b', order: 4 },
    { id: 's-5', role: 'b', order: 5 },
  ]
  it('lists the other steps', () => {
    expect(sharedRoleWarning(steps, 'b', 's-4')).toBe('Also changes steps 2 and 5.')
    expect(sharedRoleWarning(steps, 'a', 's-1')).toBe('Also changes step 3.')
    expect(sharedRoleWarning(steps, 'b', 's-2')).toBe('Also changes steps 4 and 5.')
    expect(sharedRoleWarning([...steps, { id: 's-6', role: 'b', order: 6 }], 'b', 's-2')).toBe('Also changes steps 4, 5 and 6.')
  })
  it('returns null when nobody else shares the role', () => {
    expect(sharedRoleWarning([steps[0]!], 'a', 's-1')).toBeNull()
  })
  it('falls back to list position', () => {
    expect(sharedRoleWarning([{ id: 'x', role: 'r' }, { id: 'y', role: 'r' }, { id: 'z', role: 'r' }], 'r', 'y')).toBe('Also changes steps 1 and 3.')
  })
})

describe('approvalViewState', () => {
  const t0 = Date.parse('2026-11-17T12:00:00Z')
  const base = { decision: null, requested_at: new Date(t0).toISOString(), device_owner_id: 'owner', reversible: 'yes' as const }
  it('pending for the owner shows buttons', () => {
    const v = approvalViewState(base, t0 + 1000, 'owner')
    expect(v).toMatchObject({ state: 'pending', showButtons: true })
  })
  it('not_owner for others, no buttons', () => {
    expect(approvalViewState(base, t0, 'other')).toMatchObject({ state: 'not_owner', showButtons: false })
  })
  it('decided for everyone', () => {
    for (const u of ['owner', 'other']) expect(approvalViewState({ ...base, decision: 'approved' }, t0, u)).toMatchObject({ state: 'decided', showButtons: false })
  })
  it('expires at 5 minutes', () => {
    expect(approvalViewState(base, t0 + 5 * 60_000 - 1, 'owner').state).toBe('pending')
    expect(approvalViewState(base, t0 + 5 * 60_000, 'owner')).toMatchObject({ state: 'expired', showButtons: false })
    expect(approvalViewState(base, t0 + 5 * 60_000, 'other').state).toBe('expired')
  })
  it('a decision made before expiry stays decided', () => {
    expect(approvalViewState({ ...base, decision: 'denied' }, t0 + 60 * 60_000, 'owner').state).toBe('decided')
  })
  it('passkey for approve-the-rest and irreversible steps', () => {
    expect(approvalViewState(base, t0, 'owner').passkeyRequired).toEqual({ approved: false, approved_run: true, denied: false })
    expect(approvalViewState({ ...base, reversible: 'no' }, t0, 'owner').passkeyRequired).toEqual({ approved: true, approved_run: true, denied: false })
    expect(passkeyRequired('approved', 'unsure')).toBe(true)
    expect(passkeyRequired('denied', 'no')).toBe(false)
  })
})
