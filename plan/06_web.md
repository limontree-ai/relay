# 06 Web app

Next.js on Vercel, in `apps/web`. Uses the limontree design rules unless the founders brand it separately (decisions.md D-02): white page, black text and grays, square corners, Instrument Serif headings, Inter body, three bouncing lemons for loading.

## Screens

| # | Path | Screen | Stories |
|---|---|---|---|
| 1 | `/` | Sign in with GitHub. One line on what it is | US-01 |
| 2 | `/rooms` | My rooms, New room | US-02 |
| 3 | `/rooms/new` | Name, then Connect a repo (installs the GitHub App, then pick repo and branch) | US-02 |
| 4 | `/r/:slug` | Room home: workflows list, people and devices panel, recent runs | US-02, US-05 |
| 5 | `/r/:slug/w/:wf` | Workflow editor | US-05, US-06 |
| 6 | `/r/:slug/runs/:run` | Run view | US-08, US-10 |
| 7 | `/r/:slug/w/:wf/history` | Versions with their runs | US-11 |
| 8 | `/r/:slug/settings` | Name, visibility, invite link, members, repo | US-03 |
| 9 | `/join/:code` | Accept invite | US-03 |
| 10 | `/pair` | Enter or confirm a pairing code, name the device | US-04 |
| 11 | `/devices` | My devices: rename, revoke, per room on/off switch, capabilities, last seen | US-04, US-12 |
| 12 | `/a/:approval` | Approval page, phone first | US-09 |
| 13 | `/setup` | Install steps for the plugin with copy buttons. Turn on phone notifications | US-04 |

No other screens in the MVP.

## 5. Workflow editor

Layout: header (name, Save version, Run, presence avatars, saved state), a vertical step list, and a side panel for the selected step.

Each step card shows: order, action (multi line text), role and the device it is bound to, needs, expected result, reversible, plus validation problems under the card. Reorder by drag or up and down buttons. Add step below. Delete step.

Workflow fields above the list: name, purpose, description, never automate (list).

"Runs on" control per step: a dropdown of devices of room members that are switched on for this room. It shows each device's platform and whether it is online. Choosing one writes `role_bindings` for the step's role. If other steps share the role: "Also changes steps 2 and 4." Devices that cannot do the step's `needs` are shown greyed with the reason ("Screen steps need a Mac with computer use").

Saved state, in the header:
- "Saving…" while Yjs updates are being persisted
- "Saved. Changes not in the repo yet" when `dirty`
- "In the repo at 3f9c1e2" when clean

States: loading, empty workflow ("Add the first step"), read only (viewers and public visitors), repo changed (banner, see 07_repo_sync.md), offline (Yjs keeps edits locally and syncs on reconnect).

### Live editing model

- One Yjs document per workflow: a `Y.Map` for top fields and a `Y.Map` of steps keyed by step id. Each step is a `Y.Map` with a fractional `index` string; order is "sort by index". Reordering sets one `index`, because `Y.Array` has no move and delete plus insert loses edits
- Short fields (name, role, expected result, enums) are plain strings in the `Y.Map`. Only `action` and `description` use `Y.Text`, bound with `y-textarea` for remote cursors. Presence shows which field each person is in
- Transport: our own small provider over Supabase Realtime broadcast on `wf:<workflow_id>`. Awareness (cursor, selected step, color) on the same channel, throttled to 10 updates a second
- Load: fetch `ydoc` from the database, apply, then subscribe
- Persist: every client sends its updates to `POST /api/workflows/:id/ydoc`, debounced 1 second. The server merges inside one transaction with `SELECT ... FOR UPDATE` on the workflow row, so concurrent saves never lose an update. Every 200 updates it compacts: load into a `Y.Doc`, re-encode, store
- To JSON: `toWorkflowJson(ydoc)` in `packages/format`. Used by the server for `doc`, save, and run
- Presence shows who is in the workflow and which step they have selected. A colored bar marks a step someone else is in. Text cursors show inside fields

## 6. Run view

- Header: workflow name, version (short sha with link to GitHub), started by, note, run status, Stop button
- One row per step: order, action (first line), device, status chip, time
  - Status text: Waiting, Waiting for Maya's Claude, Asking Maya, Running, Done, Failed, Stalled, Skipped, Stopped, Not run
- Expanding a row shows the plan Claude wrote, the live feed of status lines and notes, the summary and outputs
- Note box under the running step: "Send a note to Claude". Delivered on its next status call
- Stalled steps show Retry and Skip
- After the run: "Saved to the repo" with a link to the run file

## 7. History

A table, newest first: commit sha, message, author, date, number of runs, succeeded/failed, and a link to the GitHub diff from the previous version. Clicking a version shows its runs. Comparing two versions side by side is later (10_later.md).

## 12. Approval page

Built for a phone. Opened from the push or from the room.

- Device name and run starter: "Sam wants to run a step on Maya's MacBook"
- Workflow name, step order and the full step text
- "Claude's plan" with the plan text
- Badges: needs (Screen, Browser, Shell), and "Cannot be undone" if `reversible` is `no` or `unsure`
- Buttons: Approve, Approve the rest of this run, Deny
- After a decision: the result and a link to the run view
- Only the device owner sees buttons. Others see the waiting state
- The page needs a signed in session. The approval id finds the approval; it is not a password. Each approval is single use and expires after 5 minutes
- "Approve the rest of this run" and steps marked "Cannot be undone" ask for a passkey (Face ID or Touch ID) before they take effect

## Notifications

- `/setup` asks to turn on notifications. On iPhone it first explains Add to Home Screen, which Web Push needs. A "Send a test notification" button proves it works
- Pushes: approval needed, a step is waiting for your Claude, your step stalled
- iOS shows no buttons inside a notification, so every push opens a page. Android also gets Approve and Deny actions in the notification as a bonus
- Every push must show a notification. iOS revokes a subscription after a few silent pushes
- A push that fails with 404, 410, 403 or 400 deletes that subscription
- Each push opens the right page

## Tests

- Vitest for `toWorkflowJson`, the editor's binding logic and status text
- Playwright: two browser contexts edit the same workflow and both see each other's text; one full run with a fake device (a test script that plays the MCP side against the device API)
