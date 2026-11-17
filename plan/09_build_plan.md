# 09 Build plan

Spikes first. They test the assumptions that would kill the product. Each spike is throwaway code in `spikes/` and ends with a one page write up and a go, change or stop call. No product chunk starts until S1 is a go.

## Spikes

| # | Question | How | Go if | If not |
|---|---|---|---|---|
| S1 | Can an interactive Claude Code session reliably loop on an MCP tool, run steps handed to it, and report back? | Stub MCP server with the 5 tools and a local queue of 10 steps (shell, browser, one screen step). Run on 2 Macs and 1 Windows laptop. Record tool timeouts, context used per step, permission prompts hit, and whether Claude stays in the loop | 9 of 10 steps finish, the loop survives 10 steps, no tool call moved to the background. Also test: channels push with `--channels`, permission prompt relay through channels, the news hook, and the Codex path with `npx relay-ai join` | Shorter waits; skill tells user to `/compact`; make channels the default trigger |
| S2 | Does computer use run screen steps from a tool result well enough? | 5 screen steps (open app, fill a form, record screen) on a Pro plan Mac. Time and plan usage per step | 4 of 5 finish under 5 minutes each | Screen steps are marked beta; examples lean on shell and browser |
| S3 | Does Yjs over Supabase Realtime broadcast hold up? | 3 browsers editing one doc for 10 minutes, with disconnects; check payload sizes, merge persistence, reconnect. Measure awareness messages a second with 12 tabs on our Supabase plan. Fire concurrent persist requests and check none is lost. Concurrent drag reorder with fractional indexes | No lost edits, updates under the broadcast size limit, under the plan's messages a second | Liveblocks Yjs provider (paid, drop in) |
| S4 | GitHub App basics | Install with user authorization, verify `installation_id` against the user's installations, contents API commit, `createCommitOnBranch` commit, push webhook with our own commit filtered by `sender.login`, a commit blocked by a ruleset | Works end to end on a test repo | Fix before C10 |
| S5 | Web Push on iPhone home screen app | VAPID push to iOS and Android, tap opens the approval page. Check the subscription still works after 3 days, delivery in Focus mode, and resubscribe after removing the home screen app | Arrives in under 10 seconds | Email as the fallback notification |
| S6 | Plugin install commands | Publish the marketplace from a test repo; install on a clean machine with the one command `/plugin install relay --marketplace <repo>`; `claude plugin validate . --strict` passes | One command installs it | Adjust docs and `/setup` |

S1, S3 and S6 can run in parallel. S2 needs S1's stub.

## Chunks

One branch and one pull request per chunk. A chunk is done when its acceptance tests pass in CI and its summary lists anything guessed. Dependencies in brackets.

| # | Chunk | Stories | Depends on |
|---|---|---|---|
| C0 | Repo scaffold and CI | all | none |
| C1 | `packages/format` | US-05, US-08, US-11 | C0 |
| C2 | Database: tables, RLS, run engine | US-02 to US-12 | C0 |
| C3 | Auth, rooms, invites, room page | US-01, US-02, US-03 | C2 |
| C4 | Device pairing and CLI login | US-04, US-12 | C2 |
| C5 | MCP server and plugin | US-07, US-08, US-10 | C1, C4, S1 |
| C6 | Device API | US-07 to US-10 | C2, C4 |
| C7 | Editor with live editing | US-05, US-06 | C1, C3, S3 |
| C8 | Run view | US-08, US-10 | C6, C7 |
| C9 | Approvals and push | US-09 | C6, S5 |
| C10 | Repo sync | US-02, US-11 | C1, C3, S4 |
| C11 | History, setup page, dogfood fixes | US-04, US-11 | all |

Order for one engineer: C0, C1, C2, C4, C6, C5 (the device loop works from a terminal), C3, C7, C8, C9, C10, C11. Two engineers: one takes C4, C6, C5, C9; the other C3, C7, C8, C10.

---

### C0 Repo scaffold and CI

