# 07 Repo sync

The group's GitHub repo is the source of truth for saved versions. The database holds the live draft (the Yjs doc) and run state. The repo holds every version and every finished run.

## GitHub App

| Setting | Value |
|---|---|
| Repository permissions | Contents: read and write. Metadata: read |
| Events | push |
| Install scope | Only the repos the user picks |
| Commit author | The app's bot account, with a `Co-authored-by` line naming the member who saved or ran, by GitHub login noreply address |

Calls use Octokit with an installation token made per request. The private key is a Vercel env secret. Nothing else from GitHub is stored except `github_installation_id`, repo name and branch.

## What gets committed, and when

| Event | Files | Message |
|---|---|---|
| Save version (button) | `workflows/<slug>/workflow.json` | `workflow(<slug>): <message or "save">` |
| Run, when the draft is `dirty` | same as Save, before the run starts | `workflow(<slug>): save before run <short_id>` |
| Run ends | `workflows/<slug>/runs/<started_at>_<short_id>.json` | `run(<slug>): <short_id> <status>` |
| New workflow | `workflows/<slug>/workflow.json` | `workflow(<slug>): create` |

- Edits do not commit by themselves. Typing is not a version. A version is something someone chose to save or run
- Commits go straight to the room's branch. Pull requests for review are later (10_later.md)
- Single file commits use the contents API with the known blob sha. If GitHub says the file changed, the server reloads (see below) and asks the user to try again. No force writes, ever
- Run records that fail to commit (repo gone, permission removed) stay in the database with `record_commit_sha` null. The run view shows "Not saved to the repo" with Retry

## Connecting a repo

1. Owner installs the app and picks a repo and branch
2. Server lists `workflows/*/workflow.json` on the branch and imports each valid one: creates the workflow row, builds the Yjs doc from the JSON, sets `head_commit_sha`
3. Invalid files are listed with their problems and skipped. They are never changed

## Changes made in the repo (push webhook)

On a push to the room's branch that touches `workflows/*/workflow.json`:

- New file: import it
- Changed file and our draft is clean: replace the draft with the repo version. Everyone in the editor sees the change live
- Changed file and our draft is dirty: keep the draft, store the new head, and show a banner: "Someone changed this workflow in the repo. Load the repo version (your unsaved changes are lost) or keep yours (saving will replace the repo version)." Keeping yours commits on top of the new head; nothing is merged automatically
- Deleted file: the workflow is marked removed in the room, read only, with Restore (commits it back)
- Pushes made by our own app are ignored when `sender.login` is `<app-slug>[bot]`, and also when the commit sha is one we just wrote

## Not in the MVP

Forks, upstream links and three way merges are specified in 10_later.md L-01 so the format does not block them: step ids are stable and never reused, which is what a per step merge needs.

## Install security

GitHub sends `installation_id` in the setup redirect without proof. Before linking it to a room, the server checks it is in `GET /user/installations` for the signed in user (requested with "Request user authorization during installation"). The `state` parameter carries a signed nonce with the room id, but it does not prove access on its own.

## Errors

| Error | What we do |
|---|---|
| 409, or the file sha changed | Reload the file and head, retry up to 2 times, then show the conflict message |
| 403 or 422 from a branch ruleset or protection | Show the room owner how to add the relay app to the branch bypass list, or pick another branch |
| Secondary rate limit | Back off and retry. Commits are serialized per branch |

## Commit API

Single files use the contents API. Spike S4 also tries GraphQL `createCommitOnBranch`: several files in one commit, verified by GitHub, with `expectedHeadOid` as the conflict check. If it works, use it for every commit. Commits made with the installation token show as Verified only if we do not set a custom author, so the author stays the app and the member is a `Co-authored-by` line.
