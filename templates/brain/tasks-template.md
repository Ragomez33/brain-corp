# Tareas: {{TICKET_TITLE}}

- **Ticket**: {{SOURCE_TICKET}}
- **Repositorio**: {{REPO_ID}}
- **Plan**: `.brain/features/{{TICKET_ID}}/plan.md`
- **Fecha**: {{DATE}}

## Convenciones

- Cada tarea es atómica y verificable.
- `[P]` indica que puede ejecutarse en paralelo con otras tareas del mismo bloque.
- Referencia siempre la ruta exacta del archivo a modificar.
- Marca `[x]` solo cuando la tarea esté implementada y verificada.

## Tareas

- [ ] T001 [P] [ruta/exacta] Descripción de la tarea.
- [ ] T002 [ruta/exacta] Descripción de la tarea.

## Dependencias

- T002 depende de T001.
- [Si no hay dependencias, escribe "Ninguna".]

## Verificación final

- [ ] Ejecutar pruebas del repositorio.
- [ ] Verificar criterios de aceptación de la spec.
- [ ] Confirmar que no hay desvío de alcance.
