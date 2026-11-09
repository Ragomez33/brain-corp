---
name: brain-corp-ticket-ops
description: Import, normalize, validate, synchronize, close and hotfix brain-corp tickets.
summary: Manages the brain-corp ticket lifecycle with GitHub Issues using the pinned @rgkoko/brain-corp CLI.
version: 1.0.0
author: Ragomez33
license: MIT
tags: [tickets, github-issues, workflow, automation]
keywords: [brain-corp, tickets, sync, sanity, normalize, complete, hotfix, github]
use_cases: [Import GitHub issues as tickets, Validate ticket coherence, Publish tickets as issues, Close a delivery, Create an emergency hotfix ticket]
docs_url: https://github.com/Ragomez33/brain-corp#readme
compatibility: Requires Node.js 18+, npm/npx, git and GitHub CLI (gh). Network access is needed for npx.
---

# brain-corp ticket operations

Use this skill for ticket lifecycle operations. Read `../shared/cli-contract.md` and `../shared/language-boundary.md` first.

## Prerequisites

```bash
command -v brain
brain --version
gh auth status
```

If `brain` is missing, use `npx @rgkoko/brain-corp@1.1.2 <command>`.

## Workflows

### Import issues

```bash
brain sync:pull
```

Imports open and closed issues as local tickets, infers state and marks incomplete ones as `needs_formatting`.

### Normalize tickets

```bash
brain normalize
```

Completes and moves `needs_formatting` tickets to `backlog`.

### Validate coherence

```bash
brain sanity
```

Runs the structural and semantic sanity check. With `--write` it records `.agents/tickets/.sanity-check.json`.

Do not skip sanity before publishing.

### Publish tickets

```bash
brain sync
```

Publishes backlog tickets as GitHub issues and writes `github_issue` in the frontmatter. Use `--skip-sanity` only if the user explicitly asks.

### Close a delivery

```bash
brain complete TICK-XXX [PR]
```

Marks the ticket as `done`, records the PR reference, moves it to `done/`, clears the active state and closes the GitHub issue when possible.

### Emergency hotfix

```bash
brain hotfix --title "<title>" --domain <sidecar> --module <module> --spec-impact none
```

Creates an emergency ticket and prepares the `fix/TICK-XXX-slug` branch. Add `--publish` to create the issue, `--repo` for `shared`, and `--dry-run` to preview.

`brain hotfix` does not commit or push.

### Reset active state

```bash
brain reset --repo <id>
brain reset --all
```

Use when the active feature pointer is stale. This never deletes tickets or feature directories.

## Ticket format

- Frontmatter: `id`, `title`, `author`, `target_domain`, `status`, `created_at`, `dependencies`, optional `github_issue`.
- Canonical English sections: `## Context / Finding`, `## Technical Requirements`, `## Architecture Impact`, `## Delivery`.
- Legacy Spanish sections are accepted.
- Every change must reference a `TICK-XXX`.

Read `.agents/prompts/analyst.md` when manually creating or normalizing a ticket.

## Guardrails

- Do not delete tickets with `github_issue` without explicit authorization.
- Do not invent dependencies or ticket IDs.
- Do not commit or push.
- Keep engine output in English; write ticket prose in the workspace language.
