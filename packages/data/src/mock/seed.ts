import type { Store } from './store'
import type { WorkflowDoc } from '../types'

const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`

export const SEED_IDS = {
  maya: id(0x101),
  sam: id(0x102),
  jared: id(0x103),
  room: id(0x201),
  mayaWindows: id(0x301),
  jaredMac: id(0x302),
  samMini: id(0x303),
  workflow: id(0x401),
}

export const SEED_INVITE_CODE = 'demo-invite'
export const SEED_COMMIT = '3f9c1e2'
export const SEED_ROOM_SLUG = 'demo-day-crew'
export const SEED_WORKFLOW_SLUG = 'demo-day'

export const seedDoc = (): WorkflowDoc => ({
  format: 'relay/1',
  name: 'Demo day submit',
  purpose: 'Get the hackathon project tested, recorded and submitted.',
  description: 'Pull the latest code, run the tests, record a 2 minute demo and upload it to Devpost.',
  tags: ['hackathon'],
  inputs: [{ id: 'in-1', what: 'The project repo', source: 'github.com/team/app', sensitivity: 'internal' }],
  steps: [
    {
      id: 's-1',
      order: 1,
      action: 'In ~/code/app, pull main and run npm test. Report the number of passing and failing tests.',
      role: 'jared-mac',
      needs: 'shell',
      expected_result: 'Tests ran and all pass.',
      reversible: 'yes',
      tools: ['git', 'npm'],
      inputs_used: ['in-1'],
      approval: 'each',
    },
    {
      id: 's-2',
      order: 2,
      action: 'Open the app at localhost:3000 and record a 2 minute screen demo with QuickTime. Save it to the Demo folder in Google Drive.',
      role: 'jared-mac',
      needs: 'screen',
      expected_result: 'A demo video of about 2 minutes is in the Drive folder. Report its link.',
      reversible: 'yes',
      approval: 'each',
    },
    {
      id: 's-3',
      order: 3,
      action: 'In the browser, open our Devpost draft and add the demo link from the last step. Do not press Submit.',
      role: 'maya-laptop',
      needs: 'browser',
      expected_result: 'The draft shows the demo link and is not submitted.',
      reversible: 'yes',
      approval: 'each',
    },
  ],
  never_automate: ['Pressing the final Submit button on Devpost'],
})

export function buildSeed(now: number): Store {
  const t = new Date(now).toISOString()
  const old = new Date(now - 3 * 3600_000).toISOString()
  const fresh = new Date(now - 5_000).toISOString()
  const profile = (pid: string, login: string, name: string) => ({
    id: pid,
    github_login: login,
    display_name: name,
    avatar_url: null,
    created_at: t,
  })
  const device = (did: string, user_id: string, name: string, platform: 'macos' | 'windows', caps: ('shell' | 'browser' | 'screen')[], seen: string | null) => ({
    id: did,
    user_id,
    name,
    platform,
    capabilities: caps,
    token_hash: `hash-${did.slice(-3)}`,
    last_seen_at: seen,
    joined_room_id: SEED_IDS.room,
    revoked_at: null,
    created_at: t,
  })
  const doc = seedDoc()
  return {
    profiles: [
      profile(SEED_IDS.maya, 'mayal', 'Maya'),
      profile(SEED_IDS.sam, 'samk', 'Sam'),
      profile(SEED_IDS.jared, 'jaredc', 'Jared'),
    ],
    rooms: [
      {
        id: SEED_IDS.room,
        slug: SEED_ROOM_SLUG,
        name: 'Demo day crew',
        visibility: 'private',
        owner_id: SEED_IDS.maya,
        invite_code: SEED_INVITE_CODE,
        repo_full_name: 'team/app',
        repo_branch: 'main',
        github_installation_id: 1,
        created_at: t,
      },
    ],
    room_members: [
      { room_id: SEED_IDS.room, user_id: SEED_IDS.maya, role: 'owner', created_at: t },
      { room_id: SEED_IDS.room, user_id: SEED_IDS.sam, role: 'editor', created_at: t },
      { room_id: SEED_IDS.room, user_id: SEED_IDS.jared, role: 'editor', created_at: t },
    ],
    devices: [
      device(SEED_IDS.mayaWindows, SEED_IDS.maya, "Maya's Windows laptop", 'windows', ['shell', 'browser'], fresh),
      device(SEED_IDS.jaredMac, SEED_IDS.jared, "Jared's MacBook", 'macos', ['shell', 'browser', 'screen'], fresh),
      device(SEED_IDS.samMini, SEED_IDS.sam, "Sam's Mac mini", 'macos', ['shell', 'browser', 'screen'], old),
    ],
    room_devices: [SEED_IDS.mayaWindows, SEED_IDS.jaredMac, SEED_IDS.samMini].map((device_id) => ({
      room_id: SEED_IDS.room,
      device_id,
      allowed: true,
      created_at: t,
    })),
    workflows: [
      {
        id: SEED_IDS.workflow,
        room_id: SEED_IDS.room,
        slug: SEED_WORKFLOW_SLUG,
        ydoc: null,
        doc,
        head_commit_sha: SEED_COMMIT,
        head_doc_hash: 'seed',
        dirty: false,
        updated_at: t,
        created_at: t,
      },
    ],
    role_bindings: [
      { workflow_id: SEED_IDS.workflow, role: 'jared-mac', device_id: SEED_IDS.jaredMac, created_at: t },
      { workflow_id: SEED_IDS.workflow, role: 'maya-laptop', device_id: SEED_IDS.mayaWindows, created_at: t },
    ],
    runs: [],
    run_steps: [],
    approvals: [],
    run_events: [],
    versions: [
      { commit_sha: SEED_COMMIT, workflow_id: SEED_IDS.workflow, message: 'First version', author_id: SEED_IDS.maya, created_at: t },
    ],
  }
}
