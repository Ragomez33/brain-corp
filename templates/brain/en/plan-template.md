# Technical Plan: {{TICKET_TITLE}}

- **Ticket**: {{SOURCE_TICKET}}
- **Repository**: {{REPO_ID}}
- **Domain**: {{TARGET_DOMAIN}}
- **Spec**: `.brain/features/{{TICKET_ID}}/spec.md`
- **Date**: {{DATE}}

## Summary

Extract the primary requirement from the spec and the technical strategy to fulfill it.

## Technical context

- **Stack**: [relevant languages, frameworks and versions.]
- **Dependencies**: [libraries or services and their versions.]
- **Persistence**: [database, schema or N/A.]
- **Testing**: [framework and verification commands.]
- **Constraints**: [performance, compatibility, security or N/A.]

## Architecture decisions

- **ADR-001**: [decision] — [rationale and rejected alternative.]

## Changes by layer

| Layer | File or module | Change |
| --- | --- | --- |
| Data | [path] | [change] |
| Domain or service | [path] | [change] |
| Contract or API | [path] | [change] |
| Client or UI | [path] | [change] |

## Cross-sidecar integration

Indicate whether this feature consumes or exposes a contract to other repositories. If so, link `.brain/features/{{TICKET_ID}}/contract.md`.

## Testing strategy

- **Unit**: [what is tested and where.]
- **Integration**: [flow and dependencies.]
- **Manual or E2E**: [validation steps.]

## Risks and mitigation

| Risk | Impact | Mitigation |
| --- | --- | --- |
| [risk] | [impact] | [mitigation] |
