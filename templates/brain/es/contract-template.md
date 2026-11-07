# Contrato de integración: {{TICKET_TITLE}}

- **Ticket**: {{SOURCE_TICKET}}
- **Repositorio base**: {{REPO_ID}}
- **Dominio**: {{TARGET_DOMAIN}}
- **Fecha**: {{DATE}}
- **Estado**: Draft

## Alcance entre sidecars

- **Productor**: [repositorio que expone el contrato.]
- **Consumidores**: [repositorios que dependen del contrato.]

## Contrato de datos o API

| Operación | Tipo | Entrada | Salida | Notas |
| --- | --- | --- | --- | --- |
| [nombre] | [REST / GraphQL / evento] | [payload] | [payload] | [notas] |

## Errores y validaciones

- **ERR-001**: [código o caso] — [significado y respuesta esperada.]

## Compatibilidad y versionado

- **Versión**: [semver o esquema.]
- **Estrategia de cambio**: [aditivo, deprecación, migración.]
- **Retrocompatibilidad**: [sí/no y condiciones.]

## Secuencia de integración

1. [Paso en el productor.]
2. [Paso en el consumidor.]
3. [Verificación conjunta.]
