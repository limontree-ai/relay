# 02 Architecture

## The picture

```
 Browser (each member)                     Each member's machine
 ┌──────────────────────┐                  ┌──────────────────────────────────┐
 │ Next.js web app      │                  │ Claude Code (interactive)        │
 │  step list editor    │                  │   skills: join, run-step         │
 │  (Yjs doc)           │                  │   MCP: tandem (stdio, local)     │
 │  run view, approvals │                  │     heartbeat, poll, report      │
 └──────┬─────────┬─────┘                  └───────────────┬──────────────────┘
        │ realtime │ https                                  │ https (device token)
        ▼          ▼                                        ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Supabase: Postgres + RLS, Auth (GitHub), Realtime (broadcast, presence,   │
 │ postgres_changes). Run engine = SQL functions. Postgres is the queue      │
 └──────────────────────────────────▲───────────────────────────────────────┘
                                    │
 ┌──────────────────────────────────┴───────────────────────────────────────┐
 │ Next.js route handlers on Vercel: device API, GitHub App, Yjs persist,    │
 │ Web Push. No model calls                                                  │
 └──────────────────────────────────┬───────────────────────────────────────┘
                                    │ GitHub App (installation token)
                                    ▼
                         The group's GitHub repo
                  workflows/<slug>/workflow.json, runs/*.json
```

## Components

| Component | Where | Job | Why it exists |
|---|---|---|---|
| Web app | `apps/web`, Next.js on Vercel | Rooms, editor, runs, approvals, devices | The shared place to build and watch |
| Route handlers | `apps/web/app/api` | Device API, GitHub, Yjs persist, push | Anything needing a secret or a device token |
| Database | Supabase Postgres | All state. Run engine in SQL functions | RLS plus one source of truth. `FOR UPDATE SKIP LOCKED` is our queue |
| Realtime | Supabase Realtime | Presence, Yjs updates, live run status | Already used by limontree and Spectr. No socket server to run |
| Format | `packages/format` | JSON Schema, TS types, validator, secret redactor | Shared by web, server and MCP |
| Plugin | `plugin/` and `packages/cli` | Skills, MCP server, `login` | How each member's Claude joins |
| GitHub App | Registered app, handled in route handlers | Commit versions and runs, receive pushes | Per repo access without user tokens |

## Monorepo

One repo. It is also the plugin marketplace.

```
tandem/
  .claude-plugin/marketplace.json
  plugin/                         the Claude Code plugin (see 04_plugin.md)
  apps/web/                       Next.js app and route handlers
  packages/format/                schema, types, validate(), redact()
  packages/cli/                   npm @ORG/tandem: `login` and `mcp` commands
  supabase/migrations/            SQL: tables, RLS, run engine functions
  supabase/tests/                 SQL tests for RLS and the run engine
  examples/workflows/             sample workflows used in docs and tests
  .github/workflows/ci.yml
  package.json                    npm workspaces
```

## The no token model

- Our server has no Anthropic key. The CI release check fails if `ANTHROPIC_API_KEY` appears in server env files or code
- A step is text. The member's Claude Code reads it through the MCP tool `get_next_step` and does the work with its own tools: shell, browser, MCP tools, and computer use on macOS
- The member's plan limits pay for the work. We store only short text results

## How a run flows

1. Member hits Run. Route handler reads the Yjs doc, converts it to JSON, validates it. If it differs from the last commit it commits a new version. It calls `start_run(workflow_id, commit_sha)`
2. `start_run` snapshots the steps into `run_steps`, resolves each role to a device, and marks step 1 `ready`
3. On the device, Claude is inside the join loop and calls `get_next_step`. The MCP server polls `GET /api/device/next-step` every 3 seconds for up to 45 seconds. The server calls `claim_step(device_id)`
4. Claude writes a short plan and calls `ask_approval`. The server sets the step to `awaiting_approval`, inserts an `approvals` row, and sends Web Push to the device owner
5. Owner taps Approve on the phone. `ask_approval` returns `approved`. Claude does the work, calling `stream_status` along the way. Each call returns any notes and a stop flag
6. Claude calls `report_result`. `finish_step` marks it done and marks the next step `ready`. After the last step the run is finished and a route handler commits `runs/<run-id>.json`
7. Every state change is a row change. The web app subscribes with `postgres_changes`, so everyone sees it live

## Tech choices

| Choice | Picked | Reason | Rejected |
|---|---|---|---|
| Language | TypeScript everywhere | Web, MCP server and format share types. One toolchain | Python backend: second language, second deploy, for coordination only |
| Live editing | Yjs over Supabase Realtime broadcast, persisted to Postgres | No new service. Yjs is the standard CRDT | Liveblocks: paid, another vendor (kept as fallback if spike S3 fails). Hocuspocus: a server to run |
| Queue | Postgres with `SKIP LOCKED` | Volume is tiny. One place for state | Redis, SQS, Inngest |
| Device to server | HTTPS polling from the MCP server | Simple, works behind any network, no socket on the device | Realtime from the device: needs device JWTs and reconnect logic. Revisit after spike S1 |
| Auth | Supabase Auth with GitHub | Users need GitHub anyway | Email login |
| Repo access | GitHub App | Per repo permission, short lived tokens, webhooks | Storing user OAuth tokens |
| Notifications | Web Push to a home screen web app | No app store, works on iOS 16.4+ | Native app, SMS |
| Validation | JSON Schema with ajv | Same schema style as the limontree trace | Hand written checks |

## What we deliberately do not build

- A websocket server, a job queue, workers, a cache
- A step executor per step type. Claude decides how to do a step. The step only says what it needs, for routing
- A DAG engine. Steps run in order
- File storage. Results are text. Files move through the services people already use (repo, Drive, Devpost)
- Model calls of any kind on the server
- An admin panel. Use the Supabase dashboard

## Environments

| Env | Database | Web | GitHub App |
|---|---|---|---|
| local | `supabase start` | `npm run dev` | dev app pointing at a smee.io tunnel |
| preview | shared staging project | Vercel preview | staging app |
| production | production project | Vercel production | production app |

Env vars (names only): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `TANDEM_API_URL` (CLI default).
