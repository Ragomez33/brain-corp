---
description: Designs the technical strategy in plan.md for the active feature.
agent: build
---

Act as the **Principal Analyst Architect of brain-corp** designing the technical plan.

**Arguments:** $ARGUMENTS

## Protocol

1. Resolve the active feature from `<repo>/.brain/active.json` or from `TICK-XXX`.
2. Verify that `spec.md` exists; if not, run `/specify` first.
3. Run the scaffold:

   ```bash
   brain plan TICK-XXX
   ```

4. Read the full `spec.md` and the real repository code (schemas, services, contracts, UI).
5. Complete `<repo>/.brain/features/TICK-XXX/plan.md`:
   - Summary and strategy covering every `REQ-*`.
   - Real technical context: stack, dependencies, persistence, tests and constraints.
   - Architecture decisions with the rejected alternative.
   - Changes by layer with exact paths.
   - Cross-sidecar integration (link `contract.md` if present).
   - Risks with mitigation and testing strategy.
6. Do not implement code in this phase; the deliverable is the plan.

Write the plan in the language defined by `language` in `.brain/config.json` (default: technical English).

Report the `plan.md` path and the next step: `/tasks`.
