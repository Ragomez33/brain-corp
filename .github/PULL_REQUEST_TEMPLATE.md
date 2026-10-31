## Ticket asociado

Closes #<issue>
Ticket local: `TICK-XXX` (`.agents/tickets/<estado>/TICK-XXX-<slug>.md`)

<!-- Sin ticket no hay merge. Si es un hotfix, enlaza el ticket de emergencia. -->

## Resumen de cambios

<!-- Qué cambia, por qué y qué módulo/dominio afecta. 3-6 líneas. -->

## Riesgos

- [ ] Ninguno identificado
- Riesgos funcionales:
- Riesgos de datos/migración:
- Riesgos de seguridad/multi-tenant:
- Riesgos de compatibilidad de contrato/API:

## Plan de rollback

<!-- Cómo revertir sin pérdida de datos: revert del PR, flag, migración inversa, restauración, etc. -->

## Impacto en especificaciones

- [ ] `Spec impact: none` — no altera comportamiento/contrato gobernado por una spec.
- [ ] `Spec amendment`: referencia a la enmienda en `tasks.md` y a la spec/contrato actualizado.
  - Spec/contrato:
  - Change Log en `tasks.md`:
  - Motivo y comportamiento anterior vs. nuevo:

<!-- Si el cambio altera una spec existente, la enmienda debe venir en este mismo PR. -->

## Validaciones ejecutadas

- [ ] Typecheck / build limpio
- [ ] Tests unitarios
- [ ] Tests e2e o de contrato
- [ ] `npm run sanity` (si el PR toca tickets o gobernanza)
- [ ] Migraciones verificadas (si aplica)
- [ ] Sin secretos ni tokens en el diff

## Checklist de entrega

- [ ] La rama sigue el naming acordado (`<NNN>-<slug>` o `fix/TICK-XXX-<slug>`).
- [ ] El ticket tiene `status` y carpeta coherentes.
- [ ] El PR declara ticket, resumen, riesgos, rollback e impacto en specs.
- [ ] No se reescribe historia compartida (`amend`/`force-push`).
- [ ] Al mergear se ejecutará `/complete TICK-XXX <PR>` o se dejará que `sync:pull` cierre el ticket.
