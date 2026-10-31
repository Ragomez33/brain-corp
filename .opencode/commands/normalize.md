---
description: Normaliza tickets con status needs_formatting y actualiza su Issue en GitHub.
agent: build
---

Actúa como el **Arquitecto Analista Principal de brain-corp** ejecutando la normalización de tickets.

**Argumento recibido:** `$ARGUMENTS`

## Modo Orquestador Raíz (obligatorio)

- Trabaja desde la raíz de `/Users/raulgomez/Desktop/brain-corp`; no uses `cd`.
- Resuelve rutas de sidecars, dominios y constituciones desde `config/system-map.json`.
- Usa `workdir`/`cwd` cuando una herramienta necesite ejecutarse en un sidecar.

## Paso 1 — Seleccionar el ticket

1. Si el argumento contiene un ID (`TICK-XXX`, `ticket#XXX`) o un número de issue, localízalo en `.agents/tickets/` o mediante `gh issue view`.
2. Si no hay argumento, ejecuta `node scripts/normalize-ticket.js --json` y muestra al usuario la lista de tickets pendientes para que elija uno.
3. Lee el ticket completo. Debe tener `status: "needs_formatting"`; si no, informa y detente.

## Paso 2 — Analizar el contenido

1. Lee `config/system-map.json`.
2. Analiza el texto plano del ticket (título y cuerpo) e infiere el `target_domain`:
   - `forge-backend`, `forge-front`, `foundly-pos` o `shared`.
   - Usa la sugerencia de `node scripts/normalize-ticket.js --json` como punto de partida, pero valida con el contenido real y los dominios del mapa.
3. Si el dominio no puede inferirse con confianza, formula una sola pregunta de clarificación al usuario antes de continuar.

## Paso 3 — Reescribir el ticket

Reestructura el archivo local con:

- Frontmatter YAML estricto:

```yaml
---
id: "TICK-XXX"
title: "Título descriptivo"
author: "Brain-Corp Analyst"
target_domain: "forge-backend | forge-front | foundly-pos | shared"
status: "backlog"
created_at: "YYYY-MM-DD"
dependencies: []
github_issue: <numero>
---
```

- Cuerpo con las tres secciones obligatorias:
  - `## Contexto / Hallazgo`: conserva el texto original del usuario y aclara el problema.
  - `## Requerimientos Técnicos`: requisitos concretos, contratos, endpoints/mutaciones, validaciones y criterios de aceptación.
  - `## Impacto en la Arquitectura`: repositorios, capas, datos, multi-tenancy y dependencias afectadas.

Reglas:

- No inventes información de negocio. Si falta un dato crítico, formúlalo como supuesto explícito o pregunta.
- No elimines el contenido original: intégralo en Contexto/Hallazgo.
- Conserva `github_issue` si existe.
- Mantén el ticket en `.agents/tickets/backlog/` con `status: "backlog"`.

## Paso 4 — Actualizar GitHub

1. Si el ticket tiene `github_issue`, ejecuta:

```bash
node scripts/normalize-ticket.js --push <ruta-al-ticket>
```

   Esto ejecuta internamente `gh issue edit <numero> --body-file <ruta-al-ticket>`.

2. Si no tiene `github_issue`, informa que solo se normalizó localmente.

## Paso 5 — Reportar

Devuelve un resumen breve con:

- Ticket normalizado y ruta final.
- `target_domain` inferido y justificación en una frase.
- Si el Issue de GitHub fue actualizado y su número.
- Supuestos o clarificaciones pendientes.
