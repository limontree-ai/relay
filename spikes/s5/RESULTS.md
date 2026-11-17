# s5 results

no real-device test has been run. everything below is empty until sweeya fills it in. what has been checked locally is the harness only (unit tests, http endpoints, an unreachable endpoint error path), not delivery.

device: ____  os version: ____  browser: ____  tunnel: ____  date: ____

| # | test | pass or fail | latency ms (p50 / max) | notes |
| --- | --- | --- | --- | --- |
| 1 | arrival under 10 seconds | not run | | |
| 2 | tap opens the right page | not run | | |
| 3 | 3 pushes in a row all show | not run | | |
| 4 | delivery in focus mode | not run | | |
| 5 | works after 3 days | not run | | |
| 6 | resubscribe after removing the home screen app | not run | | |
| 7 | android actions | not run | | |
| 8 | delayed push with the app killed | not run | | |
| 9 | permission denied path | not run | | |

decision: go / no go (go if arrival is under 10 seconds). if no go, fall back to email, then a telegram bot.
