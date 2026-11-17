# s5 manual checklist

needs: an iphone on ios 16.4 or newer (note the exact version), an android phone with chrome, a laptop running the server and a tunnel (see README). go if every notification arrives in under 10 seconds.

## setup (iphone)

1. `npm run keys && npm start`, then `cloudflared tunnel --url http://localhost:3000`.
2. on the iphone open the https url in safari. you should see the warning "Open from the home screen icon to enable notifications".
3. share, Add to Home Screen. open the new icon (not safari). the box turns green: "Running as a home screen app".
4. tap Subscribe, allow notifications. status shows `subscribed=true`. check `data/subs.json` has one entry.

## tests

mark each in RESULTS.md. use `curl -XPOST localhost:3000/send -d '{"kind":"approval"}'` unless stated.

1. arrival under 10 seconds. lock the phone, run `npm run send:burst -- 10 3000`. pass when all 10 are acked and max < 10000 ms. also note whether they show on the lock screen.
2. tap opens the right page. tap an approval notification from the lock screen and from the app being closed. pass when `/a/<id>` opens in the home screen app, and the id matches the one in the server log. press Approve, then check the server log has `decide`.
3. 3 pushes in a row. send 3 pushes with 2 seconds between them (`npm run send:burst -- 3 2000`). pass when 3 notifications show. repeat 10 times over the day with the app closed. any push with no visible notification is a fail.
4. focus mode. turn on Focus (do not disturb), lock the phone, send one push. record whether it is delivered silently to notification centre. then add the app to the Focus allowed apps and send again. record both.
5. still works after 3 days. do not open the app for 3 days. after 72 hours send `approval` and `ready`. pass when both arrive. record the time of subscribing and the time of the test. if it fails, read the server log for the push service status.
6. resubscribe after removing the app. delete the home screen icon. check `curl -XPOST localhost:3000/send -d '{"kind":"ready"}'`: record the status and reason (apple's reason is printed, the subscription should be deleted on 404, 410, 403 or 400). add to the home screen again, open, Subscribe, send. pass when it arrives. note whether a new endpoint was issued.
7. android actions. on chrome for android subscribe (a normal tab is fine) and send `approval`. pass when Approve and Deny buttons show. tapping a button opens `/a/<id>?action=approve` and posts a decision.
8. delayed push with the app killed. `{"kind":"stalled","delayMs":60000}`, then swipe the app away and lock. pass when it arrives.
9. permission denied path. in a spare browser deny the prompt. the page should show `permission denied` and no crash.

## when something fails

- no notification and no `failed` line: the push service accepted it but the phone did not show it. record the ios version and whether the app was opened since the push.
- `failed 403` with BadJwtToken or similar: check `VAPID_SUBJECT` is a `mailto:` or https url, and that the keys in `.env.local` match what the page subscribed with (re-subscribe after `npm run keys --force`).
- copy the server log lines into RESULTS.md.
