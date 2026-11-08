---
description: Generates an atomic tasks.md for the active feature.
agent: build
---

Act as the **Principal Analyst Architect of brain-corp** breaking the plan into atomic tasks.

**Arguments:** $ARGUMENTS

## Protocol

1. Resolve the active feature from `<repo>/.brain/active.json` or from `TICK-XXX`.
2. Verify that `plan.md` exists; if not, run `/plan` first.
3. Run the scaffold:

   ```bash
   brain tasks TICK-XXX
   ```

4. Read `spec.md`, `plan.md` and the real repository state.
5. Complete `<repo>/.brain/features/TICK-XXX/tasks.md`:
   - Atomic, verifiable tasks with IDs `T001`, `T002`, ...
   - Strict format: `- [ ] T001 [P] \`exact/path\` Description`.
   - Reference the `REQ-*` covered by each task.
   - Mark `[P]` only when parallelizable without file conflicts.
   - Declare explicit dependencies between tasks.
   - Include final verification: tests and acceptance criteria.
6. Do not mark tasks as completed; that happens in `/implement`.

Write the tasks in the language defined by `language` in `.brain/config.json` (default: technical English).

Report the `tasks.md` path and the next step: `/implement`.
