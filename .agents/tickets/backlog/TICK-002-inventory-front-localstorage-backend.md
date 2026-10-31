---
id: "TICK-002"
title: "Inventario de forge-front opera sobre localStorage sin consumir las mutaciones de forge-backend"
author: "Brain-Corp Analyst"
target_domain: "forge-front"
status: "backlog"
created_at: "2026-10-30"
dependencies: ["TICK-001"]
github_issue: 2
---

## Contexto / Hallazgo

El módulo de inventario de `forge-front` presenta una UI completa (catálogo, ajustes, kardex, almacenes, operaciones, costos en destino, categorías) pero su persistencia es local al navegador. Solo tres llamadas usan GraphQL (`sidecars/forge-front/src/services/inventoryService.ts:10-16,89,117,141`); el resto escribe y lee `localStorage`.

Evidencia de operaciones locales sin backend:

- Plantillas: `createProductTemplate`, `updateProductTemplate`, `deleteProductTemplate` en `sidecars/forge-front/src/services/inventoryService.ts:157-275` solo llaman a `loadStoredTemplates`/`saveStoredTemplates`.
- Ajustes: `applyStockAdjustment` (`inventoryService.ts:294-396`) muta plantillas y genera movimientos en `localStorage`, sin `createInventoryAdjustment`/`applyInventoryAdjustment`.
- Categorías y almacenes: todo `sidecars/forge-front/src/services/inventory/categoryWarehouseService.ts` opera sobre `loadStoredCategories`/`loadStoredWarehouses`.
- Operaciones de almacén: `sidecars/forge-front/src/services/inventory/operationOrdersService.ts:44-347` crea, valida y cancela órdenes localmente, incluyendo recálculo AVCO y movimientos Kardex en cliente.
- Costos en destino: `sidecars/forge-front/src/services/inventory/landedCostService.ts:211-488` calcula prorrateos y aplica capitalización y asiento contable en cliente.
- Almacenamiento: `sidecars/forge-front/src/services/inventory/inventoryStorage.ts:56-226` define las claves `localStorage` de templates, movimientos, ajustes, categorías, almacenes, órdenes y costos.
- Consumo desde vistas: por ejemplo `InventoryAdjustmentsView.tsx:100,187`, `InventoryDetailView.tsx:426`, `WarehouseOperationsListView.tsx:142`, `LandedCostsListView.tsx:87` invocan estos servicios locales.

El backend ya expone la superficie necesaria, sin consumidor en el front:

- `createProductTemplate`/`updateProductTemplate`/`deleteProductTemplate` (`sidecars/forge-backend/src/modules/inventory/resolvers/product-template.resolver.ts:24-45`) y variantes (`product-variant.resolver.ts:29-54`).
- `createProductCategory`/`updateProductCategory`/`deleteProductCategory` (`product-category.resolver.ts:27-49`), almacenes y ubicaciones (`warehouse.resolver.ts:28-41`, `stock-location.resolver.ts`).
- `createWarehouseOperation`/`updateWarehouseOperation`/`scheduleWarehouseOperation`/`markWarehouseOperationReady`/`validateWarehouseOperation`/`cancelWarehouseOperation` (`sidecars/forge-backend/src/modules/inventory/resolvers/warehouse-operation.resolver.ts:49-106`).
- `createInventoryAdjustment`/`updateInventoryAdjustment`/`applyInventoryAdjustment`/`cancelInventoryAdjustment` (`inventory-adjustment.resolver.ts:43-81`).
- `createLandedCost`/`updateLandedCost`/`validateLandedCost`/`cancelLandedCost` (`landed-cost.resolver.ts:40-78`), con capitalización y asiento en servidor.
- `createOrderpoint`/`updateOrderpoint`/`deleteOrderpoint` (`orderpoint.resolver.ts:28-45`).
- KPIs, tasa BCV y settings (`inventory.resolver.ts:103-148`).

Además existen desalineaciones de modelo que impiden un mapeo directo:

