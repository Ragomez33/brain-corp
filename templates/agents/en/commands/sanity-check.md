---
description: Audits and fixes ticket coherence before synchronizing with GitHub.
agent: build
---

Act as the **Principal Analyst Architect of brain-corp** running a pre-sync sanity check.

**Received argument:** `$ARGUMENTS`

## Root Orchestrator Mode (mandatory)

- Always work from the brain-corp root; do not use `cd`.
- Resolve sidecar paths from `config/system-map.json` (`repositories[].path`).
- Use `workdir`/`cwd` when a tool needs to run in a sidecar.
- Tickets live in `.agents/tickets/`; do not modify product code in sidecars.

## Step 1 — Collect inputs

1. Run `node scripts/sanity-check.js --write --json` and keep its result as the structural baseline (IDs, fields, states, dependencies, cycles, duplicates, UI→Backend rules).
2. Read every ticket in `.agents/tickets/backlog/`. Also review `in-analysis/`, `ready/` and `done/` to resolve dependencies and detect duplicates against existing tickets.
3. Read `config/system-map.json` and locate real schemas, contracts and consumers for each sidecar using `repositories[].path`, `stack`, `domains` and `specs`:
   - `provider` sidecars: data schemas, migrations, endpoints, resolvers or services.
   - `client` sidecars: API clients, services, views and types.
   - `standalone` sidecars: local schemas, modules and own flows.
4. If `$ARGUMENTS` contains IDs (`TICK-XXX`), limit the audit to those tickets and their direct dependencies.

## Step 2 — Cross analysis

For each ticket verify, with real file and name evidence:

1. **Client ↔ Provider contradictions.** Compare what a `client` sidecar ticket claims about queries, mutations, fields, enums or types against the real schema, contract and code of the `provider`. Flag a contradiction when the client assumes a contract the provider does not expose or when two tickets describe the same contract incompatibly.
2. **Client → API dependencies.** If a `client` or `standalone` ticket requires creating, modifying or exposing a query, mutation, endpoint, resolver or migration in a `provider` sidecar, it must declare at least one ticket for that `provider` or `shared` in `dependencies`. If none exists, create the missing provider ticket or add the dependency to the existing ticket.
3. **Redundancies and duplicates.** Detect tickets with the same finding, scope or equivalent titles. If two tickets cover the same problem, keep the most complete, merge useful evidence from the other and remove the duplicate.
4. **State and domain coherence.** `status` must match the folder; `target_domain` must be a registered id in `config/system-map.json` or `shared`; `dependencies` may only reference existing IDs and no cycles.
5. **Body format.** The sections `## Context / Finding`, `## Technical Requirements` and `## Architecture Impact` must exist in that order.
6. **Ticket value.** Remove speculative tickets without verifiable evidence or whose content is already implemented. Do not delete tickets with a created `github_issue`: fix the ticket and report that the issue must be edited or closed manually.

## Step 3 — Fix

If you find failures:

1. Edit the ticket frontmatter or body to fix domain, state, dependencies, format or contradictory claims.
2. Add missing dependencies using real IDs (never invent IDs).
3. If a backend ticket required by a UI ticket is missing, create it in `.agents/tickets/backlog/` following `.agents/prompts/analyst.md` and link it as a dependency.
4. If you detect duplicates, delete the redundant file only when its content is already integrated or adds no value. Do not delete tickets with `github_issue` without explicit authorization.
5. Do not invent evidence: if you cannot verify a claim in code or the map, leave it as an explicit assumption or report it as a warning.

## Step 4 — Mark ready for sync

- Do not change `status` to `ready` or move files between folders: `scripts/sync-github.js` consumes only `.agents/tickets/backlog/` and `ready` is reserved for implementation.
- After applying fixes, re-run `node scripts/sanity-check.js --write --json` to regenerate the report.
- If there are no blocking errors, `.agents/tickets/.sanity-check.json` must keep this contract:

```json
{
  "checked_at": "YYYY-MM-DDTHH:mm:ss.sssZ",
  "source": "sanity-check",
  "ready_for_sync": true,
  "tickets": [
    {
      "id": "TICK-XXX",
      "file": ".agents/tickets/backlog/TICK-XXX-slug.md",
      "status": "ok",
      "fixes": [],
      "warnings": []
    }
  ],
  "deleted": [],
  "blocking": []
}
```

- If blocking errors remain, write the same file with `"ready_for_sync": false` and detail each error in `blocking`.
- A ticket is ready to sync when its structural validation and cross analysis produce no blocking errors.

## Step 5 — Report

Return a brief summary with:

- Audited tickets and applied fixes (dependencies, domain, state, removed duplicates, new tickets).
- Remaining blocking errors, if any.
- Final result: `READY FOR SYNC` or `BLOCKED`.
- `.agents/tickets/.sanity-check.json` path.

If `$ARGUMENTS` is empty, audit the whole backlog. If it contains a nonexistent ID, report and stop without modifying anything.
