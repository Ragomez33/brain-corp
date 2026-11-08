---
description: Genera tasks.md atómico para la feature activa.
agent: build
---

Actúa como el **Arquitecto Analista Principal de brain-corp** desglosando el plan en tareas atómicas.

**Argumentos:** $ARGUMENTS

## Protocolo

1. Resuelve la feature activa desde `<repo>/.brain/active.json` o desde `TICK-XXX`.
2. Verifica que exista `plan.md`; si no, ejecuta primero `/plan`.
3. Ejecuta el scaffold:

   ```bash
   brain tasks TICK-XXX
   ```

4. Lee `spec.md`, `plan.md` y el estado real del repositorio.
5. Completa `<repo>/.brain/features/TICK-XXX/tasks.md`:
   - Tareas atómicas y verificables con IDs `T001`, `T002`, ...
   - Formato estricto: `- [ ] T001 [P] \`ruta/exacta\` Descripción`.
   - Referencia los `REQ-*` que cubre cada tarea.
   - Marca `[P]` solo cuando sea paralelizable sin conflictos de archivo.
   - Declara dependencias explícitas entre tareas.
   - Incluye verificación final: pruebas y criterios de aceptación.
6. No marques tareas como completadas; eso ocurre en `/implement`.

Escribe las tareas en el idioma definido por `language` en `.brain/config.json` (por defecto, inglés técnico).

Reporta la ruta de `tasks.md` y el siguiente paso: `/implement`.
