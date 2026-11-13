# Use brain-corp as your multi-repo orchestration layer

## Problem

When you work in a multi-repository ecosystem, opening a single repo and asking the agent to change or create a feature only gives it visibility into that repo. The API contract, domain model, client consumption, topology, tickets and SDD specs live somewhere else. The agent guesses conventions, or you paste documentation excerpts into every prompt.

`brain-corp` acts as the coordination layer for the whole ecosystem. It records the repository topology, provisions the AI agent with the workspace rules, analyzes cross-repo integration gaps, creates tickets, synchronizes them with GitHub Issues and routes each ticket to an SDD specification inside the correct repository.

It also solves the "new machine" problem: a fresh clone of the orchestrator can hydrate its sidecars, initialize Git submodules, generate a managed `.gitignore` and leave the workspace ready to use.

## Tools used

| Tool | Version | Why it is needed |
| --- | --- | --- |
| `brain-corp` | `v2.3.2` | Orchestration CLI: topology, tickets, SDD, audits, agent provisioning and workspace hydration. |
| Node.js | `>=18` | Runtime required by the CLI and its native `fetch`-based update check. |
| Git | Current stable | Sidecar cloning, submodule synchronization and repository validation. |
| GitHub CLI (`gh`) | Authenticated | Repository discovery, GitHub Projects, Issues synchronization and pull requests. |
| AI agent | OpenCode, Claude Code, Cursor or Antigravity | Executes the analysis, ticket and SDD workflows using the assets provisioned by `brain-corp`. |
| Local agent commands | `/cross-analyze`, `/sanity-check`, `/normalize`, `/sync`, `/complete`, `/hotfix` | Ticket lifecycle: cross-repo analysis, pre-flight audit, normalization, publication and delivery closure. |
| SDD commands | `/init-work`, `/specify`, `/plan`, `/tasks`, `/implement`, `/analyze` | Turn a ticket into a local specification inside the resolved repository. |
| `brain hydrate` | Local command | Reconciles `system-map.json` with disk: clones missing sidecars, synchronizes submodules and reports orphan gitlinks. |
| `brain audit` | Local command | Native audits: `dead-code`, `debt-radar`, `contract-guard` and `security-scan`. |

## AI Workflow

### 1. Install and bootstrap a new orchestrator workspace

```bash
npm install -g @rgkoko/brain-corp@latest

mkdir my-orchestrator
cd my-orchestrator

brain setup
brain init
```

`brain setup` discovers repositories through `gh api`, lets you assign each one a role (`provider`, `client` or `standalone`), writes the topology to `config/system-map.json` and offers to clone the selected repositories with `gh repo clone`. Paths are generated as `sidecars/<repo>`. When `gh` is unavailable, `brain setup --manual` registers repositories by URL or local path.

`brain init` then:

- Asks for the workspace language (`en` or `es`; also `--lang en|es` or `BRAIN_LANG`) and stores it in `.brain/config.json`.
- Validates the configured GitHub Project when one is set.
- Creates or completes a managed `.gitignore` block.
- Hydrates missing sidecars using `remote`, `sshUrl` or `url` from `config/system-map.json`.
- Skips repositories that already contain a valid Git work tree.
- Synchronizes Git submodules when `.gitmodules` exists:
  `git submodule sync --recursive` and `git submodule update --init --recursive`.
- Validates declared submodules and detects orphan gitlinks instead of cloning over the container index.
- Isolates per-sidecar failures so one broken repository does not abort the whole bootstrap.
- Runs an initial `sync:pull` to import existing GitHub Issues as local tickets.
- Provisions prompts, skills, commands and SDD templates for the selected agent and language.
- Optionally starts the GitHub Issues watcher.
- Launches the configured agent.

The managed `.gitignore` covers local state (`.brainrc.json`, `.brain/active.json`), agent/IDE artifacts (`.agents/`, `.opencode/`, `.claude/`, `.cursor/`, `.antigravity/`), logs and temporary files (`*.log`, `.cache/`, `tmp/`) and local builds (`dist/`, `build/`, `.next/`). Existing user rules are preserved and repeated runs are idempotent.

Agent provisioning installs the local commands `/cross-analyze`, `/init-work`, `/specify`, `/plan`, `/tasks`, `/implement`, `/analyze`, `/normalize`, `/sanity-check`, `/sanity`, `/sync`, `/complete` and `/hotfix`. OpenCode uses `.opencode/commands/`, with equivalent structures for Claude Code (`.claude/commands/`), Cursor (`.cursor/rules/`) and Antigravity (`.antigravity/rules/`); `AGENTS.md` acts as a generic entry point.

The native audit suite is available to every user with no license or activation step:

```bash
brain audit dead-code       # orphan exports and estimated bundle savings
brain audit debt-radar      # TODO/FIXME/any + git age + cross-sidecar friction
brain audit contract-guard  # breaking changes in schemas and contract.md
brain audit security-scan   # EARS requirements vs security controls in code
```

