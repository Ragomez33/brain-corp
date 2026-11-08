# brain-corp Constitution

> Central memory of the SDD engine. It is the unbreakable rule of the ecosystem and prevails over any local instruction that contradicts it. It lives at `<workspace>/.brain/memory/constitution.md` and applies to all orchestrated repositories without being duplicated per sidecar.

## 1. Guiding principles

1. **One root, never `cd`.** Everything runs from the workspace root. Repository paths are resolved from `config/system-map.json` and passed as `workdir`/`cwd` to tools.
2. **The root orchestrates; sidecars implement.** The root contains no business logic or product code. Each repository keeps its own constitution, rules and quality gates.
3. **Analyze, do not guess.** Every decision is based on verifiable evidence: real files, contracts, schemas and tests. If it cannot be verified, declare it as an assumption.
4. **Local, traceable SDD.** Each repository keeps its specification and state in `.brain/`. No duplicated global specs.
5. **GitHub Issues is the synchronization channel.** Markdown tickets are the local representation.
6. **Zero local secrets.** GitHub authentication is delegated to `gh`; tokens and credentials are never persisted.
7. **Sanity-check is pre-flight.** Nothing is published or synchronized if the sanity check detects blocking errors.
8. **Full traceability.** No change without `TICK-XXX`, no PR without `Closes #...`, no closure without `/complete` or `sync:pull`.

## 2. Canonical flow

```text
TICK-XXX → /init-work → /specify → /plan → /tasks → /implement (Checkpoint | Batch) → /analyze → PR (template) → /complete → done/
```

- `/init-work TICK-XXX [--repo <id>]` creates `.brain/features/<TICK-XXX>/` and sets `.brain/active.json`.
- `/specify` produces `spec.md` in EARS format.
- `/plan` produces `plan.md` with the technical strategy.
- `/tasks` produces `tasks.md` with atomic tasks and `REQ-*` references.
- `/implement` runs in **Checkpoint** (one task with confirmation) or **Batch** (autonomous block) mode.
- `/analyze` audits coherence and detects spec drift between spec, tasks and code.
- `/complete` closes the delivery and moves the ticket to `done/`.

The old `speckit.*` flow is forbidden. External bash scripts and specification folders outside `.brain/` are not allowed.

## 3. `.brain/` engine rules

```text
.brain/
├── active.json              ← session pointer (ticket and phase)
├── templates/               ← EARS templates
├── memory/                  ← this constitution
└── features/<TICK-XXX>/
    ├── spec.md
    ├── plan.md
    ├── tasks.md
    ├── contract.md          ← only if it crosses sidecars
    └── analysis.md          ← analysis report
```

1. `contract.md` is generated only if the ticket is `shared` or the repository has `relationships` in `system-map.json`.
2. Every spec must include `Source Ticket: .agents/tickets/<state>/TICK-XXX-<slug>.md`.
3. No phase advances without the previous phase file (`specify → plan → tasks → implement`).
4. Tasks are marked `[x]` only when implemented and verified.
5. `/analyze` is mandatory before opening a feature PR.
6. Canonical ticket body sections are `## Context / Finding`, `## Technical Requirements` and `## Architecture Impact`. The validator also accepts the legacy Spanish equivalents for backward compatibility.

## 4. Code constraints

1. Product code is never implemented from the workspace root.
2. Every repository change respects its stack, schema and local tests.
3. Conventional Commits: `feat(<module>): ...`, `fix(<module>): ...`, `docs(spec): ...`, `refactor(<module>): ...`.
4. The agent **never** runs `git commit`, `git push`, `git merge` or opens a PR without explicit authorization.
5. No new dependencies without justifying the rejected alternative in `plan.md`.
6. Every cross-repository contract change requires `contract.md`, a compatible version and integration tests.

## 5. Strict agent behavior

1. Read this constitution before acting. If it conflicts with a ticket or instruction, the constitution prevails.
2. Resolve the target repository from `config/system-map.json`; never assume fixed paths.
3. Do not invent requirements, files or APIs. Verify or declare the assumption.
4. On ambiguity, stop and ask a single clarifying question.
5. If spec drift or uncovered scope is detected, stop implementation and run `/analyze` or `/cross-analyze`.
6. Do not delete tickets with `github_issue` without explicit authorization.
7. Do not expose secrets in logs, commits or files.

## 6. Quality gates

- **Spec gate:** EARS requirements with verifiable acceptance criteria.
- **Plan gate:** technical strategy covering every `REQ-*` and contrasting alternatives.
- **Tasks gate:** atomic tasks, parallelizable when applicable, with exact paths.
- **Implementation gate:** repository tests green and tasks verified.
- **Analyze gate:** no drift errors or uncovered requirements.
- **Sync gate:** sanity check with no blocking errors.

## 7. Amendments

Every amendment to this constitution is recorded with date, ticket, reason, previous rule and new rule. An amendment without a ticket is invalid.
