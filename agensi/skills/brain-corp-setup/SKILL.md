---
name: brain-corp-setup
description: Set up a brain-corp workspace, register sidecar repositories and initialize the CLI session.
summary: Initializes a multi-repository brain-corp workspace with the published @rgkoko/brain-corp CLI, including repository registration, language selection and agent provisioning.
version: 1.0.0
author: Ragomez33
license: MIT
tags: [developer-tools, orchestration, onboarding, multi-repo]
keywords: [brain-corp, setup, onboarding, sidecars, system-map, npm]
use_cases: [Bootstrap a brain-corp workspace, Register repositories as sidecars, Configure the workspace language and agent]
docs_url: https://github.com/Ragomez33/brain-corp#readme
compatibility: Requires Node.js 18+, npm/npx, git and GitHub CLI (gh). Network access is needed for npx.
---

# brain-corp setup

Use this skill when the user wants to initialize a brain-corp workspace, register repositories, configure the language or start the CLI session.

Read `../shared/cli-contract.md` and `../shared/language-boundary.md` first.

## Prerequisites

Verify from the workspace root, without changing directories:

```bash
command -v brain
brain --version
node --version
command -v gh
gh auth status
```

If `brain` is missing, use the pinned fallback:

```bash
npx @rgkoko/brain-corp@1.1.2 setup
npx @rgkoko/brain-corp@1.1.2 init
```

Only run `npm install -g @rgkoko/brain-corp@1.1.2` if the user explicitly approves a global install.

If `gh auth status` fails, ask the user to run `gh auth login` and stop until it succeeds.

## Workflow

1. **Register repositories.**

   Run `brain setup` (or the npx fallback). The wizard is interactive: do not invent repository selections, roles or URLs. Ask the user for the repositories and roles if they are not already provided.

   If your execution environment cannot handle interactive terminal prompts, ask the user to run the command in their own terminal and then inspect the generated files.

   Supported roles: `provider`, `client`, `standalone`.

2. **Initialize the session.**

   Run `brain init` (or the npx fallback). Ask the user for:
   - preferred workspace language (`en` or `es`),
   - GitHub Project (optional),
   - agent engine (optional).

   If the user already chose a language, pass `--lang en` or `--lang es`.

   If your execution environment cannot handle interactive terminal prompts, ask the user to run it in their own terminal and continue once it finishes.

3. **Verify the generated state.**

   Confirm these files exist and report them:

   - `config/system-map.json`
   - `.brain/config.json`
   - `.brainrc.json`

   Do not print or copy secrets from `.brainrc.json`.

4. **Report the next step.**

   Suggest `brain init-work TICK-XXX` once a ticket exists, or use the `brain-corp-ticket-ops` skill to import tickets.

## Guardrails

- Never run `git commit`, `git push` or `git merge`.
- Never modify product code while setting up the workspace.
- `brain setup` may offer to clone repositories; ask before cloning.
- Keep user-facing explanations in the workspace language; keep commands, flags and logs unchanged.
