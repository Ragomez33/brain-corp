# brain-corp

This workspace is orchestrated by brain-corp.

## Resources

- Analyst role: `.agents/prompts/analyst.md`
- Base skills: `.agents/skills/`
- Tickets: `.agents/tickets/<state>/TICK-XXX-<slug>.md`
- Native SDD: `.brain/active.json` and `.brain/features/<ticket>/`
- Central constitution: `.brain/memory/constitution.md`
- Sidecar topology: `config/system-map.json`

## Main commands

- `/cross-analyze <topic>`: analyze the ecosystem and create a ticket.
- `/init-work <TICK-XXX>`: create the feature in `.brain/features/<ticket>/`.
- `/specify`, `/plan`, `/tasks`, `/implement`: native SDD flow.
- `/analyze`: audit coherence and detect spec drift.
- Pull requests: use the `brain-corp-pr` skill (`brain pr TICK-XXX`).
- `/sanity`: validate ticket coherence.
- `/sync`: publish the backlog as GitHub issues.

## Rules

1. Always work from the workspace root; resolve sidecar paths from `config/system-map.json`.
2. Do not modify product code from the root.
3. Every change must be associated with a `TICK-XXX`.
4. Use `gh` as the only GitHub interface; do not persist tokens.
