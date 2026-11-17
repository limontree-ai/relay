# 01 Product

## Problem

- Agent workflows are built alone, in one person's Claude Code, then pasted into chat or a repo
- Shared workflows drift. obra/superpowers (318.7k stars, 28,397 forks) issues #702, #1007, #2530, #2509 and #846 show people cannot keep their own version, layer preferences or point to better forks
- Group work spans machines. Each person has different files, logins and apps. An agent today acts on one machine at a time
- Existing multiplayer tools target coding teams in desktop apps

## Who it is for

| Stage | User | Example job |
|---|---|---|
| First | CS students in a group project, hackathon team or club (progsu, EmoryHacks) | "Pull the latest repo on Jared's Mac, run tests, record the demo, upload to Devpost" |
| Next | Founding teams of 2 to 5 | "Pull Stripe metrics in Ana's browser, draft the investor update in Notion, Ben approves, send" |

We never position it as a way to do assignments.

## Goals for the MVP

1. Prove that a step handed to someone's Claude Code session through MCP runs reliably
2. Prove that a small group will build and run a workflow together live
3. Prove the no token model: we pay for no AI usage

## Non goals for the MVP

Forks with upstream sync, evals, group chat channels (iMessage, calls, Discord), Mac VM and cloud runners, Windows and Linux computer use, Codex, Gemini CLI and Cursor, branching and parallel steps, comments, file transfer between devices, billing. Each is placed in 10_later.md.

## Words

| Word | Meaning |
|---|---|
| Room | A group's shared space. Has members, devices, one connected repo and its workflows |
| Workflow | An ordered list of steps saved as a file in the repo |
| Step | One instruction for Claude, with a role, what it needs and what good looks like |
| Role | A named slot in a workflow, such as "designer" or "jared-mac". The room maps each role to a device |
| Device | One machine where a member has paired the plugin |
| Run | One execution of a workflow, pinned to one commit |
| Approval | The device owner saying yes before a step runs on their device |

## User stories and acceptance criteria

Each MVP feature traces to one of these. IDs are used in 09_build_plan.md.

**US-01 Sign in.** As a student, I sign in with GitHub.
- Sign in uses GitHub only. A profile is created with my GitHub login

**US-02 Create a room and connect a repo.** As a group lead, I create a room and connect a GitHub repo.
- I name the room, install the GitHub App on one repo and pick it
- The room shows the repo name and branch. Workflows already in `workflows/` in the repo are loaded

**US-03 Invite.** As a group lead, I share an invite link. Anyone who opens it and signs in becomes an editor.
- The link can be reset, which makes the old one stop working

**US-04 Install and pair.** As a member, I install the plugin with one command and pair my device in under 5 minutes.
- Inside Claude Code: `/plugin install relay --marketplace limontree-ai/relay` (older versions: `claude plugin marketplace add limontree-ai/relay` then `claude plugin install relay@relay`)
- Codex, Cursor and Gemini CLI (beta): `npx skills add limontree-ai/relay` and `npx relay-ai join <invite-link>`
- `npx relay-ai login` shows a code. I enter it on the web, name the device, and it appears under my devices
- My device is not allowed in any room until I switch it on for that room

**US-05 Edit together live.** As a member, I edit a workflow while others edit it, and see their changes and cursors as they type.
- Two people editing different steps never lose work. Two people typing in the same field merge character by character
- I see who is in the room and which step each person is in

**US-06 Assign a step to a device.** As a member, I pick which device runs each step.
- Picking a device for a step sets the device for that step's role in this room. If other steps share the role, the screen says so
- A step that needs the screen can only be given to a macOS device that reported it can use the screen

**US-07 Join from Claude Code.** As a member, I type `/relay:join my-room` in Claude Code and my session starts waiting for steps.
- Claude confirms the room, my device name, and whether the device is allowed
- The room shows my device as "ready"

**US-08 Run.** As a member, I hit Run and everyone sees each step go waiting, approval, running, done.
- The run is pinned to a commit. If the workflow has unsaved changes, Run saves a version first
- A step whose device is not ready shows "Waiting for Maya's Claude" and Maya gets a notification

**US-09 Approve from my phone.** As a device owner, I approve or deny each step that will run on my device, from my phone.
- I see the step text, the run starter, and Claude's short plan for the step
- Buttons: Approve, Approve the rest of this run, Deny
- Nothing runs on my device before I approve

**US-10 Watch and steer.** As a member, I watch a run live, send a note to the running step, or stop the run.
- Notes reach the running step within 30 seconds. Stop reaches it within 30 seconds and the step ends
- A step that stops reporting for 5 minutes shows "Stalled" with Retry and Skip

**US-11 Every run is a version.** As a member, I see each saved version of a workflow with the runs made from it and how they went.
- Each run writes one result file to the repo next to the workflow
- The history list shows commit, author, date, runs and how many succeeded

**US-12 Stay safe.** As a device owner, I can see every action, revoke a device, and trust the plugin to follow the safety rules (08_safety.md).

## MVP scope

| In | Out |
|---|---|
| Web app: rooms, step list editor with live editing, run view, history, devices, approval page | Node canvas |
| Claude Code plugin: 2 skills, MCP server with 5 tools, `login` command | Other agents |
| Linear runs, one step at a time, results passed forward as text | Branching, parallel steps, files between devices |
| GitHub App: commit workflow versions and run results, load pushes from the repo | Forks and upstream sync |
| Web Push to phones, plus the live room page | iMessage, calls, Discord, native iPhone app |
| Approval on every step, with "approve the rest of this run" | Approval policies |

## Success metrics

| Metric | MVP target | How measured |
|---|---|---|
| Install to first finished run | Under 15 minutes for a new pair of users | Timed at the dogfood event |
| Cross device run success | 80% of runs with steps on 2 devices finish without a retry | `runs` and `run_steps` tables |
| Live use | In 50% of rooms, 2 or more people edit at the same time in a week | `edit_log` table: two users saving the same workflow within 5 minutes |
| Repeat use | 30% of rooms run a workflow in a second week | `runs` table |
| Our AI cost | $0 | No model keys on the server |

## Validation (runs in parallel with the build)

1. Interview 10 CS students and 10 founders: "Would you build and run this together live, or do you just want shared, versioned workflows?"
2. Message authors of superpowers #702 and #1007 and the Super Powers Plus fork about the fork problem (feeds 10_later.md L-01)
3. Run one progsu event or hackathon on the MVP. Measure the metrics above
