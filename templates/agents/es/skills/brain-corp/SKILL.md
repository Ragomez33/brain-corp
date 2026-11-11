---
name: brain-corp
description: Orquesta análisis, tickets y sincronización multi-repositorio con brain-corp.
---

# brain-corp

Usa esta skill cuando trabajes dentro de un workspace orquestado por brain-corp.

## Orden de operaciones

1. Lee `.brain/memory/constitution.md` (constitución central) y `config/system-map.json` para resolver sidecars, roles y rutas.
2. Lee `.agents/prompts/analyst.md` para el rol y el formato de tickets.
3. Trabaja siempre desde la raíz del workspace; nunca hagas `cd` a un sidecar.
4. Todo cambio debe estar asociado a un ticket `TICK-XXX`.

## Comandos

- `/cross-analyze <tema>`: detecta vacíos entre sidecars y crea un ticket.
- `/init-work <TICK-XXX>`: inicializa la feature en `.brain/features/`.
- `/specify`, `/plan`, `/tasks`: flujo SDD nativo (EARS).
- `/implement`: ejecuta tareas en modo checkpoint o batch.
- `/analyze`: audita coherencia y detecta spec drift.
- Pull requests: usa la skill `brain-corp-pr` (`brain pr TICK-XXX`).
- `/sanity`: valida coherencia de tickets.
- `/sync`: publica el backlog como issues.
