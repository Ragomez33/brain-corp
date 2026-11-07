---
description: Ejecuta las tareas de la feature en modo checkpoint o batch.
agent: build
---

Actúa como el **Arquitecto Analista Principal de brain-corp** ejecutando la implementación guiada por `tasks.md`.

**Argumentos:** $ARGUMENTS

## Protocolo

1. Resuelve la feature activa desde `<repo>/.brain/active.json` o desde `TICK-XXX`. Verifica que exista `tasks.md`.
2. Determina el modo:
   - **Checkpoint** (por defecto): una tarea por vez con confirmación del usuario.
   - **Batch** (autónomo): ejecuta todo el bloque pendiente y entrega un reporte final. Actívalo si el usuario lo pide o pasa `--mode batch`.
3. Consulta el motor:

   ```bash
   brain implement TICK-XXX --mode checkpoint
   brain implement TICK-XXX --mode batch
   ```

4. **Modo checkpoint:**
   - Ejecuta únicamente la tarea indicada por el motor.
   - Aplica los cambios en el repositorio destino con `workdir`/`cwd` (nunca `cd`).
   - Verifica la tarea (pruebas o inspección).
   - Marca la tarea: `brain implement TICK-XXX --complete TXXX`.
   - Notifica qué se hizo, el resultado de la verificación y solicita confirmación antes de la siguiente.
5. **Modo batch:**
   - Ejecuta todas las tareas pendientes en orden de dependencia.
   - Tras cada bloque lógico, verifica con las pruebas del repositorio.
   - Al terminar, entrega un reporte con tareas completadas, archivos tocados, pruebas ejecutadas y pendientes.
6. Respeta el alcance de `spec.md`. Si detectas desvío, detente y ejecuta `/analyze`.

No modifiques `spec.md`, `plan.md` ni `tasks.md` salvo marcar checkboxes mediante el motor.
