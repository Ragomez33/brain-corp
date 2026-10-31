# brain-corp

Orquestador del ecosistema **Forge & Foundly**: un monorepo contenedor que mantiene juntos tres productos relacionados pero técnicamente independientes, y centraliza el análisis, la creación y la sincronización de tickets con GitHub Issues.

## ¿Por qué existe este proyecto?

Forge y Foundly no son un solo sistema. Son productos con stacks, modelos de datos y ciclos de vida distintos, que comparten un mismo negocio y, por tanto, acaban necesitando contratos comunes:

- **Forge** es un ERP cloud multi-tenant compuesto por un backend GraphQL (NestJS/Prisma/PostgreSQL) y un panel web (Next.js).
- **Foundly** es un POS móvil *local-first* (Expo/React Native/SQLite) que opera offline y no depende del backend de Forge.

Mantener estos repositorios por separado hace muy difícil responder preguntas como:

- ¿Existe esta funcionalidad en el backend pero no está expuesta en GraphQL?
- ¿La consume el front o quedó como endpoint huérfano?
- ¿Los tipos/enums de Forge y Foundly son coherentes entre sí?
- ¿Hay dos implementaciones del mismo concepto con reglas de negocio divergentes?
- ¿Qué tickets están abiertos, en análisis o listos para implementar?

**brain-corp existe para ser el punto único de coordinación de ese ecosistema.** No es un producto en sí: es capa de orquestación. Su objetivo es detectar vacíos de integración e incoherencias entre esquemas, convertirlos en tickets accionables, sincronizarlos con GitHub y encaminarlos hacia una especificación (spec-kit) en el repositorio correcto.

La razón de fondo es evitar el fallo clásico de los ecosistemas multiproyecto: **cada repo parece correcto por separado, pero el sistema completo está roto en las costuras**.

## Topología

```
brain-corp/                 ← raíz de orquestación (este repo)
├── config/system-map.json  ← fuente de verdad de la topología
├── .specify/config.json    ← enrutamiento del spec-kit nativo por sidecar
├── .agents/
│   ├── prompts/analyst.md  ← rol del Arquitecto Analista
│   └── tickets/            ← backlog, in-analysis, ready, done
├── scripts/                ← onboard, sync, watch, normalize, tickets
└── sidecars/               ← git submodules
    ├── forge-backend       ← API GraphQL del ERP (fuente de verdad de datos)
    ├── forge-front         ← panel web que consume esa API
    └── foundly-pos         ← POS móvil local-first, independiente
```

Cada sidecar es un repositorio git propio (submodule). brain-corp no los modifica desde aquí: los inspecciona, los analiza y genera trabajo para ellos.

| Sidecar | Tipo | Stack | Rol |
| --- | --- | --- | --- |
| `forge-backend` | API | NestJS 11 · GraphQL · Prisma 7 · PostgreSQL (Supabase) · Redis | Fuente de verdad de datos y reglas de negocio, multi-tenant |
| `forge-front` | Web | Next.js 16 · React 19 · MUI 7 · Tailwind 4 | Panel administrativo; consume GraphQL de `forge-backend` |
| `foundly-pos` | Móvil | React Native 0.86 · Expo 57 · Drizzle · SQLite · Zustand | POS local-first, offline, sin dependencia de Forge |

## Qué hace

### 1. Onboarding y sesión
`npm run init-brain` detecta el usuario de GitHub, configura el Project destino y el agente por defecto, guarda todo en `.brainrc.json`, lanza un `sync-pull` inicial y, opcionalmente, arranca el watcher. Al terminar, abre el agente configurado.

### 2. Sincronización con GitHub Issues
- `npm run sync` — ejecuta el sanity check previo y publica los tickets de `.agents/tickets/backlog/` como issues (etiquetados por `target_domain`), escribiendo el `github_issue` en el frontmatter. Si el sanity check falla, aborta; usa `--skip-sanity` para forzarlo.
- `npm run sync:pull` — trae issues (abiertos y cerrados) como tickets locales, infiere estado (`backlog`/`done`) y marca como `needs_formatting` los que no tienen frontmatter válido.
- `npm run watch` — bucle que ejecuta `sync-pull` + normalización cada 45 s (configurable).
- `npm run normalize` — completa y mueve tickets `needs_formatting` a `backlog` con el formato exigido.
- `npm run sanity` — audita coherencia de tickets (IDs, estados, dependencias, ciclos, duplicados y reglas UI→Backend) y escribe `.agents/tickets/.sanity-check.json`; se ejecuta automáticamente antes de `npm run sync`.
- `npm run complete -- TICK-014 [PR]` — cierra la entrega: marca `status: "done"`, registra el PR en `## Entrega`, mueve el ticket a `.agents/tickets/done/` y cierra el issue de GitHub si existe.
- `npm run hotfix -- --title "..." --domain forge-backend --module inventory --spec-impact none` — crea un ticket de emergencia, prepara la rama `fix/TICK-XXX-slug` en el sidecar y sugiere el commit `fix(<módulo>): ...`. Con `--publish` crea el issue vía `gh`.
- `sync:pull` mueve automáticamente a `done/` los tickets cuyo issue aparezca cerrado en GitHub; si un issue `done` se reabre, el ticket vuelve a `backlog/`.

