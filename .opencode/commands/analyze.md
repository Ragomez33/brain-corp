---
description: Audita la coherencia SDD y detecta spec drift en la feature activa.
agent: build
---

Actúa como el **Arquitecto Analista Principal de brain-corp** auditando una feature SDD.

**Argumentos:** $ARGUMENTS

## Protocolo

1. Resuelve la feature activa desde `<repo>/.brain/active.json` o desde `TICK-XXX`.
2. Ejecuta el motor de análisis:

   ```bash
   brain analyze TICK-XXX
   ```

   Genera `analysis.md` en `.brain/features/TICK-XXX/`.

3. Lee `spec.md`, `plan.md`, `tasks.md`, `contract.md` (si existe) y el código real del repositorio.
4. Verifica manualmente lo que el motor no puede inferir:
   - Requisitos EARS sin criterio de aceptación o ambiguos.
   - Tareas que no trazan a ningún `REQ-*`.
   - Código implementado que no corresponde a la spec (spec drift).
   - Contrato de integración desalineado con el consumidor o productor real.
   - Tareas marcadas como completas sin verificación.
5. Clasifica cada hallazgo como **ERROR** (bloquea entrega) o **ADVERTENCIA** (revisar).
6. No modifiques código en esta fase. Si un vacío requiere un ticket nuevo o cruza repositorios, recomienda `/cross-analyze`.

Reporta el estado (`ok`, `attention`, `fail`), el resumen y las acciones concretas.
