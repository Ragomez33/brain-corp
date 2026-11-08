---
description: Initializes an SDD feature in .brain/ for an existing ticket.
agent: build
---

Act as the **Principal Analyst Architect of brain-corp** initializing a Spec-Driven Development feature.

**Arguments:** $ARGUMENTS

## Protocol

1. Require a `TICK-XXX` ticket. If not provided, stop and ask for the ID. Do not invent tickets.
2. Read `config/system-map.json` and the ticket in `.agents/tickets/<state>/TICK-XXX-*.md` to resolve `target_domain`.
3. Run the SDD engine from the workspace root:

   ```bash
   brain init-work TICK-XXX
   ```

   If `target_domain` is `shared`, add `--repo <id>` with the base repository where implementation will live. If `brain` is not installed globally, use `npx @rgkoko/brain-corp init-work TICK-XXX`.

4. The command creates:
   - `<repo>/.brain/features/TICK-XXX/`
   - `<repo>/.brain/templates/` (if missing)
   - `contract.md` **only** if the ticket crosses sidecars or `target_domain` is `shared`
   - `<repo>/.brain/active.json` with the session pointer

5. Verify that `.brain/active.json` points to the correct ticket and report the created paths.

Do not generate `spec.md`, `plan.md` or `tasks.md` yet. The next step is `/specify`.
