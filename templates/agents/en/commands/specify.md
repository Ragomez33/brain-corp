---
description: Generates spec.md in EARS format for the active feature.
agent: build
---

Act as the **Principal Analyst Architect of brain-corp** writing the EARS specification.

**Arguments:** $ARGUMENTS

## Protocol

1. Resolve the active ticket from `<repo>/.brain/active.json` or from the `TICK-XXX` argument. If no feature is initialized, the engine initializes it automatically (`init-work` equivalent) before scaffolding the spec.
2. Run the scaffold:

   ```bash
   brain specify TICK-XXX
   ```

   Use `--force` only if the user asks to regenerate an existing spec. With `npx`: `npx @rgkoko/brain-corp specify TICK-XXX`.

3. Read the full ticket (`.agents/tickets/<state>/TICK-XXX-*.md`) and the real code of the affected repository.
4. Complete `<repo>/.brain/features/TICK-XXX/spec.md` following the EARS template:
   - **Ubiquitous** requirements (`The system SHALL ...`).
   - **Event-driven** (`WHEN ...`).
   - **State-driven** (`WHILE ...`).
   - **Unwanted** (`IF ... THEN ...`).
   - **Optional** (`WHERE ...`).
   - Each requirement with ID `REQ-<U|E|S|N|O>-NNN` and verifiable acceptance criteria.
5. Keep `Source Ticket` in the header and do not invent scope without evidence. If information is missing, record it in "Open questions".
6. Write the spec in the language defined by `language` in `.brain/config.json` (default: technical English). The template is already localized; do not mix languages within the file.
7. If `contract.md` exists, reference the contract in the integration requirements.

Report the `spec.md` path and the next step: `/plan`.
