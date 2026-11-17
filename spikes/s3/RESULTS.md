# s3 results

status: local fake only. the real supabase run is still pending (no project exists yet), so s3 has NOT passed against real supabase. the local fake is my model of the plan's limits (256 KB payload, 100 messages/s counting the inbound message plus every fan-out delivery, 40 ms +/- 20 ms latency, no random drops); it shows the harness works and where the design strains, not what supabase does.

all runs: `--local --seconds 60 --disconnect-every 15` (one client offline for 2 s every 15 s, round robin, 3 reconnects per run). "edit phase" is longer than 60 s when reconnects wait for convergence (up to 30 s cap).

| run | clients | msgs sent / received (fan-out) | total msg/s avg / peak | awareness msg/s avg (sent only) | update bytes p50 / p95 / max | over 256 KB | reconnect convergence | docs converged | lost edits | hub rate-drops | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a: defaults, limit 100 | 3 | 2003 / 3504 | 90.9 / 116 | 40.4 (14.5) | 48 / 192 / 4336 | 0 | 3 of 3, p50 1.4 s, max 3.7 s | yes | 0 of 424 | 183 | CHANGE (peak over 100) |
| b: defaults, limit 100 | 12 | 11172 / 7494 | 230.4 / 262 | 85.3 (59.6) | 48 / 160 / 108872 | 0 | 0 of 3 within 30 s | yes, only after 10 s settle | 0 of 2294 | 10486 | CHANGE (peak over 100) |
| c: no limit (`--rate-limit 1000000`) | 12 | 9183 / 100219 | 1810.5 / 2240 | 706.5 (59.5) | 48 / 512 / 3608 | 0 | 3 of 3, p50 152 ms | yes, 0.6 s | 0 of 1849 | 0 | CHANGE (peak over 100) |
| d: quiet clients, limit 100 (`--cursor-hz 0.2 --awareness-ms 5000 --edit-ms 3000 --batch-ms 500`) | 12 | 910 / 5256 | 82.0 / 127 | 7.4 (2.6) | 132 / 2288 / 4680 | 0 | 3 of 3, p50 23.7 s, max 29.2 s | yes, 4.6 s | 0 of 272 | 429 | CHANGE (peak over 100) |

edits are random adds, reorders, field edits and typed markers; no edit was lost in any run, but with the limiter on, edits only arrived because of the 10 s anti-entropy sync and the offline resend, which is slow (see d).

## persist route (`npm run persist`, 12 concurrent persists x 20 trials)

- no lock: 220 updates lost, 20 of 20 trials lost something.
- mutex (stand-in for `SELECT ... FOR UPDATE`): 0 lost, 0 of 20 trials.
- `Y.mergeUpdates` gives the same doc in any order. the loss is the read-modify-write race, not the merge.

## what this says

- correctness holds in the fake: yjs converges, no edits lost, concurrent reorders with fractional indexes converge. two concurrent moves can create equal keys (1 to 72 duplicate keys at the end of a run); with ties ordered by id every doc agrees, so the editor needs a tie-break and an occasional re-key.
- payloads are far from 256 KB: p95 under 3 KB, max about 109 KB in run b. the max comes from a resync diff after a long stretch of rate-limit drops; a long-lived doc with many steps could grow toward the limit, so persist and compact in the real editor.
- the message rate is the problem. fan-out multiplies every broadcast by (clients - 1) plus one. at 12 clients one broadcast costs 12 messages, so 100 msg/s is about 8 broadcasts/s for the whole room. awareness alone at 12 clients with cursors at 1 per second per client would cost 144 msg/s. even 3 clients at default cursor and edit rates peak over 100. unthrottled, 12 clients produce about 1800 msg/s.
- under the limit the room degrades: messages are dropped silently, reconnect catch-up took 24 s (run d) or did not finish within 30 s (run b), though the docs did converge after edits stopped.
- if real supabase counts messages the way the fake does, the free plan fails the rate criterion at 12 tabs, and the likely call is CHANGE: much lower awareness (send cursor on selection change only, about 1 per 2 s), larger batching, and check the paid plan's limits or the liveblocks yjs provider fallback. this must be checked on the real plan (supabase may count inbound messages only, or throttle differently).

## real supabase run: pending

see README.md, section "run against real supabase". paste output and fill the table there.
