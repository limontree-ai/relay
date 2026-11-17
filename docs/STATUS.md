# relay status

Ledger of what is done, what is unverified and what is blocked. Update it in the same pull request that changes the answer.

## Done

| Item | Where |
|---|---|
| Plan docs, task split for Sweeya and Colby, research summary | `plan/` on main |
| Name decided: relay, npm `relay-ai` | `plan/decisions.md` D-01 |
| Tech assets and short readme | `assets/`, `README.md` on main |
| Project setup, format, data and editor packages, S3 and S5 test kits | pull request #5, not merged |

## Not verified

| Item | Why |
|---|---|
| CI on GitHub | First run on pull request #5: node and sql pass, the secret scan flags 3 fake secrets in format tests |
| S3 on real Supabase | The harness only ran against a local fake. Local verdict was CHANGE on message rate at 12 clients |
| S5 on a real iPhone | No real device test yet |
| Playwright smoke test | Browsers not installed |
| Supabase `config.toml` | Written by hand, not checked with the CLI |

## Open items and blockers

| Item | Owner |
|---|---|
| Allowlist the fake secrets in `packages/format` tests, then merge pull request #5 | Sweeya |
| Branch protection on main is not enabled (needs a repository setting) | Sweeya |
| Chunks C2, C4, C5, C6, C9 (back side) not started | Colby |
| Screens wait on the design system | Sweeya |
