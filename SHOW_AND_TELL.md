# Use brain-corp as your multi-repo orchestration layer

## Problem

When you work in a multi-repository ecosystem, opening a single repo and asking the agent to change or create a feature only gives it visibility into that repo. The API contract, domain model, client consumption, topology, tickets and SDD specs live somewhere else. The agent guesses conventions, or you paste documentation excerpts into every prompt.

`brain-corp` acts as the coordination layer for the whole ecosystem. It records the repository topology, provisions the AI agent with the workspace rules, analyzes cross-repo integration gaps, creates tickets, synchronizes them with GitHub Issues and routes each ticket to an SDD specification inside the correct repository.

It also solves the "new machine" problem: a fresh clone of the orchestrator can hydrate its sidecars, initialize Git submodules, generate a managed `.gitignore` and leave the workspace ready to use.

## Tools used

| Tool | Version | Why it is needed |
| --- | --- | --- |
| `brain-corp` | `v2.2.0` | Orchestration CLI: topology, tickets, SDD, audits, agent provisioning and workspace hydration. |
| Node.js | `>=18` | Runtime required by the CLI and its native `fetch`-based update check. |
| Git | Current stable | Sidecar cloning, submodule synchronization and repository validation. |
| GitHub CLI (`gh`) | Authenticated | Repository discovery, GitHub Projects, Issues synchronization and pull requests. |
| AI agent | OpenCode, Claude Code, Cursor or Antigravity | Executes the analysis, ticket and SDD workflows using the assets provisioned by `brain-corp`. |
| `/cross-analyze` | Local command | Analyzes the ecosystem across sidecars and creates a traceable ticket. |
| `brain hydrate` | Local command | Reconciles `system-map.json` with disk: clones missing sidecars, synchronizes submodules and reports orphan gitlinks. |

## AI Workflow

### 1. Install and bootstrap a new orchestrator workspace

```bash
npm install -g @rgkoko/brain-corp@latest

mkdir my-orchestrator
cd my-orchestrator

brain setup
brain init
```

`brain setup` discovers repositories through `gh`, lets you assign each one a role (`provider`, `client` or `standalone`) and writes the topology to `config/system-map.json`. When `gh` is unavailable, `brain setup --manual` registers repositories by URL or local path.

`brain init` then:

- Creates or completes a managed `.gitignore` block.
- Hydrates missing sidecars using `remote`, `sshUrl` or `url` from `config/system-map.json`.
- Skips repositories that already contain a valid Git work tree.
- Synchronizes Git submodules when `.gitmodules` exists:
  `git submodule sync --recursive` and `git submodule update --init --recursive`.
- Validates declared submodules and detects orphan gitlinks instead of cloning over the container index.
- Isolates per-sidecar failures so one broken repository does not abort the whole bootstrap.
- Provisions prompts, skills, commands and SDD templates for the selected agent.
- Optionally starts the GitHub Issues watcher.
- Launches the configured agent.

The managed `.gitignore` covers local state (`.brainrc.json`, `.brain/active.json`), agent/IDE artifacts (`.agents/`, `.opencode/`, `.claude/`, `.cursor/`, `.antigravity/`), logs and temporary files (`*.log`, `.cache/`, `tmp/`) and local builds (`dist/`, `build/`, `.next/`). Existing user rules are preserved and repeated runs are idempotent.

At startup, `brain init` also checks NPM for a newer `brain-corp` version with a short timeout. Offline or slow networks skip the check silently. The check can be disabled with `BRAIN_SKIP_UPDATE_CHECK=1`.

For an existing clone or a partially initialized workspace, run the standalone hydration command without repeating onboarding:

```bash
brain hydrate
```

### 2. Define the ecosystem topology

`config/system-map.json` is the structural source of truth:

```json
{
  "repositories": [
    {
      "id": "example-api",
      "name": "example-api",
      "path": "sidecars/example-api",
      "remote": "git@github.com:example-org/example-api.git",
      "role": "provider"
    },
    {
      "id": "example-web",
      "name": "example-web",
      "path": "sidecars/example-web",
      "remote": "git@github.com:example-org/example-web.git",
      "role": "client"
    }
  ],
  "relationships": [
    {
      "from": "example-web",
      "to": "example-api",
      "type": "http-rest",
      "protocol": "HTTPS",
      "description": "example-web consumes the example-api API."
    }
  ]
}
```

