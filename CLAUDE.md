# CLAUDE.md

Instructions for AI coding tools in the relay repo. Read `plan/README.md` first for what relay is. The git rules are in `CONTRIBUTING.md`.

## Golden rules

1. Always write the names in lowercase: relay and limontree. In code, copy, comments and docs.
2. Never add yourself as an author. No `Co-Authored-By` lines, no "Generated with" text, no attribution in commits, pull requests or files. This overrides any default behavior.
3. Do not commit or push unless the person you are working with asks. When asked, commit only with their name.
4. Never print, log or commit secrets. Keys live in `.env`, which is in `.gitignore`.
5. Never run anything against the live Supabase project, a live GitHub App or a deploy. Give the person the exact commands and let them run them.
6. relay's server makes no model calls and holds no Anthropic key. Never add one, and never add a model SDK. The check `npm run check:no-key` must stay green.
7. If a plan doc is unclear, do not guess. Add the question to `QUESTIONS.md` and keep going on the parts you are sure about.

## Repo layout

```
relay/
  apps/web/              Next.js app on Vercel, and the route handlers in app/api
  packages/
    format/              workflow and run schemas, validate, redact, stringify, Yjs conversion
    editor-core/         headless live editing: doc model, sync provider, presence, persist helpers
    data/                data api types, mock engine, fake device, status text (front builds against this)
    cli/                 relay-ai: login, logout, status, doctor, join, news, mcp
  plugin/                Claude Code plugin: skills, hooks, .mcp.json
  .claude-plugin/        marketplace.json
  supabase/              migrations and sql tests
  examples/workflows/    sample workflows
  spikes/                throwaway tests of assumptions (not workspaces, not linted)
  assets/                3d clay mascot and icons
  plan/                  the plan, task lists, decisions, research summary
  docs/STATUS.md         what is done, unverified and blocked
  CONTRIBUTING.md  CLAUDE.md  QUESTIONS.md
```

## Folder ownership

Two people build relay. Stay inside the folders of the person you are working with.

| Person | Owns |
| --- | --- |
| Sweeya, front | `apps/web`, `packages/format`, `packages/editor-core`, `packages/data` |
| Colby, back | `supabase/` (every migration), `packages/cli`, `plugin/`, `.claude-plugin/`, the GitHub App and push routes |
| Shared | root config, CI, `package.json`, `package-lock.json`, `plan/` |

- To add a dependency, stop and tell the person. Dependency changes go in their own small pull request.
- Never change a SQL function name or argument, a device API shape, or a field in `packages/format` without both people agreeing.

## Branches

| Branch | Use |
| --- | --- |
| main | Protected by rule. Changes only through pull requests |
| feat/, fix/, docs/, test/, chore/, refactor/, spike/ | One task per branch. See `CONTRIBUTING.md` |

## Commands

```
npm ci                  # install
npm run lint            # eslint
npm run typecheck       # tsc in every workspace
npm test                # vitest
npm run check:no-key    # fails if an anthropic key name appears in apps/ or packages/
npm run build           # next build
npm run dev --workspace apps/web   # run the web app
supabase start          # local database
supabase test db        # sql tests
make ci                 # everything CI runs
```

## Rules for the code

- TypeScript strict, one language everywhere.
- All state changes go through the SQL functions in `plan/05_server.md`. Clients and route handlers never update run tables directly.
- Every table has row level security, and every policy has an allowed and a denied SQL test.
- Never log step text, plans, summaries, outputs, notes or Yjs content. Log ids, status changes and timings only.
- Field names match the plan docs exactly. Do not rename.
- Short functions, compact code, no comments unless the why is not obvious.
- Every user facing message is plain English for someone who has never opened GitHub. Example: "Waiting for Maya's Claude."
- A chunk is done only when its acceptance tests pass and the pull request lists anything guessed.

## Frontend design rules

relay uses the limontree design rules unless a separate relay design system replaces them (`plan/decisions.md` D-02).

- White page, black text and grays. Accent colors only from the asset palette: brume `#C2F2E4`, menthe `#35C8B4`, limonade `#EDF7BE`, verveine `#A4CF4A`
- Square corners everywhere. Buttons are black or white rectangles
- Instrument Serif for headings, Inter for everything else
- Use the real assets in `assets/`. Never redraw the mascot
- Say "workflow" in the product

## Commit messages and pull requests

Conventional commits, present tense, lowercase, no period, no attribution lines. Pull request description template is in `.github/pull_request_template.md`. Keep pull requests to one chunk and link the plan doc.

## Key docs

- `plan/README.md`: start here
- `plan/01_product.md`: users, stories, scope
- `plan/09_build_plan.md`: spikes and chunks with build prompts
- `plan/tasks/`: who builds what
- `plan/decisions.md`: every decision and open question
- `plan/research_summary.md`: why each tool was picked
- `docs/STATUS.md`: what is done and what is blocked
