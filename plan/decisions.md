# Decisions

Every default these docs assume. Items marked **DECIDE** wait on Sweeya or Colby; the plan uses the recommended default until then. Answers to the open questions in the research brief (section 13) are D-02 to D-09.

| # | Topic | Status | Default used in the plan | Why | Owner |
|---|---|---|---|---|---|
| D-01 | Product name | Decided | **relay**. npm `relay-ai` (plain `relay` is taken), plugin `relay@relay`, repo `limontree-ai/relay` | "huddle" was dropped: `openhuddle` is a Claude Code plugin in the same niche, plus Slack Huddles and Huddle01. `tandem` and `tandem-ai` are taken on npm | Sweeya |
| D-02 | limontree product, Spectr product, or a new company and repo | Decided | Built in `limontree-ai/relay` (this repo, renamed from `temp` on Nov 17), limontree design rules, separate product name (relay) | relay is its own project inside limontree, built by Sweeya and Colby. It reuses the brand and trace format while keeping limontree's enterprise pitch clean. limontree's context.md says limontree sells only to businesses; this product starts with students, which conflicts with that | Sweeya and Colby |
| D-03 | File format | Recommended | relay/1, a light format using trace field names (03_workflow_format.md) | The full trace needs owner_role, exceptions, output and approval fields a student group will not fill in. Same names keep a converter trivial (L-15) | Sweeya |
| D-04 | Node canvas or step list | Recommended | Step list | Steps run in order in the MVP, so a canvas adds layout code and no capability. A canvas becomes useful with L-08 | Sweeya |
| D-05 | Backend language | Recommended | TypeScript only. No FastAPI service | The server only coordinates. One language shares types with the MCP server | Sweeya |
| D-06 | Group chat without our tokens | Recommended | Relay only (L-03). Commands are parsed, not understood by a model. Not in the MVP | Keeps AI cost at zero. Users' own API keys add key storage risk for little gain | Colby |
| D-07 | Codex, Gemini CLI and Cursor on day one | Recommended | Claude Code is the supported path. Others get a beta path from day one: `npx skills add` plus `npx relay-ai join` printing their MCP config. No channels or hooks there. Full support stays L-10 | Each agent needs its own test matrix. S1 has to pass on one first | Sweeya |
| D-08 | What a device owner approves | Recommended | Every step, with "approve the rest of this run". Policies later (L-04) | Safest start. Measure taps per run in dogfood | Sweeya |
| D-09 | When a free public room becomes paid | **DECIDE** | Everything free during the MVP. Paid starts with private rooms (L-12) after the dogfood event | Private rooms are the clearest line: students and open groups stay free, founders pay | Sweeya |
| D-10 | Default room visibility | Recommended | Private | Run results can hold sensitive text. Public is a choice | Sweeya |
| D-11 | Commits | Recommended | Straight to the room's branch, by the GitHub App, with the member as co-author. Pull request mode later (L-11) | Fewest moving parts | Sweeya |
| D-12 | Windows and Linux | Recommended | Supported for shell, browser and none steps. Screen steps only on macOS | Matches Claude Code's computer use limits | Sweeya |
| D-13 | Live screen view | Recommended | Not in the MVP (L-17). Status lines instead | LiveKit is real cost and real privacy work. Status lines prove the loop first | Sweeya |
| D-14 | Mac VM and cloud runners | Recommended | Dropped from the no tokens version. Possible paid hosted option (L-13) | They cannot run on the user's subscription | Colby |
| D-15 | Academic integrity | Decided (brief) | Never shown or marketed as doing assignments. Examples are team logistics, demos, submissions, club operations | Risk named in the brief | Sweeya |
| D-16 | Sendblue group threads | Decided | Not used for approvals or the group chat channel | $100 a month per line, groups gated, no buttons, links blocked until the contact replies (research R5) | Sweeya |
| D-17 | Install path | Recommended | One command inside Claude Code: `/plugin install relay --marketplace limontree-ai/relay`, then `npx relay-ai login`. Two command form for older versions | Borrowed from openhuddle. Fewer steps on /setup | Colby |
| D-18 | Room news in Claude Code | Recommended | `SessionStart` and `UserPromptSubmit` hooks print up to 3 lines of room news (steps waiting, approvals asked, recent edits). Never step text | Borrowed from openhuddle. Tells members a step is waiting even when they are not in the join loop | Colby |
| D-19 | CLI dependencies | Recommended | Only the MCP SDK. Node built-ins for the rest | Borrowed from openhuddle (zero dependencies). Faster `npx`, smaller attack surface | Colby |
| D-20 | Trying it without setup | **DECIDE** | Keep GitHub sign in (one click, needed for approvals and repo sync). Make connecting a repo optional for a room's first runs: run records stay in the database and are committed when a repo is connected | openhuddle needs no accounts. We cannot drop sign in, because approvals need to know who owns a device. An optional repo removes the slowest step from the first 5 minutes | Sweeya |
| D-21 | Push trigger | Recommended | Polling with waits of at most 45 seconds, plus Claude Code channels push when the session uses `--channels` | Channels give instant start on Claude Code; polling works everywhere (research R1) | Colby |
| D-22 | Extra approval channel | Recommended | Web Push only in the MVP; Telegram bot is L-18 | Keeps the MVP small. Telegram is the fastest add if pushes prove unreliable | Sweeya |

## Assumptions to confirm in spikes

| Assumption | Spike |
|---|---|
| An interactive Claude Code session stays in a tool loop for 10 or more steps | S1 |
| Tool calls of 45 seconds do not time out or move to the background (they move after 2 minutes) | S1 |
| Claude Code channels push a step into a session started with `--channels`, and can relay permission prompts | S1 |
| Computer use performs screen steps that come from a tool result | S2 |
| Supabase Realtime broadcast is enough for Yjs at our sizes | S3 |
| Web Push reaches iPhones fast enough for approvals | S5 |
| `claude plugin marketplace add` and `claude plugin install` work as documented | S6 |
