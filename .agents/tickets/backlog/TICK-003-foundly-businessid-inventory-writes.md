---
id: "TICK-003"
title: "Foundly: escrituras de inventario omiten el businessId activo y rompen el aislamiento por negocio"
author: "Brain-Corp Analyst"
target_domain: "foundly-pos"
status: "backlog"
created_at: "2026-10-30"
dependencies: []
github_issue: 3
---

## Contexto / Hallazgo

`foundly-pos` soporta múltiples negocios locales mediante `businesses` y `app_settings.activeBusinessId` (`sidecars/foundly-pos/src/db/schema.ts:4-22`) y resuelve el negocio activo con `getActiveBusinessId` (`sidecars/foundly-pos/src/services/businessService.ts:86-95`). Sin embargo, las escrituras del módulo de inventario no son consistentes al fijar `businessId`:

- `createProduct` sí lo fija explícitamente con `getActiveBusinessId()` (`sidecars/foundly-pos/src/modules/inventory/services/inventoryService.ts:36-53`).
- `createProductWithEntry` inserta en `products` sin `businessId` (`inventoryService.ts:236-279`), por lo que la columna aplica el default `DEFAULT_BUSINESS_ID = 'default-business'` (`sidecars/foundly-pos/src/shared/constants/business.ts:1`, `schema.ts:28-30`) en lugar del negocio activo.
- `applyStockIncreaseWithinTx` inserta en `inventory_movements` sin `businessId` y además busca el producto solo por `id`, sin filtrar por negocio (`inventoryService.ts:179-208`). Aquí se apoyan las entradas por ajuste (`registerInventoryEntry`, `inventoryService.ts:281-318`) y el alta con entrada (`createProductWithEntry`).

Consecuencia: si el negocio activo no es `default-business`, un alta con stock inicial o un ajuste de entrada puede crear/actualizar filas atribuidas al negocio por defecto. `listProducts` y `getInventoryValuation` filtran por `getActiveBusinessId()` (`inventoryService.ts:82-90,341-367`), de modo que el producto o movimiento recién creado puede no aparecer en el catálogo ni en la valoración del negocio activo, y la fila de movimiento puede quedar con un `businessId` distinto al del producto. El mismo patrón afecta a `applyStockChange`, que valida el producto por negocio (`inventoryService.ts:115-177`) pero cuya rama de entrada no se usa, ya que `adjustStock` rechaza `IN`.

## Requerimientos Técnicos

1. Propagar `getActiveBusinessId()` como `businessId` explícito en todos los `insert` de inventario: `products` en `createProductWithEntry` y `inventory_movements` en `applyStockIncreaseWithinTx`.
2. Validar que el producto objetivo pertenece al negocio activo en `applyStockIncreaseWithinTx`, incluyendo `eq(products.businessId, businessId)` en el `select` previo y lanzando error si no existe en ese negocio.
3. Unificar las escrituras de stock en un único helper transaccional que siempre fije `businessId` y aplique la validación de pertenencia, evitando ramas con comportamiento divergente.
4. Revisar `inventory_movement_items` y `product_cost_history` para confirmar que sus escrituras derivadas heredan el negocio correcto; documentar la regla si dependen del padre.
5. Definir el tratamiento de filas históricas creadas con el default: auditoría/migración de datos o aceptación explícita si el producto es mononegocio en la práctica.
6. Añadir pruebas que activen un negocio distinto de `default-business` y verifiquen que alta con stock, ajuste de entrada, listado y valoración usan y devuelven el mismo `businessId`.
7. Criterio de aceptación: con `activeBusinessId != 'default-business'`, un alta con entrada y un ajuste generan producto y movimiento con ese `businessId`, aparecen en `listProducts`/`getInventoryValuation`, y no se crean filas en el negocio por defecto.

## Impacto en la Arquitectura

Afecta únicamente `foundly-pos`, dominio `inventory`, en la capa Drizzle/SQLite local-first. No hay dependencia de `forge-backend` ni cambio de esquema; el defecto es de consistencia de datos y aislamiento por negocio.

Riesgos: datos ya existentes con `businessId` incorrecto requerirán decisión de migración; el helper unificado puede tocar llamadas desde el módulo `cash` (`registerStockReplenishment`). Como el esquema usa centavos enteros y valores por defecto en columnas, la corrección debe ser explícita y no depender de defaults. No se requieren tickets adicionales en Forge.
