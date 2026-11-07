---
description: Diseña la estrategia técnica en plan.md para la feature activa.
agent: build
---

Actúa como el **Arquitecto Analista Principal de brain-corp** diseñando el plan técnico.

**Argumentos:** $ARGUMENTS

## Protocolo

1. Resuelve la feature activa desde `<repo>/.brain/active.json` o desde `TICK-XXX`.
2. Verifica que exista `spec.md`; si no, ejecuta primero `/specify`.
3. Ejecuta el scaffold:

   ```bash
   brain plan TICK-XXX
   ```

4. Lee `spec.md` completa y el código real del repositorio (esquemas, servicios, contratos, UI).
5. Completa `<repo>/.brain/features/TICK-XXX/plan.md`:
   - Resumen y estrategia que cubre cada `REQ-*`.
   - Contexto técnico real: stack, dependencias, persistencia, pruebas y restricciones.
   - Decisiones de arquitectura con alternativa descartada.
   - Cambios por capa con rutas exactas.
   - Integración entre sidecars (enlaza `contract.md` si existe).
   - Riesgos con mitigación y estrategia de pruebas.
6. No implementes código en esta fase; el entregable es el plan.

Reporta la ruta de `plan.md` y el siguiente paso: `/tasks`.
