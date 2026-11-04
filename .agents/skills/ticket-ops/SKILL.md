---
name: ticket-ops
description: Crea, valida, normaliza y sincroniza tickets de brain-corp.
---

# Operaciones de tickets

- Crear: `/analyze <tema>` o `node scripts/hotfix.js`.
- Validar: `node scripts/sanity-check.js --write --json`.
- Publicar: `node scripts/sync-github.js`.
- Importar: `node scripts/sync-pull.js`.
- Normalizar: `node scripts/normalize-ticket.js --auto`.
- Cerrar: `node scripts/complete-ticket.js TICK-XXX [PR]`.

El frontmatter debe incluir `id`, `title`, `author`, `target_domain`, `status`, `created_at` y `dependencies`.
