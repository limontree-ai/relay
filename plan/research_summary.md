# relay: research summary (Nov 17, 2026)

Six research agents, one per part of the research plan. The product was called "huddle" while this research ran; after it, the name was changed to **relay** (decisions.md D-01). Sources are in the agent reports; key links are kept below. Claims marked *(agent)* come from agent research and should be spot-checked before they drive a big decision.

---

## Top findings

1. **The name "huddle" is high risk. Rename before launch.** `openhuddle` is a Claude Code plugin for "multiplayer mode for AI coding agents", the same niche and the same delivery method. Also Slack Huddles, Huddle01 (AI agent comms), huddle.com, gethuddle.tech ("AI workspace builder"). npm `huddle` is taken.
2. **Claude Code can now receive pushed work.** "Channels" (research preview) let our MCP server push events into a running Claude Code session, and can relay permission prompts to another device. Users start with `claude --channels plugin:<name>@<name>`. Keep long-polling as the fallback.
3. **The device loop is technically fine.** MCP tool calls have no short timeout (wall clock about 28 hours, idle timer 30 minutes for stdio). Calls auto-background after 2 minutes, so keep each wait under that. Computer use is confirmed macOS-only, Pro/Max/Ultra, interactive only.
4. **Our model looks compliant with Anthropic's terms** *(agent reading)*: each member runs their own unmodified Claude Code on their own subscription, and our server never sees tokens and makes no model calls. Not allowed: sharing one subscription or routing OAuth tokens through us.
5. **New closest competitors:** Multipeer (Mac app, multiplayer canvas for Claude Code and Codex on each person's machine), Poly (multiplayer rooms, but in hosted sandboxes they pay for), openhuddle. Anthropic, Nov 6, 2026: "We don't have multiplayer yet." The window is open but closing.
6. **iPhone push can't show Approve/Deny buttons** in the notification. Tap → open page → approve is the right design. Telegram bot buttons are the best low-friction extra channel for students.
7. **Hosted live-sync vendors keep dying** (PartyKit hosted shut down Oct 2026; Jamsocket/Y-Sweet shut down around Mar 2026). This supports staying on Supabase with Liveblocks as the paid fallback.

---

## R1. Claude Code plugin, MCP and device loop

| Topic | Finding |
|---|---|
| Plugin format | `.claude-plugin/marketplace.json` at repo root; `plugin.json` optional (`version` pins users until bumped); `skills/<name>/SKILL.md`; MCP via `.mcp.json`. Validate with `claude plugin validate . --strict` |
| Install | `claude plugin marketplace add org/repo`, then `claude plugin install name@marketplace`. Auto-update is opt-in per marketplace |
| Anthropic directory | Submit via claude.ai/directory/manage. Every version gets a security scan for undisclosed network calls or hidden code. Disclose every endpoint in the README |
| Timeouts | Stdio tools: no per-request timer, about 28h wall clock (`MCP_TOOL_TIMEOUT`), 30 min idle (`CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`), per-server `"timeout"` in `.mcp.json`. Calls **auto-background after 2 min** (`CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS`). Output cap about 25k tokens |
| Push into a session | **Channels**: declare `claude/channel`, emit `notifications/claude/channel`. Needs `--channels` at startup and claude.ai login; Team/Enterprise admins must enable it; not on Bedrock/Vertex. No other way to inject into a running interactive session |
| Computer use | Built-in `computer-use` MCP, enabled per project via `/mcp`. macOS, v2.1.85+, Pro/Max/Ultra, interactive only (`-p` disables it). Per-app permission prompts |
| Patterns to copy | HyperFrames: plugin + `npx skills add` fallback + a `doctor` command. Superpowers: "MCP gives capability, the skill gives judgment". Pin the MCP version with `npx -y <pkg>@x.y.z` |
| Cross-agent | Skills are portable (Agent Skills / `npx skills add`) to Codex, Gemini CLI, Cursor, OpenCode. Plain stdio MCP works broadly. Channels and hooks are Claude-only |
| Biggest risk | **Permission prompts stall the loop** (bash writes, edits, computer use per app). Recommend allowlists or `acceptEdits`, and relay prompts through channels |

Sources: code.claude.com/docs/en/plugins/marketplace-reference · /mcp · /channels · /channels-reference · /computer-use · /legal-and-compliance

## R2. Live editing

| Topic | Finding |
|---|---|
| Supabase Yjs providers | `@supabase-labs/y-supabase` is official-ish but 3 months old with 10 stars (used by Supabase's `RealtimeFlow`). `y-supabase` (AlexDunmow) is abandoned and "not for production" |
| Realtime limits | Free: 200 connections, 100 msg/s (fan-out counts), 256 KB payload, presence 20 msg/s. Pro: 500 connections, 500 msg/s, 3 MB. Fine for 12 users if cursor updates are throttled to about 10–15 per second |
| Alternatives | **Liveblocks** (best managed, $25/mo Pro, no self-host) is the fallback. Hocuspocus v4 needs a long-running server. PartyKit hosted and Y-Sweet/Jamsocket are shut down. Zero, Electric, Convex, Instant, Jazz replace Yjs and are overkill |
| Editor | **Short fields: plain strings in a `Y.Map`, not `Y.Text`.** Show which field each person is in rather than in-field cursors. Use `y-textarea` or `y-codemirror.next` only for long fields |
| Reorder | `Y.Array` has no move. Use **fractional index keys** (sort by `index`; reorder = set one key) with dnd-kit |
| Persistence | `Y.mergeUpdates` → bytea is standard. Add periodic compaction (load, re-encode) and a snapshot table. Serialize concurrent merges with `SELECT … FOR UPDATE` or an advisory lock |

Recommendation: write a thin provider of about 200 lines over Supabase broadcast instead of depending on either package; keep Liveblocks as the fallback.

## R3. Backend and run engine

| Topic | Finding |
|---|---|
| Live updates to browsers | Supabase now recommends **broadcast from the database** (`realtime.broadcast_changes()` triggers on private channels, RLS on `realtime.messages`) over `postgres_changes`, which is single-threaded and does an RLS check per subscriber |
| Pricing | $2.50 per million messages, $10 per 1k peak connections. Pro includes 5M messages and 500 connections |
| Cron and queues | Keep `mark_stalled` as pure SQL with `cron.schedule`. Keep the `SKIP LOCKED` step table; pgmq adds nothing for us |
| Polling cost | Vercel Fluid compute allows up to 300s per function on all plans. 100 devices holding 45s polls ≈ ~$115/mo on Pro *(agent estimate)*. Subscribing devices to Realtime would cost nothing on Vercel and dispatch instantly |
| Device auth | Model pairing on **RFC 8628** (device code + polling with `authorization_pending`/`slow_down`), like the GitHub and Vercel CLIs. Supabase Auth doesn't support the device grant, so custom tables are right. Store the token in the OS keychain (keytar or `@napi-rs/keyring`), falling back to a 0600 file |
| Rate limiting | Vercel WAF limits by IP, not by device token. Use a **Postgres token bucket** inside the auth function |
| Alternatives | Inngest, Trigger.dev, Convex, Hatchet, Restate, DBOS: none worth adding. Stay on Postgres functions |
| Tests | `supabase/setup-cli` + `supabase start` + `supabase test db` in CI. Poll `pg_isready`. Test RLS as `authenticated` with JWT claims, because superuser bypasses RLS |

## R4. GitHub App and repo sync

| Topic | Finding |
|---|---|
| Libraries | `@octokit/app` + `@octokit/webhooks`, not Probot. In route handlers: `await req.text()` then `verifyAndReceive` with the raw body |
| Commits | Contents API = one file per commit (fine now). **GraphQL `createCommitOnBranch`**: multi-file, verified by GitHub, and `expectedHeadOid` gives built-in conflict detection |
| Verified commits | Installation-token commits show "Verified" only if you don't set a custom author. Keep the bot author plus a `Co-authored-by:` trailer |
| Rate limits | At least 5,000 requests/hr per installation, plus secondary limits on writes. Serialize commits per branch |
| Own pushes | Ignore by `sender.login === '<app-slug>[bot]'` first, sha second |
| Branch protection | Rulesets can block app commits. Detect the error and show "add the app to the bypass list" |
| Onboarding security | `installation_id` in the setup redirect can be spoofed. **Verify it with the user's token** (`GET /user/installations`); a `state` param alone isn't enough |
| Prior art | Decap and TinaCMS: concurrent editors silently overwrote each other. Our sha check plus conflict prompt is better |
| Forks later | `POST /repos/{o}/{r}/merge-upstream`; `json-merge3` does 3-way JSON merges keyed by step id |

## R5. Phone approvals

| Topic | Finding |
|---|---|
| iOS Web Push | Only for Home Screen web apps; needs a user gesture. **No action buttons on iOS** (Android only) |
| Silent push trap | Every push must show a notification. On the third silent push, WebKit permanently revokes the subscription |
| Reliability | Subscriptions sometimes die after iOS updates. Delete subscriptions on 404/403/410, add a "send test notification" button |
| Library | Raw `web-push` is enough. FCM, OneSignal and Pusher aren't worth it now; Knock or Novu later for escalation across channels |
| Alternatives | **Telegram bot** (real one-tap buttons, free, under 2s); Discord buttons; ntfy (action buttons, but an extra app); Pushover (no real approve). **Sendblue iMessage is not viable**: $100/mo per line, groups gated, no links until the contact replies, no buttons |
| Security | The approval page requires login (the id is a lookup, not a password). Single use, about 5 min expiry, tied to user and step. Passkey/Face ID confirm for "approve the rest of this run" and risky steps. Verify Telegram, Discord and Slack signatures |

## R6. Prior art and name

| Rank | Product | Overlap | Gap vs us |
|---|---|---|---|
| 1 | **Multipeer** (multipeer.sh) | Multiplayer canvas for Claude Code and Codex on each person's own machine; shared terminals; approvals | Freeform canvas, no ordered steps or step routing, no repo-saved workflows, Mac only, no phone approvals |
| 2 | **Poly** (usepoly.co) | Multiplayer rooms, approval cards anyone can tap, git behind each room | One shared agent in **their hosted sandboxes** (they pay for AI); no routing to members' devices |
| 3 | **openhuddle** (npm) | Claude Code plugin; teammates' Claude, Codex and Cursor share a prompt and task board | Brainstorm and review, not routed steps; small; and a name collision |
| 4 | Zed Delta | Plugin to share a session and worktree | Pairwise, no workflow, no routing |
| 5 | Krea, Picsart Flow multiplayer | Multiplayer node canvases | Media, not agents |

Threats: Anthropic ("multiplayer… not yet"); OpenAI DevDay talk "From Single Player to Multiplayer with Codex" (shared Spaces, team automations). Nobody does **ordered steps routed to members' own devices, repo-saved forkable workflows, and owner approvals from the phone**.

Name: rename. The agent suggested crewstep, crewline, relayhq, relayflows, pairline, workline (unchecked). From our own npm checks: `relay-ai`, `galley-ai`, `lantern-ai`, `cadence-ai` are free.

---

## Changes to make in the plan

| Plan doc / chunk | Change | From |
|---|---|---|
| decisions D-01 | Don't use "huddle". Done: renamed to relay, npm `relay-ai` | R6 |
| 04_plugin, S1, C5 | Keep long-poll `get_next_step` but **keep each wait under 2 minutes** (45–90s). Add the `claude/channel` capability to the same MCP server for instant push when the user starts with `--channels`. Add `"timeout"` in `.mcp.json`, `version` in `plugin.json`, a pinned npx version, an endpoint disclosure in the README, and a `doctor` command. Plan for directory submission | R1 |
| 04_plugin, skills | Skill must handle permission prompts: recommend allowlists; relay prompts through channels | R1 |
| 05_server, C2, C8 | Browser live updates: `realtime.broadcast_changes()` triggers on private `room:<id>` channels instead of `postgres_changes` | R3 |
| 05_server, C4 | Pairing modeled on RFC 8628 (`authorization_pending`, `slow_down`). Token in the OS keychain with a 0600 file fallback | R3 |
| 05_server, C6 | Per-device rate limit as a Postgres token bucket in the auth function. **Open question:** devices on Supabase Realtime need a Supabase JWT per device (mint one from the device token, or use third-party JWT). Decide in S1 whether to do it now or keep polling | R3, R1 |
| 06_web, C7 | Short fields as `Y.Map` strings, not `Y.Text`. Fractional index reorder with dnd-kit. Our own small provider over broadcast. Throttle cursor updates. Lock rows for concurrent merges. Compaction plus snapshots | R2 |
| S3 | Measure cursor message rate at 12 users on our plan; test concurrent persist POSTs with locking | R2 |
| 07_repo_sync, S4, C10 | Evaluate `createCommitOnBranch`. Verify `installation_id` with the user's token. Ignore own pushes by `sender.login`. Error types: 409 retry → conflict prompt; ruleset 403 → bypass checklist; secondary rate limit → back off | R4 |
| 06_web screen 12, S5, C9 | No in-notification buttons on iOS. Always show a notification. Delete dead subscriptions; add a test notification. Login-required approval page, single use, 5 min expiry; passkey for "approve the rest" and risky steps. **Add a Telegram bot** as the first extra channel. Drop Sendblue for approvals | R5 |
| 10_later | Spectr native app for real iOS buttons and live screen; Knock or Novu for multi-channel; forks via `merge-upstream` + `json-merge3` | R4, R5 |
