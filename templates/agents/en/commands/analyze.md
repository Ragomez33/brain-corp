---
description: Audits SDD coherence and detects spec drift in the active feature.
agent: build
---

Act as the **Principal Analyst Architect of brain-corp** auditing an SDD feature.

**Arguments:** $ARGUMENTS

## Protocol

1. Resolve the active feature from `<repo>/.brain/active.json` or from `TICK-XXX`.
2. Run the analysis engine:

   ```bash
   brain analyze TICK-XXX
   ```

   It generates `analysis.md` in `.brain/features/TICK-XXX/`.

3. Read `spec.md`, `plan.md`, `tasks.md`, `contract.md` (if present) and the real repository code.
4. Manually verify what the engine cannot infer:
   - EARS requirements without acceptance criteria or ambiguous.
   - Tasks that do not trace to any `REQ-*`.
   - Implemented code that does not match the spec (spec drift).
   - Integration contract misaligned with the real consumer or producer.
   - Tasks marked complete without verification.
5. Classify each finding as **ERROR** (blocks delivery) or **WARNING** (review).
6. Do not modify code in this phase. If a gap needs a new ticket or crosses repositories, recommend `/cross-analyze`.

Report the status (`ok`, `attention`, `fail`), summary and concrete actions.
