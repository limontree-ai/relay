# spike s5: web push on an iphone home screen app

throwaway harness. goal: a vapid push reaches an iphone home screen web app (and android), tapping it opens the approval page, and it arrives in under 10 seconds. fallback if this fails: email, then a telegram bot.

## run it

```
npm install
npm run keys        # writes .env.local with a vapid key pair (gitignored, never commit)
npm start           # http://localhost:3000, set PORT to change
npm test
npm run typecheck
```

`npm run icons` regenerates the solid colour placeholder icons in `public/`.

## expose it over https

web push only works on https (localhost is the one exception, and that does not help a phone). use a tunnel:

```
cloudflared tunnel --url http://localhost:3000
# or
ngrok http 3000
```

open the https url it prints on the phone. subscriptions are tied to that origin, so a new tunnel url means subscribing again (and the home screen app must be re-added).

## endpoints

| endpoint | what |
| --- | --- |
| GET /vapid-public-key | public key as text |
| POST /subscribe | store a subscription, unique by endpoint, in data/subs.json |
| POST /send | `{ kind: approval\|ready\|stalled, delayMs?, endpoint? }` push to all subscriptions |
| POST /test-notification | push a `ready` notification, optional `{ endpoint }` |
| POST /ack | the service worker reports receipt time, saved to data/latency.json |
| GET /latency, GET /stats | recorded latencies and summary |
| GET /a/:id | approval test page, add `?passkey=1` for the needs passkey variant |
| POST /decide | the approval page buttons post here |

example: `curl -XPOST localhost:3000/send -d '{"kind":"approval","delayMs":5000}'`. the delay is useful for locking the phone first.

## burst test

```
npm run send:burst -- 5 2000 20000   # count, gap ms, wait for acks ms
```

the server must be running so acks are recorded. it prints min, p50, p95, max and pass or fail for under 10 seconds. latency is the phone clock minus the server clock, so clock skew adds error (both are normally network synced).

## how errors are handled

- every push calls `showNotification`, even for malformed payloads. webkit revokes a subscription after a few silent pushes.
- a 404, 410, 403 or 400 from the push service deletes the subscription and prints the push service's reason.
- android chrome gets approve and deny action buttons when `Notification.maxActions > 0`. ios never does, so the approval page is the only place to decide there.
- `pushsubscriptionchange` resubscribes and posts to /subscribe.

## what sweeya must test on a real device

see `docs/CHECKLIST.md`, and record outcomes in `RESULTS.md`.

## status

verified locally only: unit tests, static serving, endpoint behaviour, and the error path to an unreachable push endpoint. nothing has been run against a real iphone or android. see `RESULTS.md`.

declarative web push (ios 18.4+, payload shaped for the browser to show without a service worker) is a later option and is not used here.
