# brain-corp

[![npm version](https://img.shields.io/npm/v/@rgkoko/brain-corp.svg?color=blue)](https://www.npmjs.com/package/@rgkoko/brain-corp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

CLI de orquestación para ecosistemas multi-repositorio: mantiene juntos varios productos o servicios independientes, centraliza la topología de sidecars y coordina el análisis, la creación y la sincronización de tickets con GitHub Issues.

## ¿Por qué existe este proyecto?

Los ecosistemas multi-repositorio suelen parecer correctos repo por repo, pero fallan en las costuras: contratos desalineados, funcionalidades sin endpoint, endpoints sin consumidor o modelos de datos que no coinciden.

**brain-corp es la capa de coordinación.** No implementa producto: registra la topología, detecta vacíos de integración, los convierte en tickets accionables, los sincroniza con GitHub y los encamina hacia una especificación (spec-kit) en el repositorio correcto.

## Topología

```
brain-corp/                     ← raíz de orquestación (este repo)
├── config/system-map.json      ← topología activa (se genera con brain setup)
├── config/system-map.example.json
├── .specify/config.json        ← enrutamiento del spec-kit nativo por sidecar
├── .agents/
│   ├── prompts/analyst.md      ← rol del Arquitecto Analista
│   └── tickets/                ← estados de tickets (se crean bajo demanda)
├── scripts/                    ← setup, sync, watch, normalize, tickets
├── bin/brain.js                ← binario global `brain`
└── sidecars/                   ← carpeta vacía; aquí viven los repositorios registrados
```

Cada sidecar es un repositorio git propio. brain-corp no los modifica desde aquí: los inspecciona, los analiza y genera trabajo para ellos. La carpeta `sidecars/` nace vacía y se puebla con `brain setup` (detección vía GitHub CLI o registro manual).

## Qué hace

### 1. Onboarding y sesión

`npm run init-brain` detecta el usuario de GitHub, configura el Project destino y el agente por defecto, guarda todo en `.brainrc.json`, lanza un `sync-pull` inicial y, opcionalmente, arranca el watcher.

Si no hay sidecars configurados (o el workspace está limpio), primero abre el onboarding interactivo **antes de ejecutar `sync-pull` o validar la sesión de GitHub Issues**:

1. Consulta todos los repositorios accesibles (personales y de organizaciones) con `gh api --paginate user/repos`.
2. Si hay muchos repositorios, permite filtrar por organización.
3. Muestra un menú multi-select: flechas para moverte, espacio para marcar y Enter para confirmar.
4. Permite asignar rol (`provider`, `client`, `standalone`) a cada seleccionado.
5. Genera las rutas `sidecars/<repo>` en `config/system-map.json`, sin prefijos de owner.
6. Ofrece clonarlos con `gh repo clone`.
7. Si `gh` falla o no está autenticado, continúa con registro manual por URL o ruta local.

Las confirmaciones del wizard y de `brain init` usan un selector de flechas `Sí / No`; la entrada de texto queda reservada para URLs, rutas, nombres y campos equivalentes.

Al elegir el agente, `brain init` aprovisiona automáticamente el workspace:

- `.agents/prompts/` y `.agents/skills/` con el rol del analista y las skills base.
- `.specify/` con scripts, plantillas, workflows y enrutamiento hacia los sidecars.
- `.opencode/commands/` para OpenCode (`/analyze`, `/sanity`, `/sync`, `/speckit.*`).
- Estructuras equivalentes para Claude Code (`.claude/commands/`), Cursor (`.cursor/rules/`) o Antigravity (`.antigravity/rules/`).
- `AGENTS.md` como punto de entrada genérico para otros agentes.

Al terminar, abre el agente configurado.

### 2. Sincronización con GitHub Issues

- `npm run sync` — ejecuta el sanity check previo y publica los tickets de `.agents/tickets/backlog/` como issues, escribiendo el `github_issue` en el frontmatter. Si el sanity check falla, aborta; usa `--skip-sanity` para forzarlo.
- `npm run sync:pull` — trae issues (abiertos y cerrados) como tickets locales, infiere estado (`backlog`/`done`) y marca como `needs_formatting` los que no tienen frontmatter válido.
- `npm run watch` — bucle que ejecuta `sync-pull` + normalización cada 45 s (configurable).
- `npm run normalize` — completa y mueve tickets `needs_formatting` a `backlog` con el formato exigido.
- `npm run sanity` — audita coherencia de tickets (IDs, estados, dependencias, ciclos, duplicados y reglas client→provider) y escribe `.agents/tickets/.sanity-check.json`; se ejecuta automáticamente antes de `npm run sync`.
- `npm run complete -- TICK-014 [PR]` — cierra la entrega: marca `status: "done"`, registra el PR en `## Entrega`, mueve el ticket a `.agents/tickets/done/` y cierra el issue de GitHub si existe.
- `npm run hotfix -- --title "..." --domain <sidecar> --module <módulo> --spec-impact none` — crea un ticket de emergencia, prepara la rama `fix/TICK-XXX-slug` en el sidecar y sugiere el commit `fix(<módulo>): ...`. Con `--publish` crea el issue vía `gh`.

### 3. Análisis y tickets

El rol del **Arquitecto Analista** (`.agents/prompts/analyst.md`) contrasta las capas de cada feature —datos → contrato/API → consumo en el cliente— y reporta vacíos concretos como tickets en Markdown con frontmatter estricto:

```
.agents/tickets/<estado>/TICK-XXX-<slug>.md
```

Estados: `needs_formatting` → `backlog` → `in-analysis` → `ready` → `done`. El campo `status` del frontmatter siempre coincide con la carpeta.

El comando `/sanity-check` audita el backlog antes del sync: contrasta tickets de sidecars `client` con el contrato real de los `provider`, añade dependencias faltantes, elimina redundancias y deja constancia del resultado en `.agents/tickets/.sanity-check.json`.

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
- Git para los repositorios que registres como sidecars

## Uso rápido

```bash
npm install
npm run setup         # detectar repos con gh, asignar roles y generar sidecars/<repo>
npm run init-brain    # onboarding + sesión + watcher opcional + lanza el agente
npm run agents:sync   # re-desplegar prompts, skills y comandos del motor de agente
npm run sync:pull     # importar issues a tickets
npm run sync          # publicar tickets como issues
npm run watch         # sincronización continua
```

### CLI global

`package.json` expone el binario `brain`. Tras `npm link` (o `npm install -g .`):

El CLI opera siempre sobre el **directorio actual** (`process.cwd()`): lee `config/system-map.json`, crea `.brainrc.json`, gestiona tickets y lanza el agente desde ahí, no desde la carpeta de instalación del paquete.

```bash
brain setup           # descubre repos con gh api, multi-select y asignación de roles
brain setup --manual  # omite GitHub y registra por URL o ruta local
brain init            # onboarding + sesión + lanzamiento del agente
brain agents:sync     # re-desplegar assets del motor (--agent, --overwrite)
brain sync:pull       # importar issues
brain sync            # publicar tickets
brain sanity          # auditar tickets
brain hotfix --title "..." --domain <sidecar> --module <módulo> --spec-impact none
```

En un workspace limpio, el wizard **no incluye ningún proyecto por defecto**: la topología se construye a partir de los repositorios que selecciones. Si `gh` no está autenticado o falla, el registro manual por URL/ruta local es el fallback. El wizard también ofrece clonar los repositorios seleccionados con `gh repo clone`.

## Configuración

- **`.brainrc.json`** — estado local: usuario, Project de GitHub, agente por defecto y última sesión. Está en `.gitignore`.
- **`config/system-map.json`** — topología activa: rutas, roles (`provider`/`client`/`standalone`), stacks, dominios, endpoints, esquemas y relaciones entre sidecars. El template base es neutro (sin sidecars); se puebla con `brain setup`. Es la fuente de verdad estructural.
- **`config/system-map.example.json`** — mapa poblado de referencia con sidecars provider/client/standalone. Cópialo sobre `system-map.json` si quieres partir de una topología de ejemplo.
- **`.specify/config.json`** — cómo se enruta cada ticket al proyecto y directorio de specs correcto. El wizard y `brain init` sincronizan sus `projects` con los sidecars registrados.
- **`.agents/prompts/`** — comportamiento del analista (rol, protocolo, formato de tickets).
- **`.agents/skills/`** — skills base aprovisionadas (`brain-corp`, `spec-kit`, `ticket-ops`).
- **`.opencode/commands/`** — comandos slash de OpenCode aprovisionados para el workspace.

## Principios

1. **Una raíz, nunca `cd`.** Todo opera desde brain-corp; las rutas de los sidecars se resuelven desde `config/system-map.json`.
2. **Analizar, no implementar.** brain-corp produce diagnóstico y tickets, no cambios en los sidecars.
3. **Evidencia sobre suposiciones.** Que exista un resolver no implica que haya contrato expuesto; que exista una vista no implica que tenga backend.
4. **Spec-kit es nativo.** La orquestación enruta, no reimplementa el flujo de especificación.
5. **GitHub Issues es el canal de sincronización**; los tickets en Markdown son la representación local.
6. **Cero tokens locales.** La autenticación GitHub se delega a `gh`; no se persisten PATs ni secretos en el repo.
7. **Sanity-check es pre-flight.** `npm run sync` no publica nada si el sanity check detecta incoherencias.
8. **Trazabilidad por ticket.** No hay cambios sin `TICK-XXX`, PR sin `Closes #...`, ni cierre sin `/complete` o `sync:pull`.

## Gobernanza y flujo rápido

- **`constitution.md`** — reglas fundamentales de la capa de orquestación: cero tokens locales, separación raíz/sidecars, sanity-check, trazabilidad, SDD y reglas de PR.
- **`.github/PULL_REQUEST_TEMPLATE.md`** — plantilla compartida en la raíz y en cada sidecar con ticket, resumen, riesgos, rollback e impacto en specs.
- **`/hotfix`** — flujo de emergencia: crea el ticket, prepara la rama `fix/TICK-XXX-slug`, exige declarar impacto en specs y sugiere el commit `fix(<módulo>): ...` sin saltarse la trazabilidad.