- Categorías: el front usa `cuentaIngresosId`, `cuentaGastosId`, `cuentaValoracionInventarioId`, `cuentaCostosDestinoId` (`sidecars/forge-front/src/types/inventoryTypes.ts:306-321`); el backend usa `revenueAccountId`, `expenseAccountId`, `inventoryAccountId`, `landedCostAccountId` (`schema.gql:5074-5085`).
- `productType` en el front es minúscula (`storable`/`consumable`/`service`, `productFormSchema.ts:25`); el enum GraphQL es mayúscula (`STORABLE`/`CONSUMABLE`/`SERVICE`).
- `minStock` (`inventoryTypes.ts:76`, `productFormSchema.ts:37`) no existe en `ProductTemplate`; el backend lo modela vía `Orderpoint` (`orderpoint.resolver.ts`), por lo que requiere crear/actualizar un punto de reorden.
- El alta usa `defaultCode` como SKU maestro (`productFormSchema.ts:23`) y crea variantes embebidas; el backend separa `createProductTemplate` de `createProductVariant` y el SKU vive en `ProductVariant.sku`.
- Etiquetas por nombre (`tags: string[]`) frente a `attachTemplateTag` por `tagId`.
- Importes y cantidades numéricos en el front frente a `Decimal` serializado como `String` en GraphQL (`AGENTS.md` del módulo, Core Principle IV).
- El stock inicial de variantes en cliente (`inventoryService.ts:188-213`) no tiene equivalente en `createProductTemplate`; debe canalizarse por movimiento/ajuste del backend.

Consecuencia: los datos no se comparten entre usuarios ni dispositivos, no se aplican reglas de multi-tenancy, idempotencia, auditoría, outbox, valuación ni contabilidad del backend, y la caché local puede sobrescribir silenciosamente el estado real del servidor.

## Requerimientos Técnicos

1. Implementar una capa de servicios GraphQL para inventario que reemplace la persistencia en `localStorage` como fuente de verdad. Conservar `localStorage` solo como caché de lectura opcional y claramente marcada como no autoritativa.
2. Cablear plantillas y variantes: `createProductTemplate` + `createProductVariant` (con `attributeValueIds`), `updateProductTemplate`/`updateProductVariant`, `deleteProductTemplate`. Mapear `defaultCode`/`barcode` a la variante y `productType` a mayúsculas.
3. Cablear categorías, almacenes y ubicaciones con sus mutaciones, incluyendo el mapeo de cuentas contables `cuenta*` ↔ `revenueAccountId`/`expenseAccountId`/`inventoryAccountId`/`landedCostAccountId`.
4. Cablear ajustes mediante `createInventoryAdjustment` → `applyInventoryAdjustment`/`cancelInventoryAdjustment`, enviando `idempotencyKey` y usando `adjustmentState` como estado autoritativo.
5. Cablear operaciones de almacén con `createWarehouseOperation` y su ciclo `schedule`/`markReady`/`validate`/`cancel`; eliminar el cálculo local de AVCO, Kardex y stock.
6. Cablear costos en destino con `createLandedCost`/`updateLandedCost`/`validateLandedCost`/`cancelLandedCost`; eliminar la generación local de asientos contables.
7. Mapear `minStock` a `Orderpoint` (creación/actualización al guardar el producto) y exponer su lectura en el detalle.
8. Serializar todos los importes/cantidades `Decimal` como `String` y centralizar la conversión en el adaptador, evitando aritmética monetaria en `number` cuando el backend ya la resuelve.
9. Sustituir paginación local por `skip`/`take` y contadores companion; manejar errores GraphQL (permisos, feature gate, validaciones) en la UI en lugar de absorberlos con fallbacks silenciosos.
10. Criterio de aceptación: crear/editar/eliminar un producto, aplicar un ajuste, validar una operación y aplicar un costo en destino desde el front, verificando persistencia en PostgreSQL y que un segundo usuario/dispositivo vea los mismos datos; sin escrituras a `localStorage` como fuente primaria.

## Impacto en la Arquitectura

Afecta `forge-front` en el dominio `inventory` y depende del contrato corregido de TICK-001. Requiere coordinación con `forge-backend` para validar que los inputs cubren los campos de la UI (cuentas por categoría, stock inicial, reorden) y para confirmar permisos `inventory:*`.

Implicaciones: se activa multi-tenancy real, auditoría, outbox y contabilidad server-side; desaparece la divergencia entre el estado del navegador y la base de datos. Riesgos: pérdida de borradores existentes en `localStorage` (evaluar migración o descarte explícito), necesidad de manejar modo offline/degragado en la UI, y cambios transversales en vistas de catálogo, ajustes, operaciones, kardex y costos en destino. Puede requerir tickets adicionales si el backend debe aceptar la creación transaccional plantilla+variantes o el stock inicial en una sola mutación.
