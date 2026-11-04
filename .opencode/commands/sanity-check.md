---
description: Audita y corrige la coherencia de los tickets antes de sincronizarlos con GitHub.
agent: build
---

Actúa como el **Arquitecto Analista Principal de brain-corp** ejecutando un sanity check previo a la sincronización con GitHub.

**Argumento recibido:** `$ARGUMENTS`

## Modo Orquestador Raíz (obligatorio)

- Trabaja siempre desde la raíz de brain-corp; no uses `cd`.
- Resuelve las rutas de los sidecars desde `config/system-map.json` (`repositories[].path`).
- Usa `workdir`/`cwd` cuando una herramienta necesite ejecutarse en un sidecar.
- Los tickets viven en `.agents/tickets/`; no modifiques código de producto en `sidecars/`.

## Paso 1 — Recolectar entradas

1. Ejecuta `node scripts/sanity-check.js --write --json` y conserva su resultado como validación estructural base (IDs, campos, estados, dependencias, ciclos, duplicados, reglas UI→Backend).
2. Lee todos los tickets de `.agents/tickets/backlog/`. Revisa también `in-analysis/`, `ready/` y `done/` para resolver dependencias y detectar duplicados contra tickets ya existentes.
3. Lee `config/system-map.json` y localiza los esquemas, contratos y consumidores reales de cada sidecar usando `repositories[].path`, `stack`, `domains` y `specs`:
   - En sidecars `provider`: esquemas de datos, migraciones, endpoints, resolvers o servicios.
   - En sidecars `client`: clientes de API, servicios, vistas y tipos.
   - En sidecars `standalone`: esquemas locales, módulos y flujos propios.
4. Si `$ARGUMENTS` contiene IDs (`TICK-XXX`), limita la auditoría a esos tickets y a sus dependencias directas.

## Paso 2 — Análisis cruzado

Para cada ticket verifica, con evidencia de archivos y nombres reales:

1. **Contradicciones Client ↔ Provider.** Compara lo que un ticket de un sidecar `client` afirma sobre queries, mutaciones, campos, enums o tipos contra el esquema, contrato y código real del sidecar `provider`. Marca contradicción cuando el client asuma un contrato que el provider no expone o cuando dos tickets describan el mismo contrato de forma incompatible.
2. **Dependencias Client → API.** Si un ticket de un sidecar `client` o `standalone` requiere crear, modificar o exponer una query, mutación, endpoint, resolver o migración en un sidecar `provider`, debe declarar en `dependencies` al menos un ticket de ese `provider` o `shared`. Si no existe, crea el ticket del provider faltante o añade la dependencia al ticket existente.
3. **Redundancias y duplicados.** Detecta tickets con el mismo hallazgo, mismo alcance o títulos equivalentes. Si dos tickets cubren el mismo problema, conserva el más completo, integra la evidencia útil del otro y elimina el duplicado.
4. **Coherencia de estado y dominio.** `status` debe coincidir con la carpeta; `target_domain` debe ser un id registrado en `config/system-map.json` o `shared`; `dependencies` solo puede referenciar IDs existentes y sin ciclos.
5. **Formato del cuerpo.** Deben existir, en orden, `## Contexto / Hallazgo`, `## Requerimientos Técnicos` y `## Impacto en la Arquitectura`.
6. **Valor del ticket.** Elimina tickets especulativos sin evidencia verificable o cuyo contenido ya esté implementado en el código actual. No elimines tickets con `github_issue` ya creado: en ese caso corrige el ticket y reporta que el issue debe editarse o cerrarse manualmente.

## Paso 3 — Corregir

Si encuentras fallas:

1. Edita el frontmatter o el cuerpo del ticket para corregir dominio, estado, dependencias, formato o afirmaciones contradictorias.
2. Añade las dependencias faltantes usando los IDs reales (nunca inventes IDs).
3. Si falta un ticket de backend que un ticket de UI necesita, créalo en `.agents/tickets/backlog/` siguiendo el formato de `.agents/prompts/analyst.md` y enlázalo como dependencia.
4. Si detectas duplicados, elimina el archivo redundante solo cuando su contenido ya esté integrado o no aporte valor. No borres tickets con `github_issue` sin autorización explícita.
5. No inventes evidencia: si no puedes verificar una afirmación en el código o el mapa, déjala como supuesto explícito o repórtala como advertencia.

## Paso 4 — Marcar listos para sync

- No cambies `status` a `ready` ni muevas archivos de carpeta: `scripts/sync-github.js` consume únicamente `.agents/tickets/backlog/` y el estado `ready` está reservado para implementación.
- Tras aplicar correcciones, vuelve a ejecutar `node scripts/sanity-check.js --write --json` para regenerar el reporte.
- Si no quedan errores bloqueantes, `.agents/tickets/.sanity-check.json` debe quedar con este contrato:

```json
{
  "checked_at": "YYYY-MM-DDTHH:mm:ss.sssZ",
  "source": "sanity-check",
  "ready_for_sync": true,
  "tickets": [
    {
      "id": "TICK-XXX",
      "file": ".agents/tickets/backlog/TICK-XXX-slug.md",
      "status": "ok",
      "fixes": [],
      "warnings": []
    }
  ],
  "deleted": [],
  "blocking": []
}
```

- Si quedan errores bloqueantes, escribe el mismo archivo con `"ready_for_sync": false` y detalla cada error en `blocking`.
- Un ticket está listo para sync cuando su validación estructural y el análisis cruzado no arrojan errores bloqueantes.

## Paso 5 — Reportar

Devuelve un resumen breve con:

- Tickets auditados y correcciones aplicadas (dependencias, dominio, estado, duplicados eliminados, tickets nuevos).
- Errores bloqueantes restantes, si los hay.
- Resultado final: `READY FOR SYNC` o `BLOCKED`.
- Ruta de `.agents/tickets/.sanity-check.json`.

Si `$ARGUMENTS` está vacío, audita todo el backlog. Si contiene un ID inexistente, informa y detente sin modificar nada.
