## What
One or two sentences on what changed.

## Why
The problem, or the plan doc and build chunk this covers (for example C3 in plan/09_build_plan.md).

## How to test
Exact commands or clicks.

## Screenshots
For any web change, desktop and phone.

## Notes
Anything guessed, any `DECIDE` added, any follow up.

## Checklist
- [ ] Tests added or updated, and they pass (`make test`)
- [ ] Lint and typecheck pass (`make lint`)
- [ ] `make build` passes
- [ ] Migrations are included and reviewed by Colby (or: no database changes)
- [ ] Changes to `packages/format` or to SQL function names and arguments are flagged to the other person
- [ ] No secrets, keys or `.env` files in the diff, and no Anthropic key names in `apps/` or `packages/`
- [ ] Title follows conventional commits, for example `feat(web): add run view`
- [ ] One chunk only, with no attribution lines
