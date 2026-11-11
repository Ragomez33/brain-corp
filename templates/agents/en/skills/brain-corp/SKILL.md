---
name: brain-corp
description: Orchestrates multi-repository analysis, tickets and synchronization with brain-corp.
---

# brain-corp

Use this skill when working inside a workspace orchestrated by brain-corp.

## Order of operations

1. Read `.brain/memory/constitution.md` (central constitution) and `config/system-map.json` to resolve sidecars, roles and paths.
2. Read `.agents/prompts/analyst.md` for the role and ticket format.
3. Always work from the workspace root; never `cd` into a sidecar.
4. Every change must be associated with a `TICK-XXX`.

## Commands

- `/cross-analyze <topic>`: detect gaps between sidecars and create a ticket.
- `/init-work <TICK-XXX>`: initialize the feature in `.brain/features/`.
- `/specify`, `/plan`, `/tasks`: native SDD flow (EARS).
- `/implement`: run tasks in checkpoint or batch mode.
- `/analyze`: audit coherence and detect spec drift.
- Pull requests: use the `brain-corp-pr` skill (`brain pr TICK-XXX`).
- `/sanity`: validate ticket coherence.
- `/sync`: publish the backlog as issues.
