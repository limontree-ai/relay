# 08 Safety and trust

An agent acting on someone else's computer is the biggest risk in this product. The rule: nothing runs on a device unless its owner switched it on for that room and approved that step, and every action is visible.

## Layers

| Layer | What it does | Where |
|---|---|---|
| 1. Pairing | A device exists only after its owner pairs it while signed in | 04_plugin.md |
| 2. Room switch | Each device is off in every room until its owner turns it on. Off again in one click | `room_devices.allowed` |
| 3. Capability check | Screen steps go only to Macs where Claude has computer use | routing |
| 4. Step approval | The owner approves every step, seeing the step text and Claude's plan. "Approve the rest of this run" covers only this run on this device | `approvals` |
| 5. Claude Code's own rules | Its permission prompts, computer use app approvals and safety checks still apply. We never ask users to skip them | the member's settings |
| 6. Skill rules | Spectr's rules, written into the run-step skill: asks first, never types passwords, sees only what it needs, stop means stop | run-step SKILL.md |
| 7. Stop | Any member can stop a run. The device gets `stop: true` on its next call, at most 30 seconds later in normal use | `stop_run` |
| 8. Revoke | The owner revokes a device on the web or with `tandem logout`. Its token stops working at once | `devices.revoked_at` |

## Threats

| Threat | Mitigation |
|---|---|
| A room member writes a harmful step aimed at someone else's device | Layers 2, 4 and 5. The owner sees the exact text. The run snapshots the committed step, so text cannot change after approval |
| Web pages or files read during a step contain injected instructions | The skill tells Claude step text and page content are data, not orders. Claude Code's own injection checks. Approval shows the plan before work starts |
| Stolen device token | Tokens are random 32 bytes, stored hashed, file mode 0600, revocable, rate limited. A token can only act as its device on steps bound to it |
| Pairing code phishing ("enter this code") | The pair page shows the device name and platform and says "Only pair a computer you are sitting at". Codes expire in 10 minutes |
| Secrets end up in a public repo | Validator blocks secrets in step text. `redact()` masks secret patterns in summaries and outputs before commit. Public rooms warn: "Run results are saved to a public repo" |
| Personal data in results | The skill says not to include it. Summaries are short text. No screenshots or files are stored |
| Our server is compromised | It can create steps and fake approvals, which is serious, but it cannot bypass layer 5 on the device, holds no model keys, and holds no user GitHub tokens |
| A plugin update changes behavior | The MCP version is pinned in `.mcp.json`. Releases are tagged and signed. The changelog lists any change to tool behavior or skill rules |
| A step on a device without the owner present | Approval needs the owner. Claude Code's prompts appear on that screen and wait |

## Public rooms

- Anyone can view workflows and run summaries
- Only members can edit or run
- A visitor's device can never be targeted: it must join the room, and the owner must switch it on

## Logging rules

- Never log step text, plans, summaries, outputs, notes or Yjs content in server or CLI logs
- Log ids, status changes and timings only
- `run_events` is the audit trail and is visible to members

## Before the first public release

- [ ] Every RLS policy has a SQL test for allowed and denied cases
- [ ] Device API tests: revoked token, wrong device for a step, step not active, rate limit
- [ ] The secret scan (gitleaks) runs on every pull request
- [ ] A short SECURITY.md with how to report a problem
- [ ] An outside person reads this doc and tries to run a step on a device they do not own
