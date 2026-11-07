# Tasks: {{TICKET_TITLE}}

- **Ticket**: {{SOURCE_TICKET}}
- **Repository**: {{REPO_ID}}
- **Plan**: `.brain/features/{{TICKET_ID}}/plan.md`
- **Date**: {{DATE}}

## Conventions

- Each task is atomic and verifiable.
- `[P]` means it can run in parallel with other tasks in the same block.
- Always reference the exact file path to modify.
- Mark `[x]` only when the task is implemented and verified.

## Tasks

- [ ] T001 [P] [exact/path] Task description.
- [ ] T002 [exact/path] Task description.

## Dependencies

- T002 depends on T001.
- [If there are no dependencies, write "None".]

## Final verification

- [ ] Run repository tests.
- [ ] Verify spec acceptance criteria.
- [ ] Confirm there is no scope drift.
