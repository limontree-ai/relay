# Colby: back

You own the database and run engine, device pairing and the CLI, the device API, the MCP server and Claude Code plugin, push sending, and the GitHub App. Plan docs to keep open: `plan/05_server.md`, `plan/04_plugin.md`, `plan/07_repo_sync.md`, `plan/08_safety.md`.

Your spike S1 is the gate for the whole product: the plan says no product chunk starts until S1 is a go. Do it first. See [README.md](README.md) for the full order and handoffs.

---

## Phase 1: spikes

All throwaway code in `spikes/`. Each ends with a one page `spikes/sN/README.md` and a go, change or stop call.

### T1. S1 Claude Code loop (do first)
**Question:** can an interactive Claude Code session reliably loop on an MCP tool, run steps handed to it, and report back?
- [ ] Stub MCP server with the 5 tools from `04_plugin.md` and a local queue of 10 steps (shell, browser, one screen step)
- [ ] Run on 2 Macs and 1 Windows laptop
- [ ] Record: tool timeouts, context used per step, permission prompts hit, whether Claude stays in the loop
- [ ] Check whether Claude Code's channels feature (server-pushed messages) is a better trigger than polling

**Go if:** 9 of 10 steps finish, the loop survives 10 steps, no tool timeouts at 45 seconds.
**If not:** shorter waits; the skill tells the user to `/compact`; or switch to channels.

### T2. S2 computer use from a tool result (needs T1's stub)
- [ ] 5 screen steps (open an app, fill a form, record the screen) on a Pro plan Mac
- [ ] Record time and plan usage per step

**Go if:** 4 of 5 finish in under 5 minutes each. **If not:** mark screen steps beta; examples lean on shell and browser.

### T3. S6 plugin install
- [ ] Publish the marketplace from a test repo; install on a clean machine with `claude plugin marketplace add` and `claude plugin install`

**Go if:** two commands install it. **If not:** adjust the docs and tell Sweeya what to change on `/setup`.

### T4. S4 GitHub App basics
- [ ] Install a dev GitHub App, commit a file with the contents API, receive a push webhook, and filter out our own commit
- [ ] Use a smee.io tunnel locally

**Go if:** it works end to end on a test repo.

---

## Phase 2: database

### T5. C2 database, RLS and run engine
Starts once Sweeya's C0 (repo setup) merges.
- [ ] Migrations in `supabase/migrations/` for every table in `05_server.md`: profiles, rooms, room_members, devices, device_pairings, room_devices, workflows, role_bindings, edit_log, runs, run_steps, approvals, run_events, push_subscriptions
- [ ] Profile creation trigger on sign up
- [ ] RLS policies exactly as the table in `05_server.md`, including private Realtime channels with policies on `realtime.messages`
- [ ] SQL functions: `start_run`, `claim_step` (`FOR UPDATE SKIP LOCKED`), `request_approval`, `decide_approval` (caller must own the device), `post_status`, `finish_step`, `stop_run`, `retry_step`, `skip_step`, `mark_stalled`, `join_room_by_invite`
- [ ] pg_cron: `mark_stalled` every minute; delete `device_pairings` older than 1 hour and `run_events` older than 90 days
- [ ] Limits from `05_server.md` (20 rooms per user, 12 members per room, 30 steps, 1 active run per workflow)
- [ ] pgTAP tests (`supabase test db`) for every state transition, every RLS rule (allowed and denied), `SKIP LOCKED` with two devices, the stalled rule, approve rest of run, and stale device calls returning `stop`

**Done when:** all SQL tests pass in CI.

**Prompt:** use the C2 prompt in `plan/09_build_plan.md`.

**Hand to Sweeya when it merges:**
- Generated DB types (`supabase gen types typescript`) into `packages/db-types` (or `apps/web/lib/db.types.ts`). Regenerate after every migration
- A short list of RPC names and arguments she calls from the browser: `join_room_by_invite`, `decide_approval`, `stop_run`, `retry_step`, `skip_step`

From here on, function names and arguments only change with a heads up to Sweeya.

---

## Phase 3: devices

### T6. C4 pairing and CLI login
- [ ] Routes: `POST /api/device/pair/start` (rate limited by IP), `pair/confirm`, `pair/poll`, `POST /api/device/revoke`
- [ ] Tokens: 32 random bytes, base64url, `tdm_` prefix. Store only the sha256
- [ ] `packages/cli`: `login`, `logout`, `status`. Credentials at `~/.config/tandem/credentials.json` (Windows: `%APPDATA%\tandem\credentials.json`), file mode 0600
- [ ] Codes live 10 minutes

**Done when:** an integration test against local Supabase covers start, confirm as a user, a poll that returns the token once, the token working, revoke killing it, and expired codes failing.

**Prompt:** use the C4 prompt in `plan/09_build_plan.md` (skip the `/pair` and `/devices` screens; Sweeya builds those).

**Tell Sweeya** when the pair routes work, so she can wire screens 10 and 11.