Options: `--root <dir>`, `--repo <id>`, `--ticket <TICK-XXX>`, `--json`. From a source checkout, run `npm run build` before using the audits.

At startup, `brain init` also checks NPM for a newer `brain-corp` version with a short timeout. Offline or slow networks skip the check silently. When a newer version exists, the CLI offers to install it. The check can be disabled with `BRAIN_SKIP_UPDATE_CHECK=1`.

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

Tickets move through `needs_formatting → backlog → in-analysis → ready → done`. The frontmatter `id` is the canonical identity and must match the file-name prefix; `github_issue` only links to the GitHub issue, so ticket IDs and issue numbers are independent. Issues imported without valid frontmatter land as `needs_formatting` and must pass through `/normalize` before analysis.

### 4. Validate and synchronize tickets

```bash
brain sanity
brain sync
```

`brain sanity` audits ticket coherence before publishing (IDs, states, dependencies, cycles, duplicates, file-name/id mismatches, duplicate `github_issue` values and client→provider rules). Add `--write` to record `.agents/tickets/.sanity-check.json`. `brain sync` repairs legacy IDs and file-name mismatches, runs the pre-flight sanity check and creates GitHub Issues only when it passes; `--skip-sanity` (or `BRAIN_SKIP_SANITY=1`) forces publication.

To import issues created by other team members:

```bash
brain sync:pull
```

`sync:pull` imports open and closed issues, infers `backlog`/`done`, names strict tickets from their frontmatter `id` (never from the issue number) and repairs legacy IDs and mismatched file names.

Tickets that arrive without valid frontmatter are marked `needs_formatting`; normalize them before analysis, and keep the watcher running for continuous synchronization:

```bash
brain normalize
brain watch
```

Close a delivered ticket and record its pull request:

```bash
brain complete TICK-001 [PR]
```

For an urgent fix, `brain hotfix --title "..." --domain <sidecar> --module <module> --spec-impact none` creates the ticket, prepares the `fix/TICK-XXX-slug` branch in the sidecar and suggests the commit; `--publish` also creates the issue.

### 5. Move from ticket to SDD

```bash
brain init-work TICK-001
brain specify TICK-001
brain plan TICK-001
brain tasks TICK-001
brain implement TICK-001 --mode checkpoint
brain analyze TICK-001
```

`init-work` is optional: `specify` runs it automatically when the feature does not exist yet. `implement` supports `checkpoint` (one task and confirmation) or `batch` (autonomous block). For a `shared` ticket, choose the base repository with `--repo <id>`.

The feature lives inside the resolved repository; the workspace keeps the shared memory:

```text
<repo>/.brain/
├── active.json
├── templates/
└── features/TICK-001/
    ├── spec.md
    ├── plan.md
    ├── tasks.md
    ├── contract.md   (only when the ticket is shared or crosses relationships)
    └── analysis.md

<workspace>/.brain/
├── config.json
└── memory/           (central constitution, not duplicated per sidecar)
```

`analyze` resolves task paths against both the base repository and the workspace root, so `shared` tickets can reference `sidecars/<repo>/...` directly.

### 6. Create the pull request

```bash
brain pr TICK-001 --draft
```

`brain pr` uses the ticket and the workspace language (`templates/pr/en` or `templates/pr/es`) to render the PR body, then runs `gh pr create` in the resolved sidecar. Options include `--base`, `--repo`, `--title`, `--body-file`, `--draft`, `--dry-run`, `--json` and `--lang`. It does not commit or push: the branch must already exist on the remote.

Before calling `gh`, the command validates the Git state: it fails if the current branch equals the base, if `origin` is missing, or if the branch/base is not published to `origin`, and it warns about uncommitted changes.

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
- Language selected and stored in `.brain/config.json`.
- Existing GitHub Issues imported through `sync:pull`.
- NPM update check completes quickly or is skipped silently when offline, and offers an update when one exists.
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
- The generated ticket in `.agents/tickets/backlog/` with its canonical `id` in the frontmatter.
- The ticket moving through `backlog → in-analysis → ready` as it is worked on.
- The issue created in GitHub and linked through `github_issue`.
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
- `brain pr` validates the Git state first and only creates the pull request; it does not run commit or push.
- `contract.md` is generated only for `shared` tickets or those crossing declared relationships.
- Ticket IDs are canonical; GitHub issue numbers are independent and only stored in `github_issue`.
- The audit suite requires a built `dist/` when run from a source checkout (`npm run build`).
- The automatic NPM update check has a short timeout and is skipped silently when offline.
- The managed `.gitignore` block assumes agent artifacts are local; teams that intentionally version shared agent configuration should review those rules.

## References

- [brain-corp on GitHub](https://github.com/Ragomez33/brain-corp)
- [brain-corp on npm](https://www.npmjs.com/package/@rgkoko/brain-corp)
- [Example topology map](https://github.com/Ragomez33/brain-corp/blob/main/config/system-map.example.json)
- [brain-corp README](https://github.com/Ragomez33/brain-corp#readme)