Scope: npm workspaces (`apps/web`, `packages/format`, `packages/cli`), TypeScript strict, ESLint, Prettier, Vitest, Supabase CLI project, GitHub Actions: lint, typecheck, test, SQL tests, gitleaks, a check that no Anthropic key name appears in `apps/` or `packages/`.

Acceptance: `npm ci && npm run lint && npm run typecheck && npm test` pass in CI on an empty app.

Prompt:
> Set up the relay monorepo as described in plan/02_architecture.md (Monorepo). npm workspaces for apps/web (Next.js, App Router), packages/format and packages/cli. TypeScript strict, ESLint, Prettier, Vitest. Add a Supabase CLI project in supabase/. Add .github/workflows/ci.yml running lint, typecheck, tests, `supabase test db`, gitleaks, and a script that fails if ANTHROPIC_API_KEY appears under apps/ or packages/. Do not add any other dependencies. List anything you guessed.

### C1 packages/format

Scope: `workflow.schema.json` (relay/1) and `run.schema.json` (relay-run/1), generated TS types, `validate()`, `redact()`, `stringify()` (stable key order), `toWorkflowJson(ydoc)` and `fromWorkflowJson(json)`. Ported secret patterns from limontree rules. Fixtures in `examples/workflows/` and `packages/format/fixtures/{valid,invalid}`.

Acceptance: every rule in 03_workflow_format.md has a passing and a failing fixture; `stringify(parse(x)) === x` for valid fixtures; Yjs round trip is lossless.

Prompt:
> Build packages/format exactly to plan/03_workflow_format.md. Use ajv with JSON Schema 2020-12. validate() returns plain language problems shaped like { path, message, level: "error" | "warning" }. Port the secret patterns from the limontree pattern rules (API keys, bearer tokens, private keys, passwords in URLs). Add yjs as a dependency only in this package. Write fixtures for every check and tests for stable output and the Yjs round trip. Keep field names exactly as written in the doc.

### C2 Database

Scope: migrations for every table in 05_server.md, RLS policies, the SQL functions, pg_cron jobs, realtime authorization policies. SQL tests (pgTAP via `supabase test db`).

Acceptance: tests for each state transition in the diagram, each RLS row (allowed and denied), `SKIP LOCKED` claim with two devices, stalled rule, approve rest of run, stale device calls returning stop.

Prompt:
> Write Supabase migrations for plan/05_server.md: tables, RLS, functions, pg_cron jobs and realtime.messages policies. All state changes go through the listed functions; clients cannot update run tables directly. Write pgTAP tests for every transition in the step state diagram and every RLS rule, including denied cases. Do not run anything against a live project.

### C3 Auth, rooms, invites, room page

Scope: GitHub sign in, profile creation trigger, screens 1, 2, 3 (without repo connect), 4, 8, 9. Presence on `room:<id>`.

Acceptance: Playwright: sign in with a test user, create a room, open the invite in a second context, both see each other in presence.

Prompt:
> Build screens 1, 2, 3, 4, 8 and 9 from plan/06_web.md in apps/web, using Supabase Auth with GitHub and the tables from C2. Use the browser Supabase client with RLS for all writes; add no route handlers. Follow the limontree design rules in 06_web.md. Add presence on room:<room_id>. Playwright test as described in plan/09_build_plan.md C3.

### C4 Device pairing and CLI login

Scope: pair routes, `/pair` and `/devices` screens, `packages/cli` with `login`, `logout`, `status`, credentials file.

Acceptance: CLI integration test against local Supabase: start, confirm as a user, poll returns a token once, token works, revoke kills it, expired codes fail.

Prompt:
> Build device pairing from plan/04_plugin.md (Pairing) and the pair routes in plan/05_server.md. Tokens are 32 random bytes base64url with a rly_ prefix; store only sha256. Write credentials with mode 0600 at the paths in the doc. Build /pair and /devices from plan/06_web.md. Rate limit pair/start by IP. Tests as in plan/09_build_plan.md C4.

### C5 MCP server and plugin

