# Plan técnico: {{TICKET_TITLE}}

- **Ticket**: {{SOURCE_TICKET}}
- **Repositorio**: {{REPO_ID}}
- **Dominio**: {{TARGET_DOMAIN}}
- **Spec**: `.brain/features/{{TICKET_ID}}/spec.md`
- **Fecha**: {{DATE}}

## Resumen

Extrae el requisito principal de la spec y la estrategia técnica para cumplirlo.

## Contexto técnico

- **Stack**: [lenguajes, frameworks y versiones relevantes.]
- **Dependencias**: [librerías o servicios y su versión.]
- **Persistencia**: [base de datos, esquema o N/A.]
- **Pruebas**: [framework y comandos de verificación.]
- **Restricciones**: [rendimiento, compatibilidad, seguridad o N/A.]

## Decisiones de arquitectura

- **ADR-001**: [decisión] — [motivo y alternativa descartada.]

## Cambios por capa

| Capa | Archivo o módulo | Cambio |
| --- | --- | --- |
| Datos | [ruta] | [cambio] |
| Dominio o servicio | [ruta] | [cambio] |
| Contrato o API | [ruta] | [cambio] |
| Cliente o UI | [ruta] | [cambio] |

## Integración entre sidecars

Indica si esta feature consume o expone un contrato hacia otros repositorios. Si aplica, enlaza `.brain/features/{{TICKET_ID}}/contract.md`.

## Estrategia de pruebas

- **Unitarias**: [qué se prueba y dónde.]
- **Integración**: [flujo y dependencias.]
- **Manual o E2E**: [pasos de validación.]

## Riesgos y mitigación

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| [riesgo] | [impacto] | [mitigación] |
