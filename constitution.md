# Constitución de brain-corp

**Ámbito:** orquestación del monorepo contenedor `brain-corp`, sus tickets, su sincronización con GitHub y sus flujos de entrega. Las reglas de código, datos y UI de cada producto viven en la constitución de su sidecar y prevalecen en ese dominio.

**Autoridad:** esta constitución gobierna la capa de metadatos y orquestación. En caso de conflicto, `sidecars/<repo>/constitution.md` (o el documento equivalente del sidecar) prevalece para la lógica de producto; esta constitución prevalece para tickets, sync, PRs y trazabilidad del ecosistema.

**Vigencia:** desde 2026-10-30.

---

## Artículo 1 — Cero tokens locales

1. La autenticación con GitHub se delega **exclusivamente** al CLI `gh` y a su almacén seguro de credenciales (`gh auth login`, keyring del sistema).
2. Queda prohibido guardar tokens, PATs, client secrets, service role keys o credenciales de GitHub en `.brainrc.json`, scripts, tickets, documentación, `.env*`, logs o cualquier archivo versionado.
3. Los scripts de brain-corp usan `gh` como única interfaz con GitHub. No deben implementar clientes HTTP propios con tokens embebidos ni leer tokens desde variables que se persistan en disco.
4. Si un script necesita el repositorio destino, lo recibe por argumento o lo resuelve desde la configuración no sensible (`config/system-map.json`, remoto git o `.brainrc.json` sin secretos).
5. Todo PR debe declarar que no introduce secretos. Cualquier secreto detectado se rota y se elimina del historial antes de continuar.

## Artículo 2 — Separación estricta entre orquestación y producto

1. La raíz de brain-corp contiene únicamente: `.agents/`, `.opencode/`, `config/`, `scripts/`, `.specify/`, documentación de orquestación y archivos de gobernanza.
2. La raíz **no contiene lógica de negocio, componentes, esquemas de datos ni código de producto**. Esos artefactos pertenecen a los sidecars (`forge-backend`, `forge-front`, `foundly-pos`) y se modifican dentro de su repositorio/submódulo.
3. Los sidecars no deben depender de scripts o metadatos de la raíz para funcionar en producción. La raíz orquesta; los sidecars ejecutan.
4. Las rutas de los sidecars se resuelven siempre desde `config/system-map.json`; nunca se codifican rutas absolutas de la máquina en scripts o tickets.
5. Todo cambio en un sidecar conserva su propia constitución, reglas de código, specs y quality gates. brain-corp no reemplaza ni duplica esas reglas.

## Artículo 3 — Sanity-check como pre-flight gatekeeper

1. `npm run sanity` o `/sanity-check` es **obligatorio** antes de publicar tickets en GitHub.
2. `scripts/sync-github.js` ejecuta el sanity check por defecto y **aborta** si hay errores bloqueantes. `--skip-sanity` solo se permite en una emergencia explícita y debe justificarse en el reporte de la operación.
3. El sanity check valida, como mínimo: IDs únicos, frontmatter obligatorio, coherencia `status`/carpeta, dominios permitidos, dependencias existentes y sin ciclos, duplicados evidentes, secciones obligatorias del ticket y la regla UI→Backend (un ticket de frontend que exige cambios de API debe depender de un ticket `forge-backend` o `shared`).
4. El resultado se registra en `.agents/tickets/.sanity-check.json`. Un ticket está listo para sync solo cuando no tiene errores bloqueantes.
5. El sanity check no reemplaza la revisión semántica: `/sanity-check` contrasta los tickets con `config/system-map.json`, los esquemas Prisma/Drizzle y el contrato GraphQL real.

## Artículo 4 — Trazabilidad obligatoria por tickets

1. Todo cambio de producto, contrato, esquema, configuración o entrega debe estar asociado a un ticket `TICK-XXX` en `.agents/tickets/`.
2. La spec generada por spec-kit debe incluir `Source Ticket: .agents/tickets/<estado>/TICK-XXX-<slug>.md`.
3. Todo PR debe declarar `Closes #<issue>` o el issue asociado, y el ticket local debe reflejar el estado real (`backlog`, `in-analysis`, `ready`, `done`).
4. Al completar una entrega se usa `/complete TICK-XXX <PR>` o el flujo equivalente: `status: "done"`, referencia del PR en `## Entrega`, movimiento a `.agents/tickets/done/` y cierre del issue.
5. Un issue cerrado en GitHub debe reflejarse como `done` y mover el ticket a `done/` en el siguiente `sync:pull`; un issue reabierto devuelve el ticket a `backlog/`.
6. No se eliminan tickets con `github_issue` sin autorización explícita. Los tickets locales no publicados pueden corregirse o eliminarse si son inválidos o duplicados.
7. No se aceptan cambios “huérfanos”: si durante la implementación aparece un hallazgo fuera de alcance, se crea un ticket nuevo con `dependencies` en lugar de ampliar silenciosamente el ticket original.

