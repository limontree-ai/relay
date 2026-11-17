# 03 Workflow format

## Decision

A light format based on the limontree trace (decisions.md D-03). Every field that exists in the trace keeps its trace name and meaning, so a converter to a full trace is a field mapping. Fields the trace requires but a student group does not need (owner_role, trigger, exceptions, output, status, approval fields) are left out. Three fields are new: `needs`, `approval` and `format`.

The file holds no people, device ids or room ids. That keeps it forkable. Who runs what lives in the room (`role_bindings`, 05_server.md).

## Repo layout

```
<group repo>/
  workflows/
    demo-day/
      workflow.json             the workflow. The only file people edit
      runs/
        2026-11-16T21-30-05Z_r7k2p9.json    one file per finished run
```

- `<slug>` is lowercase letters, digits and dashes, 1 to 48 characters
- Files are written as JSON with 2 space indent, keys in schema order, a final newline. Same input, same bytes. That keeps diffs clean
- Only `workflows/**` is read or written. Nothing else in the repo is touched

## workflow.json

```json
{
  "format": "tandem/1",
  "name": "Demo day submit",
  "purpose": "Get the hackathon project tested, recorded and submitted.",
  "description": "Pull the latest code, run the tests, record a 2 minute demo and upload it to Devpost.",
  "tags": ["hackathon"],
  "inputs": [
    { "id": "in-1", "what": "The project repo", "source": "github.com/team/app", "sensitivity": "internal" }
  ],
  "steps": [
    {
      "id": "s-1",
      "order": 1,
      "action": "In ~/code/app, pull main and run npm test. Report the number of passing and failing tests.",
      "role": "jared-mac",
      "needs": "shell",
      "expected_result": "Tests ran and all pass.",
      "reversible": "yes",
      "tools": ["git", "npm"],
      "inputs_used": ["in-1"],
      "approval": "each"
    },
    {
      "id": "s-2",
      "order": 2,
      "action": "Open the app at localhost:3000 and record a 2 minute screen demo with QuickTime. Save it to the Demo folder in Google Drive.",
      "role": "jared-mac",
      "needs": "screen",
      "expected_result": "A demo video of about 2 minutes is in the Drive folder. Report its link.",
      "reversible": "yes",
      "approval": "each"
    },
    {
      "id": "s-3",
      "order": 3,
      "action": "In the browser, open our Devpost draft and add the demo link from the last step. Do not press Submit.",
      "role": "maya-laptop",
      "needs": "browser",
      "expected_result": "The draft shows the demo link and is not submitted.",
      "reversible": "yes",
      "approval": "each"
    }
  ],
  "never_automate": ["Pressing the final Submit button on Devpost"]
}
```

## Fields

| Field | Type | Rule | From the trace? |
|---|---|---|---|
| `format` | string | Must be `tandem/1` | New |
| `name` | string | 1 to 80 characters | Yes |
| `purpose` | string | 1 to 300 characters | Yes |
| `description` | string | 0 to 2,000 characters | Yes |
| `tags` | string[] | Up to 10, each up to 32 characters | Yes |
| `inputs[]` | object | `id`, `what`, `source`, `sensitivity` (public, internal, confidential, restricted) | Yes, subset |
| `steps[]` | object | 1 to 30 steps | Yes |
| `steps[].id` | string | Unique, `s-` plus digits. Never reused after a step is deleted | Yes |
| `steps[].order` | integer | 1, 2, 3 with no gaps | Yes |
| `steps[].action` | string | 1 to 4,000 characters. What Claude is told to do | Yes |
| `steps[].role` | string | Lowercase slug, 1 to 32 characters | Yes |
| `steps[].needs` | enum | `none`, `shell`, `browser`, `screen`. Used only for routing | New |
| `steps[].expected_result` | string | 1 to 1,000 characters. What done looks like | Yes |
| `steps[].reversible` | enum | `yes`, `no`, `unsure` | Yes |
| `steps[].tools` | string[] | Optional hints for Claude | Yes |
| `steps[].inputs_used` | string[] | Must match `inputs[].id` | Yes |
| `steps[].approval` | enum | `each` only in tandem/1. Reserved for policies later | New |
| `never_automate` | string[] | Things Claude must never do in this workflow. Passed to every step | Yes |

`needs` routing rule:
- `none`, `shell`: any device
- `browser`: any device. Claude uses its browser tools (Chrome extension or a browser MCP the member has)
- `screen`: a macOS device that reported `screen` in its capabilities (04_plugin.md)

## Validation

`validate(doc)` in `packages/format` returns a list of plain language problems. It runs in the editor (live, shown under each step), before a commit, and in `start_run`. A workflow with problems can be saved but not run.

| Check | Message example |
|---|---|
| Schema | "Step 2 needs a description of what done looks like." |
| Unique step ids, gapless order | "Two steps share the id s-3." |
| `inputs_used` references | "Step 1 uses an input called in-9 that does not exist." |
| Secrets (pattern rules ported from limontree: API keys, tokens, private keys, passwords in URLs) | "Step 3 looks like it contains a password. Remove it. Claude should use the login already on that device." |
| `reversible: no` with no `never_automate` entry | Warning only: "Step 4 cannot be undone. Consider adding what Claude must never do." |

## Run record: runs/<started_at>_<run-id>.json

Written once, when a run ends. Never edited.

```json
{
  "format": "tandem-run/1",
  "run_id": "r7k2p9",
  "workflow_commit": "3f9c1e2",
  "started_by": "jaredc",
  "started_at": "2026-11-16T21:30:05Z",
  "ended_at": "2026-11-16T21:41:52Z",
  "status": "succeeded",
  "note": "Use the final branch",
  "steps": [
    {
      "id": "s-1",
      "role": "jared-mac",
      "device": "Jared's MacBook",
      "status": "done",
      "approved_by": "jaredc",
      "started_at": "2026-11-16T21:30:40Z",
      "ended_at": "2026-11-16T21:32:10Z",
      "summary": "Pulled main at 81ab2c0. 42 tests passed, 0 failed.",
      "outputs": { "commit": "81ab2c0" }
    }
  ]
}
```

- `status`: `succeeded`, `failed`, `stopped`
- Step `status`: `done`, `failed`, `skipped`, `stopped`, `not_run`
- `summary` up to 2,000 characters, `outputs` up to 10 string pairs of up to 500 characters. Both pass through `redact()` before commit
- GitHub logins are used, never emails

## Versioning

- A version is a commit that changes `workflow.json`
- A run always records `workflow_commit`. History groups runs by that commit (06_web.md, History)
- The format string is versioned. tandem/1 readers reject unknown fields. A tandem/2 reader must read tandem/1
