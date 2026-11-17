# contributing

- Branch prefixes: `feat/`, `fix/`, `chore/`.
- One PR per chunk from `plan/09_build_plan.md`.
- One review from the other person (Sweeya and Colby review each other).
- Conventional commits, for example `feat: add run view`.
- No attribution lines in commits or files.
- Never commit secrets. CI runs gitleaks and a check that no Anthropic key name appears in `apps/` or `packages/`.
- Colby owns `supabase/migrations/`.

Before you push: `npm run lint && npm run typecheck && npm test && npm run check:no-key && npm run build`.
