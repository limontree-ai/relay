# Contributing to relay

Two people build relay: Sweeya (front) and Colby (back). These are the git and pull request rules, copied from limontree's contributing guide and adapted. Read `plan/README.md` first for what relay is, and `plan/tasks/README.md` for who builds what.

## Branches

- Never push to main. main must always build and run.
- Pull the latest main before you make a branch: `git checkout main`, `git pull`, `git checkout -b feat/run-view`.
- Name every branch with a prefix, lowercase, words joined with hyphens.
- One task per branch. One build chunk (C0 to C11) or spike (S1 to S6) is one branch.
- Keep a branch alive for days, not weeks. Merge main into it every morning.

| Prefix | Use for | Example |
| --- | --- | --- |
| feat/ | Something new | feat/run-view |
| fix/ | A bug | fix/stalled-step-label |
| docs/ | Docs only | docs/plugin-readme |
| test/ | Tests only | test/rls-denied-cases |
| chore/ | Setup, dependencies, config | chore/add-playwright |
| refactor/ | Cleanup with no change in behavior | refactor/data-api |
| spike/ | Throwaway test of an assumption (S1 to S6) | spike/s1-claude-loop |

## Commit messages

Use Conventional Commits: `type(area): what changed`

- Present tense, lowercase, no period at the end.
- First line under 72 characters.
- One logical change per commit.
- Add a body after a blank line if the why is not obvious.
- Commits are authored by the person who wrote them.

| Type | Meaning |
| --- | --- |
| feat | New feature |
| fix | Bug fix |
| docs | Docs only |
| test | Tests only |
| refactor | Cleanup, same behavior |
| chore | Setup, tooling, dependencies |
| ci | Workflows and checks |
| style | Formatting only |

| Area | Covers |
| --- | --- |
| web | `apps/web` |
| format | `packages/format` |
| editor | `packages/editor-core` |
| data | `packages/data` |
| cli | `packages/cli` (the `relay-ai` package and MCP server) |
| plugin | `plugin/` and `.claude-plugin/` |
| db | `supabase/` migrations and tests |
| api | route handlers in `apps/web/app/api` |
| plan | `plan/` |

Examples:

- feat(web): add run view
- fix(format): reject duplicate step orders
- test(db): add denied cases for room_members
- docs(plan): add decision D-23
- chore: add playwright config

## Pull requests

- Push with `git push -u origin <branch>`, then open a pull request into main on GitHub.
- Title uses the same format as a commit. It becomes the squash commit message.
- Aim for under 400 changed lines. Split anything bigger. Lockfiles and fixtures do not count.
- Open a draft pull request early if you want feedback before it is done.
- The description template is in `.github/pull_request_template.md`. Fill in every section.

## Review

- Intended branch protection: a pull request into main, one approving review, and green checks before merge. Nobody pushes to main directly. This is not switched on yet (see `docs/STATUS.md`). Follow it anyway.
- CI must pass before merge. A red check blocks the merge.
  - `node`: lint, typecheck, tests, build and the check that no Anthropic key name appears in `apps/` or `packages/`
  - `sql`: database tests (`supabase test db`) and lint
  - `secret-scan`: gitleaks over the full history
- Every pull request needs one approving review from the other person.
- Review within one day.
- Reviewers check: does it match the plan doc, do tests pass, is anything outside the author's folders changed, is any secret or key in the diff.
- Leave comments as questions or suggestions. Approve when it is good enough to merge, not perfect.

## Checks before pushing

Run these locally. They must pass: `make ci`, or the pieces: `npm run lint`, `npm run typecheck`, `npm test`, `npm run check:no-key`, `npm run build`.

## Merge

- Use Squash and merge only. One pull request becomes one commit on main.
- The author merges after approval.
- Delete the branch after merge.

## Folder ownership

Stay inside your folders. If you need a change somewhere else, ask the owner. Owners are also in `.github/CODEOWNERS`.

| Area | Owner |
| --- | --- |
| `apps/web/`, `packages/format/`, `packages/editor-core/`, `packages/data/` | Sweeya |
| `supabase/` (every migration), `packages/cli/`, `plugin/`, `.claude-plugin/` | Colby |
| Root config, CI, `package.json`, `package-lock.json` | Shared. Change them in their own small pull request |
| `plan/` | Shared. Change a plan doc in the same pull request as the code it affects, or in a `docs/` pull request |

Handoffs (see `plan/tasks/README.md`):

- Sweeya owns the shape of `packages/format`. Colby owns SQL function names and arguments and the device API request and response shapes.
- Change any of those only with a heads up to the other person.

## Secrets

- Never commit keys, tokens, passwords or `.env` files.
- Keep `.env.example` with the variable names and empty values.
- relay's server makes no model calls. No Anthropic key name may appear in `apps/` or `packages/`.
- If a secret gets pushed by mistake, tell the other person right away. Rotate the key first, then remove it from the code.
- Test files that need fake secrets (to test the redactor and validator) must use obviously fake values.

## Do not commit or push on your own (AI tools)

- If an AI tool wrote code, the person who runs it owns the code and the commit.
- Show the changes and let the person review, commit and push. Read every line before you commit.

## No AI attribution

- Never add AI attribution anywhere. No `Co-Authored-By` lines, no "Generated with" text, no tool names as authors in commits, pull request titles or descriptions, code comments or files.
- If a commit or pull request ever includes an AI attribution line, remove it before merging.
  - Last commit: `git commit --amend`, delete the line, save.
  - Pull request: edit the description on GitHub and delete the line.

## Writing rules for anything a user sees

- Write relay and limontree in lowercase.
- Use short plain sentences for someone who has never opened GitHub.
- No dashes or hyphens in sentences, no semicolons.
- Say "workflow", not "skill", unless you mean a `SKILL.md` file.
