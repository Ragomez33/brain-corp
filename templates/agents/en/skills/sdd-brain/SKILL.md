---
name: sdd-brain
description: Native SDD engine in .brain/ per repository (init-work, specify, plan, tasks, implement, analyze).
---

# Native SDD in .brain/

Every specification and state lives in the repository where code is implemented:

```text
<repo>/.brain/
├── active.json              ← active ticket and current phase
├── templates/               ← EARS templates (spec, plan, tasks, contract)
└── features/<TICK-XXX>/
    ├── spec.md              ← EARS requirements
    ├── plan.md              ← technical strategy
    ├── tasks.md             ← atomic tasks
    ├── contract.md          ← only when crossing sidecars
    └── analysis.md          ← spec drift report
```

## Flow

1. `/init-work TICK-XXX [--repo <id>]`: create the feature and set `active.json`.
2. `/specify`: generate `spec.md` in EARS.
3. `/plan`: generate `plan.md`.
4. `/tasks`: generate `tasks.md`.
5. `/implement` (`--mode checkpoint|batch`): run tasks and mark checkboxes.
6. `/analyze`: audit coherence and detect spec drift.

## Rules

- Read `.brain/memory/constitution.md` before starting any phase; it is the central memory and prevails.
- Resolve the repository from `config/system-map.json` (`repositories[].path`).
- If the ticket is `shared` or crosses `relationships`, generate `contract.md` in the base repository.
- Never duplicate specs globally: each repository keeps its own.
- The engine is 100% Node.js: no external bash scripts or specification folders outside `.brain/`.
