# Decisions

Every default these docs assume. Items marked **DECIDE** wait on Sweeya or Natasha; the plan uses the recommended default until then. Answers to the open questions in the research brief (section 13) are D-02 to D-09.

| # | Topic | Status | Default used in the plan | Why | Owner |
|---|---|---|---|---|---|
| D-01 | Product name | **DECIDE** | Placeholder `tandem`, npm `@ORG/tandem` | Needed before C5 publishes the plugin. Check npm and GitHub names are free | Natasha |
| D-02 | limontree product, Spectr product, or a new company and repo | **DECIDE** | New repo under the limontree GitHub org, limontree design rules, separate product name | Reuses the brand, trace format and team, while keeping limontree's enterprise pitch clean. limontree's context.md says limontree sells only to businesses; this product starts with students, which conflicts with that | Sweeya and Natasha |
| D-03 | File format | Recommended | tandem/1, a light format using trace field names (03_workflow_format.md) | The full trace needs owner_role, exceptions, output and approval fields a student group will not fill in. Same names keep a converter trivial (L-15) | Sweeya |
| D-04 | Node canvas or step list | Recommended | Step list | Steps run in order in the MVP, so a canvas adds layout code and no capability. A canvas becomes useful with L-08 | Natasha |
| D-05 | Backend language | Recommended | TypeScript only. No FastAPI service | The server only coordinates. One language shares types with the MCP server | Sweeya |
| D-06 | Group chat without our tokens | Recommended | Relay only (L-03). Commands are parsed, not understood by a model. Not in the MVP | Keeps AI cost at zero. Users' own API keys add key storage risk for little gain | Natasha |
| D-07 | Codex, Gemini CLI and Cursor on day one | Recommended | No. Claude Code only. The MCP server is generic so L-10 is cheap | Each agent needs its own test matrix. S1 has to pass on one first | Sweeya |
| D-08 | What a device owner approves | Recommended | Every step, with "approve the rest of this run". Policies later (L-04) | Safest start. Measure taps per run in dogfood | Sweeya |
| D-09 | When a free public room becomes paid | **DECIDE** | Everything free during the MVP. Paid starts with private rooms (L-12) after the dogfood event | Private rooms are the clearest line: students and open groups stay free, founders pay | Natasha |
| D-10 | Default room visibility | Recommended | Private | Run results can hold sensitive text. Public is a choice | Sweeya |
| D-11 | Commits | Recommended | Straight to the room's branch, by the GitHub App, with the member as co-author. Pull request mode later (L-11) | Fewest moving parts | Sweeya |
| D-12 | Windows and Linux | Recommended | Supported for shell, browser and none steps. Screen steps only on macOS | Matches Claude Code's computer use limits | Sweeya |
| D-13 | Live screen view | Recommended | Not in the MVP (L-17). Status lines instead | LiveKit is real cost and real privacy work. Status lines prove the loop first | Natasha |
| D-14 | Mac VM and cloud runners | Recommended | Dropped from the no tokens version. Possible paid hosted option (L-13) | They cannot run on the user's subscription | Natasha |
| D-15 | Academic integrity | Decided (brief) | Never shown or marketed as doing assignments. Examples are team logistics, demos, submissions, club operations | Risk named in the brief | Natasha |
| D-16 | Sendblue group threads | Open | Checked before L-03 is designed | Named as a risk in the brief | Natasha |

## Assumptions to confirm in spikes

| Assumption | Spike |
|---|---|
| An interactive Claude Code session stays in a tool loop for 10 or more steps | S1 |
| Tool calls of 45 seconds do not time out | S1 |
| Claude Code's channels feature is not needed (or is a better trigger than polling) | S1 |
| Computer use performs screen steps that come from a tool result | S2 |
| Supabase Realtime broadcast is enough for Yjs at our sizes | S3 |
| Web Push reaches iPhones fast enough for approvals | S5 |
| `claude plugin marketplace add` and `claude plugin install` work as documented | S6 |
