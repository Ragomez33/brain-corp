# Integration Contract: {{TICKET_TITLE}}

- **Ticket**: {{SOURCE_TICKET}}
- **Base repository**: {{REPO_ID}}
- **Domain**: {{TARGET_DOMAIN}}
- **Date**: {{DATE}}
- **Status**: Draft

## Cross-sidecar scope

- **Producer**: [repository that exposes the contract.]
- **Consumers**: [repositories that depend on the contract.]

## Data or API contract

| Operation | Type | Input | Output | Notes |
| --- | --- | --- | --- | --- |
| [name] | [REST / GraphQL / event] | [payload] | [payload] | [notes] |

## Errors and validations

- **ERR-001**: [code or case] — [meaning and expected response.]

## Compatibility and versioning

- **Version**: [semver or schema.]
- **Change strategy**: [additive, deprecation, migration.]
- **Backward compatibility**: [yes/no and conditions.]

## Integration sequence

1. [Step in the producer.]
2. [Step in the consumer.]
3. [Joint verification.]
