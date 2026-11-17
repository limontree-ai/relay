# 05 Server: database, run engine, API

Everything lives in Supabase Postgres. State changes happen in SQL functions so the rules exist in one place and are tested in SQL. Route handlers in Next.js exist only for device tokens, GitHub, Yjs persistence and push.

`room_id` plays the role that `workspace_id` plays in limontree: every table has it (directly or through its parent) and every table has row level security.

## Tables

All tables have `created_at timestamptz default now()`. Ids are `uuid default gen_random_uuid()` unless noted.

**profiles**: `id` (= auth.users.id), `github_login` unique, `display_name`, `avatar_url`

**rooms**: `id`, `slug` unique, `name`, `visibility` (`private` default, `public`), `owner_id`, `invite_code` (random, resettable), `repo_full_name`, `repo_branch`, `github_installation_id`

**room_members**: `room_id`, `user_id`, `role` (`owner`, `editor`, `viewer`), primary key (room_id, user_id)

**devices**: `id`, `user_id`, `name`, `platform` (`macos`, `windows`, `linux`), `capabilities text[]`, `token_hash` (sha256), `last_seen_at`, `joined_room_id`, `revoked_at`

**device_pairings**: `pair_code` primary key, `poll_token_hash`, `name`, `platform`, `user_id` (null until confirmed), `device_id`, `expires_at`

**room_devices**: `room_id`, `device_id`, `allowed boolean default false`. Primary key (room_id, device_id). Off by default

**workflows**: `id`, `room_id`, `slug`, `ydoc bytea`, `doc jsonb` (latest JSON from the ydoc), `head_commit_sha`, `head_doc_hash`, `dirty boolean` (doc differs from head commit), `updated_at`. Unique (room_id, slug)

**role_bindings**: `workflow_id`, `role`, `device_id`. Primary key (workflow_id, role)

**edit_log**: `id bigserial`, `workflow_id`, `user_id`, `at`. One row per persisted edit batch. Used for the live use metric

**runs**: `id`, `short_id` (6 characters, used in file names), `room_id`, `workflow_id`, `commit_sha`, `started_by`, `note`, `status`, `started_at`, `ended_at`, `record_commit_sha`

**run_steps**: `id`, `run_id`, `step_id`, `order`, `snapshot jsonb` (the step as committed), `role`, `device_id`, `status`, `claimed_at`, `last_status_at`, `approved_by`, `summary`, `outputs jsonb`, `error`, `started_at`, `ended_at`

**approvals**: `id`, `run_step_id`, `device_id`, `plan`, `requested_at`, `decision` (`approved`, `approved_run`, `denied`, null while waiting), `decided_by`, `decided_at`

**run_events**: `id bigserial`, `run_id`, `run_step_id`, `kind` (`status`, `note`, `system`), `author_id`, `message`, `delivered_at` (for notes), `created_at`. The live feed

**push_subscriptions**: `id`, `user_id`, `endpoint` unique, `p256dh`, `auth`

## Row level security

| Table | Read | Write |
|---|---|---|
| rooms | members; anyone if `public` | owner (update); any signed in user (insert, becomes owner) |
| room_members | members of the room | owner; join through `join_room_by_invite(code)` |
| workflows, role_bindings | members; anyone if room `public` | editors and owner |
| runs, run_steps, run_events | members; anyone if room `public` (summaries only, see 08_safety.md) | only through functions |
| approvals | members | only through functions, and `decide_approval` checks the caller owns the device |
| devices | the owner of the device | owner (rename, revoke) |
| room_devices | members of the room | the owner of the device |
| push_subscriptions | own rows | own rows |
| device_pairings, edit_log | no client access | service role |

The device API uses the service role after it checks the device token. Every function that the device API calls takes `device_id` and checks it itself.

## Run engine

### States

Run: `running` → `succeeded` | `failed` | `stopped`

Step:

```
pending ──(previous step done)──► ready ──(claim)──► claimed ──(ask_approval)──► awaiting_approval
                                    ▲                                              │approved   │denied
                                    │retry                                         ▼           ▼
                                 stalled ◄──(no status 5 min)── running ◄──────────┘         failed
                                    │skip                          │report_result
                                    ▼                              ▼
                                 skipped                       done | failed
```

Also `stopped` from any non final state when someone stops the run, and `not_run` for steps after a run ends early.

### Rules

- Steps run one at a time, in order. Step n+1 becomes `ready` only when step n is `done` or `skipped`
- A `failed` step fails the run. (Retry starts a new run. Keeping it simple is deliberate; see 10_later.md L-07)
- A `ready` step whose device is offline (no heartbeat in 60 seconds) shows "Waiting for <name>'s Claude". On becoming `ready` the owner gets a push
- A device claims only steps bound to it, in rooms where `room_devices.allowed` is true, and only if its capabilities cover `needs`
- A device runs one step at a time
- `stalled`: a `claimed`, `awaiting_approval` or `running` step with no tool call in 5 minutes. Approval waits are exempt (the device is still polling). A stalled step is never retried automatically, because it might not be reversible. A member picks Retry (back to `ready`) or Skip
- Any device call about a step that is no longer active on that device returns `stop: true` and changes nothing. A late reply from a stalled device can never overwrite a retry

