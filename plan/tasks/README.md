# tandem: who builds what

Two people. Sweeya builds the front. Colby builds the back. Based on `limontree-ai/temp/plan/` (09_build_plan.md chunks C0 to C11, spikes S1 to S6).

- [sweeya.md](sweeya.md): web app, live editor, `packages/format`, repo setup, all screens
- [colby.md](colby.md): database and run engine, device API, CLI, MCP server and plugin, GitHub App, push sending

## Changes from 09_build_plan.md

| Change | Why |
|---|---|
| Split switched: Sweeya takes the web side, Colby the device and server side | Founder request |
| C9 split: Sweeya builds the approval page, service worker, manifest and push sign up. Colby builds push sending and `/api/push/notify` | Keeps Sweeya on the front |
| C10 split: Colby builds the GitHub App routes, import and webhook. Sweeya builds the connect repo flow, Save button, banners and history | Same reason |
| S4 (GitHub App) moves to Colby | It's backend |
| Colby ships a fake device script with C6, not C8 | Lets Sweeya build and test the run view without real Macs |
| Sweeya builds against a mock data layer until C2 lands | Lets both start on day one |

## Can Sweeya start without Colby?

Yes. Nothing blocks the first phase. Four things need Colby's work later:

| Sweeya's piece | Needs from Colby | Until then |
|---|---|---|
| Rooms, invites, members, settings | C2 tables, RLS, `join_room_by_invite` | Mock data layer |
| Pair and devices screens | C4 pairing routes, `devices` and `room_devices` tables | Mock data layer |
| Run view | C2 run functions, C6 runs route, fake device script | Mock run with scripted status changes |
| Approval page, Save, connect repo, history | `decide_approval`, push sending, GitHub routes | Mock data layer |

Note: the plan says no product chunk starts until spike S1 (Colby's) is a go. C0, C1 and S3 are safe to start anyway, because they're needed whatever S1 shows. Treat the rest of the front as at risk until S1 passes.

## Order

| Phase | Sweeya | Colby | Done when |
|---|---|---|---|
| 1 | C0 repo setup, S3 Yjs spike, S5 push spike | S1 Claude Code loop, S2 computer use, S6 plugin install, S4 GitHub App | All spikes have a go, change or stop call |
| 2 | C1 `packages/format`, mock data layer, editor (C7) live editing locally | C2 database and run engine. Then publish generated DB types | C1 and C2 merged |
| 3 | C3 rooms on real data, C7 editor persisted, pair and devices screens | C4 pairing and CLI, C6 device API plus fake device script | Fake device can run a 3 step workflow from a terminal |
| 4 | C8 run view, approval page (C9 front), setup page | C5 MCP server and plugin, C9 push sending | A real 2 Mac run with phone approval |
| 5 | Repo UI (C10 front), history | C10 GitHub routes, import, webhook | Save and run records land in a test repo |
| 6 | C11 together: 2 person dry run, safety checklist (08_safety.md) | Same | Two new people finish a cross device run in under 15 minutes |

## Handoffs: who owns which shared piece

Change any of these only with a heads up to the other person.

| Shared piece | Owner | Used by | Ships in |
|---|---|---|---|
| `packages/format` (schema, types, `validate`, `redact`, `stringify`, `toWorkflowJson`, `fromWorkflowJson`) | Sweeya | Both. Colby's server, MCP and repo sync | Phase 2 |
| Repo setup, CI, lint and test config | Sweeya | Both | Phase 1 |
| `supabase/migrations`, SQL function names and arguments | Colby | Both | Phase 2 |
| Generated DB types (`supabase gen types typescript` into `packages/db-types` or `apps/web/lib/db.types.ts`) | Colby | Sweeya | Phase 2, and after every migration |
| Device API request and response shapes (05_server.md) | Colby | Sweeya (run view, pair screen) | Phase 3 |
| `scripts/fake-device.ts` | Colby | Sweeya (Playwright, run view) | Phase 3 |
| `/api/workflows/:id/ydoc` persist route | Sweeya | Colby (reads `doc`) | Phase 3 |

## Working rules

- One branch and one pull request per chunk, named with a prefix: `feat/`, `fix/`, `chore/`
- Each PR needs one review from the other person. Colby reviews anything touching the editor's persist route; Sweeya reviews anything changing `packages/format` usage. Colby owns every migration
- A chunk is done when its acceptance tests pass in CI and the PR lists anything guessed
- Decisions Natasha needs to make first: D-01 product name (before C5 publishes the plugin), D-02 which company and repo (before C0)
