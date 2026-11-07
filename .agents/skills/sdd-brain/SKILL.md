---
name: sdd-brain
description: Motor SDD nativo en .brain/ por repositorio (init-work, specify, plan, tasks, implement, analyze).
---

# SDD nativo en .brain/

Toda especificación y estado vive en el repositorio donde se implementa el código:

```text
<repo>/.brain/
├── active.json              ← ticket activo y fase actual
├── templates/               ← plantillas EARS (spec, plan, tasks, contract)
└── features/<TICK-XXX>/
    ├── spec.md              ← requisitos EARS
    ├── plan.md              ← estrategia técnica
    ├── tasks.md             ← tareas atómicas
    ├── contract.md          ← solo si cruza sidecars
    └── analysis.md          ← reporte de spec drift
```

## Flujo

1. `/init-work TICK-XXX [--repo <id>]`: crea la feature y fija `active.json`.
2. `/specify`: genera `spec.md` en EARS.
3. `/plan`: genera `plan.md`.
4. `/tasks`: genera `tasks.md`.
5. `/implement` (`--mode checkpoint|batch`): ejecuta tareas y marca checkboxes.
6. `/analyze`: audita coherencia y detecta spec drift.

## Reglas

- Lee `.brain/memory/constitution.md` antes de iniciar cualquier fase; es la memoria central y prevalece.
- Resuelve el repositorio desde `config/system-map.json` (`repositories[].path`).
- Si el ticket es `shared` o cruza `relationships`, genera `contract.md` en el repositorio base.
- Nunca dupliques specs globalmente: cada repositorio conserva la suya.
- El motor es 100% Node.js: no depende de scripts bash externos ni de carpetas de especificación fuera de `.brain/`.
