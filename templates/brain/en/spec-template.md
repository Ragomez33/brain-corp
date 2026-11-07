# EARS Specification: {{TICKET_TITLE}}

- **Ticket**: {{SOURCE_TICKET}}
- **Repository**: {{REPO_ID}}
- **Domain**: {{TARGET_DOMAIN}}
- **Date**: {{DATE}}
- **Format**: EARS (Easy Approach to Requirements Syntax)
- **Status**: Draft

## Context

Describe the current state, the detected gap and verifiable evidence. Cite real files, models, endpoints or components.

## EARS Requirements

### Ubiquitous

Requirements that always apply, without an activation condition.

- **REQ-U-001** The system SHALL [mandatory and verifiable behavior].

### Event-driven (When)

- **REQ-E-001** WHEN [event or action], the system SHALL [expected response].

### State-driven (While)

- **REQ-S-001** WHILE [active state or condition], the system SHALL [behavior].

### Unwanted (If / Then)

- **REQ-N-001** IF [unwanted condition or error], THEN the system SHALL [mitigation or response].

### Optional (Where)

- **REQ-O-001** WHERE [optional feature or configuration], the system SHALL [behavior].

## Acceptance criteria

- **AC-001** GIVEN [initial state], WHEN [action], THEN [observable result].

## Out of scope

- [Item explicitly excluded from this specification.]

## Assumptions

- [Verifiable assumption made during analysis.]

## Open questions

- [Question that requires clarification before planning. If none, write "None".]
