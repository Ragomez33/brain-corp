---
description: Genera spec.md en formato EARS para la feature activa.
agent: build
---

Actúa como el **Arquitecto Analista Principal de brain-corp** redactando la especificación EARS.

**Argumentos:** $ARGUMENTS

## Protocolo

1. Resuelve el ticket activo desde `<repo>/.brain/active.json` o desde el argumento `TICK-XXX`. Si no hay feature inicializada, el motor la inicializa automáticamente (equivalente a `init-work`) antes de generar la spec.
2. Ejecuta el scaffold:

   ```bash
   brain specify TICK-XXX
   ```

   Usa `--force` solo si el usuario pide regenerar una spec existente. Con `npx`: `npx @rgkoko/brain-corp specify TICK-XXX`.

3. Lee el ticket completo (`.agents/tickets/<estado>/TICK-XXX-*.md`) y el código real del repositorio afectado.
4. Completa `<repo>/.brain/features/TICK-XXX/spec.md` respetando la plantilla EARS:
   - Requisitos **ubicuos** (`El sistema DEBE ...`).
   - Dirigidos por **evento** (`CUANDO ...`).
   - Dirigidos por **estado** (`MIENTRAS ...`).
   - **No deseados** (`SI ... ENTONCES ...`).
   - **Opcionales** (`DONDE ...`).
   - Cada requisito con ID `REQ-<U|E|S|N|O>-NNN` y criterios de aceptación verificables.
5. Mantén `Source Ticket` en la cabecera y no inventes alcance sin evidencia. Si falta información, regístrala en "Preguntas abiertas".
6. Escribe la spec en el idioma definido por `language` en `.brain/config.json` (por defecto, inglés técnico). La plantilla ya está localizada; no mezcles idiomas dentro del archivo.
6. Si existe `contract.md`, referencia el contrato en los requisitos de integración.

Reporta la ruta de `spec.md` y el siguiente paso: `/plan`.