### SQL functions

| Function | Called by | Does |
|---|---|---|
| `start_run(workflow_id, commit_sha, doc, note)` | route handler | Checks every role is bound and every device can do its steps. Inserts run and run_steps, step 1 `ready` |
| `claim_step(device_id)` | device API | `SELECT ... FOR UPDATE SKIP LOCKED` the oldest `ready` step for this device. Sets `claimed`. Returns step plus `previous` results |
| `request_approval(device_id, run_step_id, plan)` | device API | Sets `awaiting_approval`, inserts approval. If an `approved_run` decision exists for this run and device, approves at once |
| `decide_approval(approval_id, decision)` | web (RPC) | Caller must own the device. Sets decision; step goes `running` or `failed` |
| `post_status(device_id, run_step_id, message)` | device API | Updates `last_status_at`, inserts event, returns undelivered notes and the stop flag, marks notes delivered |
| `finish_step(device_id, run_step_id, outcome, summary, outputs, stop_run)` | device API | Sets result, readies next step or ends the run |
| `stop_run(run_id)` | web (RPC) | Editors. Run `stopped`; active steps `stopped` |
| `retry_step(run_step_id)`, `skip_step(run_step_id)` | web (RPC) | Editors. Only from `stalled` |
| `mark_stalled()` | pg_cron every minute | Applies the 5 minute rule |
| `join_room_by_invite(code)` | web (RPC) | Adds caller as editor |

## API routes (Next.js route handlers)

Device routes take `Authorization: Bearer <device token>`. The handler hashes it, finds the device, rejects revoked devices, and updates `last_seen_at`.

| Method and path | Auth | Body | Returns |
|---|---|---|---|
| POST /api/device/pair/start | none, rate limited by IP | `{ name, platform }` | `{ pair_code, poll_token, verify_url }` |
| POST /api/device/pair/confirm | user | `{ pair_code, name }` | `{ ok }` |
| POST /api/device/pair/poll | poll token | `{ poll_token }` | `{ status: "waiting" }` or `{ device_id, token }` once |
| POST /api/device/revoke | device | none | `{ ok }` |
| POST /api/device/join | device | `{ room, capabilities }` | join_room output |
| POST /api/device/heartbeat | device | none | `{ ok }` |
| GET /api/device/next-step | device | none | get_next_step output (single poll) |
| POST /api/device/steps/:id/approval | device | `{ plan }` | `{ approval_id, decision }` |
| GET /api/device/approvals/:id | device | none | `{ decision, note }` |
| POST /api/device/steps/:id/status | device | `{ message }` | `{ stop, notes }` |
| POST /api/device/steps/:id/result | device | `{ outcome, summary, outputs, stop_run }` | `{ ok, run_status }` |
| POST /api/workflows/:id/ydoc | user (editor) | binary Yjs update | `{ ok }`. Merges with `Y.mergeUpdates`, updates `doc`, `dirty`, `edit_log` |
| POST /api/workflows | user (editor) | `{ room_id, slug, name }` | `{ id }` |
| POST /api/workflows/:id/save | user (editor) | `{ message? }` | `{ commit_sha }` (07_repo_sync.md) |
| POST /api/workflows/:id/runs | user (editor) | `{ note? }` | `{ run_id }`. Saves first if `dirty` |
| POST /api/rooms/:id/repo | user (owner) | `{ installation_id, repo_full_name, branch }` | `{ ok }`, imports `workflows/**` |
| POST /api/github/webhook | GitHub signature | GitHub event | 200 |
| POST /api/push/subscribe | user | push subscription | `{ ok }` |

Everything else (room create, rename, invites, role bindings, room devices, approvals, stop, retry, skip) goes from the browser straight to Supabase with RLS or RPC. No route handler.

Push is sent from inside the route handler or function caller that causes it (step ready on an offline device, approval requested). Sent with `web-push` using VAPID keys. For SQL caused events (`mark_stalled`) a database webhook calls `POST /api/push/notify` with a shared secret.

## Realtime

| Channel | Type | Payload | Who |
|---|---|---|---|
| `room:<room_id>` | presence | `{ user_id, name, avatar, workflow_id, step_id }` | members |
| `wf:<workflow_id>` | broadcast | Yjs updates and awareness (base64) | members |
| `runs`, `run_steps`, `run_events`, `approvals`, `devices` | postgres_changes filtered by `room_id` | row changes | members, through RLS |

Realtime authorization uses private channels with RLS policies on `realtime.messages` so only members can join a room's channels.

## Limits

| Thing | Limit |
|---|---|
| Rooms per user | 20 |
| Members per room | 12 |
| Workflows per room | 50 |
| Steps per workflow | 30 |
| Active runs per workflow | 1 |
| Status messages per step | 200 (older ones are kept, new ones are dropped with one system event) |
| Device API | 60 requests a minute per device |

## Cleanup

- `device_pairings` older than 1 hour: deleted by pg_cron
- `run_events` older than 90 days: deleted. The run record in the repo is the permanent copy
