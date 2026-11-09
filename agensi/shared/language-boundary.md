# Language boundary

brain-corp separates the engine language from the user language.

## Engine

The engine, CLI errors, diagnostics, logs, warnings, command names, flags, JSON keys and code remain in technical English. Do not translate them.

## Workspace language

Resolve the user-facing language in this order:

1. `language` in `.brain/config.json` (`en` or `es`).
2. `BRAIN_LANG` environment variable.
3. `language` in `~/.brain/config.json`.
4. Default: `en`.

Use the resolved language for:

- `spec.md`, `plan.md`, `tasks.md` and `contract.md`;
- ticket body prose;
- pull request prose;
- user-facing explanations and summaries.

## Canonical ticket sections

Canonical English sections:

- `## Context / Finding`
- `## Technical Requirements`
- `## Architecture Impact`
- `## Delivery`

Legacy Spanish sections are accepted by the validator:

- `## Contexto / Hallazgo`
- `## Requerimientos Técnicos`
- `## Impacto en la Arquitectura`
- `## Entrega`

Do not mix languages inside a single artifact.