## Artículo 5 — SDD y spec-first en los sidecars

1. El flujo canónico es: ticket → sanity check → sync → `/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement` → PR → `/complete`.
2. Ningún cambio que altere comportamiento, contrato o interfaz ya gobernado por una spec puede implementarse sin actualizar antes la spec correspondiente, incluso si llega como bugfix.
3. Las enmiendas de spec se registran en el Change Log de `tasks.md` del módulo afectado con fecha, ticket, rama, archivos, motivo, comportamiento anterior/nuevo y pruebas.
4. Los hotfix pueden omitir la fase pesada de spec-kit, pero **no** pueden omitir: ticket de emergencia, validación de impacto en especificaciones y declaración explícita del impacto en el PR.
5. Si no existe spec para el área del hotfix, el PR declara `Spec impact: none` o `Spec pendiente` y se abre el ticket de seguimiento para documentarla.

## Artículo 6 — Git, ramas y Pull Requests

1. Ramas de features generadas por spec-kit: `<feature-number>-<slug>` (por ejemplo `015-inventory-data-contract`).
2. Ramas de corrección y hotfix: `fix/TICK-XXX-<slug>`; si no hay ticket, `fix/<slug>` solo en el sidecar que lo permita. No se introduce `hotfix/` salvo que se enmiende la constitución del sidecar.
3. Antes de crear una rama se verifica el estado contra la rama base (`git fetch origin`, `git log`/`git diff` contra `origin/main` o la base acordada), según la constitución del sidecar.
4. Los commits siguen Conventional Commits: `feat(<módulo>): ...`, `fix(<módulo>): ...`, `docs(spec): ...`, `refactor(<módulo>): ...`.
5. El agente **nunca** ejecuta `git commit`, `git push`, `git merge` ni abre un PR de forma autónoma. Propone el comando y solicita autorización explícita.
6. Todo PR usa la plantilla de `.github/PULL_REQUEST_TEMPLATE.md` y declara: ticket/issue, resumen, riesgos, rollback, impacto en specs, validaciones ejecutadas y checklist de calidad.
7. No se reescribe historia compartida: prohibido `amend` o `force-push` sobre commits ya publicados.
8. El merge no se considera entrega terminada hasta ejecutar `/complete` o hasta que `sync:pull` mueva el ticket a `done/`.

## Artículo 7 — Integridad del ecosistema Forge / Foundly

1. `forge-backend` es la fuente de verdad de datos y reglas de negocio de Forge; `forge-front` consume su contrato GraphQL. Un cambio de contrato requiere ticket de backend o `shared`.
2. `foundly-pos` es local-first, usa Drizzle/SQLite y no depende de `forge-backend`. Cualquier sincronización Foundly ↔ Forge se considera **no implementada** hasta que exista ticket, contrato y pruebas.
3. No se asume equivalencia de modelos entre Prisma/PostgreSQL y Drizzle/SQLite. Las diferencias de dinero (`Decimal` en Forge vs centavos enteros en Foundly) requieren conversión explícita.
4. Forge es multi-tenant y Foundly es mononegocio local. Cualquier puente debe definir el mapeo `tenant` ↔ negocio y el aislamiento de datos.
5. Las reglas de negocio no se duplican en la raíz; se documentan y ejecutan en el sidecar propietario.

## Artículo 8 — Cumplimiento y enmiendas

1. Los scripts de brain-corp hacen cumplir automáticamente lo que es determinista: sanity check, sincronización, cierre y movimiento de tickets. Lo que requiere juicio (contradicciones semánticas, impacto de negocio) se revisa en `/sanity-check` y en el PR.
2. Toda excepción a esta constitución debe quedar registrada en el ticket o PR con justificación, alcance y riesgo.
3. Las enmiendas a esta constitución se proponen mediante PR, indican el motivo, el impacto en scripts/tickets existentes y la fecha de vigencia.
4. Si una regla de esta constitución contradice la constitución de un sidecar en materia de código o datos, prevalece la del sidecar. Si la contradicción afecta tickets, sync o trazabilidad, prevalece esta constitución.

---

## Flujo canónico

```
TICK-XXX → /sanity-check → npm run sync → /speckit.specify → /speckit.plan
→ /speckit.tasks → /speckit.implement → PR (plantilla) → /complete → done/
```

## Flujo de emergencia

```
/hotfix → ticket TICK-XXX + rama fix/TICK-XXX-slug → validación de impacto
→ commit fix(<módulo>): ... → PR con Spec impact → /complete
```

**Principio rector:** la raíz orquesta y audita; los sidecars implementan y gobiernan su dominio. Ningún cambio sin ticket, ningún ticket sin trazabilidad, ningún sync sin sanity check.
