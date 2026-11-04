---
name: brain-corp
description: Orquesta análisis, tickets y sincronización multi-repositorio con brain-corp.
---

# brain-corp

Usa esta skill cuando trabajes dentro de un workspace orquestado por brain-corp.

## Orden de operaciones

1. Lee `config/system-map.json` para resolver sidecars, roles y rutas.
2. Lee `.agents/prompts/analyst.md` para el rol y el formato de tickets.
3. Trabaja siempre desde la raíz del workspace; nunca hagas `cd` a un sidecar.
4. Todo cambio debe estar asociado a un ticket `TICK-XXX`.

## Comandos

- `/analyze <tema>`: detecta vacíos y crea un ticket.
- `/sanity`: valida coherencia de tickets.
- `/sync`: publica el backlog como issues.
- `/speckit.specify` y siguientes: flujo nativo de especificación.
