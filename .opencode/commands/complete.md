---
description: Cierra un ticket, registra el PR y lo mueve a .agents/tickets/done/.
agent: build
---

Actúa como el **Arquitecto Analista Principal de brain-corp** cerrando la entrega de un ticket.

**Argumento recibido:** `$ARGUMENTS`

## Modo Orquestador Raíz (obligatorio)

- Trabaja siempre desde la raíz de brain-corp; no uses `cd`.
- No modifiques código de producto en `sidecars/`.
- Usa los scripts de `.agents`/`scripts` como fuente de verdad del estado del ticket.

## Paso 1 — Interpretar argumentos

`$ARGUMENTS` debe contener:

1. Un ID de ticket con formato `TICK-XXX` (obligatorio).
2. Opcionalmente, una URL o número de PR (por ejemplo `https://github.com/org/repo/pull/42` o `42`).

Si falta el ID, pide al usuario que lo indique y detente. Si el ID no existe o es ambiguo, informa y detente sin modificar archivos.

## Paso 2 — Ejecutar el cierre

Ejecuta:

```bash
node scripts/complete-ticket.js <TICK-XXX> [PR] --json
```

El script realiza, en este orden:

1. Localiza el ticket en cualquier carpeta de estado (`.agents/tickets/backlog|in-analysis|ready|done`).
2. Cambia `status` a `"done"` en el frontmatter.
3. Añade o actualiza la sección `## Entrega` en el cuerpo con la referencia del PR (si se proporcionó) y la fecha de completado.
4. Mueve el archivo a `.agents/tickets/done/`.
5. Si el ticket tiene `github_issue`, ejecuta `gh issue close <numero> --reason completed` y, cuando hay PR, añade un comentario con la referencia.

Opciones disponibles: `--repo <owner/repo>` para forzar el repositorio de GitHub, `--skip-close` para no cerrar el issue, `--dry-run` para simular sin escribir ni cerrar, `--json` para salida estructurada.

## Paso 3 — Manejar resultados

- Si el script termina correctamente, reporta: ticket, ruta final, estado, PR registrado e issue cerrado (o motivo por el que se omitió).
- Si el cierre de GitHub falla por autenticación, pide ejecutar `gh auth login` y reejecutar el script. El ticket local ya habrá quedado en `done/`.
- Si el ticket no tenía `github_issue`, indica que solo se completó localmente.
- No edites manualmente el frontmatter ni muevas el archivo si el script falló antes de completar; en ese caso informa el error exacto.

## Paso 4 — Verificación final

Confirma que:

- El archivo está en `.agents/tickets/done/`.
- El frontmatter contiene `status: "done"`.
- El cuerpo contiene la sección `## Entrega` con `- PR:` (si se proporcionó) y `- Completado:`.
- El issue de GitHub quedó cerrado o se explicó la omisión.
