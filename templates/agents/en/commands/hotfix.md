---
description: Opens an emergency ticket, prepares the fix/TICK-XXX-slug branch and the hotfix commit.
agent: build
---

Act as the **Principal Analyst Architect of brain-corp** running the hotfix flow.

**Received argument:** `$ARGUMENTS`

## Root Orchestrator Mode (mandatory)

- Always work from the brain-corp root; do not use `cd`.
- The ticket lives in `.agents/tickets/`; code and branch live in the sidecar resolved from `config/system-map.json`.
- Do not run `git commit`, `git push`, `git merge` or open the PR without explicit user authorization.
- Do not use local tokens or custom GitHub APIs: all GitHub interaction goes through `gh`.

## Step 1 — Gather required data

You need:

- `--title`: short, descriptive hotfix title.
- `--domain`: registered sidecar id in `config/system-map.json` or `shared`.
- `--module`: commit module, e.g. `inventory`.
- `--spec-impact`: `none` if no governing spec is affected, or a reference to the amendment in `tasks.md`/spec.
- `--repo`: required if `--domain` is `shared`; accepts a sidecar id or `root`.

Optional: `--context`, `--slug`, `--base`, `--fetch`, `--publish`, `--no-branch`, `--dry-run`, `--json`.

If required data is missing, ask before running. If `--spec-impact` is not `none`, verify the spec or `tasks.md` Change Log exists or mark it as pending in the ticket.

## Step 2 — Validate impact before coding

1. If the hotfix changes behavior, contract or interface already governed by a spec, update the spec/contract and record the amendment in the sidecar `tasks.md` Change Log. It does not require the full SDD flow, but the amendment does.
2. If no spec exists for the area, use `--spec-impact none` or `--spec-impact "Spec pending: <reason>"` and ensure a follow-up ticket is opened.
3. Review `git fetch origin` and the state against the sidecar base branch before creating the branch (`--fetch` and `--base` help).

## Step 3 — Create ticket and branch

Run:

```bash
node scripts/hotfix.js \
  --title "<title>" \
  --domain <domain> \
  --module <module> \
  --spec-impact "<none|reference>" \
  [--repo <sidecar|root>] [--context "<detail>"] [--publish] [--fetch] [--base origin/main]
```

The script:

1. Assigns the next `TICK-XXX` and creates the ticket in `.agents/tickets/backlog/` with the three mandatory sections.
2. Records domain, repository, branch and spec impact.
3. Creates or reuses the `fix/TICK-XXX-<slug>` branch in the sidecar repository.
4. Returns the suggested commit message `fix(<module>): <title>`.
5. With `--publish`, creates the GitHub issue via `gh` and writes `github_issue` in the ticket.

If the script fails to create the branch or publish the issue, report the error and do not continue as if it were ready.

After creating the ticket, run `node scripts/sanity-check.js --write` and fix any blocking errors (for example, a `client` sidecar hotfix that requires an API change without an associated `provider` ticket).

## Step 4 — Prepare delivery

1. Implement the minimal change in the corresponding sidecar.
2. Run the sidecar quality gates (typecheck/build/tests).
3. Propose the exact commit `fix(<module>): <title>` and request authorization. Do not run it on your own.
4. Prepare the PR with `.github/PULL_REQUEST_TEMPLATE.md`, including `Closes #<issue>`, risks, rollback and `Spec impact`.
5. After merge, run `/complete TICK-XXX <PR>` or let `sync:pull` move the ticket to `done/` when the issue closes.

## Step 5 — Report

Return:

- Created ticket ID and path.
- Domain, repository and branch.
- Declared `Spec impact`.
- Suggested commit message.
- Created GitHub issue (if `--publish`).
- Pending next action: implement, validate, authorize commit and open PR.
