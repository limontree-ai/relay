# Plan: live multiplayer agent workflows

Prepared for Sweeya Ghanta and Natasha Narine. November 16, 2026. Built from the research brief "live multiplayer agent workflows, stored in a repo, run on your own Claude".

## Summary

A group edits one workflow together in the browser. Each step names a role, and the room maps each role to a member's device. When the group hits Run, each step is handed to the Claude Code session on that device, through our Claude Code plugin (two skills and a small local MCP server). The device owner approves the step from their phone, their own Claude does the work on their own plan, and everyone watches the status live. The workflow and every run result are committed to the group's GitHub repo. Our server only coordinates. It makes no model calls.

Name: **relay** (decided, decisions.md D-01). npm package `relay-ai`, Claude Code plugin `relay@relay`, repo `limontree-ai/relay`.

## Reading order

| Doc | Read it if you are |
|---|---|
| [01_product.md](01_product.md) | Anyone. Problem, users, stories, MVP scope, metrics |
| [02_architecture.md](02_architecture.md) | An engineer. The whole system on two pages |
| [03_workflow_format.md](03_workflow_format.md) | Building the format, the plugin or repo sync |
| [04_plugin.md](04_plugin.md) | Building the Claude Code plugin and MCP server |
| [05_server.md](05_server.md) | Building the database, API and run engine |
| [06_web.md](06_web.md) | Building the web app |
| [07_repo_sync.md](07_repo_sync.md) | Building the GitHub side |
| [08_safety.md](08_safety.md) | Anyone. Read before shipping anything that runs on a machine |
| [09_build_plan.md](09_build_plan.md) | Starting work. Spikes, then chunks with build prompts |
| [10_later.md](10_later.md) | Asking "why isn't X in the MVP" |
| [decisions.md](decisions.md) | Deciding. Every default and every open question |
| [research_summary.md](research_summary.md) | Checking why a tool or pattern was picked. Six research reports, Nov 17, 2026 |
| [tasks/](tasks/README.md) | Building with the team. Who builds what (Sweeya front, Colby back), handoffs, order |

## The MVP in one sentence

Two people, two devices, one shared workflow, edited live, run live across both machines with phone approvals, saved to a GitHub repo, with zero model calls on our side.

## Principles

1. Kill the riskiest assumption first. Spikes come before product code (09_build_plan.md)
2. Postgres is the queue, the state machine and the audit log. No extra services
3. One language (TypeScript), one deploy (Vercel), one database (Supabase)
4. The workflow file is plain and forkable. People and devices live in the room, not in the file
5. Nothing on someone's machine runs without that person saying yes
6. If it is only needed "for later", it is not in the MVP code
