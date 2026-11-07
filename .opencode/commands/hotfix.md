---
description: Abre un ticket de emergencia, prepara la rama fix/TICK-XXX-slug y el commit de hotfix.
agent: build
---

Actúa como el **Arquitecto Analista Principal de brain-corp** ejecutando el flujo de hotfix.

**Argumento recibido:** `$ARGUMENTS`

## Modo Orquestador Raíz (obligatorio)

- Trabaja siempre desde la raíz de brain-corp; no uses `cd`.
- El ticket vive en `.agents/tickets/`; el código y la rama viven en el sidecar resuelto desde `config/system-map.json`.
- No ejecutes `git commit`, `git push`, `git merge` ni abras el PR sin autorización explícita del usuario.
- No uses tokens locales ni APIs propias de GitHub: toda interacción con GitHub es vía `gh`.

## Paso 1 — Reunir datos obligatorios

Necesitas:

- `--title`: título corto y descriptivo del hotfix.
- `--domain`: id de un sidecar registrado en `config/system-map.json` o `shared`.
- `--module`: módulo para el commit, por ejemplo `inventory`.
- `--spec-impact`: `none` si no altera ninguna spec gobernante, o una referencia a la enmienda en `tasks.md`/spec.
- `--repo`: obligatorio si `--domain` es `shared`; acepta un id de sidecar o `root`.

Opcionales: `--context`, `--slug`, `--base`, `--fetch`, `--publish`, `--no-branch`, `--dry-run`, `--json`.

Si falta un dato obligatorio, pregunta antes de ejecutar. Si `--spec-impact` no es `none`, verifica que la spec o el Change Log de `tasks.md` exista o indícalo como pendiente en el ticket.

## Paso 2 — Validar impacto antes de codificar

1. Si el hotfix altera comportamiento, contrato o interfaz ya gobernado por una spec, actualiza la spec/contrato y registra la enmienda en el Change Log de `tasks.md` del sidecar. No requiere el flujo SDD completo, pero sí la enmienda.
2. Si no existe spec para el área, usa `--spec-impact none` o `--spec-impact "Spec pendiente: <motivo>"` y asegúrate de abrir el seguimiento correspondiente.
3. Revisa `git fetch origin` y el estado contra la rama base del sidecar antes de crear la rama (`--fetch` y `--base` ayudan).

## Paso 3 — Crear ticket y rama

Ejecuta:

```bash
node scripts/hotfix.js \
  --title "<título>" \
  --domain <dominio> \
  --module <módulo> \
  --spec-impact "<none|referencia>" \
  [--repo <sidecar|root>] [--context "<detalle>"] [--publish] [--fetch] [--base origin/main]
```

El script:

1. Asigna el siguiente `TICK-XXX` y crea el ticket en `.agents/tickets/backlog/` con las tres secciones obligatorias.
2. Registra dominio, repositorio, rama e impacto en specs.
3. Crea o reutiliza la rama `fix/TICK-XXX-<slug>` en el repositorio del sidecar.
4. Devuelve el mensaje de commit sugerido `fix(<módulo>): <título>`.
5. Con `--publish`, crea el issue en GitHub vía `gh` y escribe `github_issue` en el ticket.

Si el script falla al crear la rama o publicar el issue, reporta el error y no continúes como si hubiera quedado listo.

Después de crear el ticket, ejecuta `node scripts/sanity-check.js --write` y corrige cualquier error bloqueante (por ejemplo, un hotfix de un sidecar `client` que requiera un cambio de API sin ticket de un sidecar `provider` asociado).

## Paso 4 — Preparar la entrega

1. Implementa el cambio mínimo en el sidecar correspondiente.
2. Ejecuta los quality gates del sidecar (typecheck/build/tests).
3. Propón el commit exacto `fix(<módulo>): <título>` y solicita autorización. No lo ejecutes por tu cuenta.
4. Prepara el PR con `.github/PULL_REQUEST_TEMPLATE.md`, incluyendo `Closes #<issue>`, riesgos, rollback y `Spec impact`.
5. Tras el merge, ejecuta `/complete TICK-XXX <PR>` o deja que `sync:pull` mueva el ticket a `done/` cuando el issue se cierre.

## Paso 5 — Reportar

Devuelve:

- ID y ruta del ticket creado.
- Dominio, repositorio y rama.
- `Spec impact` declarado.
- Mensaje de commit sugerido.
- Issue de GitHub creado (si `--publish`).
- Siguiente acción pendiente: implementar, validar, autorizar commit y abrir PR.