### 3. Análisis y tickets
El rol del **Arquitecto Analista** (`.agents/prompts/analyst.md`) contrasta las tres capas de cada feature —esquema de datos → contrato GraphQL → consumo en UI— y reporta vacíos concretos como tickets en Markdown con frontmatter estricto:

```
.agents/tickets/<estado>/TICK-XXX-<slug>.md
```

Estados: `needs_formatting` → `backlog` → `in-analysis` → `ready` → `done`. El campo `status` del frontmatter siempre coincide con la carpeta.

El comando `/sanity-check` audita el backlog antes del sync: contrasta tickets de frontend con el contrato real del backend, añade dependencias faltantes, elimina redundancias y deja constancia del resultado en `.agents/tickets/.sanity-check.json`.

El comando `/complete` cierra un ticket tras la entrega: actualiza el frontmatter, registra la referencia del PR, lo mueve a `done/` y cierra su issue en GitHub.

### 4. Ticket → especificación
No hay una skill o script propio que duplique spec-kit. brain-corp usa **el flujo nativo de spec-kit** en cada sidecar, enrutado por `target_domain` desde `.specify/config.json`:

```
/speckit.specify → /speckit.clarify → /speckit.plan → /speckit.tasks → /speckit.implement
```

Si un ticket es `shared`, se genera una spec por cada sidecar afectado (*fan-out*), manteniendo el `Source Ticket` dentro de la spec para trazabilidad.

## Requisitos

- Node.js 18+
- [`gh`](https://cli.github.com/) autenticado (`gh auth status`)
- Los agentes que quieras usar (`opencode`, etc.) disponibles en el `PATH`
- Los submodules inicializados: `git submodule update --init --recursive`

## Uso rápido

```bash
npm install
npm run init-brain    # onboarding + sesión + watcher opcional + lanza el agente
npm run sync:pull     # importar issues a tickets
npm run sync          # publicar tickets como issues
npm run watch         # sincronización continua
```

## Configuración

- **`.brainrc.json`** — estado local: usuario, Project de GitHub, agente por defecto y última sesión. Está en `.gitignore`.
- **`config/system-map.json`** — topología real: rutas, stacks, dominios, endpoints, esquemas y relaciones entre sidecars. Es la fuente de verdad estructural; el analista lo lee antes de trabajar.
- **`.specify/config.json`** — cómo se enruta cada ticket al proyecto y directorio de specs correcto.
- **`.agents/prompts/`** — comportamiento del analista (rol, protocolo, formato de tickets).

## Principios

1. **Una raíz, nunca `cd`.** Todo opera desde brain-corp; las rutas de los sidecars se resuelven desde `config/system-map.json`.
2. **Analizar, no implementar.** En su labor de análisis, brain-corp produce diagnóstico y tickets, no cambios en los sidecars.
3. **Evidencia sobre suposiciones.** Que exista un resolver no implica que haya query GraphQL; que exista una vista no implica que tenga backend.
4. **Spec-kit es nativo.** La orquestación enruta, no reimplementa el flujo de especificación.
5. **GitHub Issues es el canal de sincronización**, los tickets en Markdown son la representación local.
6. **Cero tokens locales.** La autenticación GitHub se delega a `gh`; no se persisten PATs ni secretos en el repo.
7. **Sanity-check es pre-flight.** `npm run sync` no publica nada si el sanity check detecta incoherencias.
8. **Trazabilidad por ticket.** No hay cambios sin `TICK-XXX`, PR sin `Closes #...`, ni cierre sin `/complete` o `sync:pull`.

## Gobernanza y flujo rápido

- **`constitution.md`** — reglas fundamentales de la capa de orquestación: cero tokens locales, separación raíz/sidecars, sanity-check, trazabilidad, SDD y reglas de PR.
- **`.github/PULL_REQUEST_TEMPLATE.md`** — plantilla compartida en la raíz y en cada sidecar con ticket, resumen, riesgos, rollback e impacto en specs.
- **`/hotfix`** — flujo de emergencia: crea el ticket, prepara la rama `fix/TICK-XXX-slug`, exige declarar impacto en specs y sugiere el commit `fix(<módulo>): ...` sin saltarse la trazabilidad.