### T7. C6 device API and the fake device script
- [ ] One shared function checks the bearer token, rejects revoked devices, loads the device, and updates `last_seen_at`
- [ ] Routes: `join`, `heartbeat`, `next-step`, `steps/:id/approval`, `approvals/:id`, `steps/:id/status`, `steps/:id/result`. Each calls one SQL function from T5; no state logic in TypeScript
- [ ] `POST /api/workflows/:id/runs`: reads `doc` (written by Sweeya's persist route), validates with `packages/format`, saves first if `dirty`, then calls `start_run`
- [ ] Rate limit: 60 requests a minute per device
- [ ] **`scripts/fake-device.ts`**: plays the device side against the device API (join, claim, ask approval, stream status, report). Ship it in this chunk, not later. Sweeya needs it for the run view and Playwright

**Done when:** route tests cover every tool path plus the denied cases in `08_safety.md`: revoked token, wrong device, inactive step, rate limit. The fake device runs a 3 step workflow from a terminal.

**Prompt:** use the C6 prompt in `plan/09_build_plan.md`.

---

## Phase 4: plugin and push

### T8. C5 MCP server and plugin
Needs S1 to be a go, plus Sweeya's C1 (`packages/format`).
- [ ] `packages/cli/src/mcp.ts`: the 5 tools (`join_room`, `get_next_step`, `ask_approval`, `stream_status`, `report_result`) with the exact inputs and outputs in `04_plugin.md`
- [ ] Official TypeScript MCP SDK over stdio. Each tool waits at most 45 seconds. Heartbeat every 20 seconds after join
- [ ] With no credentials, every tool returns the "not paired" message from `04_plugin.md`
- [ ] Never log step text or results; log tool names, ids and timings only
- [ ] `plugin/` files: `.claude-plugin/plugin.json`, `.mcp.json` (pinned CLI version), and both SKILL.md files copied word for word from `04_plugin.md`
- [ ] `.claude-plugin/marketplace.json` at the repo root
- [ ] Use the S1 findings where they differ from the doc, and list every difference in the PR

**Done when:** tool tests pass against the fake device API; a scripted real run on a Mac with Claude Code does join, two steps, approve, report; the plugin installs from the marketplace on a clean machine.

**Prompt:** use the C5 prompt in `plan/09_build_plan.md`.

**Needs from Natasha first:** D-01 product name, before the plugin and npm package are published.

### T9. Push sending (C9 back)
- [ ] `POST /api/push/subscribe` storing `push_subscriptions`
- [ ] Send with `web-push` and VAPID keys from env when an approval is requested and when a step becomes ready on an offline device
- [ ] `POST /api/push/notify` with a shared secret, for database caused events (`mark_stalled`)
- [ ] Each push opens the right page: `/a/:approval`, or the run view

**Done when:** a push arrives on a real iPhone home screen app (from Sweeya's S5 setup) and opens the approval page.

---

## Phase 5: GitHub

### T10. Repo sync (C10 back)
- [ ] Production GitHub App settings from `07_repo_sync.md`: Contents read and write, Metadata read, push events, only picked repos
- [ ] Octokit with an installation token per request. Private key in Vercel env
- [ ] `POST /api/rooms/:id/repo`: store installation, repo, branch; import `workflows/*/workflow.json`; list invalid files and skip them
- [ ] `POST /api/workflows/:id/save`, save before run, and the run record commit after a run ends. Write files with `stringify()`; pass run summaries through `redact()`
- [ ] Commit author is the app bot with a `Co-authored-by` line for the member
- [ ] Contents API with the known blob sha. If GitHub says the file changed, reload and return a conflict. **Never force write**
- [ ] `POST /api/github/webhook`: verify the signature; ignore our own commits; handle new, changed (clean or dirty draft), and deleted files as in `07_repo_sync.md`
- [ ] Failed run record commits stay in the database with `record_commit_sha` null, with a retry route

**Done when:** against a test repo: import, save, run record, an outside push with clean and dirty drafts, our own push ignored, and a save conflict handled without force.

**Prompt:** use the C10 prompt in `plan/09_build_plan.md` (skip the UI; Sweeya builds it).

**Tell Sweeya** the response shapes for connect, save and conflict, so she can build the UI.

---

## Phase 6: together with Sweeya

### T11. C11 dogfood and safety
- [ ] Two person dry run with people who've never used it. Target: a finished cross device run in under 15 minutes
- [ ] Fixes from the dry run
- [ ] Your half of the safety checklist in `08_safety.md`: every RLS policy has an allowed and a denied SQL test; device API denied case tests; gitleaks on every PR; a short SECURITY.md; an outside person tries to run a step on a device they don't own

---

## Rules for your code
- No model calls and no Anthropic key anywhere on the server. The CI check fails if `ANTHROPIC_API_KEY` appears in `apps/` or `packages/`
- All state changes go through the SQL functions. Clients and route handlers never update run tables directly
- Every function the device API calls takes `device_id` and checks it itself
- Any device call about a step that's no longer active returns `stop: true` and changes nothing
- Never log step text, plans, summaries, outputs, notes or Yjs content. Log ids, status changes and timings only
- Field names exactly as in the plan docs
