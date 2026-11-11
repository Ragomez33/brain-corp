---
name: brain-corp-pr
description: Create, preview or register a pull request for a brain-corp ticket using the bundled template, without committing or pushing.
---

# Pull requests

Use this skill when the user asks to open, prepare, preview or register a pull request for a `TICK-XXX`.

## Prerequisites

- `brain` is available (otherwise use `npx @rgkoko/brain-corp`).
- GitHub CLI is authenticated (`gh auth status`).
- The ticket exists in `.agents/tickets/`.
- The branch is already pushed to the remote and the base branch exists.

`brain pr` does not commit, push, create branches or merge.

## Workflow

1. Read `.brain/memory/constitution.md`, the ticket and `config/system-map.json`.
2. Resolve the target repository. Use `--repo <id>` when `target_domain` is `shared`.
3. Optionally preview the body and command:

   ```bash
   brain pr TICK-XXX --dry-run
   ```

4. Create the pull request:

   ```bash
   brain pr TICK-XXX --base main
   ```

   Useful options: `--draft`, `--title`, `--summary`, `--spec-impact`, `--lang en|es`, `--json`.

   The template comes from `templates/pr/<lang>/` according to the workspace language unless `--lang` overrides it.

5. Register the delivery after the PR URL exists:

   ```bash
   brain complete TICK-XXX <PR_URL>
   ```

   Do not run `complete` before the PR exists.

## Guardrails

- Never run `git commit`, `git push`, `git merge` or create branches from this skill.
- Never open a PR against an unpushed branch.
- Do not fabricate a PR URL or issue number.
- Keep user-facing explanations in the workspace language; keep CLI output and flags as-is.
