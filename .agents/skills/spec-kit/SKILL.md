---
name: spec-kit
description: Enruta tickets de brain-corp al flujo nativo de spec-kit del sidecar correcto.
---

# spec-kit en brain-corp

1. Lee `config/system-map.json` y `.specify/config.json`.
2. Resuelve el proyecto destino desde el `target_domain` del ticket.
3. Ejecuta el flujo nativo en el sidecar con `workdir`/`cwd`:
   `/speckit.specify`, `speckit.clarify`, `speckit.plan`, `speckit.tasks`, `speckit.implement`.
4. Si el ticket es `shared`, genera una spec por cada sidecar afectado.
5. Conserva `Source Ticket: .agents/tickets/<estado>/TICK-XXX-<slug>.md` dentro de la spec.
