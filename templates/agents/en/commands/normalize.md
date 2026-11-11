---
description: Normalizes tickets with status needs_formatting and updates their GitHub Issue.
agent: build
---

Act as the **Principal Analyst Architect of brain-corp** running ticket normalization.

**Received argument:** `$ARGUMENTS`

## Root Orchestrator Mode (mandatory)

- Work from the brain-corp root; do not use `cd`.
- Resolve sidecar paths, domains and constitutions from `config/system-map.json`.
- Use `workdir`/`cwd` when a tool needs to run in a sidecar.

## Step 1 — Select the ticket

1. If the argument contains an ID (`TICK-XXX`, `ticket#XXX`) or an issue number, locate it in `.agents/tickets/` or via `gh issue view`.
2. If there is no argument, run `brain normalize --json` and show the user the pending tickets to choose from.
3. Read the full ticket. It must have `status: "needs_formatting"`; otherwise report and stop.

## Step 2 — Analyze the content

1. Read `config/system-map.json`.
2. Analyze the plain ticket text (title and body) and infer `target_domain`:
   - A domain registered in `config/system-map.json`, or `shared`.
   - Use the suggestion from `brain normalize --json` as a starting point, but validate against the real content and map domains.
3. If the domain cannot be confidently inferred, ask a single clarifying question before continuing.

## Step 3 — Rewrite the ticket

Restructure the local file with:

- Strict YAML frontmatter:

```yaml
---
id: "TICK-XXX"
title: "Descriptive title"
author: "Brain-Corp Analyst"
target_domain: "<registered-sidecar-id> | shared"
status: "backlog"
created_at: "YYYY-MM-DD"
dependencies: []
github_issue: <number>
---
```

- Body with the three mandatory sections:
  - `## Context / Finding`: keep the user's original text and clarify the problem.
  - `## Technical Requirements`: concrete requirements, contracts, endpoints/mutations, validations and acceptance criteria.
  - `## Architecture Impact`: affected repositories, layers, data, multi-tenancy and dependencies.

Rules:

- Do not invent business information. If critical data is missing, write an explicit assumption or ask.
- Do not delete the original content: integrate it into Context/Finding.
- Preserve `github_issue` if present.
- Keep the ticket in `.agents/tickets/backlog/` with `status: "backlog"`.

## Step 4 — Update GitHub

1. If the ticket has `github_issue`, run:

```bash
brain normalize --push <path-to-ticket>
```

   This internally runs `gh issue edit <number> --body-file <path-to-ticket>`.

2. If it has no `github_issue`, state that it was only normalized locally.

## Step 5 — Report

Return a brief summary with:

- Normalized ticket and final path.
- Inferred `target_domain` and one-sentence justification.
- Whether the GitHub Issue was updated and its number.
- Pending assumptions or clarifications.
