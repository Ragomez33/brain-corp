---
name: brain-corp-sdd
description: Run the native brain-corp Spec-Driven Development flow for a ticket, from init-work through analyze.
summary: Drives init-work, specify, plan, tasks, implement and analyze using the pinned @rgkoko/brain-corp CLI and the workspace language.
version: 1.0.0
author: Ragomez33
license: MIT
tags: [sdd, spec-driven-development, planning, ears, implementation]
keywords: [brain-corp, sdd, init-work, specify, plan, tasks, implement, analyze, ears]
use_cases: [Start an SDD feature, Generate spec plan and tasks, Implement a feature in checkpoint or batch mode, Audit spec drift]
docs_url: https://github.com/Ragomez33/brain-corp#readme
compatibility: Requires Node.js 18+, npm/npx and git. Network access is needed for npx.
---

# brain-corp SDD

Use this skill when the user wants to turn a ticket into a specification, plan, tasks or implementation using brain-corp.

Read `../shared/cli-contract.md` and `../shared/language-boundary.md` first.

## Prerequisites

```bash
command -v brain
brain --version
```

If missing, use `npx @rgkoko/brain-corp@1.1.2 <command>`.

The ticket must exist in `.agents/tickets/<state>/TICK-XXX-*.md`.

## Workflow

1. **Resolve the ticket and repository.**
   - Read the ticket and `config/system-map.json`.
   - Use `target_domain` to resolve the base repository.
   - If `target_domain` is `shared`, ask the user which repository is the base and pass `--repo <id>`.

2. **Initialize the feature.**

   ```bash
   brain init-work TICK-XXX [--repo <id>]
   ```

   This creates `.brain/features/TICK-XXX/`, copies templates, sets `.brain/active.json` and generates `contract.md` when the feature crosses sidecars.

3. **Write the specification.**

   ```bash
   brain specify TICK-XXX
   ```

   Complete `spec.md` in EARS format. Use `REQ-<U|E|S|N|O>-NNN` identifiers and verifiable acceptance criteria. Keep `Source Ticket` in the header. Write in the workspace language.

4. **Write the plan.**

   ```bash
   brain plan TICK-XXX
   ```

   Complete `plan.md` with technical context, decisions, layer changes, integration, risks and testing strategy.

5. **Write the tasks.**

   ```bash
   brain tasks TICK-XXX
   ```

   Complete `tasks.md` with atomic tasks, exact paths, `[P]` markers and `REQ-*` references.

6. **Implement.**

   Checkpoint mode:

   ```bash
   brain implement TICK-XXX --mode checkpoint
   brain implement TICK-XXX --complete TXXX
   ```

   Batch mode:

   ```bash
   brain implement TICK-XXX --mode batch
   ```

   Apply code changes only in the resolved sidecar. Never use `cd`; pass `workdir`/`cwd` to tools. Verify each task before marking it complete.

7. **Audit.**

   ```bash
   brain analyze TICK-XXX
   ```

   Read `analysis.md`, inspect the real code and report drift. Stop and ask the user before expanding scope.

8. **Pull request.**

   After `analyze` passes, use the `brain-corp-pr` skill.

## Guardrails

- Do not invent requirements, APIs, files or task IDs.
- Do not modify `spec.md`, `plan.md` or `tasks.md` outside the engine workflow, except filling their content.
- Do not commit or push.
- If a command fails, report the exact error and stop the phase.
- Keep engine output in English and write artifacts in the workspace language.
