# Sweeya: front

You own the web app, the live editor, `packages/format` and the repo setup. Plan docs to keep open: `plan/06_web.md`, `plan/03_workflow_format.md`, `plan/05_server.md` (tables, RLS, Realtime, API shapes).

You can start today. Nothing in phases 1 and 2 waits on Colby. See [README.md](README.md) for the full order and handoffs.

---

## Phase 1: setup and spikes

### T1. C0 Repo setup and CI
- [ ] npm workspaces: `apps/web` (Next.js App Router), `packages/format`, `packages/cli` (empty for Colby)
- [ ] TypeScript strict, ESLint, Prettier, Vitest, Playwright
- [ ] `supabase/` folder with the Supabase CLI project (empty migrations; Colby fills them)
- [ ] `.github/workflows/ci.yml`: lint, typecheck, test, `supabase test db`, gitleaks, and a check that fails if `ANTHROPIC_API_KEY` appears under `apps/` or `packages/`
- [ ] `.claude-plugin/` and `plugin/` folders left empty for Colby

**Done when:** `npm ci && npm run lint && npm run typecheck && npm test` pass in CI on an empty app.

**Prompt:** use the C0 prompt in `plan/09_build_plan.md` as written.

### T2. S3 spike: Yjs over Supabase Realtime
- [ ] 3 browsers edit one Yjs doc for 10 minutes over a Realtime broadcast channel, with forced disconnects
- [ ] Record payload sizes against the broadcast size limit, reconnect behavior, and whether merged updates persist with no lost edits
- [ ] Measure awareness messages a second with 12 tabs on our Supabase plan (Free: 100 a second including fan out). Fire concurrent persist requests and check none is lost. Try concurrent drag reorder with fractional indexes
- [ ] Write `spikes/s3/README.md` with a go, change or stop call. Fallback: the Liveblocks Yjs provider

### T3. S5 spike: Web Push on iPhone
- [ ] VAPID push to an iPhone home screen web app and to Android. Tap opens a test approval page
- [ ] Measure time to arrive (go if under 10 seconds). Check the subscription still works after 3 days, delivery in Focus mode, and resubscribe after removing the home screen app. Always show a notification (iOS revokes after silent pushes). Write `spikes/s5/README.md`. Fallback: email, then a Telegram bot (L-18)

---

## Phase 2: format, mock data, editor

### T4. C1 `packages/format`
- [ ] `workflow.schema.json` (`relay/1`) and `run.schema.json` (`relay-run/1`) exactly as in `03_workflow_format.md`
- [ ] Generated TS types, `validate()` returning `{ path, message, level }`, `redact()`, `stringify()` with stable key order
- [ ] `toWorkflowJson(ydoc)` and `fromWorkflowJson(json)`
- [ ] Port the secret patterns from limontree's pattern rules
- [ ] Fixtures in `examples/workflows/` and `packages/format/fixtures/{valid,invalid}`

**Done when:** every rule in `03_workflow_format.md` has a passing and a failing fixture; `stringify(parse(x)) === x`; Yjs round trip is lossless.

**Prompt:** use the C1 prompt in `plan/09_build_plan.md`.

**Tell Colby** when it merges. His server, MCP server and repo sync import it.

### T5. Mock data layer
So you're not blocked on C2.
- [ ] `apps/web/lib/data/`: one function per read or write the screens need, named after the table or RPC in `05_server.md` (e.g. `listRooms`, `joinRoomByInvite`, `startRun`, `decideApproval`, `stopRun`, `retryStep`, `skipStep`)
- [ ] Two implementations behind the same types: `mock` (fixtures in memory, plus a scripted run that moves through step states every few seconds) and `supabase` (real calls, filled in once C2 lands)
- [ ] An env flag picks which one. Delete `mock` once every screen runs on real data. It must not ship

### T6. C7 editor, part 1: live editing
- [ ] Screen 5 (`/r/:slug/w/:wf`): header, step list, side panel, workflow fields, add, delete, reorder
- [ ] Yjs model: `Y.Map` for top fields, a `Y.Map` of steps keyed by step id, each with a fractional `index` (reorder sets one key; `Y.Array` has no move). Short fields as plain strings; `Y.Text` with `y-textarea` only for `action` and `description`
- [ ] Our own small Yjs provider (about 200 lines) over Realtime broadcast on `wf:<workflow_id>`, with awareness (cursor, selected step, color) throttled to 10 a second, based on S3. Do not depend on the `y-supabase` packages. Drag to reorder with dnd-kit
- [ ] Validation problems under each step from `validate()`
- [ ] States: loading, empty, read only, offline

**Done when:** two browser contexts typing in the same field both see each other's text, and an offline edit syncs after reconnect.

---

## Phase 3: real data

Starts when Colby's C2 merges and he publishes generated DB types.

### T7. C3 auth, rooms, invites
- [ ] Supabase Auth with GitHub
- [ ] Screens 1 (`/`), 2 (`/rooms`), 3 (`/rooms/new`, name only; repo connect comes in T13), 4 (`/r/:slug`), 8 (`/r/:slug/settings`), 9 (`/join/:code`)
- [ ] Browser Supabase client with RLS for all writes. No route handlers
- [ ] Presence on `room:<room_id>`
- [ ] limontree design rules: white page, black and grays, square corners, Instrument Serif headings, Inter body, three bouncing lemons for loading