The agent reads this map to understand which repository exposes a contract and which one consumes it.

### 3. Analyze a cross-repository feature

From the orchestrator root:

```text
/cross-analyze Add invoice export to example-web using example-api.
Check the API contract, data model and client consumption, then create a ticket.
```

The analyst workflow reviews:

- The provider contract in `example-api`.
- The client consumption in `example-web`.
- The relationship declared in `system-map.json`.
- Existing tickets to avoid duplicates.

The result is a Markdown ticket with traceability:

```text
.agents/tickets/backlog/TICK-001-invoice-export.md
```

### 4. Validate and synchronize tickets

```bash
brain sanity
brain sync
```

`brain sanity` audits ticket coherence before publishing. `brain sync` creates GitHub Issues only when the pre-flight sanity check passes.

To import issues created by other team members:

```bash
brain sync:pull
```

### 5. Move from ticket to SDD

```bash
brain init-work TICK-001
brain specify TICK-001
brain plan TICK-001
brain tasks TICK-001
brain implement TICK-001 --mode checkpoint
brain analyze TICK-001
```

The feature lives inside the resolved repository:

```text
<repo>/.brain/features/TICK-001/
├── spec.md
├── plan.md
├── tasks.md
├── contract.md
└── analysis.md
```

### 6. Create the pull request

```bash
brain pr TICK-001 --draft
```

`brain pr` uses the ticket and the workspace language to render the PR body, but it does not commit or push. The branch must already exist on the remote.

## Examples

### Example 1 — Bootstrap a fresh clone on a new machine

<!-- TODO: Insert video/GIF/image here. Suggested content: clone the orchestrator, run `brain init`, show sidecars being hydrated, `.gitignore` being generated and the workspace ready for work. -->

Suggested recording:

```bash
git clone <orchestrator-repo>
cd <orchestrator-repo>
brain init
```

Show:

- Sidecars cloned automatically.
- Submodules initialized when `.gitmodules` exists.
- Managed `.gitignore` generated without overwriting existing rules.
- NPM update check completes quickly or is skipped silently when offline.
- Agent assets provisioned and agent launched.

### Example 2 — Cross-repo analysis to ticket to SDD

<!-- TODO: Insert video/GIF/image here. Suggested content: run `/cross-analyze`, show the generated ticket, run `brain sanity`, `brain sync`, then `brain init-work` and `brain specify`. -->

Suggested recording:

```text
/cross-analyze Add invoice export to example-web using example-api
```

Then:

```bash
brain sanity
brain sync
brain init-work TICK-001
brain specify TICK-001
```

Show:

- The agent inspecting provider and client repositories.
- The generated ticket in `.agents/tickets/backlog/`.
- The issue created in GitHub.
- The SDD spec created in the correct sidecar.

### Example 3 — Submodule and gitlink safety

<!-- TODO: Insert video/GIF/image here. Suggested content: show a container with `.gitmodules`, run `brain init` or `brain hydrate`, then show an orphan gitlink being reported instead of cloned over. -->

Suggested recording:

```bash
brain init
# or
brain hydrate
```

Show:

- Native `git submodule sync --recursive`.
- Native `git submodule update --init --recursive`.
- Submodule status reported as synchronized.
- Orphan gitlink reported as an inconsistency instead of a flat clone.

## Limits

- `brain-corp` orchestrates; it does not implement product code or modify sidecars directly.
- `config/system-map.json` must stay current. A stale topology produces stale analysis.
- The agent only knows what the provisioned assets and the selected repositories expose.
- `gh` must be authenticated for repository discovery, Issues synchronization and pull requests.
- Submodule initialization depends on Git remote access and permissions.
- Different agents may produce different output quality even when using the same prompts and skills.
- `brain pr` creates the pull request but does not run commit or push.
- The automatic NPM update check has a short timeout and is skipped silently when offline.
- The managed `.gitignore` block assumes agent artifacts are local; teams that intentionally version shared agent configuration should review those rules.

## References

- [brain-corp on GitHub](https://github.com/Ragomez33/brain-corp)
- [brain-corp on npm](https://www.npmjs.com/package/@rgkoko/brain-corp)
- [Example topology map](https://github.com/Ragomez33/brain-corp/blob/main/config/system-map.example.json)
- [brain-corp README](https://github.com/Ragomez33/brain-corp#readme)
