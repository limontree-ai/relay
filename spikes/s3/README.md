# spike s3: yjs over supabase realtime broadcast

question: does a thin yjs provider over supabase realtime broadcast hold up for the relay workflow editor (3 to 12 tabs, disconnects, persistence)?

throwaway harness. the same provider code runs against an in-process fake (`--local`) and against real supabase (`--supabase`). only the fake has been run so far, see RESULTS.md.

## layout

- `src/provider.ts` thin yjs provider over a `Transport` interface. events: `yjs-update`, `awareness`, `sync-req`, `sync-reply` (all base64 yjs/awareness bytes). sync request with state vector on connect, reply with the diff (jittered, suppressed if someone else already answered), origin tagging so remote updates are not echoed, offline queue merged with `Y.mergeUpdates` and resent on reconnect, update batching (`--batch-ms`), awareness throttled to 10/s, anti-entropy sync request every 10 s to heal silent drops.
- `src/clients.ts` simulated browser: `steps` Y.Map keyed by id, each step a Y.Map with a fractional-index `order`, plain string fields and a `Y.Text` `action`. random adds, drag reorders, field edits, typing bursts (char by char), awareness cursor updates. every edit has a unique marker (`c<client>-<n>`) also written to an `edits` map.
- `src/fake.ts` fake broadcast hub: latency, jitter, random drop, disconnect, 256 KB payload limit, 100 messages/s limiter that counts the inbound message plus every fan-out delivery. messages over the limit are silently dropped.
- `src/supabase.ts` real transport: one supabase client per simulated tab, public broadcast channel `wf:spike`, `self: false`.
- `src/run.ts` the cli and the report.
- `src/persist-test.ts` concurrent persist route: no lock vs mutex (stand-in for `SELECT ... FOR UPDATE`).
- `src/spike.test.ts` vitest checks.

## run

```
npm install
npm test
npm run persist
npx tsx src/run.ts --local --clients 3 --seconds 60 --disconnect-every 15
npx tsx src/run.ts --local --clients 12 --seconds 60 --disconnect-every 15
npx tsx src/run.ts --local --clients 12 --minutes 10 --disconnect-every 30
```

options: `--clients 3|12`, `--minutes 10` or `--seconds 30`, `--mode local|supabase` (or `--local` / `--supabase`), `--disconnect-every N` (seconds, one client at a time, round robin), `--disconnect-ms 2000` (how long it stays offline). tuning: `--edit-ms 400` (mean gap between edits per client), `--cursor-hz 5`, `--awareness-ms 100` (provider throttle), `--batch-ms 50`. local only: `--latency-ms 40`, `--drop 0.0`, `--rate-limit 100`.

## run against real supabase

1. create a project at supabase.com (the free plan is the one we care about).
2. project settings, api: copy the project url and the anon key.
3. realtime settings: leave "allow public access" on (the spike uses a public channel `wf:spike`, no auth).
4. in a shell, never in a file:
   ```
   export SUPABASE_URL=https://<ref>.supabase.co
   export SUPABASE_ANON_KEY=<anon key>
   ```
5. `npx tsx src/run.ts --supabase --clients 3 --minutes 10 --disconnect-every 60`, then the same with `--clients 12`. run one at a time (the channel is shared, parallel runs mix). also try with `--cursor-hz 1 --awareness-ms 1000 --batch-ms 200` if the default trips the limit.
6. copy the printed output into the results table below / RESULTS.md. check the supabase dashboard, reports, realtime, for the plan's own message count and any rate errors.

in supabase mode the report counts messages the clients sent and received (fan-out as seen by the clients). there is no hub, so server side drops are only visible as missing edits or non-convergence. the realtime-js client default of 10 events/s is raised to 100 (`eventsPerSecond`) so the server limit is what we hit.

## what the numbers mean

- msgs/s per client: messages sent and received per second by one tab over the edit phase.
- total incl. fan-out: sent plus received by all clients, per second. this is the number the plan limit (100/s on free) applies to. avg and peak (worst one-second window).
- awareness msgs/s: the same, awareness events only. "sent only" is what the clients emit before fan-out.
- update payload bytes: size of the json payload of `yjs-update` messages (base64 inflates by 4/3). p50, p95, max, and count over 256 KB (the broadcast payload limit).
- reconnect convergence: after a client comes back, time until every doc has everything every doc had at that moment (state vector comparison). `converged 0` means it never caught up within 30 s.
- settle: after edits stop, time until all docs are equal.
- docs converged: canonical json of all docs is identical.
- lost edits: every edit has a marker. "lost everywhere" means gone from every doc; "missing in at least one doc" also counts docs that are just behind. typed markers count as present if their characters appear in order (concurrent char-by-char typing at one spot can interleave).
- duplicate order keys / tie repairs: concurrent drag reorders can give two steps the same fractional key. the harness orders by (key, id) so every doc agrees, and a client that sees a tie places the new key after it. no step is lost or duplicated.

verdict rule: STOP if any edit is lost, docs do not converge, or a payload is over 256 KB. CHANGE if only the peak rate is over 100 msg/s. GO if all pass. the rate criterion is only binding at 12 clients.

## persist route

`npm run persist` fires 12 concurrent persists. `Y.mergeUpdates` is commutative, associative and idempotent, so merging in any order gives the same doc and the merge never drops an update. loss only happens in the read-modify-write around it: two requests read the same old row, each writes old plus its own update, and the later write overwrites the other. a row lock (`SELECT ... FOR UPDATE` in one transaction) or an append-only update log removes the loss.

## results table (fill in for the real run)

| run | clients | minutes | disconnect every | total msg/s avg / peak | awareness msg/s avg | update p50 / p95 / max bytes | over 256 KB | reconnect convergence | docs converged | lost edits | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| supabase free | 3 | 10 | 60 s | | | | | | | | |
| supabase free | 12 | 10 | 60 s | | | | | | | | |
