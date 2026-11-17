# relay status

Ledger of what is done, what is unverified and what is blocked. Update it in the same pull request that changes the answer.

## Done

| Item | Where |
|---|---|
| Plan docs, task split for Sweeya and Colby, research summary | `plan/` |
| Name decided: relay, npm `relay-ai`. Repo renamed from temp to relay | `plan/decisions.md` D-01, D-02 |
| Tech assets and short readme | `assets/`, `README.md` |
| Engineering rules: contributing guide, ai tool rules, pr template, codeowners, dependabot, secret scan | `CONTRIBUTING.md`, `CLAUDE.md`, `.github/` |
| Project setup and ci: workspaces, lint, typecheck, tests, build, no anthropic key check | root config, `.github/workflows/ci.yml` |
| `packages/format`: schemas, validate, redact, stringify, yjs conversion | `packages/format` |
| `packages/data`: data api, mock run engine, fake device, status text | `packages/data` |
| `packages/editor-core`: headless live editing | `packages/editor-core` |
| Spike harnesses for S3 (yjs over broadcast) and S5 (web push) | `spikes/s3`, `spikes/s5` |

## Not verified

| Item | Why |
|---|---|
| S3 on real Supabase | The harness only ran against a local fake. Local verdict was CHANGE on message rate at 12 clients |
| S5 on a real iPhone | No real device test yet |
| Playwright smoke test | Browsers not installed |
| Supabase `config.toml` | Written by hand, not checked with the CLI |

## Open items and blockers

| Item | Owner |
|---|---|
| Run S3 on a real Supabase project and S5 on a real iPhone | Sweeya |
| Screens (editor, run view, approvals, setup) wait on the design system | Sweeya |
| Chunks C2 (database), C4 (pairing, cli), C6 (device api, fake device script), C5 (mcp server, plugin), push sending, github routes not started | Colby |
| dependabot npm job fails: it cannot find a very new package version. Check after the version is older | Colby |
