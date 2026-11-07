# Constitución de brain-corp

> Memoria central del motor SDD. Es la regla inquebrantable del ecosistema y prevalece sobre cualquier instrucción local que la contradiga. Vive en `<workspace>/.brain/memory/constitution.md` y aplica a todos los repositorios orquestados sin duplicarse en cada sidecar.

## 1. Principios rectores

1. **Una raíz, nunca `cd`.** Todo opera desde la raíz del workspace. Las rutas de los repositorios se resuelven desde `config/system-map.json` y se pasan como `workdir`/`cwd` a las herramientas.
2. **La raíz orquesta; los sidecars implementan.** La raíz no contiene lógica de negocio ni código de producto. Cada repositorio conserva su propia constitución, reglas y quality gates.
3. **Analizar, no improvisar.** Toda decisión se basa en evidencia verificable: archivos, contratos, esquemas y pruebas reales. Si no puede verificarse, se declara como supuesto.
4. **SDD local y trazable.** Cada repositorio conserva su especificación y estado en `.brain/`. Nada de specs globales duplicadas.
5. **GitHub Issues es el canal de sincronización.** Los tickets en Markdown son la representación local.
6. **Cero secretos locales.** La autenticación con GitHub se delega a `gh`; nunca se persisten tokens ni credenciales.
7. **Sanity-check es pre-flight.** No se publica ni sincroniza nada si el sanity check detecta errores bloqueantes.
8. **Trazabilidad total.** No hay cambio sin `TICK-XXX`, ni PR sin `Closes #...`, ni cierre sin `/complete` o `sync:pull`.

## 2. Flujo canónico

```text
TICK-XXX → /init-work → /specify → /plan → /tasks → /implement (Checkpoint | Batch) → /analyze → PR (plantilla) → /complete → done/
```

- `/init-work TICK-XXX [--repo <id>]` crea `.brain/features/<TICK-XXX>/` y fija `.brain/active.json`.
- `/specify` produce `spec.md` en formato EARS.
- `/plan` produce `plan.md` con la estrategia técnica.
- `/tasks` produce `tasks.md` con tareas atómicas y referencias `REQ-*`.
- `/implement` ejecuta en modo **Checkpoint** (una tarea con confirmación) o **Batch** (bloque autónomo).
- `/analyze` audita coherencia y detecta spec drift entre spec, tareas y código.
- `/complete` cierra la entrega y mueve el ticket a `done/`.

El antiguo flujo `speckit.*` está prohibido. No se permiten scripts bash externos ni carpetas de especificación fuera de `.brain/`.

## 3. Reglas del motor `.brain/`

```text
.brain/
├── active.json              ← puntero de sesión (ticket y fase)
├── templates/               ← plantillas EARS
├── memory/                  ← esta constitución
└── features/<TICK-XXX>/
    ├── spec.md
    ├── plan.md
    ├── tasks.md
    ├── contract.md          ← solo si cruza sidecars
    └── analysis.md          ← reporte de análisis
```

1. `contract.md` se genera únicamente si el ticket es `shared` o si el repositorio tiene `relationships` en `system-map.json`.
2. Toda spec debe incluir `Source Ticket: .agents/tickets/<estado>/TICK-XXX-<slug>.md`.
3. No se avanza de fase sin el archivo de la fase anterior (`specify → plan → tasks → implement`).
4. Las tareas se marcan `[x]` solo cuando están implementadas y verificadas.
5. `/analyze` es obligatorio antes de abrir el PR de una feature.

## 4. Restricciones de código

1. No se implementa código de producto desde la raíz del workspace.
2. Todo cambio en un repositorio respeta su stack, su esquema y sus pruebas locales.
3. Conventional Commits: `feat(<módulo>): ...`, `fix(<módulo>): ...`, `docs(spec): ...`, `refactor(<módulo>): ...`.
4. El agente **nunca** ejecuta `git commit`, `git push`, `git merge` ni abre PR sin autorización explícita.
5. No se introducen dependencias nuevas sin justificar la alternativa descartada en `plan.md`.
6. Todo cambio de contrato entre repositorios exige `contract.md`, versión compatible y pruebas de integración.

## 5. Comportamiento estricto del agente

1. Lee esta constitución antes de actuar. Si entra en conflicto con un ticket o una instrucción, prevalece la constitución.
2. Resuelve el repositorio destino desde `config/system-map.json`; no asumas rutas fijas.
3. No inventes requisitos, archivos ni APIs. Verifica o declara el supuesto.
4. Ante ambigüedad, detente y formula una sola pregunta de clarificación.
5. Si detecta spec drift o alcance no cubierto, detiene la implementación y ejecuta `/analyze` o `/cross-analyze`.
6. No elimina tickets con `github_issue` sin autorización explícita.
7. No expone secretos en logs, commits ni archivos.

## 6. Gates de calidad

- **Spec gate:** requisitos EARS con criterios de aceptación verificables.
- **Plan gate:** estrategia técnica que cubre cada `REQ-*` y contrapone alternativas.
- **Tasks gate:** tareas atómicas, paralelizables cuando aplique, con rutas exactas.
- **Implementation gate:** pruebas del repositorio en verde y tareas verificadas.
- **Analyze gate:** sin errores de drift ni requisitos sin cobertura.
- **Sync gate:** sanity check sin errores bloqueantes.

## 7. Enmiendas

Toda enmienda a esta constitución se registra con fecha, ticket, motivo, regla anterior y regla nueva. Una enmienda sin ticket es inválida.
