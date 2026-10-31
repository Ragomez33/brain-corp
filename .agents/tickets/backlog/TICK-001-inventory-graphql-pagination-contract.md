---
id: "TICK-001"
title: "Contrato GraphQL de inventario desalineado: paginación inexistente en templates y kardex"
author: "Brain-Corp Analyst"
target_domain: "forge-front"
status: "backlog"
created_at: "2026-10-30"
dependencies: []
github_issue: 1
---

## Contexto / Hallazgo

El cliente GraphQL de inventario de `forge-front` declara consultas incompatibles con el contrato real que expone `forge-backend`.

- `sidecars/forge-front/src/graphql/inventory.gql.ts:3-59` (`GET_TEMPLATES_QUERY`) consulta `templates(filter: $filter, page: $page, perPage: $perPage) { nodes { ... } pageInfo { ... } }`.
- El esquema generado define `templates(cursor, distinct, orderBy, skip, take, where): [ProductTemplate!]!` (`sidecars/forge-backend/schema.gql:6856`), implementado en `sidecars/forge-backend/src/modules/inventory/resolvers/catalog.resolver.ts:58-63` con `FindManyProductTemplateArgs`. No existen los argumentos `filter`, `page` ni `perPage`, ni el envoltorio `nodes`/`pageInfo`.
- `sidecars/forge-front/src/graphql/inventory.gql.ts:116-150` (`GET_KARDEX_QUERY`) consulta `kardex(variantId, state, page, perPage) { nodes { ... } pageInfo { ... } }`.
- El esquema define `kardex(cursor, distinct, orderBy, skip, state, take, variantId, where): [StockMove!]!` (`sidecars/forge-backend/schema.gql:6723`) e implementa la query en `sidecars/forge-backend/src/modules/inventory/resolvers/stock-move.resolver.ts:116-126`. También aquí sobran `page`, `perPage` y el envoltorio `nodes`/`pageInfo`.
- Los DTO `GqlKardexPage` y `GqlPageInfo` (`sidecars/forge-front/src/types/inventoryDto.ts:92-102`) y los tipos de respuesta en `sidecars/forge-front/src/services/inventoryService.ts:89-93,141-145` asumen ese contrato paginado que el backend no ofrece.

Consecuencia: ambas operaciones son rechazadas por el servidor por argumentos/campos inexistentes. El error queda silenciado por los `catch` de `getInventoryTemplates` (`inventoryService.ts:87-110`) y `getVariantKardex` (`inventoryService.ts:139-155`), que caen al almacenamiento local o devuelven `[]`. Así, el front aparenta funcionar con datos locales mientras la lectura real del backend nunca se ejecuta.

Hallazgo secundario: `GET_TEMPLATES_QUERY` no solicita `attribute.values`, pero el adaptador lee `attrRel.attribute.values` (`sidecars/forge-front/src/services/adapters/inventoryAdapter.ts:30-37`), por lo que en el listado los atributos quedan sin valores. `GET_TEMPLATE_BY_ID_QUERY` sí los pide, generando paridad inconsistente entre listado y detalle.

## Requerimientos Técnicos

1. Reescribir `GET_TEMPLATES_QUERY` contra el contrato generado: `templates(where: ProductTemplateWhereInput, orderBy: [ProductTemplateOrderByWithRelationInput!], skip: Int, take: Int)` y consumir el arreglo `[ProductTemplate!]!` directamente, sin `nodes` ni `pageInfo`.
2. Reescribir `GET_KARDEX_QUERY` con `kardex(variantId: ID!, state: MoveState, where: StockMoveWhereInput, orderBy: [...], skip: Int, take: Int): [StockMove!]!`, eliminando `page`/`perPage` y el envoltorio `nodes`.
3. Sustituir la paginación por wrapper usando las queries companion ya existentes: `inventoryTemplateCount` (`catalog.resolver.ts:47-56`) e `inventoryKardexCount` (`stock-move.resolver.ts:128-137`) para calcular `totalCount`, `hasNextPage` y páginas en el cliente.
4. Actualizar `GqlKardexPage`, `GqlPageInfo` y los tipos de respuesta de `inventoryService` para reflejar arreglos planos y contadores companion; ajustar `getInventoryTemplates` y `getVariantKardex` para dejar de esperar `.nodes`.
5. Incluir `attribute { values { id name htmlColor } }` en `GET_TEMPLATES_QUERY` para que el adaptador reciba los mismos datos que en el detalle.
6. Verificar que `ProductTemplateWhereInput`, `ProductTemplateOrderByWithRelationInput` y `StockMoveWhereInput` cubren los filtros usados por la UI (categoría, tipo de producto, estado de movimiento, rango de fechas); si falta algún filtro, ajustar la UI o solicitar su incorporación al backend.
7. Criterio de aceptación: ejecutar las tres queries contra `forge-backend` real (o esquema mock derivado de `schema.gql`) sin errores de validación y con datos paginados correctos; un test de contrato que falle si se reintroduce el envoltorio `nodes`/`pageInfo` o argumentos no declarados.

## Impacto en la Arquitectura

Afecta la capa de contrato GraphQL entre `forge-front` y `forge-backend` en el dominio `inventory`. Es prerrequisito para cualquier migración real de las vistas de inventario al backend: mientras las queries sean inválidas, el front seguirá operando contra `localStorage` y ocultará el fallo de integración.

Riesgos: cambios en DTO y servicios pueden repercutir en `InventoryCatalogView`, `InventoryKardexView`, `InventoryDetailView` y el adaptador `inventoryAdapter.ts`, que hoy toleran respuestas incompletas. No requiere cambios de esquema ni migraciones de datos. Dependencia bloqueante para TICK-002 (migración del CRUD y operaciones a GraphQL).