**Done when:** Playwright signs in a test user, creates a room, opens the invite in a second context, and both see each other in presence.

**Prompt:** use the C3 prompt in `plan/09_build_plan.md`.

### T8. C7 editor, part 2: persist and bind devices
- [ ] `POST /api/workflows/:id/ydoc`: merge with `Y.mergeUpdates` inside one transaction with `SELECT ... FOR UPDATE` on the workflow row, update `doc`, `dirty`, `edit_log`. Compact every 200 updates (load, re-encode, store). Debounce client sends by 1 second
- [ ] Load `ydoc` from the database, apply, then subscribe
- [ ] Saved state in the header: Saving…, Saved but not in the repo, In the repo at `<sha>`
- [ ] "Runs on" control writing `role_bindings`. Show "Also changes steps 2 and 4" for shared roles. Grey out devices that can't do the step's `needs`, with the reason
- [ ] New workflow (`POST /api/workflows`)

**Done when:** reload keeps both people's edits, and a screen step can't be bound to a Windows device.

**Tell Colby** when the persist route merges. His run start reads `doc`.

### T9. Pair and devices screens
Needs Colby's C4 routes.
- [ ] Screen 10 (`/pair`): enter or confirm a pairing code, name the device, call `pair/confirm`
- [ ] Screen 11 (`/devices`): rename, revoke, per room on/off switch (`room_devices.allowed`, off by default), capabilities, last seen

---

## Phase 4: running

### T10. C8 run view
Needs Colby's C6 routes and `scripts/fake-device.ts`.
- [ ] Run button calls `POST /api/workflows/:id/runs`
- [ ] Screen 6 (`/r/:slug/runs/:run`): header with version link and Stop; one row per step with status chip and time
- [ ] Status text exactly as in `06_web.md`: Waiting, Waiting for Maya's Claude, Asking Maya, Running, Done, Failed, Stalled, Skipped, Stopped, Not run
- [ ] Expand a row: Claude's plan, live feed, summary, outputs
- [ ] Note box under the running step; Retry and Skip on stalled steps
- [ ] Live updates from the private `room:<room_id>` broadcast channel (Colby's database triggers), not `postgres_changes`

**Done when:** Playwright with the fake device runs a 3 step workflow, a note reaches the fake device, Stop ends it, and a stalled step can be retried.

### T11. Approval page and push sign up (C9 front)
- [ ] Screen 12 (`/a/:approval`), phone first: who wants to run what on whose device, full step text, Claude's plan, needs badges, "Cannot be undone" badge
- [ ] Buttons Approve, Approve the rest of this run, Deny, calling `decide_approval`. Only the device owner sees buttons
- [ ] The page needs a signed in session; the id is a lookup, not a password. Single use, 5 minute expiry (enforced by Colby's function; show the expired state)
- [ ] Passkey (Face ID or Touch ID) confirm for "Approve the rest of this run" and steps that cannot be undone
- [ ] Android: Approve and Deny actions inside the notification are a bonus; iOS has none, so the page is the main path
- [ ] Web app manifest and service worker so it works as an iPhone home screen app
- [ ] Push subscribe calls `POST /api/push/subscribe` (Colby builds the route)

**Done when:** a decision on the page unblocks the device's `ask_approval`, and only the owner sees buttons.

### T12. Setup page
- [ ] Screen 13 (`/setup`): the one command install from inside Claude Code (`/plugin install relay --marketplace limontree-ai/temp`), the two command form for older versions, `npx relay-ai login` and `npx relay-ai doctor`, all with copy buttons
- [ ] A tab for Codex, Cursor and Gemini CLI: `npx skills add limontree-ai/temp` and `npx relay-ai join <invite-link>`, marked beta
- [ ] Permission prompts: suggest an allowlist for read only commands, and how to start with `--channels`
- [ ] Turn on notifications, with the iPhone Add to Home Screen explanation first, and a "Send a test notification" button

---

## Phase 5: repo

### T13. Repo UI (C10 front)
Needs Colby's GitHub routes.
- [ ] Connect a repo on screen 3 and in settings: install the GitHub App, pick repo and branch, call `POST /api/rooms/:id/repo`, show imported workflows and any invalid files with their problems
- [ ] Save version button calling `POST /api/workflows/:id/save`, with a conflict message when the repo changed
- [ ] Repo changed banner (load repo version or keep yours) and removed workflow state with Restore
- [ ] After a run: "Saved to the repo" link, or "Not saved to the repo" with Retry

### T14. History
- [ ] Screen 7 (`/r/:slug/w/:wf/history`): newest first, commit sha, message, author, date, runs, succeeded and failed, link to the GitHub diff. Click a version to see its runs

---

## Phase 6: together with Colby

### T15. C11 dogfood
- [ ] A sample "demo day" workflow in `examples/workflows/`
- [ ] Two person dry run with people who've never used it. Target: a finished cross device run in under 15 minutes
- [ ] Fixes from the dry run
- [ ] Your half of the safety checklist in `08_safety.md`

---

## Rules for your code
- Never log step text, plans, summaries, outputs, notes or Yjs content
- No model calls anywhere, and no Anthropic key names in `apps/` or `packages/`
- Only the device owner can approve. Don't rely on hiding buttons; RLS and `decide_approval` enforce it
- Field names exactly as in the plan docs
