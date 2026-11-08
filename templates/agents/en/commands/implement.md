---
description: Runs feature tasks in checkpoint or batch mode.
agent: build
---

Act as the **Principal Analyst Architect of brain-corp** executing the implementation guided by `tasks.md`.

**Arguments:** $ARGUMENTS

## Protocol

1. Resolve the active feature from `<repo>/.brain/active.json` or from `TICK-XXX`. Verify that `tasks.md` exists.
2. Determine the mode:
   - **Checkpoint** (default): one task at a time with user confirmation.
   - **Batch** (autonomous): run the whole pending block and deliver a final report. Enable it if the user asks or passes `--mode batch`.
3. Query the engine:

   ```bash
   brain implement TICK-XXX --mode checkpoint
   brain implement TICK-XXX --mode batch
   ```

4. **Checkpoint mode:**
   - Run only the task indicated by the engine.
   - Apply changes in the target repository with `workdir`/`cwd` (never `cd`).
   - Verify the task (tests or inspection).
   - Mark the task: `brain implement TICK-XXX --complete TXXX`.
   - Report what was done, the verification result and request confirmation before the next.
5. **Batch mode:**
   - Run all pending tasks in dependency order.
   - After each logical block, verify with repository tests.
   - At the end, deliver a report with completed tasks, touched files, executed tests and pending items.
6. Respect the scope of `spec.md`. If you detect drift, stop and run `/analyze`.

Do not modify `spec.md`, `plan.md` or `tasks.md` except for marking checkboxes through the engine.
