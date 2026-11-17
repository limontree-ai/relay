# Prompt: planning docs for live multiplayer agent workflows

Use this prompt as written. It is the refined version of the founders' request.

---

You are a staff engineer and product lead. Write the full planning set for a new product. The research brief is "live multiplayer agent workflows, stored in a repo, run on your own Claude", prepared for Sweeya Ghanta and Colby on November 16, 2026. It builds on limontree (trace format, rules, versions) and Spectr (computer use, device routing, approvals).

## What to produce

A `plan/` folder of short markdown docs. Together they must answer every question an engineer needs answered to build the MVP without coming back to ask, and lay out what comes after.

1. `README.md`: index, reading order, one paragraph summary
2. `01_product.md`: problem, users, goals, non goals, user stories with acceptance criteria, MVP scope, success metrics
3. `02_architecture.md`: components, data flow, the no token model, tech choices with the reason for each, what we deliberately do not build
4. `03_workflow_format.md`: the file format, repo layout, run record format, validation, examples
5. `04_plugin.md`: Claude Code plugin, marketplace file, skills (full text), MCP tools (exact inputs and outputs), device pairing
6. `05_server.md`: database tables, row level security, API routes, run engine state machine, routing, realtime channels
7. `06_web.md`: every screen, its states, live editing model, mobile approval page
8. `07_repo_sync.md`: GitHub App, what is committed when, inbound changes, forks (later)
9. `08_safety.md`: permissions, approvals, threat model, what the agent must never do
10. `09_build_plan.md`: spikes first, then build chunks in order, each with scope, files, acceptance tests and a build prompt
11. `10_later.md`: everything out of the MVP, in order, with the trigger that moves it in
12. `decisions.md`: every decision taken with its default, and every open question marked DECIDE with a recommendation

## How to plan

- Plan like a professional who has shipped this kind of product. Kill risk first: the riskiest assumptions get a 1 to 3 day spike before any product code
- Avoid over engineering and code bloat. Prefer one deploy, one database, a few packages. Every component must justify itself against "could Supabase or Next.js do this already"
- Reuse what exists: limontree trace field names, Supabase with row level security, Next.js on Vercel, Spectr safety rules
- We pay for no AI usage. No model calls on our server in the MVP. Each member's own Claude Code does the work
- Design around the real limits: computer use is macOS and Pro, Max or Ultra only; it needs an open interactive session; plugins run code on people's machines
- Be concrete: table columns, JSON fields, tool schemas, state names, file paths, limits and timeouts
- When a fact about a third party is not certain, say so and add it to a spike
- Follow limontree house rules: write limontree in lowercase, plain English, no attribution lines

## Done means

An engineer can start chunk 1 tomorrow, every MVP feature traces to a user story, every open question has an owner and a recommended default, and nothing in the MVP exists only "for later".