Scope: `relay-ai mcp` with the 5 tools, heartbeat, polling, the channels push, the news hook, `doctor` and `join` commands, plugin files and both skills exactly as in 04_plugin.md. Only dependency: the MCP SDK.

Acceptance: tool tests with a fake device API; a scripted end to end run on a real Mac with Claude Code: join, two steps, approve, report. Install from the marketplace on a clean machine.

Prompt:
> Build the MCP server in packages/cli/src/mcp.ts and the plugin/ folder exactly to plan/04_plugin.md, using the official TypeScript MCP SDK over stdio. Each tool waits at most 45 seconds. Heartbeat every 20 seconds after join. Never log step text or results. Copy the two SKILL.md files word for word from the doc. Use the findings from the S1 write up in spikes/s1/README.md where they differ from the doc, and list every difference.

### C6 Device API

Scope: the device routes in 05_server.md, token middleware, per device rate limit, push on step ready for offline devices.

Acceptance: route tests for each tool path, revoked token, wrong device, inactive step, rate limit.

Prompt:
> Build the device routes from plan/05_server.md as Next.js route handlers. One shared function checks the bearer token and loads the device. Each route calls one SQL function from C2; put no state logic in TypeScript. Tests for every route, including the denied cases listed in plan/08_safety.md.

### C7 Editor with live editing

Scope: screen 5, Yjs doc model, Realtime broadcast provider, persist route with server merge, presence in the editor, validation under steps, Runs on control writing `role_bindings`, New workflow.

Acceptance: Playwright with two contexts typing in the same field; reload keeps both edits; offline edit syncs after reconnect; screen step cannot be bound to a Windows device.

Prompt:
> Build the workflow editor (screen 5) and the live editing model from plan/06_web.md, using toWorkflowJson and validate from packages/format. Write a small Yjs provider over Supabase Realtime broadcast on wf:<workflow_id>, based on the S3 spike. Build POST /api/workflows/:id/ydoc with Y.mergeUpdates and edit_log. Tests as in plan/09_build_plan.md C7.

### C8 Run view

Scope: Run button (calls the runs route), screen 6, live updates from the `room:<room_id>` broadcast channel, notes, stop, retry, skip.

Acceptance: Playwright with a fake device script runs a 3 step workflow; a note reaches the fake device; stop ends it; a stalled step can be retried.

Prompt:
> Build the Run button and the run view (screen 6) from plan/06_web.md. Subscribe to the private room:<room_id> broadcast channel fed by database triggers. Notes, stop, retry and skip call the RPC functions from C2. Add a test script, scripts/fake-device.ts, that plays the device side against the device API, and use it in Playwright.

### C9 Approvals and push

Scope: screen 12, push subscribe, `web-push` sending, `/api/push/notify` for database events, the service worker and web app manifest.

Acceptance: approval decided on the page unblocks `ask_approval`; only the owner sees buttons; approve rest of run skips later prompts on that device only.

Prompt:
> Build the approval page (screen 12), Web Push and the notifications in plan/06_web.md using web-push and VAPID keys from env. Add a manifest and service worker so it works as an iPhone home screen app. Only the device owner can decide. Tests as in plan/09_build_plan.md C9.

### C10 Repo sync

Scope: GitHub App routes, repo connect and import, save, save before run, run record commit, push webhook, banner states.

Acceptance: against a test repo: import, save, run record, external push with clean and dirty drafts, our own push ignored, conflict on save handled without force.

Prompt:
> Build repo sync exactly to plan/07_repo_sync.md with Octokit and installation tokens. Files are written with stringify() from packages/format. Run summaries pass through redact() before commit. Verify webhook signatures. Never force write. Tests with recorded GitHub responses plus one manual check on a real test repo.

### C11 History, setup, dogfood

Scope: screens 7 and 13, a sample "demo day" workflow, a 2 person dry run, fixes from it, the safety checklist in 08_safety.md.

Acceptance: two people who have never used it reach a finished cross device run in under 15 minutes; the safety checklist is complete.
