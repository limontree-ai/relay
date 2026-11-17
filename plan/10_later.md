# 10 Later

Everything out of the MVP, roughly in order. Each item has the signal that moves it in. Nothing here gets code until its trigger fires.

| # | Item | Shape | Trigger |
|---|---|---|---|
| L-01 | Forks linked to the original | "Fork" copies a workflow into another room's repo and writes `upstream: { repo, path, commit }` into workflow.json (tandem/2). "Updates available" compares upstream changes per step id. For each step: keep mine, take theirs, or edit both. Three way merge on the step list using the stable ids | Fork pain confirmed in validation (superpowers authors, interviews), or 3 rooms ask for it |
| L-02 | Public library | Browse public workflows, sorted by runs and success rate | 50 public workflows exist |
| L-03 | Group chat channel | Discord bot first (free, groups are native), then iMessage through Sendblue if group threads work. The channel only relays: "run demo-day" creates a run; status and approval links are posted back. No model calls: commands are parsed, not understood | 20 weekly active rooms, and group thread support confirmed |
| L-04 | Approval policies | Per device: approve each step, approve per run, or auto approve steps that are reversible and need only shell or none | Approval taps per run are the top complaint |
| L-05 | Comments and suggestions on steps | Pinned comments on a step, resolve. Suggest mode later | Asked for in dogfood |
| L-06 | Compare versions | Side by side step diff with success rate per version | 10 workflows with runs on 3 or more versions |
| L-07 | Resume a failed run | Retry a failed step inside the same run | Users rerun often after one step fails |
| L-08 | Branching and parallel steps | Use trace `decisions` (after_step, options, otherwise). Parallel steps on different devices | Real workflows need it and stay under 30 steps |
| L-09 | Files between steps | Small artifacts through Supabase Storage with expiry | Outputs as links are not enough |
| L-10 | Other agents | Codex, Gemini CLI, Cursor through the same MCP server plus standalone skills. The server does not change | 3 or more requests per week |
| L-11 | Pull request mode | Save opens a pull request instead of committing to the branch | Founder teams with branch protection |
| L-12 | Private rooms and teams paid plan | Billing with Stripe. Free: public rooms; paid: private rooms, more members | After the dogfood event, see decisions.md D-09 |
| L-13 | Hosted always on runners | Mac VM or cloud browser that runs steps while laptops are closed. Paid by the user. This is the only place model costs could appear, and they are passed through | Paying teams ask for it |
| L-14 | Evals and "best fork" | Score versions and forks by run success and checks | L-01 and L-06 in use |
| L-15 | Export to SKILL.md and limontree trace | Generator from tandem/1 to SKILL.md and to a full trace | Users want to use a workflow alone in Claude Code |
| L-16 | Native phone app | Reuse the Spectr iPhone app for approvals and live screen | Web Push proves unreliable |
| L-17 | Live screen view | LiveKit stream of the device screen during screen steps, owner opt in per step | Asked for in dogfood |
