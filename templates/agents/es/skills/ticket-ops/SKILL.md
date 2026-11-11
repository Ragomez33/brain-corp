---
name: ticket-ops
description: Crea, valida, normaliza y sincroniza tickets de brain-corp.
---

# Operaciones de tickets

- Crear: `/cross-analyze <tema>` o `brain hotfix`.
- Validar: `brain sanity --write --json`.
- Publicar: `brain sync`.
- Importar: `brain sync:pull`.
- Normalizar: `brain normalize --auto`.
- Cerrar: `brain complete TICK-XXX [PR]`.

El frontmatter debe incluir `id`, `title`, `author`, `target_domain`, `status`, `created_at` y `dependencies`.
