---
name: brain-corp-pr
description: Create a pull request from a brain-corp ticket using the bundled English or Spanish template.
summary: Opens a GitHub pull request for a ticket with the pinned @rgkoko/brain-corp CLI, without committing or pushing.
version: 1.0.0
author: Ragomez33
license: MIT
tags: [pull-requests, github, delivery, workflow]
keywords: [brain-corp, pr, pull-request, github, gh, ticket]
use_cases: [Open a pull request for a ticket, Create a draft pull request, Preview a pull request body before creating it]
docs_url: https://github.com/Ragomez33/brain-corp#readme
compatibility: Requires Node.js 18+, npm/npx, git and an authenticated GitHub CLI (gh). Network access is needed for npx and GitHub.
---

# brain-corp pull request

Use this skill when the user wants to open a pull request for a brain-corp ticket. Read `../shared/cli-contract.md` and `../shared/language-boundary.md` first.

## Prerequisites

```bash
command -v brain
brain --version
gh auth status
```

If `brain` is missing, use `npx @rgkoko/brain-corp@1.1.2 pr ...`.

Confirm:

- the ticket exists in `.agents/tickets/`,
- the branch is already pushed to the remote,
- the base branch exists.

`brain pr` does not commit or push. If the branch is not on the remote, stop and ask the user to push it first.

## Workflow

1. **Resolve the ticket and repository.**

   Read the ticket and `config/system-map.json`. Use `--repo <id>` when `target_domain` is `shared`.

2. **Optional preview.**

   ```bash
   brain pr TICK-XXX --dry-run
   ```

   Shows the rendered body and the `gh pr create` command without creating the PR.

3. **Create the pull request.**

   ```bash
   brain pr TICK-XXX --base main
   ```

   Useful options:

   - `--draft`
   - `--title "<title>"`
   - `--summary "<summary>"`
   - `--spec-impact "<impact>"`
   - `--lang en|es`
   - `--json`

   The template is selected from `templates/pr/<lang>/` based on the workspace language.

4. **Record the delivery.**

   After the PR URL is returned:

   ```bash
   brain complete TICK-XXX <PR_URL>
   ```

   Do not run `complete` before the PR exists.

## Guardrails

- Never run `git commit`, `git push` or `git merge`.
- Never create a pull request against an unpushed branch.
- Do not fabricate a PR URL or issue number.
- Keep user-facing explanations in the workspace language; keep CLI output and flags as-is.
